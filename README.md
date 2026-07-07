<img alt="banner" src="https://github.com/user-attachments/assets/3c0eb2a6-fce9-4c39-8943-d348ce1bc284" />

<h3 align="center">Pikit — an opinionated Pi coding agent configuration. Batteries included.</h3>

<p align="center">
  <a href="#whats-in-here">What's in here</a> &nbsp;·&nbsp;
  <a href="#install">Install</a> &nbsp;·&nbsp;
  <a href="#extensions">Extensions</a> &nbsp;·&nbsp;
  <a href="#skills">Skills</a> &nbsp;·&nbsp;
  <a href="#prompt-templates">Prompt templates</a> &nbsp;·&nbsp;
  <a href="#theme">Theme</a> &nbsp;·&nbsp;
  <a href="#configs">Configs</a>
  
</p>

---

## What's in here

```
agent/
├── configs/
│   ├── caveman.json             # Caveman default level — gitignored, auto-created on first use
│   ├── chat-mode.json           # Chat mode settings (tracked)
│   ├── plan-mode.json           # Plan mode settings (tracked)
│   ├── footer.json              # Footer segment configuration — gitignored, see footer/footer.example.json
│   ├── mcp.json                 # MCP server config — gitignored, see mcp/mcp.example.json
│   ├── permission-gate.json     # Permission gate patterns — gitignored, see permission-gate.example.json
│   ├── protected-paths.json     # Protected path entries — gitignored, see protected-paths.example.json
│   └── .env                     # Secret env vars — gitignored, see env-loader/.env.example
├── APPEND_SYSTEM.md             # Coding guidelines appended to the system prompt every session
├── settings.example.json        # Opinionated pi settings — copy to settings.json (gitignored)
├── skills/
│   ├── pi-extension-builder/    # Guidelines for building and modifying extensions in this repo
│   ├── add-ollama-cloud-model/  # Guidelines for adding an Ollama Cloud model to models.json
│   ├── gh/                      # Read-only GitHub CLI access via enforced wrapper
│   └── pr-review/               # Review a GitHub PR and emit findings as a markdown artifact
├── prompts/
│   ├── handoff.md               # /handoff — write a session handoff document to .pi/handoffs/
│   └── pickup.md                # /pickup — resume work from the latest handoff document
├── themes/
│   └── slop.json                # Custom warm color theme
└── extensions/
    ├── chat-input/              # Unicode box border around the main chat input editor
    ├── caveman/                 # Compresses LLM responses: lite (professional) / full (caveman) / ultra (max compression)
    ├── env-loader/              # Injects .env tokens into process.env at startup
    ├── footer/                  # Status bar with git, tokens, cost, context
    ├── mcp/                     # MCP server bridge with lazy connections and proxy tool
    ├── plan-mode/               # Plan-then-execute workflow: read-only planning, then execute with plan_complete
    ├── chat-mode/               # Read-only conversational mode: chat, explore, search — no edits
    ├── permission-gate/         # Confirms dangerous bash commands before running
    ├── protected-paths/         # Blocks read/write access to sensitive files and directories
    ├── llm-council/             # Multi-model council: members answer independently, chairman synthesises
    ├── spinners/                # Rotating spinner verbs while the agent thinks
    ├── startup/                 # Welcome header shown at session start
    ├── styled-outputs/          # Custom styled rendering for all message types (tools, diffs, thinking, skills)
    ├── subagents/               # Delegate tasks to specialized child agents (single, parallel, chain)
    ├── web-access/              # Web search, page fetching, and PDF extraction
    └── artifacts/               # Visual HTML artifacts (markdown/html) on a lazy localhost server with live reload
```

---

## Install

```bash
# Install Pi
npm install -g --ignore-scripts @earendil-works/pi-coding-agent

# Install Pikit
pi install npm:@adrianapan/pikit

# (Optional, but recommended) Scaffold Pikit's opinionated files into ~/.pi/agent
bash ~/.pi/agent/npm/node_modules/@adrianapan/pikit/setup.sh

# Start Pi
pi
```

### `setup.sh`

You can manually sync the opinionated Pikit configs (settings, keybindings, additional system prompt) by pulling them from the repo and manually placing the relevant files in your Pi folder. Alternatively, you can use the automated `setup.sh` script.

```bash
# flags are optional
bash ~/.pi/agent/npm/node_modules/@adrianapan/pikit/setup.sh [flags]
```

