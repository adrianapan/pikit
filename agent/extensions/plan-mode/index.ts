/** Plan Mode — toggle via /plan command or configurable shortcut. PLAN: read-only. EXECUTE: tools restored + plan_complete signal. Plan files stored in .pi/plans/. */

import type {
  ExtensionAPI,
  ExtensionContext,
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
  ToolCallEvent,
  ToolCallEventResult,
  ToolResultEvent,
  AgentEndEvent,
} from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { Container, Input, Text, Spacer, matchesKey, Key, type KeyId, type Component, type SelectItem } from "@earendil-works/pi-tui";
import { join } from "node:path";
import { existsSync, writeFileSync, readFileSync, unlinkSync } from "node:fs";

import { PLAN_MODE_TOOLS, PLAN_MODE_PROMPT, PLAN_FILE_PREFIX, PLAN_DIR, buildExecutePrompt, buildRefinePrompt, USER_CONFIG } from "./config.js";
import {
  isSafeCommand,
  extractPlanText,
  isPlanLike,
  ensurePlanDir,
  titleFromFilename,
  listPlanFiles,
  sanitizePlanName,
  extractTextFromMessage,
  applyLabelColor,
} from "./utils.js";
import { getMode, getRefining, setRefining, getActivePlanFile, setActivePlanFile, transition, enterPlanWithFile, restore, resetState } from "./state.js";
import { showSelectMenu } from "./menus.js";

