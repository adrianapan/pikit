# slop-startup

A startup header for the pi coding agent. Displays a two-column welcome box at session start showing model info, current project, loaded configuration counts, quick tips, and recent sessions.

<img src="demo.png" alt="slop-startup">

## Features

- **Model info**: Shows the active model name and provider
- **Project context**: Displays the current working directory name
- **Loaded counts**: Reports how many context files, extensions, skills, and prompt templates are active
- **Recent sessions**: Lists the 3 most recently touched sessions with relative timestamps
- **Quick tips**: Inline keyboard shortcut reminders (`/`, `!`, `Shift+Tab`)
- **Responsive layout**: Box adapts to terminal width; hidden below 44 columns
- **Nerd Font icons**: Uses Nerd Font glyphs where available

## Installation

Install from npm using pi:

```bash
pi install npm:slop-startup
```

Or copy the extension files to your pi extensions directory manually:

```bash
cp -r . ~/.pi/agent/extensions/slop-startup
```

Or load it directly for testing:

```bash
pi -e ./src/index.ts
```

## What it shows

### Left column
| Item | Description |
|------|-------------|
| Model name | Name of the active model (e.g. `claude-sonnet-4-6`) |
| Provider | Model provider (e.g. `anthropic`) |
| Working directory | `basename` of the current `cwd` |
| pi agent version | Running version of the pi agent |

### Right column
| Section | Description |
|---------|-------------|
| **Tips** | Keyboard shortcuts: `/` for commands, `!` for bash, `Shift+Tab` to cycle thinking |
| **Loaded** | Count of context files, extensions, skills, prompt templates, and MCP servers discovered |
| **Recent sessions** | Up to 3 recent session names with time elapsed (e.g. `3h ago`) |

## Loaded counts discovery

The extension scans standard pi paths to count what is active:

| Type | Paths scanned |
|------|---------------|
| Context files | `~/.pi/agent/AGENTS.md`, `~/.claude/AGENTS.md`, `<cwd>/AGENTS.md`, `<cwd>/CLAUDE.md`, `<cwd>/.pi/AGENTS.md` |
| Extensions | `~/.pi/agent/settings.json`, `<cwd>/.pi/settings.json` (npm packages), plus `~/.pi/agent/extensions/`, `<cwd>/.pi/extensions/`, `<cwd>/extensions/` (local dirs) |
| Skills | `~/.pi/agent/skills/`, `<cwd>/.pi/skills/`, `<cwd>/skills/` (dirs with `SKILL.md`) |
| Prompt templates | `~/.pi/agent/prompts/`, `~/.pi/agent/commands/`, `~/.claude/commands/`, `<cwd>/.pi/commands/`, `<cwd>/.claude/commands/` |
| MCP servers | `~/.pi/agent/configs/slop-mcp.json` |

## Recent sessions discovery

Sessions are found by scanning `~/.pi/agent/sessions/` and `~/.pi/sessions/` for `.jsonl` files. The parent directory name is used as the project name. Entries are deduplicated and sorted by modification time.

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
2. Set **Font** to `JetBrainsMonoNL Nerd Font Propo`, size `12`
3. Enable **Use a different font for non-ASCII text** and set the same font there — this is required for the icons to render correctly