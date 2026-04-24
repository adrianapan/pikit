# Custom pi.dev setup

Opinionated configuration for [pi.dev](https://pi.dev/), a minimal terminal coding agent. This repo tweaks the TUI experience with a custom startup screen, footer status bar, dynamic spinner verbs, and a warm color theme — plus a permission gate for dangerous commands, protected-paths for sensitive files, and a web-access extension for searching the web and fetching pages.

## What's in here

```
agent/
├── configs/
│   ├── footer.json              # Footer segment configuration (tracked)
│   ├── mcp.json                 # MCP server config — gitignored, see mcp/mcp.json.example
│   ├── permission-gate.json     # Permission gate patterns — gitignored, see permission-gate.example.json
│   ├── protected-paths.json     # Protected path entries — gitignored, see protected-paths.example.json
│   └── .env                     # Secret env vars — gitignored, see env-loader/.env.example
├── APPEND_SYSTEM.md             # Coding guidelines appended to the system prompt every session
├── skills/
│   └── pi-extension-builder/    # Guidelines for building and modifying extensions in this repo
├── themes/
│   └── slop.json     # Custom warm color theme
└── extensions/
    ├── env-loader/   # Injects .env tokens into process.env at startup
    ├── footer/       # Status bar with git, tokens, cost, context
    ├── mcp/          # MCP server bridge with lazy connections and proxy tool
    ├── permission-gate/ # Confirms dangerous bash commands before running
    ├── protected-paths/ # Blocks read/write access to sensitive files and directories
    ├── spinners/     # Rotating spinner verbs while the agent thinks
    ├── startup/      # Welcome header shown at session start
    └── web-access/   # Web search, page fetching, and PDF extraction
```

### env-loader

Injects `~/.pi/agent/configs/.env` into `process.env` at startup. Keeps API tokens and secrets out of your shell profile (`~/.zshrc`, etc.) and scoped to pi. Loads synchronously before `session_start` so all other extensions see the vars immediately. Shell environment always takes precedence — existing values are never overwritten. Use `/env` to verify which keys were loaded (values are never shown).

### footer

A customizable footer that replaces pi's default status bar. Renders live data in left- and right-aligned segments:

- **Left**: agent icon, separator, active model, thinking level, current path, git branch + dirty state
- **Right**: context window %, total/input/output token counts, estimated API cost

Segments are configured via `footer.json`. Supports Nerd Font icons with plain-ASCII fallbacks. Git status is cached and invalidated automatically on file writes or git operations.

<img src="agent/extensions/footer/demo.png" alt="footer">

### spinners

Replaces the default "Thinking..." working message with 186 rotating verbs. A new verb is picked every 2.5 seconds with a typewriter reveal effect (42ms per character). Hooks into `turn_start` / `message_update` / `turn_end` to start, stop, and clean up timers.

Sample verbs: Architecting, Boondoggling, Flibbertigibbeting, Hyperspacing, Lollygagging, Perambulating...

### mcp

Bridges [Model Context Protocol (MCP)](https://modelcontextprotocol.io) servers into pi with minimal context overhead. Instead of registering every MCP tool individually at startup (which can burn thousands of tokens), it registers a single `mcp` proxy tool. The LLM searches for tools with `mcp({ search: "keyword" })`, inspects schemas with `mcp({ describe: "tool_name" })`, and calls them with `mcp({ tool: "tool_name", args: '{...}' })`. Servers start lazily — only when a tool is actually invoked. Tool metadata is cached to disk so discovery works without live connections.

Key features: lazy server startup, proxy tool pattern, disk metadata cache, proper session restart lifecycle, per-server `directTools` opt-in, config merging across all standard MCP locations, `${VAR}` env interpolation, and connected-server count in the footer status bar. Use `/mcp` for status, `/mcp tools [server]` to list tools, `/mcp reconnect [server]`, `/mcp search <query>`.

### permission-gate

Intercepts `bash` tool calls and prompts for confirmation before running commands that match dangerous patterns (`rm -rf`, `sudo`, `chmod/chown 777`). Blocks silently in non-interactive mode. Patterns are fully configurable via `configs/permission-gate.json` — when the file is present it replaces the built-in defaults entirely; when absent the three defaults apply. Set `blockWithoutUI: false` to let commands through in headless/CI contexts. See [`agent/extensions/permission-gate/README.md`](agent/extensions/permission-gate/README.md).

### protected-paths

Blocks `read`, `write`, and `edit` tool calls to sensitive files and directories. Each entry defines a path and an explicit deny list, so you can block writes to `node_modules/` while still allowing reads for docs and type references. Bare entries like `.env` and `node_modules/` use exact path-segment matching — no false positives. Absolute and `~/`-prefixed entries are resolved and matched with `startsWith`. The agent is told why it was blocked and recovers gracefully. See [`agent/extensions/protected-paths/README.md`](agent/extensions/protected-paths/README.md).

### web-access

Gives the agent web access via three tools: `web_search` (Google Search grounding via Gemini AI, returns a synthesized answer with source citations), `fetch_content` (fetches any URL and extracts clean readable markdown — handles regular pages and PDFs), and `get_search_content` (retrieves full stored content when a response was truncated). Requires `GEMINI_API_KEY` for search; page fetching and PDF extraction work without any key. See [`agent/extensions/web-access/README.md`](agent/extensions/web-access/README.md).

### startup

Renders a three-column welcome box at session start showing: the pi logo, keyboard shortcut hints, and counts of loaded extensions / skills / MCP configs / prompt templates / context files. Agent version is shown in the top border. Hidden below 44 terminal columns.

<img src="agent/extensions/startup/demo.png" alt="startup">

### slop theme

A warm, earthy color palette (`themes/slop.json`). Primary: `#d67858` (terracotta). Text: `#f5f2ee` (warm white). Covers all 51 required pi color tokens including syntax highlighting and thinking level indicators.

---

## First-run setup

### 1. Install pi

```bash
npm install -g @mariozechner/pi-coding-agent
```

Requires Node.js 18+. On macOS, the easiest way to get Node is via [nvm](https://github.com/nvm-sh/nvm) or [Homebrew](https://brew.sh).

### 2. Clone this repo

Pi looks for its config in `~/.pi/`. Clone this repo directly into that directory:

```bash
git clone git@github.com:AdrianApan/pi-dev.git ~/.pi
# or via HTTPS
git clone https://github.com/AdrianApan/pi-dev.git ~/.pi
```

> If `~/.pi/` already exists from a previous pi install, back it up first: `mv ~/.pi ~/.pi.bak`

### 3. Authenticate

Launch pi:

```bash
pi
```

**Via subscription** (Claude Pro/Max, ChatGPT Plus/Pro, GitHub Copilot, Google Gemini) — run inside pi:

```
/login
```

Select your provider and complete the OAuth flow in the browser. Tokens are stored in `~/.pi/agent/auth.json` and auto-refresh when expired.

**Via API key** — set the environment variable before launching:

```bash
export ANTHROPIC_API_KEY=sk-ant-...
pi
```

| Provider | Environment variable |
|----------|---------------------|
| Anthropic | `ANTHROPIC_API_KEY` |
| OpenAI | `OPENAI_API_KEY` |
| Google Gemini | `GEMINI_API_KEY` |
| OpenRouter | `OPENROUTER_API_KEY` |
| Groq | `GROQ_API_KEY` |

See the full provider list in the [pi providers docs](https://github.com/badlogic/pi-mono/blob/main/packages/agent/docs/providers.md).

### 4. Enable the slop theme

Inside pi, open settings and select the theme:

```
/settings
```

Navigate to **Theme** and select `slop`.

### 5. Set up Nerd Fonts (recommended)

The footer and startup extensions use Nerd Font icons for git status, model info, and other indicators. Most modern terminals (Ghostty, WezTerm, Kitty, Alacritty) auto-detect support — iTerm2 needs a small one-time config.

**Install a Nerd Font on macOS:**

```bash
brew install --cask font-jetbrains-mono-nerd-font
```

Other fonts available via `brew search nerd-font`.

**Configure iTerm2:**

1. Open **Settings → Profiles → Text**
2. Set **Font** to `JetBrainsMonoNL Nerd Font Propo`, size `12`
3. Enable **Use a different font for non-ASCII text** and set the same font there — required for icons to render correctly

No config needed for Ghostty, WezTerm, Kitty, or Alacritty — icons work out of the box. If icons still look wrong, force Nerd Font mode:

```bash
export FOOTER_NERD_FONTS=1
```

### 6. Configure protected paths (optional)

The `protected-paths` extension ships with four built-in entries (`.env`, `.git/`, `node_modules/`, `~/.pi/agent/auth.json`). To customise them, copy the example config:

```bash
cp ~/.pi/agent/extensions/protected-paths/protected-paths.example.json \
   ~/.pi/agent/configs/protected-paths.json
```

Edit `protected-paths.json` to add, remove, or replace entries. See [`agent/extensions/protected-paths/README.md`](agent/extensions/protected-paths/README.md) for the full reference.

### 7. Configure permission patterns (optional)

The `permission-gate` extension ships with three built-in patterns. To customise them, copy the example config:

```bash
cp ~/.pi/agent/extensions/permission-gate/permission-gate.example.json \
   ~/.pi/agent/configs/permission-gate.json
```

Edit `permission-gate.json` to add, remove, or replace patterns. See [`agent/extensions/permission-gate/README.md`](agent/extensions/permission-gate/README.md) for the full reference.

### 8. Configure MCP servers (optional)

Copy the example config and edit it with your servers:

```bash
cp ~/.pi/agent/extensions/mcp/mcp.json.example ~/.pi/agent/configs/mcp.json
```

See [`agent/extensions/mcp/README.md`](agent/extensions/mcp/README.md) for the full configuration reference.

### 9. Install extension dependencies

This repo uses npm workspaces. A single install at the root handles all extension dependencies:

```bash
cd ~/.pi
npm install
```

All packages are hoisted to `~/.pi/node_modules/` — no per-extension `node_modules/` directories, no individual install steps. Any new extension you add with a `package.json` is picked up automatically on the next `npm install`.

### 10. Set up environment variables (optional)

If any extensions require API tokens (MCP servers, web-access search, etc.), store them in `~/.pi/agent/configs/.env` (gitignored) rather than your shell profile:

```bash
cp ~/.pi/agent/extensions/env-loader/.env.example ~/.pi/agent/configs/.env
```

Edit the file with your actual values. The `env-loader` extension injects these into `process.env` at startup. Use `/env` inside pi to verify what was loaded.

See [`agent/extensions/env-loader/README.md`](agent/extensions/env-loader/README.md) for details.

### 11. Add custom or local models (optional)

`agent/models.json` is excluded from this repo. Create it to register local models (Ollama, LM Studio, vLLM) or any OpenAI-compatible endpoint:

```json
// ~/.pi/agent/models.json
{
  "providers": {
    "ollama": {
      "baseUrl": "http://localhost:11434/v1",
      "api": "openai-completions",
      "apiKey": "ollama",
      "models": [
        { "id": "llama3.1:8b" }
      ]
    }
  }
}
```

The file hot-reloads — edit it while pi is running and open `/model` to pick up changes. See the [custom models docs](https://github.com/badlogic/pi-mono/blob/main/packages/agent/docs/models.md) for the full reference including API types, auth, and OpenAI compatibility options.

---

## About pi.dev

[Pi](https://pi.dev/) is a minimal, extensible terminal coding agent. Its philosophy is a small core with maximal extensibility — features like plan mode, permission gates, MCP, and sub-agents are left to the community to build via extensions and packages.

Below is a high-level map of what you can extend or configure.

### Extensions

TypeScript modules that hook into pi's lifecycle. Auto-discovered from `~/.pi/agent/extensions/` (global) or `.pi/extensions/` (project-local). Hot-reloadable via `/reload`.

An extension exports a default function that receives `ExtensionAPI`:

```ts
export default function myExtension(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    ctx.ui.notify("Hello from my extension!", "info");
  });
}
```

**What extensions can do:**

| Capability | API |
|---|---|
| React to lifecycle events | `pi.on("session_start" \| "turn_start" \| "turn_end" \| "message_update" \| "tool_result" \| "user_bash" \| ...)` |
| Register LLM-callable tools | `pi.registerTool()` |
| Register slash commands | `pi.registerCommand("/mycommand", { handler })` |
| Intercept / block tool calls | Event hooks with `ctx.intercept()` |
| Inject context into the session | `ctx.injectContext()` |
| Customize conversation compaction | Override the compaction handler |
| Persist state across restarts | `pi.appendEntry()` |
| Prompt the user | `ctx.ui.select()`, `ctx.ui.confirm()`, `ctx.ui.input()`, `ctx.ui.notify()` |
| Custom TUI components | `ctx.ui.custom(component)` — full keyboard input, overlays |
| Status line items | `ctx.ui.setStatus("key", styledText)` |
| Widgets above/below editor | `ctx.ui.setWidget("key", lines)` |
| Replace the footer | `ctx.ui.setFooter(component)` |
| Replace the header | `ctx.ui.setHeader(component)` |
| Custom editor (e.g., vim mode) | `ctx.ui.setEditorComponent(factory)` |
| Set working message | `ctx.ui.setWorkingMessage("Thinking...")` |

Built-in TUI building blocks (`@mariozechner/pi-tui`): `Text`, `Box`, `Container`, `Spacer`, `Markdown`, `SelectList`, `SettingsList`, `BorderedLoader`, and more.

Extension examples from the pi repo: permission gates, git checkpointing, path protection, conversation summarizers, interactive tools, a todo-list tool, even a Snake game.

**Security note:** extensions run with full system access. Only install from sources you trust.

### Skills

Self-contained capability packages loaded on-demand from the filesystem. Each skill is a directory with a `SKILL.md` file:

```
my-skill/
├── SKILL.md       # frontmatter (name, description) + instructions
├── scripts/
│   └── run.sh
└── references/
    └── api.md
```

Pi implements the [Agent Skills standard](https://agentskills.io/specification). At startup, pi reads all skill names and descriptions into the system prompt. When a task matches, the agent reads the full `SKILL.md` on-demand (progressive disclosure). Skills can also be invoked explicitly with `/skill:name`.

Skill locations: `~/.pi/agent/skills/`, `.pi/skills/`, `.agents/skills/`, or listed in `settings.json`.

This repo ships with one skill: **`pi-extension-builder`** — auto-loaded when you ask to build or modify an extension. Covers file structure, code conventions, modularity patterns, and documentation requirements. Invoke explicitly with `/skill:pi-extension-builder`.

### MCP (Model Context Protocol)

Pi has **no built-in MCP support** — this is a deliberate design choice. The `mcp` extension in this repo provides a full MCP bridge. See `agent/extensions/mcp/README.md` for configuration details.

The two general approaches for adding external tools to pi:

1. **Skills** — wrap any external tool in a `SKILL.md`. The agent reads the instructions and invokes it via shell commands. No protocol needed; a well-documented script is enough.
2. **Extensions** — register tools directly via `pi.registerTool()`. The key thing to understand is how the LLM learns about a tool: every registered tool's `name`, `description`, and parameter schema are injected into the system prompt automatically. The LLM picks the right tool by reading those descriptions — exactly like any built-in tool.

### Prompt Templates

Markdown files that expand into prompts via `/name`. Filename becomes the command. Supports positional arguments (`$1`, `$2`, `$@`).

```markdown
---
description: Review staged git changes
argument-hint: "[focus area]"
---
Review `git diff --cached`. Focus on: $@
```

Saved to `~/.pi/agent/prompts/` (global) or `.pi/prompts/` (project). Invoked with `/review` or `/review security`.

**Skills vs prompt templates:** if you're telling the agent *what to do*, use a prompt template. If you're telling it *how to behave*, use a skill. Example: a `/review` template kicks off a code review task; a `pi-extension-builder` skill shapes how the agent approaches extension work without you having to invoke it manually.

### System Prompt Customization

Pi supports two special Markdown files for injecting content into the system prompt — no extension or code required.

| File | Behavior |
|------|----------|
| `SYSTEM.md` | **Replaces** the default system prompt entirely |
| `APPEND_SYSTEM.md` | **Appends** to the default system prompt |

Both are discovered in the same locations: `~/.pi/agent/` (global) or `.pi/` (project-level). Project files take precedence over global ones.

This repo ships with `~/.pi/agent/APPEND_SYSTEM.md` — a trimmed version of [Andrej Karpathy's coding guidelines](https://github.com/forrestchang/andrej-karpathy-skills/blob/main/CLAUDE.md) covering four rules: think before coding, simplicity first, surgical changes, and goal-driven execution. It's appended on every session without touching pi's built-in prompt.

### Themes

JSON files with exactly 51 color tokens covering: core UI, backgrounds, markdown rendering, syntax highlighting, thinking level indicators, and diff colors. Placed in `~/.pi/agent/themes/` and activated via `"theme": "name"` in `settings.json`. Hot-reloaded when the file changes.

### Packages

Bundle extensions, skills, prompt templates, and themes for sharing. Distributed via npm or git:

```bash
pi install npm:@foo/my-pi-package
pi install git:github.com/user/repo
pi install ./local/path
```

Declare resources in `package.json` under the `"pi"` key, or use conventional directories (`extensions/`, `skills/`, `prompts/`, `themes/`). Tag with `pi-package` keyword for gallery discoverability.

### Model Configuration

Defined in `~/.pi/agent/models.json`. Supports 15+ providers: Anthropic, OpenAI, Google, Ollama, LM Studio, vLLM, Azure, and more. Models can be configured with custom context windows, token limits, reasoning support, and OpenAI-compatible API endpoints for local inference. Hot-reloaded when the file changes.

### Keybindings

Configured in `~/.pi/agent/keybindings.json`. Supports modifiers (`ctrl`, `shift`, `alt`), chord bindings, and remapping of any core action.

### Settings

Global: `~/.pi/agent/settings.json`. Project: `.pi/settings.json`. Nested objects merge rather than replace, so project settings layer on top of global ones. Covers model defaults, thinking level, UI preferences, session behavior, and resource toggles.
