/** Plan Mode — toggle via /plan or Ctrl+Alt+P. PLAN: read-only. EXECUTE: tools restored + plan_complete signal. Plan files stored in .pi/plans/. */

import type {
  ExtensionAPI,
  ExtensionContext,
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
  ToolCallEvent,
  ToolCallEventResult,
  ToolResultEvent,
  AgentEndEvent,
} from "@mariozechner/pi-coding-agent";
import { DynamicBorder } from "@mariozechner/pi-coding-agent";

import { PLAN_MODE_TOOLS, PLAN_MODE_PROMPT, PLAN_FILE_PREFIX, PLAN_DIR, buildExecutePrompt, buildRefinePrompt } from "./config.js";
import {
  isSafeCommand,
  extractPlanText,
  ensurePlanDir,
  titleFromFilename,
  listPlanFiles,
  sanitizePlanName,
  extractTextFromMessage,
} from "./utils.js";
import { Container, Input, Text, Spacer, matchesKey, Key, type Component } from "@earendil-works/pi-tui";
import { getMode, getRefining, setRefining, getActivePlanFile, setActivePlanFile, transition, enterPlanWithFile, restore, resetState } from "./state.js";
import { join } from "node:path";
import { existsSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";

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
      pi.setActiveTools(pi.getAllTools().map((t) => t.name));
    }
  }

  /** Get absolute path to the active plan file, or null if none set. */
  function getPlanFilePath(): string | null {
    const file = getActivePlanFile();
    if (!file) return null;
    return join(process.cwd(), PLAN_DIR, file);
  }

  /** Get a display title for the active plan.
   *  Tries # Plan: heading from file, falls back to titleFromFilename. */
  function getPlanDisplayTitle(): string | null {
    const file = getActivePlanFile();
    if (!file) return null;
    const filePath = getPlanFilePath();
    if (filePath && existsSync(filePath)) {
      const heading = readFileSync(filePath, "utf-8").match(/^# Plan:\s*(.+)$/m);
      if (heading) return heading[1].trim();
    }
    return titleFromFilename(file);
  }

  // ─── UI helpers ────────────────────────────────────────────────────────────

  function updateStatus(ctx: ExtensionContext): void {
    if (!ctx.hasUI) return;
    const mode = getMode();

    if (mode === "plan") {
      const title = getPlanDisplayTitle();
      ctx.ui.setStatus("plan-mode", title ? `Plan: ${title}` : "Plan");
      ctx.ui.setWidget("plan-mode", title ? [`⏸ Plan: ${title}`] : ["⏸ Plan Mode"]);
    } else if (mode === "execute") {
      const title = getPlanDisplayTitle();
      ctx.ui.setStatus("plan-mode", title ? `Executing plan: ${title}` : "Executing plan");
      ctx.ui.setWidget("plan-mode", title ? [`📋 Executing plan: ${title}`] : ["📋 Executing plan"]);
    } else {
      ctx.ui.setStatus("plan-mode", undefined);
      ctx.ui.setWidget("plan-mode", undefined);
    }

    pi.events.emit("plan-mode:state", { mode });
  }

  // ─── State transitions ─────────────────────────────────────────────────────

  function enterPlanMode(ctx: ExtensionContext): void {
    transition("plan", pi);
    saveAndSetActiveTools(PLAN_MODE_TOOLS);
    updateStatus(ctx);
    if (ctx.hasUI) ctx.ui.notify("Plan mode ON", "info");
  }

  function enterExecuteMode(ctx: ExtensionContext): void {
    transition("execute", pi);
    restoreAllTools();
    updateStatus(ctx);
    const title = getPlanDisplayTitle();
    if (ctx.hasUI) ctx.ui.notify(title ? `Executing plan: ${title}` : "Executing plan", "info");
  }

  function enterOffMode(ctx: ExtensionContext, message?: string): void {
    transition("off", pi);
    restoreAllTools();
    updateStatus(ctx);
    if (ctx.hasUI) ctx.ui.notify(message ?? "Plan mode OFF", "info");
  }

  // ─── Re-derive state from entries on the current branch ──────────────────────

  function syncStateFromBranch(ctx: ExtensionContext): void {
    const branch = ctx.sessionManager.getBranch();
    const restored = restore(branch);

    if (!restored) {
      resetState();
      restoreAllTools();
      updateStatus(ctx);
      return;
    }

    // Check if active plan file was deleted externally
    const filePath = getPlanFilePath();
    if (getActivePlanFile() && filePath && !existsSync(filePath)) {
      if (ctx.hasUI) ctx.ui.notify(`Plan file "${getActivePlanFile()}" not found — disabling plan mode.`, "warning");
      enterOffMode(ctx);
      return;
    }

    if (getMode() === "plan") {
      saveAndSetActiveTools(PLAN_MODE_TOOLS);
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
        const filePath = getPlanFilePath();
        if (filePath && existsSync(filePath)) {
          const planContent = readFileSync(filePath, "utf-8");
          return { systemPrompt: event.systemPrompt + "\n\n" + buildRefinePrompt(planContent) };
        }
      }
      return { systemPrompt: event.systemPrompt + "\n\n" + PLAN_MODE_PROMPT };
    }

    if (mode === "execute") {
      const filePath = getPlanFilePath();
      if (!filePath || !existsSync(filePath)) return {};
      const planContent = readFileSync(filePath, "utf-8");
      return { systemPrompt: event.systemPrompt + "\n\n" + buildExecutePrompt(planContent) };
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

  // ─── Tool: plan_complete ────────────────────────────────────────────────────

  pi.registerTool({
    name: "plan_complete",
    label: "Plan Complete",
    description: "Signal that all plan steps have been executed. Call this once after finishing the final step. This exits execute mode.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    async execute() {
      return {
        content: [{ type: "text", text: "Plan complete. Exiting execute mode." }],
        details: { planComplete: true },
      };
    },
  });

  // ─── Event: tool_result (process plan_complete results) ────────────────────

  pi.on("tool_result", (event: ToolResultEvent, ctx: ExtensionContext): void => {
    if (event.toolName !== "plan_complete") return;
    if (getMode() !== "execute") return;
    enterOffMode(ctx, "Plan implemented. Plan mode OFF.");
  });

  // ─── Event: agent_end (extract plan text in PLAN mode) ────────────────────

  pi.on("agent_end", async (event: AgentEndEvent, ctx: ExtensionContext) => {
    if (getMode() !== "plan") return;
    if (!ctx.hasUI) return;

    // Get the last assistant message
    const lastAssistant = [...event.messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;

    const text = extractTextFromMessage(lastAssistant);
    if (!text) return;

    const planText = extractPlanText(text);

    setRefining(false);

    // Write plan file if plan text was found
    if (planText) {
      const planDir = ensurePlanDir();
      const activeFile = getActivePlanFile();
      let filename = activeFile;
      if (!filename) {
        // Generate timestamp filename
        const ts = new Date().toISOString().replace(/[T:]/g, "-").slice(0, 16);
        filename = `${PLAN_FILE_PREFIX}${ts}.md`;
        setActivePlanFile(filename, pi);
      }
      const filePath = join(planDir, filename);
      const title = titleFromFilename(filename);
      const content = `# Plan: ${title}\n\n${planText}\n`;
      writeFileSync(filePath, content, "utf-8");
      updateStatus(ctx);
    }

    await showPlanMenu(ctx)
  });

  // ─── Event: session_tree ──────────────────────────────────────────────────

  pi.on("session_tree", async (_event, ctx) => {
    syncStateFromBranch(ctx);
  });

  /** Prompt user for optional plan name, then enter plan mode. Uses timestamp if no name given. Returns false if cancelled or invalid. */
  async function promptNameAndEnterPlanMode(ctx: ExtensionContext): Promise<boolean> {
    const nameInput = await ctx.ui.custom<string | undefined>((tui, theme, _kb, done) => {
      const input = new Input();
      input.onSubmit = (value) => done(value);

      const border = new DynamicBorder((s: string) => theme.fg("accent", s));
      const label = new Text(theme.fg("accent", "Plan name ") + theme.fg("dim", "(optional, leave empty for timestamp)"), 1, 0);
      const indent = 1;

      const container = new Container();
      container.addChild(border);
      container.addChild(new Spacer());
      container.addChild(label);
      container.addChild(new Spacer());
      const indentedInput: Component = {
        render: (w: number) => input.render(w - indent).map(line => " ".repeat(indent) + line),
        invalidate: () => input.invalidate(),
      };
      container.addChild(indentedInput);
      container.addChild(new Spacer());
      container.addChild(new Text(theme.fg("dim", "enter") + theme.fg("muted", " to submit") + theme.fg("dim", " • ") + theme.fg("dim", "esc") + theme.fg("muted", " to cancel"), 1, 0));
      container.addChild(new Spacer());
      container.addChild(border);

      input.focused = true;

      return {
        render(width: number) { return container.render(width); },
        invalidate() { container.invalidate(); },
        handleInput(data: string) {
          if (matchesKey(data, Key.escape)) { done(undefined); return; }
          input.handleInput(data);
          tui.requestRender();
        },
      };
    });

    if (nameInput === undefined) return false; // cancelled
    const trimmed = nameInput.trim();
    if (trimmed) {
      const sanitized = sanitizePlanName(trimmed);
      if (!sanitized) {
        ctx.ui.notify("Invalid plan name. Use letters, numbers, hyphens, underscores, spaces, and dots only.", "warning");
        return false;
      }
      const filename = `${PLAN_FILE_PREFIX}${sanitized}.md`;
      enterPlanWithFile(filename, pi);
      saveAndSetActiveTools(PLAN_MODE_TOOLS);
      updateStatus(ctx);
      const createTitle = titleFromFilename(filename);
      if (ctx.hasUI) ctx.ui.notify(`Plan mode ON — creating plan "${createTitle}"`, "info");
    } else {
      enterPlanMode(ctx);
    }
    return true;
  }

  /** Show the plan action menu: Execute, Refine, Save & Exit, Discard & Exit. */
  async function showPlanMenu(ctx: ExtensionContext): Promise<void> {
    while (true) {
      const choice = await ctx.ui.select(
        "Plan is ready. How'd you like to proceed?",
        ["Execute", "Refine", "Save & Exit", "Discard & Exit"],
      );

      if (choice === "Execute") {
        enterExecuteMode(ctx);
        pi.sendUserMessage("Execute the plan steps now.");
        return;
      } else if (choice === "Refine") {
        setRefining(true);
        updateStatus(ctx);
        return;
      } else if (choice === "Save & Exit") {
        enterOffMode(ctx, "Plan saved. Plan mode OFF.");
        return;
      } else if (choice === "Discard & Exit") {
        const confirmed = await ctx.ui.select(
          "Are you sure?",
          ["Yes, discard", "Cancel"],
        );
        if (confirmed === "Yes, discard") {
          const filePath = getPlanFilePath();
          if (filePath && existsSync(filePath)) unlinkSync(filePath);
          setActivePlanFile(null, pi);
          enterOffMode(ctx, "Plan discarded. Plan mode OFF.");
          return;
        }
        // Cancel — re-show plan menu
      } else {
        // Escaped menu — re-show plan menu
      }
    }
  }

  /** Load an existing plan file and show the action menu. */
  function loadPlanAndShowMenu(ctx: ExtensionContext, filename: string, displayName: string): void {
    enterPlanWithFile(filename, pi);
    saveAndSetActiveTools(PLAN_MODE_TOOLS);
    updateStatus(ctx);
    ctx.ui.notify(`Loaded plan: ${displayName}`, "info");

    const filePath = join(process.cwd(), PLAN_DIR, filename);
    if (existsSync(filePath)) {
      const planContent = readFileSync(filePath, "utf-8");
      pi.sendMessage({
        customType: "plan-mode",
        content: planContent,
        display: true,
      });
    }
  }

  // ─── Message renderer for plan-mode ────────────────────────────────────────

  pi.registerMessageRenderer("plan-mode", (message, _options, theme) => {
    const box = new DynamicBorder((s: string) => theme.fg("accent", s));
    box.addChild(new Text(theme.fg("accent", "📄 " + (message.content as string).split("\n")[0])));
    const body = (message.content as string).split("\n").slice(1).join("\n");
    if (body) {
      box.addChild(new Spacer());
      box.addChild(new Text(body));
    }
    return box;
  });

  // ─── Command: /plan [off|<name>] ──────────────────────────────────────────

  pi.registerCommand("plan", {
    description: "Plan mode: /plan (toggle) · /plan <name> (load existing or create new) · /plan off",
    handler: async (args: string, ctx) => {
      const input = args.trim();

      if (!input) {
        // Toggle: OFF (with picker if plans exist)↔PLAN, EXECUTE→OFF
        const current = getMode();
        if (current === "off") {
          const files = listPlanFiles();
          if (files.length === 0) {
            await promptNameAndEnterPlanMode(ctx);
          } else {
            const options = ["Create new plan", ...files.map((f) => f.title)];
            const choice = await ctx.ui.select("Select a plan or create a new one:", options);
            if (choice === undefined) return; // cancelled
            if (choice === "Create new plan") {
              await promptNameAndEnterPlanMode(ctx);
            } else {
              const idx = options.indexOf(choice) - 1; // offset for "Create new" option
              if (idx >= 0 && idx < files.length) {
                const file = files[idx];
                loadPlanAndShowMenu(ctx, file.name, file.title);
                await showPlanMenu(ctx);
              }
            }
          }
        } else {
          enterOffMode(ctx);
        }
      } else if (input.toLowerCase() === "off") {
        if (getMode() === "off") {
          ctx.ui.notify("Plan mode is already off", "info");
          return;
        }
        enterOffMode(ctx);
      } else {
        // Treat input as plan name: load existing → execute, or create new → plan mode
        const sanitized = sanitizePlanName(input);
        if (!sanitized) {
          ctx.ui.notify("Invalid plan name. Use letters, numbers, hyphens, underscores, spaces, and dots only.", "warning");
          return;
        }
        const filename = `${PLAN_FILE_PREFIX}${sanitized}.md`;
        const filePath = join(process.cwd(), PLAN_DIR, filename);

        if (existsSync(filePath)) {
          // Load existing plan → show action menu
          loadPlanAndShowMenu(ctx, filename, titleFromFilename(filename));
          await showPlanMenu(ctx);
        } else {
          // New plan → plan mode
          if (getMode() === "plan") {
            ctx.ui.notify("Already in plan mode", "info");
            return;
          }
          enterPlanWithFile(filename, pi);
          saveAndSetActiveTools(PLAN_MODE_TOOLS);
          updateStatus(ctx);
          if (ctx.hasUI) ctx.ui.notify(`Plan mode ON — creating plan "${titleFromFilename(filename)}"`, "info");
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

