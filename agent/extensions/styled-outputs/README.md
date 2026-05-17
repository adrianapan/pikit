# styled-outputs

Custom styled rendering for every message type in pi — assistant messages, user messages, thinking blocks, tool executions, skill invocations, and MCP tools. Replaces the default flat output with prefix icons, colour-coded diffs, expandable sections, grouped tool configs, and per-tool-type rendering.

## Features

- **Assistant messages** — Prefixed lines with configurable icon and colour
- **User messages** — Prefixed with custom icon; optional theme background toggle
- **Thinking blocks** — Animated prefix with optional label ("Thinking:"); continuation lines align to prefix width, not the label
- **Tool executions** — Custom call/result renderers for `read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`, web tools, and MCP tools
- **Diff viewer** — Side-by-side-style diff highlighting for `edit` and `write` with added/removed/context colours; skips oversized files (configurable threshold)
- **Skill invocations** — Expandable skill blocks with prefix icon, title, and content
- **Custom messages** — Expandable custom messages with prefix icon, type name, and content; all custom messages get styled output regardless of registered renderers
- **Tool spinner** — Animated character spinner while tools are running
- **Bash execution** — `!` commands styled as `Command`, `!!` commands styled as `Shell` (no context); error prefix swaps to `✗`
- **Group-aware config** — Override any general tool setting per group (`base`, `mcp`, `web`, `custom`); unset properties fall through to `general`
- **Theme-aware colours** — All colour fields accept pi theme tokens (`"accent"`, `"dim"`, etc.) or hex values (`"#ff6347"`)
- **Expand/collapse** — Tool outputs and skill blocks collapse by default; expand with a keypress

## Installation

Included in the pi-dev repo. Auto-discovered from `~/.pi/agent/extensions/`. No additional installation required.

To use it outside this repo, copy the extension directory to your pi extensions folder or load it directly:

```bash
pi -e ./src/index.ts
```

## Configuration

Copy the example config and edit it:

```bash
cp ~/.pi/agent/extensions/styled-outputs/styled-outputs.example.json \
   ~/.pi/agent/configs/styled-outputs.json
```

All fields are optional — omit any field to keep its default.

### Assistant message

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `assistantMessage.prefix` | `string` | `"●"` | Prefix icon on the first line of content |
| `assistantMessage.color` | `string` | `"text"` | Colour for the prefix icon (theme token or hex) |

### User message

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `userMessage.prefix` | `string` | `"❯"` | Prefix icon on the first line |
| `userMessage.color` | `string` | `"accent"` | Colour for the prefix icon |
| `userMessage.bodyColor` | `string` | `"text"` | Colour for message body text |
| `userMessage.isThemeBackgroundVisible` | `boolean` | `true` | Keep the default theme background behind user messages |

### Thinking message

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `thinkingMessage.prefix` | `string` | `"✽"` | Prefix icon character |
| `thinkingMessage.prefixColor` | `string` | `"accent"` | Colour for the prefix icon |
| `thinkingMessage.label` | `string` | `"Thinking:"` | Label text shown after the prefix when `isLabelVisible` is `true` |
| `thinkingMessage.labelColor` | `string` | `"muted"` | Colour for the label text |
| `thinkingMessage.isLabelVisible` | `boolean` | `false` | Show the label on the first line |
| `thinkingMessage.messageColor` | `string` | `"dim"` | Colour for thinking content |

> **Note:** When `isLabelVisible` is `true`, continuation lines align to the prefix width (e.g. ` ✽ `), not the full first-line prefix (` ✽ Thinking: `). The label is a one-time header.

### Skill invocation

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `skills.prefix` | `string` | `"✓"` | Prefix icon |
| `skills.prefixColor` | `string` | `"accent"` | Colour for the prefix |
| `skills.titleColor` | `string` | `"toolTitle"` | Colour for the skill title |
| `skills.nameColor` | `string` | `"dim"` | Colour for the skill name in the title |
| `skills.labelColor` | `string` | `"success"` | Colour for status labels (e.g. "DONE") |
| `skills.expandHintColor` | `string` | `"dim"` | Colour for the expand/collapse hint |
| `skills.outputColor` | `string` | `"dim"` | Colour for expanded content |

### Custom message

Styled rendering for all custom messages. Custom messages registered via `pi.registerMessageRenderer()` are also styled by this extension — the registered renderer is ignored in favor of consistent styled output.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `customMessages.prefix` | `string` | `"✓"` | Prefix icon |
| `customMessages.prefixColor` | `string` | `"accent"` | Colour for the prefix |
| `customMessages.titleColor` | `string` | `"toolTitle"` | Colour for the "Custom tool" label |
| `customMessages.nameColor` | `string` | `"dim"` | Colour for the custom type name |
| `customMessages.labelColor` | `string` | `"success"` | Colour for status labels (e.g. "Loaded") |
| `customMessages.expandHintColor` | `string` | `"dim"` | Colour for the expand/collapse hint |
| `customMessages.outputColor` | `string` | `"dim"` | Colour for expanded content |

### Bash execution (! and !! commands)

`!` and `!!` commands share the same visual pattern as tool executions:

- **`!` commands** — labelled `Command` (output is included in LLM context)
- **`!!` commands** — labelled `Shell` (output runs in background, excluded from context)

Both use the same header format, status footer, and expandable output. The label word is the only visual difference — no border, no separate `$` prefix icon.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `bashExecution.titleColor` | `string` | `"toolTitle"` | Colour for the "Command" / "Shell" label |

