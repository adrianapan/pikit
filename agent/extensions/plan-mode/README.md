# Plan Mode Extension

Toggle plan mode via `/plan` command or `Shift+Tab`.

## Modes

- **OFF** — Normal operation, all tools available
- **PLAN** — Read-only exploration. LLM produces an action plan under a `Plan:` header. PLAN mode also blocks non-read-only bash commands — only whitelisted commands like `cat`, `ls`, `grep`, `git status`, etc. pass through.
- **EXECUTE** — Full tools restored. LLM executes steps and calls `plan_complete()` when done

## Commands

| Command | Action |
|---|---|
| `/plan` | OFF → show picker (if plans exist) or enter plan mode · PLAN/EXECUTE → turn off |
| `/plan <name>` | If plan exists: load & show action menu · if not: enter plan mode (create new) |
| `/plan off` | Force off, restores all tools |

## Keyboard Shortcuts

- `Shift+Tab` — Toggle plan mode on/off

## CLI Flag

- `--plan` — Start in plan mode

## Plan Files

Plans are stored as markdown files in `.pi/plans/` with a thin heading wrapper:

```markdown
# Plan: Refactor Auth Module

1. Add auth middleware to routes/index.ts
   Apply it as `app.use(authMiddleware)` before the route definitions (~line 45).
   Currently routes/index.ts has no middleware.

2. Write tests for auth module
   Create `test/auth.test.ts` and test middleware behavior: valid token, expired token, missing token.
   Follow the existing test pattern in `test/user.test.ts`.

3. Update documentation
   Add auth section to `README.md` explaining how to configure and use the middleware.
```

- Plan files contain raw LLM output under the `# Plan: <title>` heading
- Steps are self-contained with enough context to execute without conversation history
- The format is format-agnostic — the LLM decides the structure, the prompt enforces self-contained steps

## How It Works

1. `/plan` (from OFF) → shows picker with existing plans + "Create new plan" option; selecting an existing plan displays the plan content in chat and shows the action menu (Execute / Refine / Save & Exit / Discard & Exit)
2. "Create new plan" → optional name input (leave empty for timestamp) → enter PLAN mode
3. LLM explores and produces a plan under a `Plan:` header
4. After LLM response, a menu offers: Execute / Refine / Save & Exit / Discard & Exit
   - Execute → switch to execute mode, LLM carries out the plan
   - Refine → revise the plan, stay in plan mode
   - Save & Exit → save plan file, return to normal mode
   - Discard & Exit → delete plan file, return to normal mode (with confirmation)
5. Execute mode → all tools restored, full plan file injected into system prompt each turn
6. LLM calls `plan_complete()` after finishing all steps → automatically returns to OFF mode
- `/plan <name>` with existing plan → load into plan mode and show action menu (Execute / Refine / Save & Exit / Discard & Exit)
- `/plan <name>` with new name → enter plan mode with that name

## `plan_complete` Tool

A custom tool registered by this extension. The LLM calls `plan_complete()` after executing all plan steps.

- The tool returns "Plan complete. Exiting execute mode."
- The extension exits execute mode and returns to OFF
- If the LLM never calls `plan_complete`, execute mode stays active — user can `/plan off` manually

## State Persistence

Mode and active plan file are stored in the session via `pi.appendEntry`. Plan content is persisted in the plan file on disk. Forking or resuming a session restores state and re-reads the plan file.