Flag | Description |
|-|-|
| `--settings` | Sync `settings.json` (theme: "slop")
| `--system-prompt` | Sync `APPEND_SYSTEM.md`
| `--modes` | Sync `configs/chat-mode.json` and `configs/plan-mode.json`
| `--keybindings` | Sync `keybindings.json` (two Pikit keybinds)
| `--help`, `-h` | Show this help


* Running it with no flags runs every job, in order: settings, system-prompt, modes, keybindings

* Existing files are backed up to `~/.pi/agent/_bak/` before being replaced

* Idempotent so existing mode configs and already-correct fields are skipped

### Cloning the repo?

If you decide to clone the repo directly into your `~/.pi` folder instead of installing it via `pi install`, you'll need to run `npm i` to install the deps.

```bash
git clone git@github.com:adrianapan/pikit.git
cd ~/.pi
npm i
```

---


## Extensions

### Workflows & Modes

* **plan-mode** — Adds a `/plan` workflow. Restricts tools to read-only mode while the LLM drafts a structured execution roadmap, then unlocks full capabilities once execution begins. → [`README`](agent/extensions/plan-mode/README.md)
* **chat-mode** — Toggled via `/chat` or `Ctrl+Shift+C`. Locks the filesystem to read-only so you can freely discuss, search, and parse code without risk of accidental changes. → [`README`](agent/extensions/chat-mode/README.md)
* **subagents** — Delegates isolated tasks to background `pi` subprocesses. Supports running single tasks, parallel batches, or piped execution chains. → [`README`](agent/extensions/subagents/README.md)
* **llm-council** — Runs questions across a parallel panel of distinct models, then passes their independent findings to a chairman model to synthesize a final answer. → [`README`](agent/extensions/llm-council/README.md)

### UI & UX

* **styled-outputs** — Swaps flat console readouts for color-coded diff blocks, expandable sections, custom icons, and visual tool groups. → [`README`](agent/extensions/styled-outputs/README.md)
* **footer** — A dense, customized status line detailing active models, token metrics, live run costs, and current git state. Supports Nerd Fonts and ASCII fallbacks. → [`README`](agent/extensions/footer/README.md)
* **artifacts** — Renders rich markdown, HTML, and Mermaid diagrams to a self-contained local browser tab featuring live-reloading. → [`README`](agent/extensions/artifacts/README.md)
* **chat-input** — Draws a stylized, isolated Unicode frame around your active terminal prompt line while preserving all underlying editing shortcuts. → [`README`](agent/extensions/chat-input/README.md)
* **spinners** — Trades static loader indicators for dynamic, timed thinking states and live token accumulators. → [`README`](agent/extensions/spinners/README.md)
* **startup** — Displays a concise diagnostic dashboard on boot, mapping out active plugins, server states, and shortcut reminders. → [`README`](agent/extensions/startup/README.md)

### Guardrails & Safety

* **permission-gate** — Traps out-of-the-box bash executions and forces confirmation steps before running destructive or sensitive commands like `sudo` or `rm`. → [`README`](agent/extensions/permission-gate/README.md)
* **protected-paths** — Explicitly denies write or read access to critical areas (e.g., `.git`, `.env`, credentials) to ensure the agent stays within its scope. → [`README`](agent/extensions/protected-paths/README.md)

### Integrations & Tweaks

* **mcp** — A lazy-loading Model Context Protocol bridge. Instead of taxing initialization speeds by parsing all schemas on boot, it exposes tools on demand. → [`README`](agent/extensions/mcp/README.md)
* **web-access** — Adds live search summaries through the Gemini API and extracts clean markdown formatting from remote URLs and PDF files. → [`README`](agent/extensions/web-access/README.md)
* **env-loader** — Automatically injects custom `.env` variables into the agent's process context at boot, keeping key management out of global shell files. → [`README`](agent/extensions/env-loader/README.md)
* **caveman** — Strips away polite conversational filler from the model's output. Features three target tiers: `lite` (concise prose), `full` (prehistoric grunt), and `ultra` (max token compression). → [`README`](agent/extensions/caveman/README.md)

---

## Skills

### pi-extension-builder

Loaded when you ask pi to build or modify an extension in this repo. Covers file structure, code conventions, and documentation requirements. Invoke explicitly with `/skill:pi-extension-builder`.

### add-ollama-cloud-model

Loaded when you ask pi to add an Ollama Cloud model. Fetches the model page, extracts capabilities, and writes the correct entry to `models.json`. Invoke explicitly with `/skill:add-ollama-cloud-model`.

### gh

Read-only GitHub CLI access via an enforced wrapper. Lists issues, PRs, repos, runs, releases, and more, but blocks all write, delete, and modify commands. Load when working with GitHub resources. Invoke explicitly with `/skill:gh`.

