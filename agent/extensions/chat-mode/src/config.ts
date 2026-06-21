/** Config: tool allowlists, bash patterns, prompt templates, user config. */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ChatModeUserConfig } from "./types.js";

// ─── Tool Lists ─────────────────────────────────────────────────────────────

/** Tool names available in CHAT mode (read-only). */
export const CHAT_MODE_TOOLS: string[] = [
  "read",
  "bash",
  "grep",
  "find",
  "ls",
  "web_search",
  "fetch_content",
  "get_search_content",
];

// ─── Bash Safety ─────────────────────────────────────────────────────────────

/** Default safe command patterns — only these are allowed in CHAT mode. */
const DEFAULT_SAFE_PATTERNS: RegExp[] = [
  /^\s*cat\b/, /^\s*head\b/, /^\s*tail\b/, /^\s*less\b/, /^\s*more\b/,
  /^\s*grep\b/, /^\s*find\b/, /^\s*ls\b/, /^\s*pwd\b/, /^\s*cd\b/,
  /^\s*echo\b/, /^\s*printf\b/, /^\s*wc\b/, /^\s*sort\b/,
  /^\s*diff\b/, /^\s*file\b/, /^\s*stat\b/, /^\s*du\b/, /^\s*df\b/,
  /^\s*tree\b/, /^\s*which\b/, /^\s*whereis\b/, /^\s*type\b/,
  /^\s*env\b/, /^\s*printenv\b/, /^\s*uname\b/, /^\s*whoami\b/,
  /^\s*date\b/, /^\s*uptime\b/, /^\s*ps\b/, /^\s*free\b/,
  /^\s*rg\b/, /^\s*fd\b/, /^\s*bat\b/, /^\s*jq\b/,
  /^\s*git\s+(status|log|diff|show|branch|remote)/i,
  /^\s*node\s+--version/i, /^\s*python\s+--version/i,
  /^\s*(npx\s+)?tsc\b.*--noEmit/i,
  /^\s*npm\s+(list|ls|view|info|outdated|audit)/i,
  /^\s*yarn\s+(list|info|why|audit)/i,
];

/** Default destructive command patterns — always blocked in CHAT mode, even if matching a safe pattern. */
const DEFAULT_DESTRUCTIVE_PATTERNS: RegExp[] = [
  /\brm\b/i, /\brmdir\b/i, /\bmv\b/i, /\bcp\b/i,
  /\bmkdir\b/i, /\btouch\b/i, /\bchmod\b/i, /\bchown\b/i,
  /\btee\b/i, /\bdd\b/i, /\bshred\b/i,
  /(^|[^<])>(?!>|&)/, />>/,
  /\bnpm\s+(install|uninstall|update|ci)/i,
  /\byarn\s+(add|remove|install)/i,
  /\bpip\s+(install|uninstall)/i,
  /\bgit\s+(add|commit|push|merge|rebase|reset|checkout|branch\s+-)/i,
  /\bsudo\b/i, /\bsu\b/i, /\bkill\b/i, /\bpkill\b/i,
  /\b(sh|bash|zsh)\b/i,
  /\b(vim?|nano|emacs|code|subl)\b/i,
];

// ─── Prompt Templates ────────────────────────────────────────────────────────

/** System prompt injected when in CHAT mode. */
export const CHAT_MODE_PROMPT = `\
**SUPERSEDES ALL OTHER BEHAVIOR INSTRUCTIONS.** This overrides any role or style directives (e.g. caveman, roleplay, tone modifiers). The constraints below take absolute priority.

You are in CHAT MODE. You have read-only access — you may read files, search code, run safe inspection commands, and search the web to answer, discuss, and explore. Converse naturally — answer questions, explain, brainstorm, look things up.

You MUST NOT attempt to edit, create, delete, or modify any files, or run any command that changes state. If the user asks for a change, explain what you would do but do not attempt it — they can exit chat mode first.

There is no plan format and no plan_complete tool. Just respond helpfully within read-only constraints.`;

// ─── Custom Entry Types ──────────────────────────────────────────────────────

/** customType value stored in session entries. */
export const ENTRY_TYPE = "chat-mode";

// ─── User Config ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  UI: {
    HIDE_NOTIFY: false,
    HIDE_WIDGET: true,
  },
  SHORTCUTS: {
    TOGGLE_MODE: "ctrl+shift+c",
  },
  LABELS: {
    CHAT: {
      NOTIFY: "✓ Chat mode ON",
      NOTIFY_TYPE: "info",
      WIDGET: "✓ Chat mode",
      WIDGET_COLOR: "accent",
    },
    OFF: {
      NOTIFY: "✓ Chat mode OFF",
      NOTIFY_TYPE: "info",
    },
  },
};

const CONFIG_PATH = join(homedir(), ".pi", "agent", "configs", "chat-mode.json");

function loadUserConfig(): ChatModeUserConfig {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const userConfig = loadUserConfig();

// ─── Bash Pattern Resolution ──────────────────────────────────────────────────

/** Compile string patterns to RegExp. Falls back to defaults if list is empty or all fail. */
function resolvePatterns(strings: string[] | undefined, defaults: RegExp[]): RegExp[] {
  if (!strings || strings.length === 0) return defaults;
  const patterns: RegExp[] = [];
  for (const p of strings) {
    try {
      patterns.push(new RegExp(p, "i"));
    } catch {
      console.warn(`[chat-mode] Invalid pattern: "${p}" — skipping`);
    }
  }
  return patterns.length > 0 ? patterns : defaults;
}

/** Safe command patterns — resolved from user config or defaults. Replace-only: user list replaces all defaults. */
export const SAFE_COMMAND_PATTERNS: RegExp[] = resolvePatterns(
  userConfig.bashPatterns?.safePatterns,
  DEFAULT_SAFE_PATTERNS,
);

/** Destructive command patterns — resolved from user config or defaults. Replace-only: user list replaces all defaults. */
export const DESTRUCTIVE_PATTERNS: RegExp[] = resolvePatterns(
  userConfig.bashPatterns?.destructivePatterns,
  DEFAULT_DESTRUCTIVE_PATTERNS,
);

export const USER_CONFIG = {
  ui: {
    hideNotify: userConfig.ui?.hideNotify ?? DEFAULT_CONFIG.UI.HIDE_NOTIFY,
    hideWidget: userConfig.ui?.hideWidget ?? DEFAULT_CONFIG.UI.HIDE_WIDGET,
  },
  shortcuts: {
    toggleMode: userConfig.shortcuts?.toggleMode ?? DEFAULT_CONFIG.SHORTCUTS.TOGGLE_MODE,
  },
  labels: {
    chat: {
      notify: userConfig.labels?.chat?.notify ?? DEFAULT_CONFIG.LABELS.CHAT.NOTIFY,
      notifyType: userConfig.labels?.chat?.notifyType ?? DEFAULT_CONFIG.LABELS.CHAT.NOTIFY_TYPE,
      widget: userConfig.labels?.chat?.widget ?? DEFAULT_CONFIG.LABELS.CHAT.WIDGET,
      widgetColor: userConfig.labels?.chat?.widgetColor ?? DEFAULT_CONFIG.LABELS.CHAT.WIDGET_COLOR,
    },
    off: {
      notify: userConfig.labels?.off?.notify ?? DEFAULT_CONFIG.LABELS.OFF.NOTIFY,
      notifyType: userConfig.labels?.off?.notifyType ?? DEFAULT_CONFIG.LABELS.OFF.NOTIFY_TYPE,
    },
  },
};