# pikit-plan-mode — read-only planning mode for [pi.dev](https://pi.dev)

Toggle plan mode via `/plan` command or configurable keyboard shortcut.

https://github.com/user-attachments/assets/eb70370e-3f75-4c22-a0eb-901bf91bae00

## Install

```bash
pi install npm:pikit-plan-mode
```

> [!TIP]
> Or grab the entire [pikit](https://github.com/adrianapan/pikit) setup, an opinionated pi.dev configuration that includes this extension.

## Modes

- **OFF** — Normal operation, all tools available
- **PLAN** — Read-only exploration. LLM produces an action plan under a `Plan:` header. PLAN mode also blocks non-read-only bash commands — only whitelisted commands like `cat`, `ls`, `grep`, `git status`, etc. pass through.
- **EXECUTE** — Full tools restored. LLM executes steps and calls `plan_complete()` when done

### Tool Restriction Mechanism

Plan mode restricts tools via `pi.setActiveTools()`. On entering plan mode, the full tool list is saved and replaced with a read-only subset (`read`, `bash`, `grep`, `find`, `ls`, `web_search`, `fetch_content`, `get_search_content`, `artifact`) — configurable via `allowedTools` (see Configuration). On exiting (to OFF or EXECUTE), the original tool list is restored via `pi.setActiveTools()` with the saved names. Bash commands receive a second layer of defense — the `tool_call` event handler blocks destructive commands even though `bash` itself remains available for exploration.

## Commands

| Command | Action |
|---|---|
| `/plan` | OFF → show picker (if plans exist) or enter plan mode · PLAN/EXECUTE → turn off |
| `/plan <name>` | If plan exists: load & show action menu · if not: enter plan mode (create new) |
| `/plan off` | Force off, restores all tools |

## Keyboard Shortcuts

- Default: `ctrl+shift+l` — Toggle plan mode on/off (configurable via `shortcuts.toggleMode`)

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

## Configuration

Create `~/.pi/agent/configs/plan-mode.json` to customize behavior. An example file is at the extension root (`plan-mode.example.json`).

| Option | Type | Default | Description |
|---|---|---|---|
| `cleanup.cleanupOnComplete` | boolean | `false` | Delete the plan file after successful execution (via `plan_complete`) |
| `bashPatterns.safePatterns` | string[] (regex) | *(built-in list)* | Replace-only: provide your own safe command regex patterns to **replace** all defaults. Omit to keep built-in safe patterns |
| `bashPatterns.destructivePatterns` | string[] (regex) | *(built-in list)* | Replace-only: provide your own destructive command regex patterns to **replace** all defaults. Omit to keep built-in destructive patterns |
| `allowedTools` | string[] | *(built-in list)* | Replace-only: provide a list of tool names to **replace** the default PLAN mode tool set. Omit to keep built-in defaults (`read`, `bash`, `grep`, `find`, `ls`, `web_search`, `fetch_content`, `get_search_content`, `artifact`) |
| `ui.hideNotify` | boolean | `false` | Suppress toast notifications on mode transitions |
| `ui.hideWidget` | boolean | `true` | Hide the widget when in plan/execute mode |
| `shortcuts.toggleMode` | string | `"ctrl+shift+l"` | Keybinding action for toggling plan mode on/off |
| `labels.plan.notify` | string | `"✓ Plan mode ON"` | Notify text when entering plan mode |
| `labels.plan.notifyType` | string | `"info"` | Notify type: `"info"`, `"warning"`, `"error"`, `"success"` |
| `labels.plan.notifyWithTitle` | string | `"✓ Active plan {title}"` | Notify text with `{title}` placeholder (creating named plan) |
| `labels.plan.notifyLoaded` | string | `"✓ Active plan: {title}"` | Notify text when loading an existing plan (with `{title}` placeholder) |
| `labels.plan.widget` | string | `"✓ Plan mode active"` | Widget text when no title |
| `labels.plan.widgetWithTitle` | string | `"✓ Active plan: {title}"` | Widget text with `{title}` placeholder |
| `labels.plan.widgetColor` | string | `"accent"` | Color for plan widget text (theme token or hex) |
| `labels.execute.notify` | string | `"✓ Executing plan"` | Notify text when entering execute mode (no title) |
| `labels.execute.notifyWithTitle` | string | `"✓ Executing plan: {title}"` | Notify text with `{title}` placeholder |
| `labels.execute.notifyType` | string | `"info"` | Notify type: `"info"`, `"warning"`, `"error"`, `"success"` |
| `labels.execute.widget` | string | `"✓ Executing plan"` | Widget text when no title |
| `labels.execute.widgetWithTitle` | string | `"✓ Executing plan: {title}"` | Widget text with `{title}` placeholder |
| `labels.execute.widgetColor` | string | `"muted"` | Color for execute widget text (theme token or hex) |
| `labels.off.notify` | string | `"✓ Plan mode OFF"` | Notify text when turning off (fallback — contextual messages override this) |
| `labels.off.notifyType` | string | `"info"` | Notify type: `"info"`, `"warning"`, `"error"`, `"success"` |

### Color values

Color fields accept both **pi theme tokens** and **hex values**:
- Theme tokens: `"text"`, `"accent"`, `"success"`, `"error"`, `"muted"`, `"dim"`, `"separator"`, `"toolTitle"`, etc.
- Hex values: `"#ff6600"`, `"#00ff88"`, etc. — converted to ANSI truecolor at render time

### Label templates

Fields ending in `WithTitle` support the `{title}` placeholder, which is replaced with the plan's display title at runtime. When no title is available, the plain `widget` field is used instead.

### Notify types

`notifyType` fields accept one of: `"info"`, `"warning"`, `"error"`, `"success"`. The type determines the visual treatment (color, icon) of the toast notification.

### Bash patterns (replace-only)

`bashPatterns.safePatterns` and `bashPatterns.destructivePatterns` are **replace-only** — if you provide an array, it entirely replaces the built-in defaults. There is no merge/append. This matches the permission-gate extension's approach.

Patterns are case-insensitive regex strings (the `i` flag is applied automatically). Invalid patterns are warned and skipped; if all patterns in an array are invalid, the built-in defaults are used as fallback.

Example — allow only `ls` and `cat` as safe, and block `rm` and `sudo` as destructive:

```json
{
  "bashPatterns": {
    "safePatterns": ["^\\s*ls\\b", "^\\s*cat\\b"],
    "destructivePatterns": ["\\brm\\b", "\\bsudo\\b"]
  }
}
```

### Allowed tools (replace-only)

`allowedTools` is **replace-only** — if you provide an array, it entirely replaces the built-in default tool set for PLAN mode. There is no merge/append. Omit the field (or set to `null`) to keep the defaults: `read`, `bash`, `grep`, `find`, `ls`, `web_search`, `fetch_content`, `get_search_content`, `artifact`.

Example — allow only the read-only file tools plus `artifact`:

```json
{
  "allowedTools": ["read", "grep", "find", "ls", "artifact"]
}
```

### `cleanup.cleanupOnComplete`

When `true`, the plan file is automatically deleted when the LLM calls `plan_complete()` and the mode transitions from execute back to off. When `false` (default), the plan file is preserved after execution.