### pr-review

Review a GitHub PR and emit the findings as a markdown artifact (rendered HTML report in the browser). Gathers the diff via the `gh` skill, reviews it, then produces one `artifact`: verdict up top, findings ranked by severity, per-file `diff` fences. Invoke explicitly with `/skill:pr-review`.

---

## Prompt templates

### handoff

`/handoff` generates a comprehensive handoff document (summary, work completed, files affected, current state, next steps) and saves it to the project's `.pi/handoffs/` directory (same convention as plan-mode's `.pi/plans/`). Use it when a session's context is getting full or you want to continue in a fresh session without carrying the full conversation over.

### pickup

`/pickup` is the companion to `/handoff`. Reads the most recent handoff document from `.pi/handoffs/` (or a specific one by name), verifies it against the current git state, summarises where things stand, and starts on the "Immediate Next Steps" section.

---

## Theme

### slop

A warm, earthy palette with terracotta primary (`#d67858`) and warm-white text (`#f5f2ee`), covering all 51 pi color tokens including syntax highlighting and thinking level indicators. Activate via `/settings → Theme → slop`.

---

## System prompt

Pi appends [`agent/APPEND_SYSTEM.md`](agent/APPEND_SYSTEM.md) to its default system prompt every session (no extension code involved). It's a trimmed and adapted version of [Andrej Karpathy's coding guidelines](https://github.com/forrestchang/andrej-karpathy-skills/blob/main/CLAUDE.md): think before coding, simplicity first, surgical changes, goal-driven execution, and a fifth nudge to emit visual output via the `artifact` tool.

---

## Configs

> Best experienced with [Ghostty](https://ghostty.org/) - a fast, GPU-accelerated, cross-platform terminal emulator.

### Models

Launch `pi` in your terminal, then pick your authentication mechanism:

* **Subscription Providers:** Trigger `/login` and authenticate with your existing account context (Claude Pro, ChatGPT Plus, Copilot, or Gemini).
* **Direct API Keys:** Export your keys to your active shell session prior to startup (e.g., `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`).

### Fonts

If interface icons or status graphics look broken, install a modern developer font setup:

```bash
brew install --cask font-jetbrains-mono-nerd-font

```

*Note for iTerm2 users:* Ensure **Settings → Profiles → Text** points to your chosen Nerd Font family, and enable **Use a different font for non-ASCII text**. If layout renders fall back, enforce rendering symbols explicitly via `export FOOTER_NERD_FONTS=1`.

### Custom or local models

`agent/models.json` (gitignored, hot-reloads while pi runs) registers local models or any OpenAI-compatible endpoint. Full reference in the [models docs](https://github.com/earendil-works/pi/blob/main/packages/coding-agent/docs/models.md).

#### Ollama — local models

Point `baseUrl` at the Ollama daemon and list whichever models you have pulled. `apiKey` is required but ignored locally.

```json
{
  "providers": {
    "ollama": {
      "api": "openai-completions",
      "apiKey": "ollama",
      "baseUrl": "http://127.0.0.1:11434/v1",
      "models": [
        {
          "id": "qwen3.5:4b",
          "name": "Qwen3.5 4B",
          "contextWindow": 265000,
          "input": ["text", "image"],
          "reasoning": true
        }
      ]
    }
  }
}
```

#### Ollama — cloud models

Ollama Cloud needs an API key and a `compat` block, because cloud models don't support the `developer` role pi uses for reasoning models. Store the key in `agent/configs/.env` and read it with the shell-command form so it's resolved at runtime:

```json
{
  "providers": {
    "ollama-cloud": {
      "api": "openai-completions",
      "apiKey": "!grep ^OLLAMA_API_KEY ~/.pi/agent/configs/.env | cut -d= -f2",
      "baseUrl": "https://ollama.com/v1",
      "compat": {
        "supportsDeveloperRole": false
      },
      "models": [
        {
          "id": "qwen3.5:cloud",
          "name": "Qwen 3.5",
          "contextWindow": 265000,
          "input": ["text", "image"],
          "reasoning": true
        }
      ]
    }
  }
}
```

Browse models at [ollama.com/search](https://ollama.com/search); cloud variants use the `:cloud` suffix. Or skip the JSON and just ask pi: *"Add https://ollama.com/library/qwen3.5 to my Ollama cloud config"*, and the [`add-ollama-cloud-model`](agent/skills/add-ollama-cloud-model/SKILL.md) skill handles it.

> pi extensions run with full system access; that applies to this kit and anything else you install. Review the source before trusting a package; everything here is small enough to read in one sitting.
