# env-loader

Injects `~/.pi/agent/configs/.env` into `process.env` at startup. A pi-native alternative to adding secrets to your shell profile (`~/.zshrc`, etc.) — tokens stay in one place, scoped to pi, and never get committed.

## How it works

The extension loads synchronously in its factory function, before `session_start` and before any other extension runs. Shell environment always takes precedence: if a key is already set in your shell, the file value is silently skipped.

## Structure

```
env-loader/
├── package.json
├── README.md
├── .env.example
└── src/
    ├── loader.ts  — file reading, parsing, and process.env injection
    └── index.ts   — extension entry point, error notification, /env command
```

## Configuration

Create `~/.pi/agent/configs/.env` (gitignored — never committed):

```
SLACK_MCP_TOKEN=xoxp-...
GITHUB_TOKEN=ghp-...
GEMINI_API_KEY=AIza...
```

Copy the example to get started:

```bash
cp ~/.pi/agent/extensions/env-loader/.env.example ~/.pi/agent/configs/.env
```

Then replace the placeholder values with your actual tokens.

### Supported syntax

```bash
KEY=value
KEY="value"          # quoted values (quotes stripped)
KEY='value'          # single-quoted values (quotes stripped)
export KEY=value     # export prefix is ignored
# comment            # lines starting with # are skipped
                     # blank lines are skipped
```

### Rules

| Behaviour | Detail |
|-----------|--------|
| Shell env takes precedence | Existing `process.env` values are never overwritten |
| File absent | Extension loads silently with no effect |
| File read error | Error notification shown on `session_start` |

## Usage

Use `/env` to verify what was loaded (key names only — values are never shown):

```
/env
→ 3 var(s) loaded from .env:
    SLACK_MCP_TOKEN
    GITHUB_TOKEN
    GEMINI_API_KEY
```

If a var was already set in your shell, it shows up in the skipped count rather than the loaded list.
