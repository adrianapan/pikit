# Plan: Simplify Plan Mode Extension Architecture

Refactor the plan-mode extension at `~/.pi/agent/extensions/plan-mode/` to remove per-step tracking complexity and shift to a format-agnostic, self-contained plan approach. The extension currently uses a `step_done` tool, in-memory `todosCache`, checkbox-based plan file mutation, and a todo list widget — all of which add significant complexity for marginal value. This plan replaces that machinery with a simple `plan_complete` tool, raw plan file injection, and a static "Executing plan" status.

## 1. Remove `step_done` tool and all per-step tracking infrastructure

Delete the following from `src/index.ts`:

- The `step_done` tool registration (the `pi.registerTool` block for `step_done`)
- The `tool_result` event handler that processes `step_done` results
- The `todosCache` variable and all references to it (`loadTodosFromPlanFile`, the `done/total` counting in `updateStatus`, the all-done check)
- The `renderTodoList` and `renderTodoListThemed` functions
- The `loadTodosFromPlanFile` function
- The `activePlanFileExists` function (but keep the missing-file guard in `syncStateFromBranch` — replace with a direct `existsSync` check)

Delete the following from `src/utils.ts`:

- The `TodoItem` interface (no longer needed)
- The `parsePlanFile` function (no longer parsing steps from plan files)
- The `serializePlanFile` function (no longer serializing todo items)
- The `markStepInFile` function (no checkbox mutation)
- The `stripMarkdownFormatting` function (only used for todo rendering)
- The `renderMarkdownStep` function (only used for todo rendering)

In `src/index.ts`, remove all imports that become unused after these deletions. This will include: `TodoItem`, `parsePlanFile`, `serializePlanFile`, `markStepInFile`, `stripMarkdownFormatting`, `renderMarkdownStep`, `loadTodosFromPlanFile`. Note: `readFileSync` and `existsSync` are still needed (for `before_agent_start` reading the plan file, for `syncStateFromBranch` missing-file guard, and for `agent_end` writing the plan file). Do NOT remove those `node:fs` imports.

The `extractPlanSteps` function is still needed — it's used in `agent_end` to detect that a plan was produced. But it should be simplified: instead of returning `TodoItem[]`, have it return just the raw text under the "Plan:" header. See step 3 for details.

## 2. Register `plan_complete` tool (replaces `step_done`)

In `src/index.ts`, register a new tool:

```ts
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
```

Add a `tool_result` handler that detects `plan_complete` and exits execute mode:

```ts
pi.on("tool_result", (event: ToolResultEvent, ctx: ExtensionContext): void => {
  if (event.toolName !== "plan_complete") return;
  if (getMode() !== "execute") return;
  if (ctx.hasUI) ctx.ui.notify("All plan steps complete!", "success");
  enterOffMode(ctx);
});
```

This replaces the entire `step_done` + per-step `tool_result` tracking system.

## 3. Simplify plan file writing — raw LLM output, thin wrapper only

Currently `agent_end` extracts steps via `extractPlanSteps` → `TodoItem[]` → `serializePlanFile`. Change this so the plan file contains the raw LLM output with only a thin `# Plan: <title>` heading prepended.

Modify `extractPlanSteps` in `src/utils.ts` to return the raw plan text (everything under the `Plan:` header) instead of parsed `TodoItem[]`. Rename it to `extractPlanText` to reflect the new semantics:

```ts
/** Extract the raw text under the "Plan:" header from a message. Returns null if no plan found. */
export function extractPlanText(message: string): string | null {
  const planMatch = message.match(/^\s*Plan:\s*$/im);
  if (!planMatch) return null;
  const afterPlan = message.slice(planMatch.index! + planMatch[0].length);
  return afterPlan.trim();
}
```

In the `agent_end` handler in `src/index.ts`, replace the plan file writing logic:

