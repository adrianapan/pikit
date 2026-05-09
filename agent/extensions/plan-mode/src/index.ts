/** Plan Mode — toggle via /plan or Ctrl+Alt+P. PLAN: read-only. EXECUTE: tools restored + [DONE:n] tracking. */

import type {
  ExtensionAPI,
  ExtensionContext,
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
  ToolCallEvent,
  ToolCallEventResult,
  AgentEndEvent,
  TurnEndEvent,
} from "@mariozechner/pi-coding-agent";
import { PLAN_MODE_TOOLS, PLAN_MODE_PROMPT, buildExecutePrompt, buildRefinePrompt } from "./config.js";
import { isSafeCommand, extractPlanSteps, markCompletedSteps } from "./utils.js";
import type { TodoItem } from "./utils.js";
import { getMode, getRefining, setRefining, getTodos, transition, setTodos, restore, resetState } from "./state.js";

export default function planMode(pi: ExtensionAPI) {
  // ─── Saved tool list for restoring ────────────────────────────────────────
  let savedToolNames: string[] | null = null;

  function saveAndSetActiveTools(toolNames: string[]): void {
    if (savedToolNames === null) {
      savedToolNames = pi.getAllTools().map((t) => t.name);
    }
    pi.setActiveTools(toolNames);
  }

  function restoreAllTools(): void {
    if (savedToolNames !== null) {
      pi.setActiveTools(savedToolNames);
      savedToolNames = null;
    } else {
      // Fallback: restore all known tools
      pi.setActiveTools(pi.getAllTools().map((t) => t.name));
    }
  }

  // ─── UI helpers ────────────────────────────────────────────────────────────

  function updateStatus(ctx: ExtensionContext): void {
    if (!ctx.hasUI) return;
    const mode = getMode();
    const todos = getTodos();

    if (mode === "plan") {
      ctx.ui.setStatus("plan-mode", "⏸ PLAN");
      ctx.ui.setWidget("plan-mode", ["⏸ Plan Mode — read-only"]);
    } else if (mode === "execute") {
      const done = todos.filter((t) => t.completed).length;
      const total = todos.length;
      ctx.ui.setStatus("plan-mode", `📋 ${done}/${total}`);
      ctx.ui.setWidget("plan-mode", renderTodoList(todos));
    } else {
      ctx.ui.setStatus("plan-mode", undefined);
      ctx.ui.setWidget("plan-mode", undefined);
    }

    pi.events.emit("plan-mode:state", { mode });
  }

  function renderTodoList(todos: TodoItem[]): string[] {
    return todos.map((t) => `${t.completed ? "☑" : "☐"} ${t.step}. ${t.text}`);
  }

  // ─── State transitions ─────────────────────────────────────────────────────

  function enterPlanMode(ctx: ExtensionContext): void {
    transition("plan", pi);
    saveAndSetActiveTools(PLAN_MODE_TOOLS);
    updateStatus(ctx);
    if (ctx.hasUI) ctx.ui.notify("Plan mode ON — read-only, explore and plan", "info");
  }

  function enterExecuteMode(ctx: ExtensionContext): void {
    transition("execute", pi);
    restoreAllTools();
    updateStatus(ctx);
  }

  function enterOffMode(ctx: ExtensionContext): void {
    transition("off", pi);
    restoreAllTools();
    updateStatus(ctx);
    if (ctx.hasUI) ctx.ui.notify("Plan mode OFF", "info");
  }

  // ─── Re-derive state from entries on the current branch ──────────────────────

  function syncStateFromBranch(ctx: ExtensionContext): void {
    const branch = ctx.sessionManager.getBranch();
    const restored = restore(branch);

    if (!restored) {
      // No plan-mode entry on this branch — reset to off
      resetState();
      restoreAllTools();
      updateStatus(ctx);
      return;
    }

    if (getMode() === "plan") {
      saveAndSetActiveTools(PLAN_MODE_TOOLS);
    } else if (getMode() === "execute") {
      // Re-scan messages for [DONE:n] markers to rebuild completion state
      const todos = getTodos();
      for (const entry of branch) {
        if (entry.type === "message") {
          const text = extractTextFromMessage(entry.message as Record<string, unknown>);
          if (text) markCompletedSteps(text, todos);
        }
      }
    }

    updateStatus(ctx);
  }

  // ─── Event: session_start ──────────────────────────────────────────────────

  pi.on("session_start", async (event, ctx) => {
    // Handle --plan flag: start in plan mode on initial startup
    if (event.reason === "startup" && pi.getFlag("plan") === true && getMode() === "off") {
      enterPlanMode(ctx);
      return;
    }

    syncStateFromBranch(ctx);
  });

  // ─── Event: before_agent_start ──────────────────────────────────────────────

  pi.on("before_agent_start", (event: BeforeAgentStartEvent): BeforeAgentStartEventResult => {
    const mode = getMode();

    if (mode === "plan") {
      if (getRefining()) {
        const todos = getTodos();
        if (todos.length > 0) {
          return { systemPrompt: event.systemPrompt + "\n\n" + buildRefinePrompt(todos) };
        }
      }
      return { systemPrompt: event.systemPrompt + "\n\n" + PLAN_MODE_PROMPT };
    }

    if (mode === "execute") {
      const todos = getTodos();
      const incomplete = todos.filter((t) => !t.completed);
      if (incomplete.length === 0) return {};
      return { systemPrompt: event.systemPrompt + "\n\n" + buildExecutePrompt(incomplete) };
    }

    return {};
  });

  // ─── Event: tool_call (block unsafe bash in PLAN mode) ─────────────────────

  pi.on("tool_call", (event: ToolCallEvent): ToolCallEventResult => {
    if (getMode() !== "plan") return {};
    if (event.toolName !== "bash") return {};

    const command = event.input.command as string;
    if (isSafeCommand(command)) return {};

    return {
      block: true,
      reason: `[plan-mode] Command blocked — destructive or unknown command in plan mode: ${command}`,
    };
  });

  // ─── Event: turn_end (scan for [DONE:n] in EXECUTE mode) ─────────────────

  pi.on("turn_end", async (event, ctx) => {
    if (getMode() !== "execute") return;

    const todos = getTodos();
    const text = extractTextFromMessage(event.message);
    if (!text) return;

    const newlyCompleted = markCompletedSteps(text, todos);
    if (newlyCompleted > 0) {
      setTodos(todos, pi);
      updateStatus(ctx);
    }

    // Check if all done
    if (todos.length > 0 && todos.every((t) => t.completed)) {
      if (ctx.hasUI) ctx.ui.notify("All plan steps complete!", "success");
      enterOffMode(ctx);
    }
  });

  // ─── Event: agent_end (extract plan steps in PLAN mode) ────────────────────

  pi.on("agent_end", async (event: AgentEndEvent, ctx: ExtensionContext) => {
    if (getMode() !== "plan") return;
    if (!ctx.hasUI) return;

    // Get the last assistant message
    const lastAssistant = [...event.messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;

    const text = extractTextFromMessage(lastAssistant);
    if (!text) return;

    const steps = extractPlanSteps(text);
    if (steps.length === 0) return; // No plan extracted yet — skip ui.select

    setRefining(false, pi);
    setTodos(steps, pi);

    const choice = await ctx.ui.select(
      "Plan extracted. What next?",
      ["Execute plan", "Refine", "Stay in plan mode"],
    );

    if (choice === "Execute plan") {
      enterExecuteMode(ctx);
      pi.sendUserMessage("Execute the plan steps now.");
    } else if (choice === "Refine") {
      setRefining(true, pi);
      updateStatus(ctx);
    }
    // "Stay in plan mode" or undefined (cancelled) — do nothing
  });

  // ─── Event: session_tree ──────────────────────────────────────────────────

  pi.on("session_tree", async (_event, ctx) => {
    syncStateFromBranch(ctx);
  });

  // ─── Command: /plan [on|off|execute|status] ─────────────────────────────────

  pi.registerCommand("plan", {
    description: "Toggle plan mode. Subcommands: on · off · execute · status. No args: toggle on/off.",
    handler: async (args: string, ctx) => {
      const sub = args.trim().toLowerCase();

      if (sub === "on") {
        if (getMode() === "plan") {
          ctx.ui.notify("Already in plan mode", "info");
          return;
        }
        // Force plan mode, clear previous todos
        enterPlanMode(ctx);
      } else if (sub === "off") {
        if (getMode() === "off") {
          ctx.ui.notify("Plan mode is already off", "info");
          return;
        }
        enterOffMode(ctx);
      } else if (sub === "execute") {
        if (getMode() !== "plan") {
          ctx.ui.notify("Must be in plan mode first. Use /plan on", "warning");
          return;
        }
        const todos = getTodos();
        if (todos.length === 0) {
          ctx.ui.notify("No plan steps to execute yet. Create a plan first.", "warning");
          return;
        }
        enterExecuteMode(ctx);
        pi.sendUserMessage("Execute the plan steps now.");
      } else if (sub === "status") {
        const mode = getMode();
        const todos = getTodos();
        if (mode === "off") {
          ctx.ui.notify("Plan mode is OFF", "info");
        } else if (mode === "plan") {
          ctx.ui.notify(todos.length > 0
            ? `Plan mode ON — ${todos.length} step(s) planned`
            : "Plan mode ON — no plan yet", "info");
        } else {
          const done = todos.filter((t) => t.completed).length;
          ctx.ui.notify(`Execute mode — ${done}/${todos.length} steps done`, "info");
        }
      } else {
        // Toggle: OFF↔PLAN, EXECUTE→OFF
        const current = getMode();
        if (current === "off") {
          enterPlanMode(ctx);
        } else {
          enterOffMode(ctx);
        }
      }
    },
  });

  // ─── Shortcut: Ctrl+Alt+P ─────────────────────────────────────────────────

  pi.registerShortcut("ctrl+alt+p", {
    description: "Toggle plan mode",
    handler: async (ctx) => {
      const current = getMode();
      if (current === "off") {
        enterPlanMode(ctx);
      } else {
        enterOffMode(ctx);
      }
    },
  });

  // ─── Flag: --plan ──────────────────────────────────────────────────────────

  pi.registerFlag("plan", {
    type: "boolean",
    description: "Start in plan mode (read-only, explore and plan)",
  });
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractTextFromMessage(message: Record<string, unknown>): string | null {
  const content = message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((block: unknown): block is { type: string; text?: string } =>
        typeof block === "object" && block !== null && "type" in block && (block as { type: string }).type === "text",
      )
      .map((block) => block.text ?? "")
      .join("\n");
  }
  return null;
}