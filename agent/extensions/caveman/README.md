# caveman

Compresses pi's LLM responses from polished prose to prehistoric grunt. Three modes cover the full spectrum from professional-but-tight to maximum compression.

<table>
<tr>
<td width="50%">

### 🗣️ Normal (69 tokens)

> "The reason your React component is re-rendering is likely because you're creating a new object reference on each render cycle. When you pass an inline object as a prop, React's shallow comparison sees it as a different object every time, which triggers a re-render. I'd recommend using useMemo to memoize the object."

</td>
<td width="50%">

### 🪨 Caveman (19 tokens)

> "New object ref each render. Inline object prop = new ref = re-render. Wrap in `useMemo`."

</td>
</tr>
</table>

## Commands

| Command | Description |
|---------|-------------|
| `/caveman` | Toggle on (full as default) / off |
| `/caveman lite` | Professional, no fluff |
| `/caveman full` | Classic caveman (default) |
| `/caveman ultra` | Maximum compression |

## Levels

| Level | Style | Example |
|-------|-------|---------|
| **Lite** | No filler. Full sentences. Professional but tight. | "Your component re-renders because you create a new object reference each render." |
| **Full** | Drop articles, fragments OK. Classic caveman. | "New object ref each render. Wrap in `useMemo`." |
| **Ultra** | Abbreviations, arrows, maximum compression. | "Inline obj prop → new ref → re-render. `useMemo`." |

## Persistence

Caveman state survives across sessions in two ways:

- **Session resume** — active level is stored in the session log via `pi.appendEntry`. If you fork or switch back to a session, the exact state (on/off + mode) is restored automatically.
- **New sessions** — the last-used state is saved to `~/.pi/agent/configs/caveman.json` and applied when starting a fresh session. This file is gitignored and auto-created on first use — no manual setup required.

Example config file (`~/.pi/agent/configs/caveman.json`):

```json
{
  "defaultLevel": "full"
}
```

Valid values for `defaultLevel`: `"off"` (default, don't auto-enable), `"lite"`, `"full"`, `"ultra"`. You can edit this file directly — changes take effect on the next session start.

## How it works

Hooks into `before_agent_start` and appends mode-specific instructions to the system prompt each turn. No post-processing — the LLM adjusts its output directly. Disabling caveman removes the instruction immediately on the next turn. Auto-clarity rules tell the model to drop caveman for security warnings or irreversible action confirmations, then resume after.

## Installation

Included in the pi-dev repo. Auto-discovered from `~/.pi/agent/extensions/`. No additional setup required.