```ts
const planText = extractPlanText(text);
if (!planText) return; // No plan found

// Write plan file with thin wrapper heading
const title = titleFromFilename(filename);
const content = `# Plan: ${title}\n\n${planText}\n`;
writeFileSync(filePath, content, "utf-8");
```

Remove the `todosCache = steps` line and the `setRefining(false)` call before file writing — `setRefining(false)` stays but the cache assignment is gone.

## 4. Simplify execute mode prompt — raw file injection

Currently `buildExecutePrompt` takes `incompleteSteps: Array<{ step: number; text: string }>` and lists them. Change it to accept the full plan text and inject it verbatim:

In `src/config.ts`, replace `buildExecutePrompt`:

```ts
/** System prompt injected when in EXECUTE mode. */
export function buildExecutePrompt(planContent: string): string {
  return `\
You are in EXECUTE MODE. Execute the plan below step by step.

After completing ALL steps, call plan_complete() to signal that execution is finished. Do NOT call plan_complete before all steps are done.

Plan:
${planContent}`;
}
```

In the `before_agent_start` handler in `src/index.ts`, replace the execute-mode branch:

```ts
if (mode === "execute") {
  const filePath = getPlanFilePath();
  if (!filePath || !existsSync(filePath)) return {};
  const planContent = readFileSync(filePath, "utf-8");
  return { systemPrompt: event.systemPrompt + "\n\n" + buildExecutePrompt(planContent) };
}
```

This requires adding `readFileSync` back to imports (it was removed in step 1, but now needed again for reading the plan file into the prompt). Also add `existsSync` if not already imported.

## 5. Simplify `updateStatus` — static execute label

In `src/index.ts`, simplify the `updateStatus` function. The "plan" branch stays the same. The "execute" branch changes — no more todo list widget, just a static status:

```ts
function updateStatus(ctx: ExtensionContext): void {
  if (!ctx.hasUI) return;
  const mode = getMode();

  if (mode === "plan") {
    ctx.ui.setStatus("plan-mode", "⏸ PLAN");
    ctx.ui.setWidget("plan-mode", ["⏸ Plan Mode — read-only"]);
  } else if (mode === "execute") {
    ctx.ui.setStatus("plan-mode", "📋 Executing plan");
    ctx.ui.setWidget("plan-mode", undefined);
  } else {
    ctx.ui.setStatus("plan-mode", undefined);
    ctx.ui.setWidget("plan-mode", undefined);
  }

  pi.events.emit("plan-mode:state", { mode });
}
```

No more `Text` component import needed for widget rendering, no more `Container`, `Spacer` imports either (those are only used in the plan name input dialog, check if still needed separately).

## 6. Simplify `/plan status` — no step counting

In the `/plan` command handler, the `status` subcommand currently counts done/total steps via `todosCache`. Simplify it:

```ts
} else if (input.toLowerCase() === "status") {
  const mode = getMode();
  if (mode === "off") {
    ctx.ui.notify("Plan mode is OFF", "info");
  } else if (mode === "plan") {
    const file = getActivePlanFile();
    ctx.ui.notify(file ? `Plan mode ON — ${file}` : "Plan mode ON — no plan yet", "info");
  } else {
    ctx.ui.notify("Execute mode — running plan", "info");
  }
}
```

## 7. Simplify `/plan list` — no step counting from file contents

Currently `listPlanFiles` reads each file to count checked/unchecked steps. Simplify it to just list files without completion counts. Two approaches:

**Option A (simplest):** Remove completion counts from listing. The `/plan list` output becomes just filenames. The `PlanFileSummary` type drops `done`/`total` fields. The `listPlanFiles` function no longer reads file contents — just lists filenames.

**Option B (still useful):** Keep parsing just the `# Plan: <title>` heading for display, but drop step counting. This gives nicer output like "Add auth middleware" instead of "plan-add-auth-middleware".

Go with Option B — read only the first line of each file for the title, no step parsing:

```ts
interface PlanFileSummary {
  name: string;
  title: string;
}

export function listPlanFiles(): PlanFileSummary[] {
  const dir = join(process.cwd(), PLAN_DIR);
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir)
    .filter((f) => f.startsWith(PLAN_FILE_PREFIX) && f.endsWith(".md"))
    .sort();

  return files.map((filename) => {
    const content = readFileSync(join(dir, filename), "utf-8");
    const titleMatch = content.match(/^# Plan:\s*(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : titleFromFilename(filename);
    return { name: filename, title };
  });
}
```

Update the `/plan list` handler and the `/plan` toggle picker to use `file.title` instead of `file.display` with `done/total` counts.

Also update the `loadPlanAndExecute` function — it currently calls `parsePlanFile` to check if the plan has steps and if all are done. Since we're removing that, simplify:

```ts
function loadPlanAndExecute(ctx: ExtensionContext, filename: string, displayName: string): boolean {
  setActivePlanFile(filename, pi);
  transition("execute", pi);
  restoreAllTools();
  updateStatus(ctx);
  ctx.ui.notify(`Loaded plan "${displayName}"`, "info");
  pi.sendUserMessage("Execute the plan steps now.");
  return true;
}
```

No more `parsePlanFile` call, no more "all steps done" check, no more `done/total` in the notification.

## 8. Update the plan mode prompt for self-contained step prose

In `src/config.ts`, update `PLAN_MODE_PROMPT` to enforce the self-contained, context-rich step format. Also update the `Plan:` header extraction to work with multi-paragraph content per step (the `extractPlanText` function from step 3 already handles this since it grabs everything after "Plan:").

Update `PLAN_MODE_PROMPT`:

```
You are in PLAN MODE. You have read-only access — you may explore and analyze, but you MUST NOT make any changes.

Your task: produce an action plan under a "Plan:" header.

Format:
```
Plan:
1. [Step title — short verb-object phrase]
   [2-4 sentences of context: which file(s), where, what to change, and why.]
2. [Step title]
   [Context...]
...
```

Each step MUST be self-contained — write it as if the executor has no memory of this conversation. Include enough context that it can be carried out with only the plan file and the codebase. Assume the executor will read the relevant files fresh — do not rely on findings you discovered during planning.

Good: "Add auth middleware to routes/index.ts
     Apply it as `app.use(authMiddleware)` before the route definitions (~line 45). Currently routes/index.ts has no middleware."

Bad: "Add it to the file we looked at"

Bad (over-prescribed): "Insert `const authMiddleware = require('./middleware/auth');` at line 3, then add `app.use(authMiddleware);` at line 46"

Specify what to do and where — not the exact implementation. The executor reads the relevant files and decides how.

After listing all steps, stop and wait for the user to choose:
- "Execute plan" — switches to execute mode where you carry out each step
- "Refine" — revise the plan based on feedback
- Continue exploring if you need more information before planning

Do NOT attempt to make any file changes, run destructive commands, or modify anything.
```

Similarly update `buildRefinePrompt` — remove the `4-8 words` constraint and add the self-contained context requirement:

```
You are in PLAN MODE (refining). The user wants to revise the current plan based on their feedback.

Current plan:
<raw plan text injected here>

Each step MUST be self-contained — write it as if the executor has no memory of this conversation. Include enough context that it can be carried out with only the plan file and the codebase. Assume the executor will read the relevant files fresh — do not rely on findings you discovered during planning.

Revise the plan and output the full updated plan under a "Plan:" header.

Do NOT make any changes. Only produce a revised plan.
```

For the refine prompt, inject the raw plan text (read from the plan file) instead of the previous `todosCache`-derived step list.

## 9. Update the refine prompt injection to use raw plan file content

In the `before_agent_start` handler, the "plan" + "refining" branch currently calls `buildRefinePrompt(todosCache)`. Change it to read the plan file directly:

```ts
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
```

## 10. Clean up unused imports and state in `src/state.ts`

In `src/state.ts`, the state module is fine as-is — it still tracks `mode`, `activePlanFile`, and `refining`. No changes needed there.

But check that nothing references `todosCache` or `TodoItem` after all the deletions. Remove any remaining dead imports in `src/index.ts`.

## 11. Update `README.md`

Update `~/.pi/agent/extensions/plan-mode/README.md` to reflect the new architecture:

- Remove references to `step_done` tool — replace with `plan_complete`
- Remove references to checkbox syntax in plan files — plan files now contain raw LLM output with thin `# Plan: <title>` heading
- Remove references to "checklist updates in real time" and per-step progress tracking
- Document the `plan_complete` tool
- Update "How It Works" section: execute mode ends when LLM calls `plan_complete`
- Document that plan files are format-agnostic — the LLM decides the structure, the prompt enforces self-contained steps
- Update `package.json` description field

## 12. Remove `DynamicBorder` import if unused

Check if `DynamicBorder` from pi-coding-agent is still used after all changes. It was imported in `index.ts` — used in the `promptNameAndEnterPlanMode` input dialog. That dialog still exists, so the import likely stays. But verify and remove if unused.

Similarly, check if `Container`, `Input`, `Text`, `Spacer`, `matchesKey`, `Key`, `Component` from pi-tui are still used. The name input dialog uses them, so they stay. But `Text` was also used in `renderTodoListThemed` — if that's been removed, verify no other usage exists.

## 13. Verify no references to deleted functions remain

After all changes, search the entire extension directory for any remaining references to:
- `TodoItem`
- `todosCache`
- `step_done`
- `parsePlanFile`
- `serializePlanFile`
- `markStepInFile`
- `stripMarkdownFormatting`
- `renderMarkdownStep`
- `loadTodosFromPlanFile`
- `activePlanFileExists`
- `renderTodoList`
- `completed` (in the context of todo items)

Remove any that are found.

## 14. Test the extension manually

After implementation, test the following flows:

