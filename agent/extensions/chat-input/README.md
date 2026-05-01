# chat-input

Replaces the default chat input with a configurable, boxed input. All native editor features — cursor movement, history, autocomplete, paste — work normally inside the box.

## Features

- **Full box border**: With configurable inner spacing
- **Theme-aware borders**: Pulls border colour from your active theme
- **Menu outside box**: Slash menu (`/`) appears below the box
- **Scroll indicators**: Shows `↑ N more` / `↓ N more` when content scrolls
- **Responsive**: Adapts to terminal width; degrades gracefully on narrow terminals


## Installation

This extension is included in the pi-dev repo and auto-discovered from
`~/.pi/agent/extensions/`. No additional installation is required.

To use it outside this repo, copy the extension directory to your
pi extensions folder manually or load it directly:

```bash
pi -e ./src/index.ts
```

## Configuration

All configuration is done in `src/index.ts`. Edit the constants at the top of the file:

```ts
// ─── Config ───────────────────────────────────────────────────────────────
const BOX_PAD_X = 1;          // spaces between │ and text inside the box
const MENU_GAP = 0;           // blank lines between box bottom and menu
const EXTRA_MENU_INDENT = 1;  // extra spaces before menu lines below box
const BORDER_TOKEN = "border"; // border colour from theme
```

| Constant | Description | Default |
|----------|-------------|---------|
| `BOX_PAD_X` | Horizontal padding inside the box. Total gap from `│` to text = this value + 1 (for the border char itself). | `1` |
| `MENU_GAP` | Blank lines between the box bottom and the slash menu. | `0` |
| `EXTRA_MENU_INDENT` | Extra spaces to indent menu lines below the box. Menu is already indented by 1 space by default. | `1` |
| `BORDER_TOKEN` | Theme colour token for the box border. | `"border"` |

### Border colour tokens

Any valid theme colour token works. See your active theme in `~/.pi/agent/themes/` or via `/settings → Theme` for available tokens.