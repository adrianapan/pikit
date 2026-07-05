---
name: pi-extension-builder
description: Guidelines for creating or modifying pi.dev extensions in this repo (~/.pi). Load when the user asks to build, edit, debug, or refactor a pi.dev extension.
---

## Pi Extension Development Guide

### Before writing any code

- Read root `README.md` — documents extensions, file tree, setup conventions
- Read extension's `README.md` if exists
- Read existing `src/index.ts` to understand current patterns
- Source of truth: code, not README

### Structure decision: simple vs complex

Judge scope first, then pick pattern:

**Simple** (spinner, env-loader, single tool):
```
agent/extensions/<name>/
├── README.md
├── package.json
└── src/
    └── index.ts
```

**Complex** (TUI components, user config, multiple tools, layered logic):
```
agent/extensions/<name>/
├── README.md
├── package.json
├── <name>.example.json     # Example user config (with relevant _comment)
└── src/
    ├── index.ts            # Wiring only
    ├── config.ts           # Dumb values (single source of truth)
    ├── utils.ts            # Pure helpers
    └── components/         # TUI components if needed
        └── <name>.ts
```

**Rules:**
- Start simple — split only when needed
- If user config is needed, `config.ts` and `<name>.example.json` are mandatory
- `index.ts` always the entry point, always exports default function receiving `ExtensionAPI`
- `package.json` must include `"pi": { "extensions": ["./src/index.ts"] }` — see `web-access/package.json`
- New extensions go in root npm workspace
- Extensions are published to npm as `pikit-<name>` — mirror the full manifest shape of `footer/package.json`: `pikit-` prefixed `name`, `files` (src + example config), `repository` with `directory`, `keywords` including `pi-package`, and `peerDependencies` (see below)

### Code conventions

- Export single default function receiving `ExtensionAPI` — no classes, no extra exports
- Reference existing extensions: `web-access/src/index.ts` (tool registration), `startup/src/index.ts` (lifecycle), `permission-gate/src/index.ts` (interception)
- Match TypeScript style of file being edited — no new patterns
- Opening a URL in the default browser — use the `mcp/src/helpers.ts` `openBrowser` pattern: `spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref()` with `cmd` = `open` (darwin) / `start` (win32) / `xdg-open` (linux). No shell, no `exec` string concatenation. See `agent/extensions/mcp/src/helpers.ts`
- One concern per extension

### Import ordering

Group imports with a blank line between externals and internals:

```typescript
// External: @earendil-works/*, node:*, other packages
import type { Theme } from "@earendil-works/pi-coding-agent";
import { existsSync } from "node:fs";
import { join } from "node:path";

// Internal: ./ or ../ relative paths
import { CONFIG } from "./config.js";
import type { Result } from "./types.js";
```

