# pikit-llm-council — multi-LLM council synthesis for [pi.dev](https://pi.dev)

Convene an LLM Council — multiple models answer a question independently, then a chairman synthesizes their answers into a unified response.

https://github.com/user-attachments/assets/031066b9-c47e-4ece-9491-a648d2cc545f

## Install

```bash
pi install npm:pikit-llm-council
```

> [!TIP]
> Or grab the entire [pikit](https://github.com/adrianapan/pikit) setup, an opinionated pi.dev configuration that includes this extension.

## How it works

1. **Members** — Each council member (a different LLM) receives the same question and answers independently, in parallel
2. **Chairman** — A chairman model receives all member answers (anonymously) and synthesizes the best unified response

Progress streams inline with animated spinners, member status, and elapsed time. Collapse/expand to see full member responses.

## Tool

Registered as `llm_council` — available to the agent when this extension is loaded.

| Parameter | Type | Description |
|-----------|------|-------------|
| `question` | `string` | The question to pose to the council |

### When to use

- Questions that benefit from multiple perspectives or cross-checking
- When accuracy matters — divergent answers flag uncertainty
- Not for simple factual questions or routine tasks

## Structure

```
llm-council/
├── package.json
├── README.md
├── llm-council.example.json
└── src/
    ├── config.ts   — loads llm-council.json, falls back to built-in defaults
    ├── index.ts     — extension entry point, tool registration & rendering
    ├── types.ts     — TypeScript interfaces for user config
    └── utils.ts     — color, formatting, and width helpers
```

## Default council

| Role | Model | Label |
|------|-------|-------|
| Member | GLM 5.1 | Member A |
| Member | Kimi K2.6 | Member B |
| Member | MiniMax M2.7 | Member C |
| Chairman | DeepSeek V4 Pro | Chairman |

Members have read-only tool access (`read`, `grep`, `find`, `ls`, `web_search`, `fetch_content`, `get_search_content`). The chairman has no tools — it only synthesizes.

## Configuration

Copy the example config and edit it:

```bash
cp ~/.pi/agent/extensions/llm-council/llm-council.example.json \
   ~/.pi/agent/configs/llm-council.json
```

### Member options (`member`)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `council` | `object[]` | *(3 members)* | Array of council members. Each requires `model` and `label`. Optional: `displayName`, `systemPrompt` |
| `defaultSystemPrompt` | `string` | *(built-in)* | System prompt for members that don't specify their own |
| `display.labelColor` | `string` | `"accent"` | Color for member labels |
| `display.modelColor` | `string` | `"dim"` | Color for model names |
| `tools` | `string[] \| null` | *(built-in list)* | Tools available to members. `null` = pi defaults, `[]` = no tools |
| `thinking` | `string \| null` | `"medium"` | Thinking level for members. `null` = pi default |
| `extensions` | `string[] \| null` | *(built-in list)* | Extensions for members. `null` = pi defaults |
| `skills` | `string[] \| null` | `["gh"]` | Skills for members. `null` = pi defaults |
| `contextFiles` | `boolean` | `false` | Whether members see project context files |

### Chairman options (`chairman`)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `model` | `string` | `"deepseek-v4-pro:cloud"` | Chairman model |
| `displayName` | `string` | `"DeepSeek V4 Pro"` | Human-readable name for UI |
| `systemPrompt` | `string` | *(built-in)* | Chairman system prompt |
| `exposePersonas` | `boolean` | `true` | Include member system prompts in chairman's input |
| `display.icon` | `string` | `""` | Icon prefix for chairman |
| `display.labelColor` | `string` | `"accent"` | Color for chairman label |
| `display.modelColor` | `string` | `"dim"` | Color for chairman model name |
| `tools` | `string[] \| null` | `[]` | Tools for chairman (none by default) |
| `thinking` | `string \| null` | `"medium"` | Thinking level. `null` = pi default |
| `extensions` | `string[] \| null` | `["env-loader"]` | Extensions for chairman |
| `skills` | `string[] \| null` | `[]` | Skills for chairman |
| `contextFiles` | `boolean` | `false` | Whether chairman sees project context files |

### Shared display options (`shared`)

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `spinner.prefixChars` | `string[]` | `["·","✢","✳","✶","✻","✽"]` | Spinner animation frames |
| `spinner.interval` | `number` | `80` | Spinner frame interval (ms) |
| `spinner.color` | `string` | `"muted"` | Spinner frame color |
| `successPrefix.prefix` | `string` | `"✓"` | Success indicator |
| `successPrefix.color` | `string` | `"success"` | Success indicator color |
| `errorPrefix.prefix` | `string` | `"✗"` | Error indicator |
| `errorPrefix.color` | `string` | `"error"` | Error indicator color |
| `branch.prefix` | `string` | `"└─"` | Branch/indent line prefix |
| `branch.color` | `string` | `"separator"` | Branch line color |
| `status.doneLabel` | `string` | `"Done"` | Label for completed members |
| `status.doneColor` | `string` | `"success"` | Color for done label |
| `status.errorLabel` | `string` | `"Error"` | Label for failed members |
| `status.errorColor` | `string` | `"error"` | Color for error label |
| `status.workingLabel` | `string` | `"Working..."` | Label for active members |
| `status.workingColor` | `string` | `"dim"` | Color for working label |
| `status.waitingIcon` | `string` | `"↪"` | Icon for pending members |
| `status.waitingIconColor` | `string` | `"muted"` | Color for waiting icon |
| `status.synthesizingLabel` | `string` | `"Synthesising..."` | Label when chairman is working |
| `status.waitingLabel` | `string` | `"Waiting for members..."` | Label before members start |
| `status.elapsedColor` | `string` | `"dim"` | Color for elapsed time |
| `toolHeader.titleColor` | `string` | `"toolTitle"` | Title color in tool header |
| `toolHeader.summaryColor` | `string` | `"dim"` | Summary color in tool header |
| `expandHint.color` | `string` | `"dim"` | Color for expand toggle hint |
| `questionPreview.maxLength` | `number` | `40` | Max chars for question preview |

### Color values

Color fields accept **pi theme tokens** (`"text"`, `"accent"`, `"success"`, `"error"`, `"muted"`, `"dim"`, `"separator"`, `"toolTitle"`, etc.) and **hex values** (`"#ff6600"`).