export default function planMode(pi: ExtensionAPI) {
  // ─── Saved tool list for restoring ────────────────────────────────────────
  let savedToolNames: string[] | null = null;

  function saveAndSetActiveTools(toolNames: string[]): void {
    if (savedToolNames === null) {
      savedToolNames = pi.getAllTools().map((t) => t.name);
    }
    pi.setActiveTools(toolNames);
  }

  /** Tool names from the registry, excluding plan_complete (only available in execute mode). */
  function toolsWithoutPlanComplete(names: string[]): string[] {
    return names.filter((n) => n !== "plan_complete");
  }

  function restoreAllTools(): void {
    if (savedToolNames !== null) {
      pi.setActiveTools(toolsWithoutPlanComplete(savedToolNames));
      savedToolNames = null;
    } else {
      pi.setActiveTools(toolsWithoutPlanComplete(pi.getAllTools().map((t) => t.name)));
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
      const widgetText = title
        ? USER_CONFIG.labels.plan.widgetWithTitle.replace("{title}", title)
        : USER_CONFIG.labels.plan.widget;
      ctx.ui.setWidget("plan-mode", USER_CONFIG.ui.hideWidget ? undefined : [applyLabelColor(ctx.ui.theme, USER_CONFIG.labels.plan.widgetColor, widgetText)]);
    } else if (mode === "execute") {
      const title = getPlanDisplayTitle();
      const widgetText = title
        ? USER_CONFIG.labels.execute.widgetWithTitle.replace("{title}", title)
        : USER_CONFIG.labels.execute.widget;
      ctx.ui.setWidget("plan-mode", USER_CONFIG.ui.hideWidget ? undefined : [applyLabelColor(ctx.ui.theme, USER_CONFIG.labels.execute.widgetColor, widgetText)]);
    } else {
      ctx.ui.setWidget("plan-mode", undefined);
    }

    pi.events.emit("plan-mode:state", { mode });
  }

  // ─── State transitions ─────────────────────────────────────────────────────

  /** Mutual-exclusion guard: chat + plan cannot co-activate (undefined = chat-mode ext not loaded = allowed). Returns true if chat is active (caller must abort). */
  function chatActive(ctx: ExtensionContext): boolean {
    const chatMode = (globalThis as Record<string, unknown>).__chatMode as { mode?: string } | undefined;
    if (chatMode?.mode && chatMode.mode !== "off") {
      if (ctx.hasUI) ctx.ui.notify("Exit chat mode first", "warning");
      return true;
    }
    return false;
  }

  function enterPlanMode(ctx: ExtensionContext): void {
    // Mutual-exclusion guard: chat + plan cannot co-activate
    if (chatActive(ctx)) return;
    transition("plan", pi);
    saveAndSetActiveTools(PLAN_MODE_TOOLS);
    updateStatus(ctx);
    if (ctx.hasUI && !USER_CONFIG.ui.hideNotify) ctx.ui.notify(USER_CONFIG.labels.plan.notify, USER_CONFIG.labels.plan.notifyType as "info" | "warning" | "error");
  }

  function enterExecuteMode(ctx: ExtensionContext): void {
    transition("execute", pi);
    // Restore all tools AND include plan_complete (only available during execute mode)
    const baseNames = savedToolNames ?? pi.getAllTools().map((t) => t.name);
    pi.setActiveTools([...toolsWithoutPlanComplete(baseNames), "plan_complete"]);
    savedToolNames = null;
    updateStatus(ctx);
    const title = getPlanDisplayTitle();
    const notifyText = title
      ? USER_CONFIG.labels.execute.notifyWithTitle.replace("{title}", title)
      : USER_CONFIG.labels.execute.notify;
    if (ctx.hasUI && !USER_CONFIG.ui.hideNotify) ctx.ui.notify(notifyText, USER_CONFIG.labels.execute.notifyType as "info" | "warning" | "error");
  }

  function enterOffMode(ctx: ExtensionContext, message?: string): void {
    transition("off", pi);
    restoreAllTools();
    updateStatus(ctx);
    if (ctx.hasUI && !USER_CONFIG.ui.hideNotify) ctx.ui.notify(
      message ?? USER_CONFIG.labels.off.notify,
      message ? "info" : (USER_CONFIG.labels.off.notifyType as "info" | "warning" | "error")
    );
  }

  /** Cleanup plan file when transitioning off via plan_complete, if configured. */
  function cleanupPlanFile(): void {
    if (!USER_CONFIG.cleanup.cleanupOnComplete) return;
    const filePath = getPlanFilePath();
    if (filePath && existsSync(filePath)) unlinkSync(filePath);
    setActivePlanFile(null, pi);
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
    } else if (getMode() === "execute") {
      // Restore execute mode tools including plan_complete
      const allNames = pi.getAllTools().map((t) => t.name);
      pi.setActiveTools([...toolsWithoutPlanComplete(allNames), "plan_complete"]);
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

  // ─── Event: tool_call (block unsafe bash in PLAN mode + plan_complete outside EXECUTE) ─

  pi.on("tool_call", (event: ToolCallEvent): ToolCallEventResult => {
    // Guard: plan_complete only callable in execute mode
    if (event.toolName === "plan_complete" && getMode() !== "execute") {
      return {
        block: true,
        reason: `[plan-mode] plan_complete only available in execute mode. Current mode: ${getMode()}`,
      };
    }

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
    description: "Signal that all plan steps have been executed. ONLY callable in EXECUTE mode. Call this once after finishing the final step. This exits execute mode. Do NOT call this outside execute mode.",
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
    cleanupPlanFile();
    enterOffMode(ctx, "Plan implemented. Plan mode OFF.");
  });

  // ─── Event: agent_end (extract plan text in PLAN mode) ────────────────────

  pi.on("agent_end", async (event: AgentEndEvent, ctx: ExtensionContext) => {
    if (getMode() !== "plan") return;
    if (!ctx.hasUI) return;

    // Get the last assistant message
    const lastAssistant = [...event.messages].reverse().find((m) => m.role === "assistant");
    if (!lastAssistant) return;

    const text = extractTextFromMessage(lastAssistant as unknown as Record<string, unknown>);
    if (!text) return;

    const planText = extractPlanText(text);

    setRefining(false);

    // Write plan file if plan text was found (via heading or smart fallback)
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
      const content = `# Plan: ${title}\n\n${planText.replace(/^\s*#{1,6}\s*Plan:[^\n]*\n?/, '').trimStart()}\n`;
      writeFileSync(filePath, content, "utf-8");
      updateStatus(ctx);

      await showPlanMenu(ctx);
    } else if (isPlanLike(text)) {
      // Plan-like response without extractable heading — show menu so user isn't stuck
      updateStatus(ctx);
      await showPlanMenu(ctx);
    }
  });

  // ─── Event: session_tree ──────────────────────────────────────────────────

  pi.on("session_tree", async (_event, ctx) => {
    syncStateFromBranch(ctx);
  });

  /** Prompt user for optional plan name, then enter plan mode. Uses timestamp if no name given. Returns false if cancelled or invalid. */
  async function promptNameAndEnterPlanMode(ctx: ExtensionContext): Promise<boolean> {
    if (chatActive(ctx)) return false;
    const nameInput = await ctx.ui.custom<string | undefined>((tui, theme, kb, done) => {
      const input = new Input();
      input.onSubmit = (value) => done(value);

      const border = new DynamicBorder((s: string) => theme.fg("border", s));
      const label = new Text(theme.fg("text", "Plan name ") + theme.fg("dim", "(optional, leave empty for timestamp)"), 1, 0);
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
          if (kb.matches(data, "app.tools.expand")) { ctx.ui.setToolsExpanded(!ctx.ui.getToolsExpanded()); return; }
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
      if (ctx.hasUI && !USER_CONFIG.ui.hideNotify) ctx.ui.notify(USER_CONFIG.labels.plan.notifyWithTitle.replace("{title}", createTitle), USER_CONFIG.labels.plan.notifyType as "info" | "warning" | "error");
    } else {
      enterPlanMode(ctx);
    }
    return true;
  }

  /** Show the plan action menu: Execute, Refine, Save & Exit, Discard & Exit. */
  async function showPlanMenu(ctx: ExtensionContext): Promise<void> {
    const options: SelectItem[] = [
      { value: "execute", label: "Execute" },
      { value: "refine", label: "Refine" },
      { value: "save", label: "Save & Exit" },
      { value: "discard", label: "Discard & Exit" },
    ];

    while (true) {
      // Guard: mode may have changed externally (shortcut, /plan off) while awaiting input
      if (getMode() !== "plan") return;

      const choice = await showSelectMenu(ctx, "How'd you like to proceed?", options);

      if (choice === "execute") {
        enterExecuteMode(ctx);
        // Defer to next tick — agent may still be processing inside agent_end handler.
        // setTimeout lets the handler return and agent transition to idle before sending.
        setTimeout(() => {
          pi.sendUserMessage("Execute the plan steps now.");
        }, 0);
        return;
      } else if (choice === "refine") {
        setRefining(true);
        updateStatus(ctx);
        return;
      } else if (choice === "save") {
        enterOffMode(ctx, "Plan saved. Plan mode OFF.");
        return;
      } else if (choice === "discard") {
        const confirmOptions: SelectItem[] = [
          { value: "yes", label: "Yes, I am sure" },
          { value: "cancel", label: "Cancel" },
        ];
        const confirmed = await showSelectMenu(ctx, "Are you sure?", confirmOptions, {
          bold: false,
          dimSuffix: " (this will delete the plan file)",
        });

        if (confirmed === "yes") {
          const filePath = getPlanFilePath();
          if (filePath && existsSync(filePath)) unlinkSync(filePath);
          setActivePlanFile(null, pi);
          enterOffMode(ctx, "Plan discarded. Plan mode OFF.");
          return;
        }
        // Cancel — re-show plan menu
      } else {
        // Escaped/cancelled — re-show plan menu
      }
    }
  }

  /** Load an existing plan file and show the action menu. */
  function loadPlanAndShowMenu(ctx: ExtensionContext, filename: string, displayName: string): void {
    if (chatActive(ctx)) return;
    enterPlanWithFile(filename, pi);
    saveAndSetActiveTools(PLAN_MODE_TOOLS);
    updateStatus(ctx);
    if (!USER_CONFIG.ui.hideNotify) ctx.ui.notify(USER_CONFIG.labels.plan.notifyLoaded.replace("{title}", displayName), "info");

    const filePath = join(process.cwd(), PLAN_DIR, filename);
    if (existsSync(filePath)) {
      const planContent = readFileSync(filePath, "utf-8");
      pi.sendMessage({
        customType: "plan-mode",
        content: planContent,
        display: true,
        details: { title: `Active plan: ${displayName}` },
      });
    }
  }

  // ─── Message renderer for plan-mode ────────────────────────────────────────

  pi.registerMessageRenderer("plan-mode", (message, _options, theme) => {
    const border = new DynamicBorder((s: string) => theme.fg("border", s));
    const container = new Container();
    container.addChild(border);
    container.addChild(new Text(theme.fg("text", "📄 " + (message.content as string).split("\n")[0])));
    const body = (message.content as string).split("\n").slice(1).join("\n");
    if (body) {
      container.addChild(new Spacer());
      container.addChild(new Text(body));
    }
    container.addChild(border);
    return container;
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
            const selectItems: SelectItem[] = [
            { value: "create", label: "Create new plan" },
            ...files.map((f) => ({ value: f.name, label: f.title })),
          ];
          const choice = await showSelectMenu(ctx, "Select a plan or create a new one:", selectItems);
          if (choice === null) return; // cancelled
          if (choice === "create") {
            await promptNameAndEnterPlanMode(ctx);
          } else {
            const file = files.find((f) => f.name === choice);
            if (file) {
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
          if (chatActive(ctx)) return;
          if (getMode() === "plan") {
            ctx.ui.notify("Already in plan mode", "info");
            return;
          }
          enterPlanWithFile(filename, pi);
          saveAndSetActiveTools(PLAN_MODE_TOOLS);
          updateStatus(ctx);
          if (ctx.hasUI && !USER_CONFIG.ui.hideNotify) ctx.ui.notify(USER_CONFIG.labels.plan.notifyWithTitle.replace("{title}", titleFromFilename(filename)), USER_CONFIG.labels.plan.notifyType as "info" | "warning" | "error");
        }
      }
    },
  });

  // ─── Shortcut: toggle plan mode ─────────────────────────────────────────────

  pi.registerShortcut(USER_CONFIG.shortcuts.toggleMode as KeyId, {
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

