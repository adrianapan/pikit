# Chat Mode Extension

Toggle chat mode via `/chat` command or configurable keyboard shortcut. Read-only conversational access — chat, explore code, search the web — without making any changes.

## Modes

- **OFF** — Normal operation, all tools available
- **CHAT** — Read-only. Converse naturally — answer questions, explain, brainstorm, look things up. CHAT mode also blocks non-read-only bash commands — only whitelisted commands like `cat`, `ls`, `grep`, `git status`, etc. pass through. Mutually exclusive with plan mode.

### Tool Restriction Mechanism

Chat mode restricts tools via `pi.setActiveTools()`. On entering chat mode, the full tool list is saved and replaced with a read-only subset (`read`, `bash`, `grep`, `find`, `ls`, `web_search`, `fetch_content`, `get_search_content`, `artifact`) — configurable via `allowedTools` (see Configuration). On exiting, the original tool list is restored via `pi.setActiveTools()` with the saved names. Bash commands receive a second layer of defense — the `tool_call` event handler blocks destructive commands even though `bash` itself remains available for inspection.

## Commands

| Command | Action |
|---|---|
| `/chat` | OFF → enter chat mode · CHAT → turn off |
| `/chat off` | Force off, restores all tools |

## Keyboard Shortcuts

- Default: `ctrl+shift+c` — Toggle chat mode on/off (configurable via `shortcuts.toggleMode`)

## CLI Flag

- `--chat` — Start in chat mode

## Mutual Exclusion With Plan Mode

Chat and plan mode cannot be active at the same time. Entering chat mode while plan mode is on is blocked with an "Exit plan mode first" warning, and vice versa. Nesting is semantically pointless — plan mode's read-only phase is a superset of chat, and plan-in-chat would break chat's read-only promise via `execute`.

## State Persistence

Mode is stored in the session via `pi.appendEntry`. Forking or resuming a session restores state.

## Configuration

Create `~/.pi/agent/configs/chat-mode.json` to customize behavior. An example file is at the extension root (`chat-mode.example.json`).

| Option | Type | Default | Description |
|---|---|---|---|
| `bashPatterns.safePatterns` | string[] (regex) | *(built-in list)* | Replace-only: provide your own safe command regex patterns to **replace** all defaults. Omit to keep built-in safe patterns |
| `bashPatterns.destructivePatterns` | string[] (regex) | *(built-in list)* | Replace-only: provide your own destructive command regex patterns to **replace** all defaults. Omit to keep built-in destructive patterns |
| `allowedTools` | string[] | *(built-in list)* | Replace-only: provide a list of tool names to **replace** the default CHAT mode tool set. Omit to keep built-in defaults (`read`, `bash`, `grep`, `find`, `ls`, `web_search`, `fetch_content`, `get_search_content`, `artifact`) |
| `ui.hideNotify` | boolean | `false` | Suppress toast notifications on mode transitions |
| `ui.hideWidget` | boolean | `true` | Hide the widget when in chat mode |
| `shortcuts.toggleMode` | string | `"ctrl+shift+c"` | Keybinding action for toggling chat mode on/off |
| `labels.chat.notify` | string | `"✓ Chat mode ON"` | Notify text when entering chat mode |
| `labels.chat.notifyType` | string | `"info"` | Notify type: `"info"`, `"warning"`, `"error"`, `"success"` |
| `labels.chat.widget` | string | `"✓ Chat mode"` | Widget text when in chat mode |
| `labels.chat.widgetColor` | string | `"accent"` | Color for chat widget text (theme token or hex) |
| `labels.off.notify` | string | `"✓ Chat mode OFF"` | Notify text when turning off |
| `labels.off.notifyType` | string | `"info"` | Notify type: `"info"`, `"warning"`, `"error"`, `"success"` |

### Color values

Color fields accept both **pi theme tokens** and **hex values**:
- Theme tokens: `"text"`, `"accent"`, `"success"`, `"error"`, `"muted"`, `"dim"`, `"separator"`, `"toolTitle"`, etc.
- Hex values: `"#ff6600"`, `"#00ff88"`, etc. — converted to ANSI truecolor at render time

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

`allowedTools` is **replace-only** — if you provide an array, it entirely replaces the built-in default tool set for CHAT mode. There is no merge/append. Omit the field (or set to `null`) to keep the defaults: `read`, `bash`, `grep`, `find`, `ls`, `web_search`, `fetch_content`, `get_search_content`, `artifact`.

Example — allow only the read-only file tools plus `artifact`:

```json
{
  "allowedTools": ["read", "grep", "find", "ls", "artifact"]
}
```

## Footer & Chat Input Integration

Chat mode surfaces in two other extensions:

- The [`footer`](../footer/README.md) `chat_mode` segment shows `Chat mode: OFF` / `ON` (hidden when this extension is not loaded).
- The [`chat-input`](../chat-input/README.md) border switches to a distinct colour and prefix (`»`) while chat mode is active, mirroring plan-mode styling.