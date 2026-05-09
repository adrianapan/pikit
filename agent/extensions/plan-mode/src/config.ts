/** Config: tool allowlists, bash patterns, prompt templates. */

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

Your task: produce a numbered action plan under a "Plan:" header.

Format:
\`\`\`
Plan:
1. [First step]
2. [Second step]
3. [Third step]
...
\`\`\`

Each step should be concrete and actionable. After listing all steps, stop and wait for the user to choose:
- "Execute plan" — switches to execute mode where you carry out each step
- "Refine" — revise the plan based on feedback
- Continue exploring if you need more information before planning

Do NOT attempt to make any file changes, run destructive commands, or modify anything.`;

/** System prompt injected when in EXECUTE mode. */
export function buildExecutePrompt(incompleteSteps: Array<{ step: number; text: string }>): string {
  const steps = incompleteSteps.map((s) => `${s.step}. ${s.text}`).join("\n");
  return `\
You are in EXECUTE MODE. Execute the remaining plan steps. Mark each completed step with [DONE:n] when finished.

Remaining steps:
${steps}

After completing a step, mark it: [DONE:n]
When all steps are complete, report "All steps complete." and you will exit execute mode.`;
}

/** System prompt injected when refining a plan in PLAN mode. */
export function buildRefinePrompt(todos: Array<{ step: number; text: string }>): string {
  const steps = todos.map((s) => `${s.step}. ${s.text}`).join("\n");
  return `\
You are in PLAN MODE (refining). The user wants to revise the current plan based on their feedback.

Current plan:
${steps}

Revise the plan and output the full updated plan under a "Plan:" header:

Plan:
1. [Revised step]
2. [Revised step]
...

Do NOT make any changes. Only produce a revised plan.`;
}

// ─── Custom Entry Types ──────────────────────────────────────────────────────

/** customType value stored in session entries. */
export const ENTRY_TYPE = "plan-mode";