---
name: add-ollama-cloud-model
description: Add an Ollama Cloud model to models.json. Load when the user asks to add, configure, or set up an Ollama cloud model in pi.
---

## Add Ollama Cloud Model

### Step 1 — Resolve the model page

The user will either provide a direct ollama.com URL or a model name.

- **Direct URL**: fetch it immediately with `fetch_content`
- **Model name**: use `fetch_content` on `https://ollama.com/search?q=<name>`, find the closest matching result, then fetch that model's page

### Step 2 — Extract cloud variants

On the model page, scan all available tags for entries ending in `:cloud`.

For each cloud variant collect:
- Full tag (e.g. `qwen3.5:cloud`, `qwen3.5:397b-cloud`)
- Context window size
- Supported inputs (text only, or text + image)

If **no cloud variants** are found, tell the user and stop.

If **one cloud variant** is found, proceed with it directly.

If **multiple cloud variants** are found, list them with their context window and input support, and ask the user which one(s) to add before proceeding.

### Step 3 — Derive the model name

Strip the `:cloud` or `:<params>-cloud` suffix and convert to title case.

Examples:
- `qwen3.5:cloud` → `Qwen 3.5`
- `qwen3.5:397b-cloud` → `Qwen 3.5 397B`
- `llama3.3:70b-cloud` → `Llama 3.3 70B`

### Step 4 — Update models.json

Check if `~/.pi/agent/models.json` exists. If not, create it with an empty `providers` object.

Merge the new model(s) into the `ollama-cloud` provider block. If the provider block doesn't exist yet, add it with this exact shape:

```json
"ollama-cloud": {
  "api": "openai-completions",
  "apiKey": "!grep ^OLLAMA_API_KEY ~/.pi/agent/configs/.env | cut -d= -f2",
  "baseUrl": "https://ollama.com/v1",
  "compat": {
    "supportsDeveloperRole": false
  },
  "models": []
}
```

Each model entry:

```json
{
  "id": "<full-cloud-tag>",
  "name": "<derived name from step 3>",
  "contextWindow": <value from model page>,
  "input": <derived from model page capabilities>,
  "reasoning": <true if model page explicitly states reasoning/thinking support, false otherwise>
}
```

For `input`: map all supported modalities listed on the model page (e.g. `["text"]`, `["text", "image"]`). Do not assume — read what the page says.

For `reasoning`: only set `true` if the model page explicitly mentions thinking, reasoning, or a reasoning mode. Default to `false` if unclear.

Do not duplicate a model that is already present in the list.

### Step 6 — Confirm

Do not verify the API key or make any test API calls at this stage. Just update the `models.json` file and confirm to the user that the model was added successfully. Tell the user the model was added, then remind them of the two steps to start using it:

1. Run `/scoped-models` to enable the model
2. Run `/model` to open the picker and switch to it
