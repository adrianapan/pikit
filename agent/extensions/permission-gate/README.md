# permission-gate

Intercepts `bash` tool calls and prompts for confirmation before running commands that match dangerous patterns. Blocks silently in non-interactive mode.

https://github.com/user-attachments/assets/cef479b8-6d1c-4c57-89f5-175009e9b856

## Install

```bash
pi install npm:pikit-permission-gate
```

Or grab the whole [pikit](https://github.com/adrianapan/pikit) setup — this extension ships with it and loads automatically.

## How it works

On every `bash` tool call, the extension tests the command string against a list of regex patterns. If any pattern matches, the user is shown a confirmation prompt — `Yes` lets the command through, `No` blocks it and the agent is told it was blocked. When pi is running without an interactive UI (headless, piped input), the command is blocked automatically.

## Structure

```
permission-gate/
├── package.json
├── README.md
├── permission-gate.example.json
└── src/
    ├── config.ts  — loads permission-gate.json, falls back to built-in defaults
    └── index.ts   — extension entry point, tool_call hook
```

## Default patterns

These three patterns apply when no config file is present:

| Pattern | What it catches |
|---------|----------------|
| `\brm\s+(-rf?\|--recursive)` | Recursive deletes |
| `\bsudo\b` | Any command run as root |
| `\b(chmod\|chown)\s+(?:-[a-z]+\s+)*777(?:\b|$)` | World-writable permission changes |
| `\bprintenv\b` | `printenv` and `printenv KEY` — dumps env vars |
| `(^|\s)env(\s\|$)` | Bare `env` command — dumps all env vars. Does not match `NODE_ENV=x` or `/usr/bin/env` |

## Configuration

Copy the example config and edit it:

```bash
cp ~/.pi/agent/extensions/permission-gate/permission-gate.example.json \
   ~/.pi/agent/configs/permission-gate.json
```

```json
{
  "patterns": [
    "\\brm\\s+(-rf?|--recursive)",
    "\\bsudo\\b",
    "\\b(chmod|chown)\\s+(?:-[a-z]+\\s+)*777(?:\\b|$)",
    "\\bprintenv\\b",
    "(^|\\s)env(\\s|$)"
  ],
  "blockWithoutUI": true
}
```

### Options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `patterns` | `string[]` | *(built-in three)* | Regex strings to match against bash commands. When present, **replaces** the defaults entirely. |
| `blockWithoutUI` | `boolean` | `true` | What to do when a dangerous command is detected but no UI is available. `true` = block it; `false` = let it through. |

### Adding custom patterns

Patterns are standard JavaScript regex strings — backslashes must be escaped (`\\b`, not `\b`):

```json
{
  "patterns": [
    "\\brm\\s+(-rf?|--recursive)",
    "\\bsudo\\b",
    "\\b(chmod|chown)\\b.*777",
    "\\bdrop\\s+table\\b",
    "\\bcurl\\b.*\\|.*\\bsh\\b"
  ]
}
```
