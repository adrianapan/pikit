# slop-footer

A customizable footer for the pi coding agent. Provides a rich status bar at the bottom of the terminal showing model info, git status, token usage, and more.

<img src="demo.png" alt="slop-footer">

## Features

- **Customizable segments**: Choose which info to display on the left and right sides
- **Git integration**: Shows current branch and working tree status (staged, unstaged, untracked)
- **Token tracking**: Display input/output/total tokens and cache read/write
- **Context awareness**: Shows context window usage percentage
- **Thinking level**: Visual indicator of model reasoning level
- **Nerd Font support**: Automatic detection with ASCII fallbacks
- **Live updates**: Git status refreshes automatically as you work

## Installation

Install from npm using pi:

```bash
pi install npm:slop-footer
```

Or copy the extension files to your pi extensions directory manually:

```bash
# Copy to global extensions directory
cp -r . ~/.pi/agent/extensions/slop-footer

# Or use directly for testing
pi -e ./src/index.ts
```

## Configuration

Create `~/.pi/agent/configs/slop-footer.json` to customize the footer:

```json
{
  "leftSegments": [
    "pi",
    "separator",
    "model",
    "separator",
    "thinking",
    "separator",
    "path",
    "git"
  ],

  "rightSegments": [
    "context_pct",
    "separator",
    "token_total",
    "token_in",
    "token_out",
    "separator",
    "cost"
  ],
  "icons": {
    "pi": "π",
    "model": "◈",
    "thinking": "🧠",
    "folder": "📁",
    "git": "⎇",
    "tokens": "⊛",
    "input": "↑",
    "output": "↓",
    "cacheRead": "↙",
    "cacheWrite": "↗",
    "contextPct": "◫",
    "separator": "|"
  },
  "colors": {
    "pi": "accent",
    "model": "#d787af",
    "path": "#00afaf",
    "git": "success",
    "gitDirty": "warning",
    "gitClean": "success",
    "thinking": "muted",
    "context": "dim",
    "contextWarn": "warning",
    "contextError": "error",
    "cost": "text",
    "tokens": "muted",
    "separator": "dim"
  },
  "segmentOptions": {
    "path": {
      "mode": "basename"
    },
    "git": {
      "showBranch": true,
      "showStaged": true,
      "showUnstaged": true,
      "showUntracked": true
    },
    "context_pct": {
      "showAutoIcon": false
    }
  }
}
```

## Available Segments

| Segment | Description | `segmentOptions` |
|---------|-------------|-----------------|
| `pi` | Pi logo/icon | — |
| `model` | Current model name | `showThinkingLevel` (bool, default `false`) — appends thinking level inline with a `·` separator |
| `thinking` | Standalone thinking/reasoning level indicator | `prefix` (string) — prepended to the level label, e.g. `"Thinking: "` |
| `path` | Current working directory | `mode`: `"basename"` (default) · `"abbreviated"` (with `~`, capped at `maxLength`) · `"full"` |
| `git` | Git branch and status | `showBranch`, `showStaged`, `showUnstaged`, `showUntracked` (all bool, all default `true`) |
| `token_in` | Input tokens this session | `mode`: `"icons"` (default) · `"text"` (renders as `In: 12k`) |
| `token_out` | Output tokens this session | `mode`: `"icons"` (default) · `"text"` (renders as `Out: 4k`) |
| `token_total` | Total tokens (input + output + cache) | `mode`: `"icons"` (default) · `"text"` (renders as `Tokens: 16k`) |
| `cache_read` | Cache read tokens (hidden if zero) | — |
| `cache_write` | Cache write tokens (hidden if zero) | — |
| `cost` | Estimated API cost in USD | — |
| `context_pct` | Context window usage percentage | `showAutoIcon` (bool, default `false`) — shows auto-compact icon when enabled |
| `context_total` | Total context window size | — |
| `separator` | Visual separator between segments | — |
| `text:...` | Literal text, e.g. `text:⚡` | — |

## Git Status Indicators

The `git` segment shows:
- Branch name with icon
- `*N` - Unstaged changes (warning color)
- `+N` - Staged changes (success color)  
- `?N` - Untracked files (muted color)

Colors indicate clean (green) vs dirty (yellow) working tree.

## Icons

Nerd Fonts are supported on **macOS and Linux**. The extension auto-detects support based on your terminal (`TERM_PROGRAM`) and falls back to plain ASCII/Unicode symbols if none is found. Supported terminals are detected automatically: Ghostty, WezTerm, Kitty, iTerm2, and Alacritty.

You can also force the detection:

```bash
export SLOP_FOOTER_NERD_FONTS=1  # force Nerd Fonts on
export SLOP_FOOTER_NERD_FONTS=0  # force plain icons
```

### Installing a Nerd Font (macOS)

On macOS with Homebrew:

```bash
brew install fontconfig
brew install --cask font-jetbrains-mono-nerd-font
```

Other Nerd Fonts are available via `brew search nerd-font`.

### Configuring iTerm2

After installing a Nerd Font, set it in iTerm2:

1. Open **Settings → Profiles → Text**
2. Set **Font** to `JetBrainsMonoNL Nerd Font Mono`, size `12`
3. Enable **Use a different font for non-ASCII text** and set the same font there — this is required for the icons to render correctly

### Custom Icons

To swap out any icon, add an `icons` key to your `~/.pi/agent/configs/slop-footer.json`. You can browse all available Nerd Font glyphs at [nerdfonts.com/cheat-sheet](https://www.nerdfonts.com/cheat-sheet) — copy the **UTF-8 codepoint** (e.g. `\uF126`) or the glyph character directly and paste it into your config:

```json
{
  "icons": {
    "branch": "\uF126",
    "separator": "\uE0B1"
  }
}
```