1. **Create plan from scratch**: `/plan` → no existing plans → enter name → LLM produces plan → save plan file ✓
2. **Execute plan**: Select "Execute plan" → enters execute mode → status shows "📋 Executing plan" → LLM works through steps → calls `plan_complete` → auto-exits to off mode ✓
3. **Refine plan**: Select "Refine" → LLM revises plan → saves updated file ✓
4. **Load existing plan**: `/plan <name>` → enters execute mode with plan file content injected ✓
5. **Plan file format**: Verify the file contains `# Plan: <title>` heading followed by raw LLM output (no checkboxes) ✓
6. **List plans**: `/plan list` → shows titles from `# Plan:` headings ✓
7. **Status**: `/plan status` → shows mode without step counting ✓
8. **Toggle off**: `/plan off` → restores all tools ✓
9. **Ctrl+Alt+P**: Toggles plan mode ✓
10. **--plan flag**: Starts in plan mode ✓
11. **Session restore**: Fork/switch branch → state restored ✓
12. **Raw file injection**: In execute mode, verify the full plan file content is injected into the system prompt, not a parsed step list ✓
13. **Plan file deleted externally**: While in execute mode, externally delete the plan file → `syncStateFromBranch` should detect missing file and exit to off mode with a warning notification ✓
14. **LLM never calls plan_complete**: Execute mode stays active. User can `/plan off` manually. Not a crash. ✓
15. **Refine doesn't produce Plan header**: `extractPlanText` returns null → `agent_end` returns early, existing plan file untouched. User can retry or execute existing plan. ✓
16. **Manually load already-completed plan**: Can't detect completion without step tracking. LLM gets plan injected, realizes work is done, calls `plan_complete`. Acceptable. ✓

## Files to modify

| File | Changes |
|------|---------|
| `src/index.ts` | Major refactor: remove step_done, remove todosCache, remove todo rendering, add plan_complete tool and handler, simplify updateStatus, simplify agent_end plan writing, update before_agent_start for raw file injection, simplify /plan status and /plan list, simplify loadPlanAndExecute |
| `src/config.ts` | Rewrite PLAN_MODE_PROMPT, rewrite buildExecutePrompt, rewrite buildRefinePrompt, remove buildExecutePrompt's old signature |
| `src/utils.ts` | Remove TodoItem, parsePlanFile, serializePlanFile, markStepInFile, stripMarkdownFormatting, renderMarkdownStep; rename extractPlanSteps → extractPlanText; simplify listPlanFiles; simplify PlanFileSummary |
| `src/state.ts` | No changes needed |
| `README.md` | Rewrite to reflect new architecture |
| `package.json` | Update description |

## Edge cases and how they're handled

- **Refine produces no "Plan:" header**: `extractPlanText` returns null, `agent_end` returns early. Existing plan file stays untouched. User can retry or execute the existing plan.
- **Plan file deleted externally during execute mode**: `syncStateFromBranch` must check if the active plan file still exists on disk. If not, notify the user and exit to off mode. This check was previously handled by `activePlanFileExists` — we need a simplified version of the same guard.
- **LLM never calls `plan_complete`**: Execute mode stays active indefinitely. User can exit manually with `/plan off`. The prompt should strongly emphasize calling `plan_complete` when done, but we don't hard-enforce it.
- **LLM calls `plan_complete` twice**: Second call hits `getMode() !== "execute"` guard (already in off mode) → no-op. Safe.
- **Multi-turn execution**: Each turn, `before_agent_start` re-reads the plan file and injects it fresh. This is a feature — plan context persists across turns without relying on conversation memory.
- **Load already-completed plan**: Without step tracking, we can't detect completion. The LLM receives the plan, finds the work already done, and calls `plan_complete`. Acceptable behavior.
- **Headless mode (no UI)**: `agent_end` has `if (!ctx.hasUI) return;` guard — plan file is written but user never gets the Execute/Refine prompt. Same as current behavior. CLI users can switch to execute mode manually via `/plan <name>`.
- **Concurrent external edits to plan file**: `before_agent_start` reads the file fresh each turn, so edits are picked up automatically. No stale cache risk.

## Key design decisions (for context)

- **`plan_complete` over `step_done`**: Single tool, no parameters, called once when done. Simpler registration, handler, and tracking. No per-step state.
- **Raw file injection over parsed steps**: The plan file is verbatim LLM output with a `# Plan: <title>` heading. The execute prompt injects the full file content. No parsing needed for execution context.
- **Format-agnostic plans**: The prompt enforces self-contained, context-rich step descriptions. The LLM decides the exact structure. We don't parse the internal format.
- **Explicit > terse**: Each step must be understandable without conversation context. This makes plans work in new chat windows, with subagents, and with less capable models. The prompt explicitly asks for file paths, what to change, and why — but not exact implementation code. The executor reads files and decides the how.
- **What vs how**: Steps should specify what to do and where (file paths, ~line numbers, descriptions of what currently exists). They should NOT prescribe exact implementation code. The executor is expected to read the relevant files and adapt. This avoids plans breaking when the planner's assumptions about the code are slightly wrong.
- **Title from file heading**: `listPlanFiles` reads the `# Plan: <title>` line from each file for display. Falls back to filename-derived title.
- **No resume via checkboxes**: If execution is interrupted, a new chat reads the plan file + the codebase to determine what's left. The self-contained step descriptions make this reliable.
- **Static status in execute mode**: Just "📋 Executing plan" instead of step counting. Observable progress is the chat stream itself.