**Rules:**
- All external imports first (`@earendil-works/*`, `node:*`, third-party)
- All internal imports after (`./`, `../`)
- Blank line between the two groups
- Within each group, match existing ordering (don't reorder beyond grouping)
- Applies to `import type` lines too — they follow the same grouping
- Don't add comments to the import section — it's self-explanatory with the grouping

### Package namespace

Pi's npm packages live under `@earendil-works/` (the old `@mariozechner/` scope is deprecated). The extension loader resolves both prefixes to the same bundled modules at runtime — no `npm install` needed in extension code.

| Deprecated (old) | Current |
|---|---|
| `@mariozechner/pi-coding-agent` | `@earendil-works/pi-coding-agent` |
| `@mariozechner/pi-tui` | `@earendil-works/pi-tui` |
| `@mariozechner/pi-agent-core` | `@earendil-works/pi-agent-core` |
| `@mariozechner/pi-ai` | `@earendil-works/pi-ai` |

**Convention:** Use `@earendil-works/pi-coding-agent` and `@earendil-works/pi-tui` for imports. Match existing extension code. Never put these in `dependencies` — the loader provides them. Because extensions are published to npm, list each pi package the extension imports in `peerDependencies` with a `"*"` range (`@earendil-works/pi-coding-agent` always; `pi-tui`, `pi-ai`, `typebox` only if imported). Genuine third-party runtime deps (e.g. `@sinclair/typebox`, `marked`) go in `dependencies` as usual.

### Complex extension patterns

Apply only when structure warrants it:

**1. Single source of truth** — Config defined once, derived values computed:
```typescript
// config.ts
export const CONFIG = { DOT_PREFIX: "●" };

// component.ts
const WIDTH = getVisibleWidth(CONFIG.DOT_PREFIX) + 2;  // Auto-computed
const PADDING = " ".repeat(WIDTH);  // Auto-matched
```

**2. Separation of concerns**
- `index.ts` — Wiring (patches, events, registrations)
- `config.ts` — Dumb values only (no logic)
- `utils.ts` — Pure helpers (parsers, validators, formatters)
- `types.ts` — Type definitions (always extract when config exists). User config types mirror the config shape with all-optional fields. See `styled-outputs/src/types.ts` for pattern
- `components/` — TUI rendering (implement `render(width)` interface)

**3. Clean porting** — From reference implementations:
- Draw from functionality, not implementation
- Don't replicate convoluted code — reinterpret cleanly
- Extract in order: config → utils → components → wire in index.ts

**4. User config** — When extension supports user configuration:
   - Config file: `~/.pi/agent/configs/<extension-name>.json`
   - `config.ts` defines `DEFAULT_CONFIG` with all defaults (color fields use theme tokens like `"text"`, `"accent"`, `"success"`, `"muted"`, `"dim"`, `"separator"`)
   - `loadUserConfig()` reads user config (`readFileSync` + `JSON.parse`, catch → `{}`)
   - Merge via `??`: `userConfig.field ?? DEFAULT_CONFIG.FIELD` — user overrides win, defaults fill gaps
   - See `styled-outputs/src/config.ts` for full pattern

**5. Color support** — All color config fields must accept both theme tokens and hex:
   - Theme tokens: `"text"`, `"accent"`, `"success"`, `"error"`, `"muted"`, `"dim"`, `"separator"`, `"toolTitle"`, etc.
   - Hex values: `"#ff6600"`, `"#00ff88"`, etc.
   - Implementation in `utils.ts`:
     - `isHexColor(color)` — checks `color.startsWith("#")`
     - `applyColor(theme, color, text)` — hex → ANSI truecolor (`\x1b[38;2;r;g;bm`), otherwise `theme.fg(color, text)`
     - `applyBgColor(theme, color, text)` — hex → ANSI truecolor bg (`\x1b[48;2;r;g;bm`), otherwise converts theme fg ANSI to bg ANSI (swap `38` → `48`)
   - See `styled-outputs/src/utils.ts` for full implementation

**6. Example config** — Include `<extension-name>.example.json` at extension root:
   - `_comment` key with file placement instructions (e.g. `"Place this file at ~/.pi/agent/configs/<name>.json"`)
   - Default values for every field — users copy this as starting point
   - See `styled-outputs/styled-outputs.example.json` for pattern

**7. Patching pattern** — Modifying pi components:
```typescript
import { PATCH_FLAG } from "./utils.js";

export default function(pi) {
  const proto = TargetComponent.prototype as any;
  if (proto[PATCH_FLAG]) return;  // Prevent double-patching
  
  const original = proto.method;
  proto.method = function(...args) {
    const result = original.call(this, ...args);
    // Enhance/modify
    return result;
  };
  proto[PATCH_FLAG] = true;
}
```

**8. Keybindings** — Matching keystrokes or displaying key labels.

**For input handling** inside `handleInput(data)`, `ctx.ui.custom()`, or `ctx.ui.setEditorComponent()` — the framework passes a `KeybindingsManager` instance via callback:
- `ctx.ui.custom(tui, theme, keybindings, done)` → use the `keybindings` parameter
- `ctx.ui.setEditorComponent(tui, theme, keybindings)` → use the `keybindings` parameter

```typescript
if (this.keybindings.matches(data, "app.tools.expand")) {
  // toggle expansion
  return true; // consumed
}
```

**For displaying key labels** (headers, tips, help text) where no callback provides the instance — use `getKeybindings()` from `@earendil-works/pi-tui`:

```typescript
import { getKeybindings } from "@earendil-works/pi-tui";

// Always call lazily inside a function (event handler, render), NOT at module top-level.
// pi sets the global instance after module init; calling at top-level gets a fallback
// instance without app keybindings (e.g. "app.model.cycleForward").
const kb = getKeybindings();

// Returns lowercase KeyId: "ctrl+p", "shift+tab"
const key = kb.getKeys("app.model.cycleForward")[0] ?? "ctrl+p";
```

**Why not `KeybindingsManager.create()`?** `KeybindingsManager` is exported as `export type` from `@earendil-works/pi-coding-agent` — it cannot be used as a value. `getKeybindings()` from `@earendil-works/pi-tui` returns the global instance that pi has configured with user overrides and app keybinding definitions.

`KeyId` values are always lowercase — use them as-is, no title-casing needed.

**Common action IDs:** `app.model.cycleForward`, `app.model.cycleBackward`, `app.thinking.cycle`, `app.tools.expand`, `app.interrupt`, `app.clear`, `app.exit`, `app.editor.external`. Full list: `AppKeybinding` type export.

**API:**
- `matches(data, action)` → keystroke matches action? (respects user overrides)
- `getKeys(action)` → KeyId[] for that action (respects user overrides)

### Don't over-engineer

- Register only tools/commands/events explicitly asked for
- No config abstraction unless extension already has one
- In doubt: mirror simplest existing extension (`spinners`, `env-loader`)

### Documentation

- Update extension's `README.md` with new features, tools, commands
- If no `README.md` exists, create one with description + usage
- Document new permissions or lifecycle hooks

**Root README additions** — under `## Extensions`, ordered by category:
1. **UI** — visible every session, zero/minimal config
2. **Security** — intercepts or blocks actions
3. **Utils** — tools, bridges, integrations
4. **Misc** — cosmetic or low-priority

Format: one short paragraph (what it does, configurable?, slash command if primary interface), `→ README` link. No command tables, no implementation detail.