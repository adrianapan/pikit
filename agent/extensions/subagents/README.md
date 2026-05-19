# Subagents

Delegate tasks to specialized subagents — child pi processes that work independently with their own model, tools, extensions, and skills.

## How it works

1. Parent LLM calls the `subagent` tool with an agent name and task
2. Extension spawns a new pi process with agent-specific config (`--mode json -p --no-session`)
3. System prompt written to temp file, passed via `--append-system-prompt`
4. JSON line stream parsed — assistant `message_end` text collected
5. Result returned to parent LLM for further use

Child processes are guarded by `PI_SUBAGENT_DEPTH` — subagents cannot spawn further subagents.

## Agent files

Agents are `.md` files with YAML frontmatter and a body (system prompt).

### File locations

| Location | Scope | Priority |
|----------|-------|----------|
| `.pi/agents/` (project) | This project only | Higher — overwrites user agents on name conflict |
| `~/.pi/agent/agents/` (user) | All projects | Lower |

### Frontmatter fields

| Field | Required | Type | Description |
|-------|----------|------|-------------|
| `name` | **Yes** | string | Unique identifier (e.g. `scout`) |
| `description` | **Yes** | string | What the agent does — shown in tool description |
| `tools` | No | string | Comma-separated tool names. Absent → default list (`read, grep, find, ls, web_search, fetch_content, get_search_content`). Empty → no tools. |
| `model` | No | string | Model for the subagent. Omitted → inherits from parent. |
| `thinking` | No | string | Thinking budget: `low`, `medium`, `high`. Omitted → inherits from parent. |
| `extensions` | No | string | Extensions to load. Absent → defaults (`env-loader, web-access, permission-gate, protected-paths`). Empty → no extensions. Values → exact list. Paths resolved to `~/.pi/agent/extensions/<name>/src/index.ts`. |
| `skills` | No | string | Skills to load. Absent → none. Empty → no skills. Values → exact list. Paths resolved to `~/.pi/agent/skills/<name>/SKILL.md`. |

### Example

See `examples/scout.md` in this extension directory. Copy it to `.pi/agents/` (pi's installation folder) or `~/.pi/agent/agents/` (project folder) to use.

## Usage patterns

### Natural language delegation

The parent LLM decides when to delegate. Just describe what you want:

> "Use the scout agent to find all database connection code in this project"

### Chaining

Parent LLM can call `subagent` multiple times sequentially — each result is returned before the next call:

```
subagent(scout, "find auth modules")
  → returns file list
subagent(reviewer, "review auth/auth.ts for security issues")
  → returns review
```

### Auto-orchestration

The parent LLM reads agent descriptions from the tool prompt and delegates autonomously when it sees a suitable match.

## Configuration

Place `subagents.json` at `~/.pi/agent/configs/subagents.json`. See `subagents.example.json` for all options.

All fields optional — defaults match styled-outputs/LLM Council conventions.

| Section | Key | Default | Purpose |
|---------|-----|---------|---------|
| `spinner` | `prefixChars` | `["·","✢","✳","✶","✻","✽"]` | Animation frames |
| | `interval` | `80` | Frame interval (ms) |
| | `color` | `"muted"` | Spinner color |
| `successPrefix` | `prefix` | `"✓"` | Success icon |
| | `color` | `"success"` | Icon color |
| `errorPrefix` | `prefix` | `"✗"` | Error icon |
| | `color` | `"error"` | Icon color |
| `branch` | `prefix` | `"└─"` | Branch prefix |
| | `color` | `"separator"` | Branch color |
| `status` | `doneLabel` | `"Done"` | Done status text |
| | `doneColor` | `"success"` | Done text color |
| | `errorLabel` | `"Error"` | Error status text |
| | `errorColor` | `"error"` | Error text color |
| | `workingLabel` | `"Running..."` | Working status text |
| | `workingColor` | `"dim"` | Working text color |
| | `elapsedColor` | `"muted"` | Elapsed time color |
| | `countColor` | `"muted"` | Line count color |
| | `separatorColor` | `"dim"` | "•" separator color |
| `header` | `titleColor` | `"toolTitle"` | "Subagent" label color |
| | `agentColor` | `"dim"` | Agent name color |
| `expandHint` | `color` | `"dim"` | Expand hint color |

## Limitations

- **Single-agent only** — one subagent per tool call
- **Synchronous** — parent LLM waits for subagent to finish
- **No recursion** — `PI_SUBAGENT_DEPTH` prevents subagents from spawning more subagents
- **No builtin agents** — you must create agent `.md` files first
- **`/reload` required** — new agent files are not picked up until you reload pi extensions