### Tool execution

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `tools.toolSpinnerPrefix.prefixChars` | `string[]` | `["·","✢","✳","✶","✻","✽"]` | Characters cycling in the loading spinner |
| `tools.toolSpinnerPrefix.color` | `string` | `"muted"` | Colour for the spinner |
| `tools.toolSuccess.prefix` | `string` | `"✓"` | Icon for successful tool runs |
| `tools.toolSuccess.prefixColor` | `string` | `"success"` | Colour for the success icon |
| `tools.toolSuccess.labelColor` | `string` | `"success"` | Colour for the success label (status line) |
| `tools.toolError.prefix` | `string` | `"✗"` | Icon for failed tool runs |
| `tools.toolError.prefixColor` | `string` | `"error"` | Colour for the error icon |
| `tools.toolError.labelColor` | `string` | `"error"` | Colour for the error label (status line) |
| `tools.toolBranch.prefix` | `string` | `"└─"` | Icon before the status line |
| `tools.toolBranch.color` | `string` | `"separator"` | Colour for the branch icon |

### Tool general settings

These apply to all tool types unless overridden by a group.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `tools.general.titleColor` | `string` | `"toolTitle"` | Colour for tool titles |
| `tools.general.summaryColor` | `string` | `"dim"` | Colour for the summary line |
| `tools.general.countColor` | `string` | `"muted"` | Colour for counts (e.g. "Tool 1 of 3") |
| `tools.general.expandHintColor` | `string` | `"dim"` | Colour for expand/collapse hints |
| `tools.general.outputColor` | `string` | `"dim"` | Colour for tool output text |
| `tools.general.maxExpandedLines` | `number` | `40` | Max lines shown when a tool result is expanded |
| `tools.general.moreColor` | `string` | `"muted"` | Colour for "more" separator text |
| `tools.general.moreBgColor` | `string` | `"separator"` | Background colour for the "more" separator |
| `tools.general.isThemeBackgroundVisible` | `boolean` | `false` | Apply theme background behind tool blocks, skill invocations, and custom messages |
| `tools.general.verticalPadding` | `number` | `0` | Vertical padding inside tool content boxes (0 = compact, core default = 1) |
| `tools.general.horizontalPadding` | `number` | `3` | Horizontal padding inside tool content boxes (left+right indent; core default = 1) |
| `tools.general.diffAddedColor` | `string` | `"toolDiffAdded"` | Colour for diff added lines |
| `tools.general.diffRemovedColor` | `string` | `"toolDiffRemoved"` | Colour for diff removed lines |
| `tools.general.diffContextColor` | `string` | `"toolDiffContext"` | Colour for diff context lines |
| `tools.general.maxDiffFileSize` | `string\|number` | `"1MB"` | Skip diff rendering for files exceeding this size |

### Tool groups

Any `tools.general` key can be overridden per group. Unset properties fall through to `general`.

| Key | Description |
|-----|-------------|
| `tools.groups.base` | Built-in tool renderers (`read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`) |
| `tools.groups.mcp` | MCP tool renderers |
| `tools.groups.web` | Web tool renderers (`web_search`, `fetch_content`, `get_search_content`) |
| `tools.groups.custom` | Any other tool |

Example — give MCP tools a different title colour and expanded line limit:

```json
{
  "tools": {
    "groups": {
      "mcp": {
        "titleColor": "#c07898",
        "maxExpandedLines": 20
      }
    }
  }
}
```

### Colour values

Every colour field accepts either:

- A **pi theme token** — e.g. `"accent"`, `"dim"`, `"muted"`, `"success"`, `"error"`, `"warning"`, `"separator"`, `"toolTitle"`, `"toolDiffAdded"`, `"toolDiffRemoved"`, `"toolDiffContext"`
- A **hex colour** — e.g. `"#ff6347"`, `"#c07898"`

Theme tokens adapt to your active theme automatically.

## How it works

The extension patches pi's built-in message components (`AssistantMessage`, `UserMessage`, `ToolExecution`, `SkillInvocationMessage`, `CustomMessage`, `BashExecution`) at prototype level. A `Symbol.for` patch flag prevents double-patching on reload.

For `BashExecutionComponent`, the extension listens to the `user_bash` event to determine whether a command is `!` (Command) or `!!` (Shell), then patches `updateDisplay` to strip borders and apply the styled header/status/output format.

Tool renderers are registered via `pi.registerTool()` for built-in tools (`read`, `bash`, `edit`, `write`, `grep`, `find`, `ls`) — each with custom call and result renderers. For web tools and MCP tools, the extension patches `getCallRenderer` / `getResultRenderer` to provide specialised renderers when no built-in renderer exists.

All rendering uses factory functions + closures (no classes). Derived values like prefix widths and padding are computed from config — change a prefix icon and the alignment adjusts automatically.

## Structure

```
styled-outputs/
├── package.json
├── styled-outputs.example.json
└── src/
    ├── index.ts                # Extension entry point, patching & tool registration
    ├── config.ts               # Defaults + user config loading
    ├── types.ts                # TypeScript interfaces for user config
    ├── utils.ts                # Colour helpers, ANSI utilities, path shortening
    └── components/
        ├── assistant-message.ts # Assistant message renderer
        ├── thinking-message.ts # Thinking block renderer
        ├── user-message.ts     # User message renderer
        ├── skill-message.ts    # Skill invocation renderer
        ├── custom-message.ts   # Custom message renderer
        ├── base-renderer.ts    # Built-in tool call/result renderers
        ├── mcp-renderer.ts     # MCP tool call/result renderers
        ├── web-renderer.ts     # Web tool call/result renderers
        ├── markdown-result.ts  # Shared markdown result renderer
        └── tool-shared.ts      # Group config resolution, spinner, branch/indent helpers
```