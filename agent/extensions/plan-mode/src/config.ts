/** Config: tool allowlists, bash patterns, prompt templates, plan file constants, user config. */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { PlanModeUserConfig } from "./types.js";

// ─── Plan File Constants ────────────────────────────────────────────────────

/** Directory for plan files, relative to project root. */
export const PLAN_DIR = ".pi/plans";

/** File prefix for plan files. */
export const PLAN_FILE_PREFIX = "plan-";

// ─── Tool Lists ─────────────────────────────────────────────────────────────

/** Tool names available in PLAN mode (read-only). */
export const PLAN_MODE_TOOLS: string[] = [
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

/** Safe command patterns — only these are allowed in PLAN mode. */
export const SAFE_COMMAND_PATTERNS: RegExp[] = [
  /^\s*cat\b/, /^\s*head\b/, /^\s*tail\b/, /^\s*less\b/, /^\s*more\b/,
  /^\s*grep\b/, /^\s*find\b/, /^\s*ls\b/, /^\s*pwd\b/,
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

/** Destructive command patterns — always blocked in PLAN mode, even if matching a safe pattern. */
export const DESTRUCTIVE_PATTERNS: RegExp[] = [
  /\brm\b/i, /\brmdir\b/i, /\bmv\b/i, /\bcp\b/i,
  /\bmkdir\b/i, /\btouch\b/i, /\bchmod\b/i, /\bchown\b/i,
  /\btee\b/i, /\bdd\b/i, /\bshred\b/i,
  /(^|[^<])>(?!>)/, />>/,
  /\bnpm\s+(install|uninstall|update|ci)/i,
  /\byarn\s+(add|remove|install)/i,
  /\bpip\s+(install|uninstall)/i,
  /\bgit\s+(add|commit|push|merge|rebase|reset|checkout|branch\s+-)/i,
  /\bsudo\b/i, /\bsu\b/i, /\bkill\b/i, /\bpkill\b/i,
  /\b(sh|bash|zsh)\b/i,
  /\b(vim?|nano|emacs|code|subl)\b/i,
];

// ─── Prompt Templates ────────────────────────────────────────────────────────

/** System prompt injected when in PLAN mode. */
export const PLAN_MODE_PROMPT = `\
You are in PLAN MODE. You have read-only access — you may explore and analyze, but you MUST NOT make any changes.

Your task: produce an action plan under a "Plan:" header.

Format:

Plan:
1. [Step title — short verb-object phrase]
   [2-4 sentences of context: which file(s), where, what to change, and why.]
2. [Step title]
   [Context...]
...

Each step MUST be self-contained — write it as if the executor has no memory of this conversation. Include enough context that it can be carried out with only the plan file and the codebase. Assume the executor will read the relevant files fresh — do not rely on findings you discovered during planning.

Good: "Add auth middleware to routes/index.ts
     Apply it as \`app.use(authMiddleware)\` before the route definitions (~line 45). Currently routes/index.ts has no middleware."

Bad: "Add it to the file we looked at"

Bad (over-prescribed): "Insert \`const authMiddleware = require('./middleware/auth');\` at line 3, then add \`app.use(authMiddleware);\` at line 46"

Specify what to do and where — not the exact implementation. The executor reads the relevant files and decides how.

After listing all steps, stop and wait for the user to choose:
- "Execute plan" — switches to execute mode where you carry out each step
- "Refine" — revise the plan based on feedback
- Continue exploring if you need more information before planning

Do NOT attempt to make any file changes, run destructive commands, or modify anything.`;

/** System prompt injected when in EXECUTE mode. */
export function buildExecutePrompt(planContent: string): string {
  return `\
You are in EXECUTE MODE. Execute the plan below step by step.

After completing ALL steps, call plan_complete() to signal that execution is finished. Do NOT call plan_complete before all steps are done.

Plan:
${planContent}`;
}

/** System prompt injected when refining a plan in PLAN mode. */
export function buildRefinePrompt(planContent: string): string {
  return `\
You are in PLAN MODE (refining). The user wants to revise the current plan based on their feedback.

Current plan:
${planContent}

Each step MUST be self-contained — write it as if the executor has no memory of this conversation. Include enough context that it can be carried out with only the plan file and the codebase. Assume the executor will read the relevant files fresh — do not rely on findings you discovered during planning.

Revise the plan and output the full updated plan under a "Plan:" header.

Do NOT make any changes. Only produce a revised plan.`;
}

// ─── Custom Entry Types ──────────────────────────────────────────────────────

/** customType value stored in session entries. */
export const ENTRY_TYPE = "plan-mode";

// ─── User Config ────────────────────────────────────────────────────────────

const DEFAULT_CONFIG = {
  CLEANUP: {
    CLEANUP_ON_COMPLETE: false
  },
  UI: {
    HIDE_NOTIFY: false,
    HIDE_WIDGET: true
  },
  SHORTCUTS: {
    TOGGLE_MODE: "shift+tab"
  },
  LABELS: {
    PLAN: {
      NOTIFY: "✓ Plan mode ON",
      NOTIFY_TYPE: "info",
      NOTIFY_WITH_TITLE: "✓ Active plan {title}",
      NOTIFY_LOADED: "✓ Active plan: {title}",
      WIDGET: "✓ Plan mode active",
      WIDGET_WITH_TITLE: "✓ Active plan: {title}",
      WIDGET_COLOR: "accent",
    },
    EXECUTE: {
      NOTIFY: "✓ Executing plan",
      NOTIFY_WITH_TITLE: "✓ Executing plan: {title}",
      NOTIFY_TYPE: "info",
      WIDGET: "✓ Executing plan",
      WIDGET_WITH_TITLE: "✓ Executing plan: {title}",
      WIDGET_COLOR: "muted",
    },
    OFF: {
      NOTIFY: "✓ Plan mode OFF",
      NOTIFY_TYPE: "info",
    },
  },
};

const CONFIG_PATH = join(homedir(), ".pi", "agent", "configs", "plan-mode.json");

function loadUserConfig(): PlanModeUserConfig {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const userConfig = loadUserConfig();

export const USER_CONFIG = {
  cleanup: {
    cleanupOnComplete: userConfig.cleanup?.cleanupOnComplete ?? DEFAULT_CONFIG.CLEANUP.CLEANUP_ON_COMPLETE,
  },
  ui: {
    hideNotify: userConfig.ui?.hideNotify ?? DEFAULT_CONFIG.UI.HIDE_NOTIFY,
    hideWidget: userConfig.ui?.hideWidget ?? DEFAULT_CONFIG.UI.HIDE_WIDGET,
  },
  shortcuts: {
    toggleMode: userConfig.shortcuts?.toggleMode ?? DEFAULT_CONFIG.SHORTCUTS.TOGGLE_MODE,
  },
  labels: {
    plan: {
      notify: userConfig.labels?.plan?.notify ?? DEFAULT_CONFIG.LABELS.PLAN.NOTIFY,
      notifyType: userConfig.labels?.plan?.notifyType ?? DEFAULT_CONFIG.LABELS.PLAN.NOTIFY_TYPE,
      notifyWithTitle: userConfig.labels?.plan?.notifyWithTitle ?? DEFAULT_CONFIG.LABELS.PLAN.NOTIFY_WITH_TITLE,
      notifyLoaded: userConfig.labels?.plan?.notifyLoaded ?? DEFAULT_CONFIG.LABELS.PLAN.NOTIFY_LOADED,
      widget: userConfig.labels?.plan?.widget ?? DEFAULT_CONFIG.LABELS.PLAN.WIDGET,
      widgetWithTitle: userConfig.labels?.plan?.widgetWithTitle ?? DEFAULT_CONFIG.LABELS.PLAN.WIDGET_WITH_TITLE,
      widgetColor: userConfig.labels?.plan?.widgetColor ?? DEFAULT_CONFIG.LABELS.PLAN.WIDGET_COLOR,
    },
    execute: {
      notify: userConfig.labels?.execute?.notify ?? DEFAULT_CONFIG.LABELS.EXECUTE.NOTIFY,
      notifyWithTitle: userConfig.labels?.execute?.notifyWithTitle ?? DEFAULT_CONFIG.LABELS.EXECUTE.NOTIFY_WITH_TITLE,
      notifyType: userConfig.labels?.execute?.notifyType ?? DEFAULT_CONFIG.LABELS.EXECUTE.NOTIFY_TYPE,
      widget: userConfig.labels?.execute?.widget ?? DEFAULT_CONFIG.LABELS.EXECUTE.WIDGET,
      widgetWithTitle: userConfig.labels?.execute?.widgetWithTitle ?? DEFAULT_CONFIG.LABELS.EXECUTE.WIDGET_WITH_TITLE,
      widgetColor: userConfig.labels?.execute?.widgetColor ?? DEFAULT_CONFIG.LABELS.EXECUTE.WIDGET_COLOR,
    },
    off: {
      notify: userConfig.labels?.off?.notify ?? DEFAULT_CONFIG.LABELS.OFF.NOTIFY,
      notifyType: userConfig.labels?.off?.notifyType ?? DEFAULT_CONFIG.LABELS.OFF.NOTIFY_TYPE,
    },
  },
};