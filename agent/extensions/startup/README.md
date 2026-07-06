# startup

A startup header for the pi coding agent. Displays a three-column welcome box at session start showing the pi logo, loaded configuration counts, and quick keyboard shortcuts.

<img alt="preview" src="https://github.com/user-attachments/assets/18d9730b-7df1-48a5-b91e-404454bcb06f" />

## Features

- **Pi logo**: ASCII art rendered in the accent colour
- **Loaded counts**: Reports how many extensions, skills, MCP configs, prompt templates, and context files are active
- **Quick tips**: Inline keyboard shortcut reminders
- **Version banner**: Agent version shown in the top border
- **Responsive layout**: Box adapts to terminal width; hidden below 44 columns
- **Nerd Font icons**: Uses Nerd Font glyphs where available, falls back to plain Unicode symbols automatically

## What it shows

| Column | Content |
|--------|---------|
| Left | Pi ASCII art logo |
| Centre | Counts of extensions, skills, MCP configs, prompt templates, and context files |
| Right | Keyboard shortcuts |

## Loaded counts discovery

The extension counts what is active via pi's command registry and standard pi paths:

| Type | Source |
|------|--------|
| Models | `~/.pi/agent/settings.json`, `<cwd>/.pi/settings.json` (`enabledModels`) |
| Context files | `~/.pi/agent/AGENTS.md`, `~/.claude/AGENTS.md`, `<cwd>/AGENTS.md`, `<cwd>/CLAUDE.md`, `<cwd>/.pi/AGENTS.md` |
| Extensions | `~/.pi/agent/settings.json`, `<cwd>/.pi/settings.json` (each package's `package.json` `pi.extensions` manifest — glob-expanded, with `!`/`+`/`-` overrides — under `npm/node_modules/<name>` and `git/<host>/<path>`, user + project scope; packages with no manifest fall back to a convention `extensions/` dir; object-form entries may additionally filter via an `extensions` array, where `[]` disables all), plus local dirs `~/.pi/agent/extensions/`, `<cwd>/.pi/extensions/`, `<cwd>/extensions/` (smart discovery: flat `.ts`/`.js` files and `index.ts` subdirs, mirroring pi's `collectAutoExtensionEntries`) |
| Skills | pi command registry — `pi.getCommands()` with `source: "skill"` (local + package-installed) |
| Prompt templates | pi command registry — `pi.getCommands()` with `source: "prompt"` (local + package-installed) |
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
2. Set **Font** to `JetBrainsMonoNL Nerd Font Propo`, size `10` (recommended)
3. Enable **Use a different font for non-ASCII text** and set the same font there — required for icons to render correctly
