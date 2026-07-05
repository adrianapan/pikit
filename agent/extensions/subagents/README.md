# Subagents

Delegate tasks to specialized subagents — child pi processes that work independently with their own model, tools, extensions, and skills. Supports single, parallel, and chain modes.

## Install

```bash
pi install npm:pikit-subagents
```

Or grab the whole [pikit](https://github.com/adrianapan/pikit) setup — this extension ships with it and loads automatically.

## How it works

1. Parent LLM calls the `subagent` tool in one of three modes
2. Extension spawns child pi processes with agent-specific config (`--mode json -p --no-session`)
3. System prompt written to temp file, passed via `--append-system-prompt`
4. JSON line stream parsed — assistant `message_end` text collected
5. Results returned to parent LLM

Child processes are guarded by `PI_SUBAGENT_DEPTH` — subagents cannot spawn further subagents.

### Modes

| Mode | Parameter | Description |
|------|-----------|-------------|
| **Single** | `agent` + `task` | One subagent, synchronous. Existing behavior. |
| **Parallel** | `tasks` (array) | Up to 8 tasks, 4 concurrent. Results aggregated. |
| **Chain** | `chain` (array) | Sequential steps. Use `{previous}` to pipe prior output forward. |

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

### Single mode

Delegate one task to one agent:

```
subagent(agent="scout", task="Find all database connection code in this project")
```

### Parallel mode

Dispatch independent tasks concurrently (max 8, 4 at a time):

```
subagent(tasks=[
  {agent="scout", task="Find all auth-related code"},
  {agent="reviewer", task="Check db/pool.ts for connection leaks"},
  {agent="tester", task="Run the existing test suite"}
])
```

### Chain mode

Sequential steps with output piping via `{previous}`:

```
subagent(chain=[
  {agent="scout", task="Find all auth-related code"},
  {agent="planner", task="Previous findings: {previous}. Design an OAuth migration plan."},
  {agent="worker", task="Plan: {previous}. Implement the migration."}
])
```

Chain stops on first error. `{previous}` is auto-substituted — never shown to the user.

### Auto-orchestration

The parent LLM reads agent descriptions from the tool prompt and chooses modes autonomously when it sees a suitable match.

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
| | `waitingIcon` | `"↪"` | Waiting/pending icon |
| | `waitingIconColor` | `"muted"` | Waiting icon color |
| | `elapsedColor` | `"muted"` | Elapsed time color |
| | `countColor` | `"muted"` | Line count color |
| | `separatorColor` | `"dim"` | "•" separator color |
| `header` | `titleColor` | `"toolTitle"` | "Subagent" label color |
| | `agentColor` | `"accent"` | Agent name color |
| | `summaryColor` | `"muted"` | Progress summary color (e.g. "step 2/3") |
| `expandHint` | `color` | `"dim"` | Expand hint color |

## Limitations

- **No recursion** — `PI_SUBAGENT_DEPTH` prevents subagents from spawning more subagents
- **No builtin agents** — you must create agent `.md` files first
- **`/reload` required** — new agent files are not picked up until you reload pi extensions
- **Parallel cap** — max 8 tasks, 4 concurrent (internal limits, not user-configurable)
