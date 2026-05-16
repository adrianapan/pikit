# chat-input

Replaces the default chat input with a configurable, boxed input. All native editor features — cursor movement, history, autocomplete, paste — work normally inside the box.

## Features

- **Full box border**: With configurable inner spacing
- **Theme-aware borders**: Pulls border colour from your active theme
- **Menu outside box**: Slash menu (`/`) appears below the box
- **Scroll indicators**: Shows `↑ N more` / `↓ N more` when content scrolls
- **Responsive**: Adapts to terminal width; degrades gracefully on narrow terminals
- **Unboxed mode**: Optionally drop side borders for a minimal horizontal-rule look
- **ASCII companion**: Rotating cat (7 expressions, 5s interval) shown above the input

## Installation

This extension is included in the pi-dev repo and auto-discovered from
`~/.pi/agent/extensions/`. No additional installation is required.

To use it outside this repo, copy the extension directory to your
pi extensions folder manually or load it directly:

```bash
pi -e ./src/index.ts
```

## Configuration

User config lives in `~/.pi/agent/configs/chat-input.json`. Create it to override defaults:

```json
{
  "boxedView": true,
  "companion": {
    "enabled": true,
    "color": "accent"
  }
}
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `boxedView` | `boolean` | `true` | `true` = full box with side borders. `false` = top/bottom horizontal rules only, no sides. |
| `boxPadX` | `number` | `1` | Horizontal padding inside the box. |
| `menuGap` | `number` | `0` | Blank lines between bottom border and slash-menu. |
| `extraMenuIndent` | `number` | `1` | Extra indent (spaces) for slash-menu lines. |
| `borderColor` | `string` | `"border"` | Theme colour token **or** hex colour |
| `prefixColor` | `string` | `"accent"` | Theme colour token **or** hex colour |
| `prefix` | `string` | `"❯"` | Unicode prefix character shown on the first body line. |
| `planModeBorderColor` | `string` | `"customMessageLabel"` | Border colour in plan/execute mode (theme token or hex) |
| `planModePrefixColor` | `string` | `"customMessageLabel"` | Prefix colour in plan/execute mode (theme token or hex) |
| `planModePrefix` | `string` | `"⏸"` | Prefix character in plan/execute mode |
| `companion.enabled` | `boolean` | `true` | Show a rotating ASCII cat companion above the input. 7 expressions rotate every 5 seconds. |
| `companion.color` | `string` | `"accent"` | Theme colour token **or** hex colour for the companion art. |

### Border colour tokens

Any valid theme colour token works. See your active theme in `~/.pi/agent/themes/` or via `/settings → Theme` for available tokens.
