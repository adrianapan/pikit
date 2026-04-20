# slop-spinners

Replaces the standard **Thinking** verb shown during LLM inference with a random one picked from a curated list of 170+ alternatives — one per response.

## What it does

Each time the model starts generating a response, the extension picks a random verb from `src/verbs.ts` and passes it to `ctx.ui.setWorkingMessage()`, overriding the default "Thinking" label in the spinner.

Example outputs:
- *Boondoggling*
- *Reticulating*
- *Flibbertigibbeting*
- *Prestidigitating*

## Structure

```
slop-spinners/
├── package.json
├── README.md
└── src/
    ├── index.ts   — extension entry point, hooks message_start
    └── verbs.ts   — the verb list and random picker
```

## Customizing

Edit `src/verbs.ts` to add or remove verbs from the `VERBS` array.

## Installation

This extension is auto-discovered from the `~/.pi/agent/extensions/` directory. No additional registration is required.
