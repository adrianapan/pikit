# startup

A startup header for the pi coding agent. Displays a three-column welcome box at session start showing the pi logo, loaded configuration counts, and quick keyboard shortcuts.

<img src="demo.png" alt="startup">

## Features

- **Pi logo**: ASCII art rendered in the accent colour
- **Loaded counts**: Reports how many extensions, skills, MCP configs, prompt templates, and context files are active
- **Quick tips**: Inline keyboard shortcut reminders (`/`, `!`, `Ctrl+P`, `Shift+Tab`)
- **Version banner**: Agent version shown in the top border
- **Responsive layout**: Box adapts to terminal width; hidden below 44 columns
- **Nerd Font icons**: Uses Nerd Font glyphs where available, falls back to plain Unicode symbols automatically

## Installation

Install from npm using pi:

```bash
pi install npm:startup
```

Or copy the extension files to your pi extensions directory manually:

```bash
cp -r . ~/.pi/agent/extensions/startup
```

Or load it directly for testing:

```bash
pi -e ./src/index.ts
```

## What it shows

| Column | Content |
|--------|---------|
| Left | Pi ASCII art logo |
| Centre | Counts of extensions, skills, MCP configs, prompt templates, and context files |
| Right | Keyboard shortcuts: `/` for commands, `!` for bash, `Ctrl+P` cycle model, `Shift+Tab` cycle thinking |

## Loaded counts discovery

The extension scans standard pi paths to count what is active:

| Type | Paths scanned |
|------|---------------|
| Context files | `~/.pi/agent/AGENTS.md`, `~/.claude/AGENTS.md`, `<cwd>/AGENTS.md`, `<cwd>/CLAUDE.md`, `<cwd>/.pi/AGENTS.md` |
| Extensions | `~/.pi/agent/settings.json`, `<cwd>/.pi/settings.json` (npm packages), plus `~/.pi/agent/extensions/`, `<cwd>/.pi/extensions/`, `<cwd>/extensions/` (local dirs) |
| Skills | `~/.pi/agent/skills/`, `<cwd>/.pi/skills/`, `<cwd>/skills/` (dirs with `SKILL.md`) |
| Prompt templates | `~/.pi/agent/prompts/`, `~/.pi/agent/commands/`, `~/.claude/commands/`, `<cwd>/.pi/commands/`, `<cwd>/.claude/commands/` |
| MCP servers | `~/.pi/agent/configs/mcp.json` |

## Icons

Nerd Font icons are auto-detected from your terminal. Ghostty, WezTerm, Kitty, iTerm2, and Alacritty are recognised automatically — everything else falls back to plain Unicode symbols. If detection gets it wrong (e.g. when running inside tmux), override it:

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
2. Set **Font** to `JetBrainsMonoNL Nerd Font Propo`, size `12`
3. Enable **Use a different font for non-ASCII text** and set the same font there — required for icons to render correctly
