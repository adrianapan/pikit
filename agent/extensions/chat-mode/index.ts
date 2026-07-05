/** Chat Mode — toggle via /chat command or configurable shortcut. CHAT: read-only conversational. Mutually exclusive with plan mode. */

import type {
  ExtensionAPI,
  ExtensionContext,
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
  ToolCallEvent,
  ToolCallEventResult,
} from "@earendil-works/pi-coding-agent";
import type { KeyId } from "@earendil-works/pi-tui";

import { CHAT_MODE_TOOLS, CHAT_MODE_PROMPT, USER_CONFIG } from "./config.js";
import { isSafeCommand, applyLabelColor } from "./utils.js";
import { getMode, transition, restore, resetState } from "./state.js";

export default function chatMode(pi: ExtensionAPI) {
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

  // ─── UI helpers ────────────────────────────────────────────────────────────

  function updateStatus(ctx: ExtensionContext): void {
    if (!ctx.hasUI) return;
    const mode = getMode();

    if (mode === "chat") {
      ctx.ui.setWidget(
        "chat-mode",
        USER_CONFIG.ui.hideWidget ? undefined : [applyLabelColor(ctx.ui.theme, USER_CONFIG.labels.chat.widgetColor, USER_CONFIG.labels.chat.widget)],
      );
    } else {
      ctx.ui.setWidget("chat-mode", undefined);
    }

    pi.events.emit("chat-mode:state", { mode });
  }

  // ─── State transitions ─────────────────────────────────────────────────────

  function enterChatMode(ctx: ExtensionContext): void {
    // Mutual-exclusion guard: plan + chat cannot co-activate (undefined = plan-mode ext not loaded = allowed)
    const planMode = (globalThis as Record<string, unknown>).__planMode as { mode?: string } | undefined;
    if (planMode?.mode && planMode.mode !== "off") {
      if (ctx.hasUI) ctx.ui.notify("Exit plan mode first", "warning");
      return;
    }
    transition("chat", pi);
    saveAndSetActiveTools(CHAT_MODE_TOOLS);
    updateStatus(ctx);
    if (ctx.hasUI && !USER_CONFIG.ui.hideNotify) ctx.ui.notify(USER_CONFIG.labels.chat.notify, USER_CONFIG.labels.chat.notifyType as "info" | "warning" | "error");
  }

  function enterOffMode(ctx: ExtensionContext): void {
    transition("off", pi);
    restoreAllTools();
    updateStatus(ctx);
    if (ctx.hasUI && !USER_CONFIG.ui.hideNotify) ctx.ui.notify(USER_CONFIG.labels.off.notify, USER_CONFIG.labels.off.notifyType as "info" | "warning" | "error");
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

    if (getMode() === "chat") {
      saveAndSetActiveTools(CHAT_MODE_TOOLS);
    }

    updateStatus(ctx);
  }

  // ─── Event: session_start ──────────────────────────────────────────────────

  pi.on("session_start", async (event, ctx) => {
    // Handle --chat flag: start in chat mode on initial startup
    if (event.reason === "startup" && pi.getFlag("chat") === true && getMode() === "off") {
      enterChatMode(ctx);
      return;
    }

    syncStateFromBranch(ctx);
  });

  // ─── Event: before_agent_start ──────────────────────────────────────────────

  pi.on("before_agent_start", (event: BeforeAgentStartEvent): BeforeAgentStartEventResult => {
    if (getMode() === "chat") {
      return { systemPrompt: event.systemPrompt + "\n\n" + CHAT_MODE_PROMPT };
    }
    return {};
  });

  // ─── Event: tool_call (block unsafe bash in CHAT mode) ─────────────────────

  pi.on("tool_call", (event: ToolCallEvent): ToolCallEventResult => {
    if (getMode() !== "chat") return {};
    if (event.toolName !== "bash") return {};

    const command = event.input.command as string;
    if (isSafeCommand(command)) return {};

    return {
      block: true,
      reason: `[chat-mode] Command blocked — destructive or unknown command in chat mode: ${command}`,
    };
  });

  // ─── Event: session_tree ──────────────────────────────────────────────────

  pi.on("session_tree", async (_event, ctx) => {
    syncStateFromBranch(ctx);
  });

  // ─── Command: /chat [off] ──────────────────────────────────────────────────

  pi.registerCommand("chat", {
    description: "Chat mode: /chat (toggle) · /chat off",
    handler: async (args: string, ctx) => {
      const input = args.trim();

      if (input.toLowerCase() === "off") {
        if (getMode() === "off") {
          if (ctx.hasUI) ctx.ui.notify("Chat mode is already off", "info");
          return;
        }
        enterOffMode(ctx);
        return;
      }

      // Toggle (ignore any non-"off" arg)
      if (getMode() === "off") {
        enterChatMode(ctx);
      } else {
        enterOffMode(ctx);
      }
    },
  });

  // ─── Shortcut: toggle chat mode ─────────────────────────────────────────────

  pi.registerShortcut(USER_CONFIG.shortcuts.toggleMode as KeyId, {
    description: "Toggle chat mode",
    handler: async (ctx) => {
      if (getMode() === "off") {
        enterChatMode(ctx);
      } else {
        enterOffMode(ctx);
      }
    },
  });

  // ─── Flag: --chat ──────────────────────────────────────────────────────────

  pi.registerFlag("chat", {
    type: "boolean",
    description: "Start in chat mode (read-only conversational)",
  });
}