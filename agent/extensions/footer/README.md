# footer

A customizable two-row footer for the pi coding agent. Provides a rich status bar at the bottom of the terminal showing model info, git status, token usage, and more.

## Layout

```
Row 1 left:  π | <model name> (<provider>) | <folder> <path> <branch> <dirty>
Row 1 right: <context bar> <pct%> / <max tokens>

Row 2 left:  Thinking: <LEVEL> | Caveman mode: <VALUE>
Row 2 right: T: <total> (<cached> cached) ↑ <in> ↓ <out> | $<cost>
```

## Features

- **Two-row layout**: Info grouped by purpose across two lines
- **Context bar**: 20-character gradient block bar with configurable colours and % indicator
- **Git integration**: Shows current branch and working tree status (staged, unstaged, untracked)
- **Token tracking**: Composite `T:` line with total, cached, input, and output counts
- **Thinking level**: Faint label + CAPS level name with per-level colour
- **Caveman mode indicator**: Shows active caveman mode when the caveman extension is loaded
- **Nerd Font support**: Automatic detection with ASCII fallbacks
- **Live updates**: Git status refreshes automatically as you work

## Installation

This extension is included in the pi-dev repo and auto-discovered from
`~/.pi/agent/extensions/`. No additional installation is required.

To use it outside this repo, copy the extension directory to your
pi extensions folder manually or load it directly:

```bash
pi -e ./src/index.ts
```

## Configuration

Create `~/.pi/agent/configs/footer.json` to customise the footer. Each row's
left and right segments are configured independently:

```json
{
  "row1LeftSegments":  ["pi", "separator", "model", "separator", "path", "git"],
  "row1RightSegments": ["context_pct"],
  "row2LeftSegments":  ["thinking", "separator", "caveman"],
  "row2RightSegments": ["token_total", "separator", "cost"],

  "colors": {
    "model": "#c07898",
    "thinkingHigh": "#afb9fe",
    "separator": "#87827a"
  },

  "segmentOptions": {
    "path": { "mode": "basename" },
    "git": {
      "showBranch": true,
      "showStaged": true,
      "showUnstaged": true,
      "showUntracked": true
    }
  }
}
```

See `footer.example.json` in this directory for a full annotated example.

## Available Segments

| Segment | Description | Notes |
|---------|-------------|-------|
| `pi` | π symbol in accent blue | — |
| `model` | Model name in pink + `(provider)` in dim | No icon; provider omitted if unavailable |
| `path` | Current working directory | `segmentOptions.path.mode`: `"basename"` (default) · `"abbreviated"` · `"full"` |
| `git` | Git branch and dirty indicators | `showBranch`, `showStaged`, `showUnstaged`, `showUntracked` (all bool) |
| `context_pct` | Gradient bar + `X.X%` + max tokens | Bar fully configurable via `segmentOptions.contextBar` (see below). % and max tokens use `contextLabel` colour. Max tokens formatted with K/M suffix (e.g. `128k`, `2M`). Set `DEBUG_PCT` in `context.ts` to a number (0–100) to pin the bar at a fixed value for visual testing. |
| `cost` | `$<amount>` | `$` dim, amount in `cost` colour (`muted` by default) |
| `thinking` | `Thinking: <LEVEL>` | Dim label, CAPS level with per-level colour; always visible |
| `caveman` | `Caveman mode: <MODE>` | Hidden when caveman extension not loaded |
| `token_total` | `T: <total> (<cached> cached) ↑ <in> ↓ <out>` | Labels dim, numbers in `tokens` colour (`muted` by default) |
| `token_in` | Input tokens | Available for custom layouts |
| `token_out` | Output tokens | Available for custom layouts |
| `cache_read` | Cache read tokens (hidden if zero) | — |
| `cache_write` | Cache write tokens (hidden if zero) | — |
| `context_total` | Total context window size | — |
| `separator` | `\|` divider | Coloured via `separator` in `colors` |
| `text:...` | Literal text, e.g. `text:⚡` | — |

## Context Bar

The `context_pct` segment's bar is fully configurable via `segmentOptions.contextBar`:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `barWidth` | number | `18` | Number of characters wide |
| `filledChar` | string | `"▋"` | Character used for the filled portion |
| `unfilledChar` | string | `"▋"` | Character used for the unfilled portion |
| `unfilledColor` | color | `"#4e4c49"` | Color of the unfilled portion — hex or pi theme token |
| `gradientStart` | color | `"#f29373"` | Gradient color at the left/empty end — hex or pi theme token |
| `gradientMid` | color | `"#d67858"` | Gradient midpoint color — hex or pi theme token |
| `gradientEnd` | color | `"#ae4f2f"` | Gradient color at the right/full end — hex or pi theme token |
| `gradientMidPoint` | number | `0.55` | Where `gradientMid` sits along the bar (0–1). Below this fraction the gradient runs start→mid; above it mid→end |

All color fields accept either a hex string (e.g. `"#ff6347"`) or a pi theme token (e.g. `"accent"`, `"warning"`, `"dim"`).

```json
{
  "segmentOptions": {
    "contextBar": {
      "barWidth": 20,
      "unfilledColor": "dim",
      "gradientStart": "#56b6c2",
      "gradientMid": "#61afef",
      "gradientEnd": "#c678dd",
      "gradientMidPoint": 0.4
    }
  }
}
```

## Thinking Levels

The `thinking` segment shows per-level colours:

| Level | Display | Default colour |
|-------|---------|---------------|
| `off` | `OFF` | dim |
| `minimal` | `MINIMAL` | muted |
| `low` | `LOW` | warning |
| `medium` | `MEDIUM` | success |
| `high` | `HIGH` | `#afb9fe` |
| `xhigh` | `EXTRA HIGH` | rainbow gradient |
| `max` | `MAX` | rainbow gradient |

Override any level colour via the corresponding key in `colors`. Setting `thinkingXhigh` or `thinkingMax` replaces the rainbow gradient with a solid colour:

```json
{
  "colors": {
    "thinkingXhigh": "#9575cd",
    "thinkingMax": "#ce93d8"
  }
}
```

## Git Status Indicators

The `git` segment shows:
- Branch name coloured green (clean) or amber (dirty)
- `*N` — unstaged changes
- `+N` — staged changes
- `?N` — untracked files

## Icons

Nerd Font icons are auto-detected from your terminal. Ghostty, WezTerm, Kitty, iTerm2, Alacritty, Foot, Rio, and Contour are recognised automatically — everything else falls back to plain Unicode symbols. If detection gets it wrong (e.g. when running inside tmux), override it:

```bash
export FOOTER_NERD_FONTS=1  # force Nerd Fonts on
export FOOTER_NERD_FONTS=0  # force plain icons
```

### Installing a Nerd Font (macOS)

```bash
brew install --cask font-jetbrains-mono-nerd-font
```

Other fonts available via `brew search nerd-font`.

### Configuring iTerm2

1. Open **Settings → Profiles → Text**
2. Set **Font** to `JetBrainsMonoNL Nerd Font Propo`, size `10` (recommended)
3. Enable **Use a different font for non-ASCII text** and set the same font there — required for icons to render correctly

### Custom Icons

To swap out any icon, add an `icons` key to your `~/.pi/agent/configs/footer.json`. Browse available Nerd Font glyphs at [nerdfonts.com/cheat-sheet](https://www.nerdfonts.com/cheat-sheet):

```json
{
  "icons": {
    "branch": "",
    "separator": "|"
  }
}
```
