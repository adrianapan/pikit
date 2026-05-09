# Plan Mode Extension

Toggle plan mode via `/plan` command or `Ctrl+Alt+P`.

## Modes

- **OFF** — Normal operation, all tools available
- **PLAN** — Read-only exploration. LLM produces a numbered plan under a `Plan:` header
- **EXECUTE** — Full tools restored. LLM executes steps and marks `[DONE:n]` on completion

## Commands

| Command | Action |
|---|---|
| `/plan` | Toggle: OFF↔PLAN, EXECUTE→OFF |
| `/plan on` | Force plan mode on (clears previous todos) |
| `/plan off` | Force off, restores all tools |
| `/plan execute` | Switch from PLAN to EXECUTE (requires plan steps) |
| `/plan status` | Show current mode and progress |

## Keyboard Shortcuts

- `Ctrl+Alt+P` — Toggle plan mode on/off

## CLI Flag

- `--plan` — Start in plan mode

## How It Works

1. Enter plan mode → tools restricted to read-only set, bash gated by command allowlist
2. LLM explores the codebase and produces a numbered plan
3. After LLM response, a menu offers: Execute / Refine / Stay in plan mode
4. Execute mode → all tools restored, LLM executes steps marking `[DONE:n]`
5. All steps complete → automatically returns to OFF mode

## State Persistence

Mode and todo state are stored in the session via `pi.appendEntry`. Forking or resuming a session restores the exact state.