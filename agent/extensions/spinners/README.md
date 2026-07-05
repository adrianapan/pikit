# spinners

Replaces the default **Thinking** verb with random alternatives from a curated list, cycling periodically with a typewriter reveal.

## Install

```bash
pi install npm:pikit-spinners
```

Or grab the whole [pikit](https://github.com/adrianapan/pikit) setup — this extension ships with it and loads automatically.


## Features

- **Curated verb list** — Unique alternatives to the default thinking message
- **Typewriter animation** — Character-by-character reveal
- **Auto-cycling** — Rotates through verbs while model works
- **Live status** — Shows elapsed time and estimated token count
- **Theme-aware colors** — Uses pi.dev theme colors with fallbacks
- **Keyboard shortcut hint** — Shows how to expand thinking blocks

## Configuration

Copy the example config and edit it:

```bash
cp ~/.pi/agent/extensions/spinners/spinners.example.json \
   ~/.pi/agent/configs/spinners.json
```

```json
{
  "themeTokens": {
    "verb": "accent",
    "separator": "separator",
    "status": "muted",
    "separatorIcon": "└─"
  }
}
```

### Options

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `themeTokens.verb` | `string` | `"accent"` | Theme token for the verb text (e.g., "Boondoggling...") |
| `themeTokens.separator` | `string` | `"separator"` | Theme token for the separator icon |
| `themeTokens.status` | `string` | `"muted"` | Theme token for the status line (elapsed time, token count) |
| `themeTokens.separatorIcon` | `string` | `"└─"` | The separator icon shown before the status |

### Available Theme Tokens

Use any valid pi.dev theme token. Common values:

- `"accent"` — Primary accent color
- `"muted"` — Dimmed/subtle text
- `"separator"` — UI separators
- `"error"` — Error states
- `"success"` — Success states
- `"warning"` — Warning states

## Verbs

Edit `src/verbs.ts` to customize the verb list:

```typescript
// Add your own verbs
export const VERBS: readonly string[] = [
  'YourVerbHere',
  // ... existing verbs
];
```

## How It Works

1. **Turn starts** → Picks random verb, types it out character-by-character
2. **While working** → Cycles to new verb every 2.5 seconds
3. **Status updates** → Shows elapsed time and estimated token count (when tokens are being streamed)

