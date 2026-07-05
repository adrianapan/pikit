# pikit-chat-input — configurable boxed chat input for [pi.dev](https://pi.dev)

Replaces the default chat input with a configurable, boxed input. All native editor features — cursor movement, history, autocomplete, paste — work normally inside the box.

<img src="https://raw.githubusercontent.com/adrianapan/pikit/main/agent/extensions/chat-input/preview.png" alt="chat-input preview">

## Install

```bash
pi install npm:pikit-chat-input
```

> [!TIP]
> Or grab the entire [pikit](https://github.com/adrianapan/pikit) setup, an opinionated pi.dev configuration that includes this extension.


## Features

- **Full box border**: With configurable inner spacing
- **Theme-aware borders**: Pulls border colour from your active theme
- **Menu outside box**: Slash menu (`/`) appears below the box
- **Scroll indicators**: Shows `↑ N more` / `↓ N more` when content scrolls
- **Responsive**: Adapts to terminal width; degrades gracefully on narrow terminals
- **Unboxed mode**: Optionally drop side borders for a minimal horizontal-rule look
- **ASCII companion**: Cat ascii companion

## Configuration

User config lives in `~/.pi/agent/configs/chat-input.json`. Create it to override defaults:

```json
{
  "boxedView": false,
  "borderColor": "border",
  "prefix": "❯",
  "prefixColor": "accent",
  "planModePrefix": "⏸",
  "planModePrefixColor": "customMessageLabel",
  "planModeBorderColor": "customMessageLabel",
  "chatModePrefix": "»",
  "chatModePrefixColor": "chatModeBorder",
  "chatModeBorderColor": "chatModeBorder",
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
| `prefix` | `string` | `"❯"` | Unicode prefix character shown on the first body line. |
| `prefixColor` | `string` | `"accent"` | Theme colour token **or** hex colour |
| `planModeBorderColor` | `string` | `"customMessageLabel"` | Border colour in plan/execute mode (theme token or hex) |
| `planModePrefix` | `string` | `"⏸"` | Prefix character in plan/execute mode |
| `planModePrefixColor` | `string` | `"customMessageLabel"` | Prefix colour in plan/execute mode (theme token or hex) |
| `chatModeBorderColor` | `string` | `"chatModeBorder"` | Border colour in chat mode (theme token or hex) |
| `chatModePrefix` | `string` | `"»"` | Prefix character in chat mode |
| `chatModePrefixColor` | `string` | `"chatModeBorder"` | Prefix colour in chat mode (theme token or hex) |
| `companion.enabled` | `boolean` | `false` | Show a rotating ASCII cat companion above the input. When disabled, top padding is `0`. |
| `companion.color` | `string` | `"accent"` | Theme colour token **or** hex colour for the companion art. |

### Border colour tokens

Any valid theme colour token works. See your active theme in `~/.pi/agent/themes/` or via `/settings → Theme` for available tokens.

Chat mode gets its own border/prefix styling like plan mode — see the [`chat-mode`](../chat-mode/README.md) extension. Precedence when multiple modes are active: bash > plan > chat > default (in practice modes are mutually exclusive).
