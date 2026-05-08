---
name: styled-outputs-builder
description: Architecture patterns for building the styled-outputs pi.dev extension. Load when adding features to styled-outputs extension. Covers separation of concerns, clean config patterns, modular component design, and porting from pi-cc-tools without replicating messy code.
---

## Extension Architecture Patterns

### Core Principles

**1. Functional Over Class-Based**
- Prefer factory functions + closures over classes
- No `this` — closure variables are lexically scoped, truly private, no binding issues
- Every component: factory fn → `{ render(width), invalidate() }` object
- Easier to reason about, compose, and refactor as extension grows

**2. Single Source of Truth**
- Config values defined once, derived values computed automatically
- No hardcoded magic numbers that duplicate config
- If you change a config value, all dependent values auto-adjust

**3. Separation of Concerns**
```
extension-name/
├── package.json
└── src/
    ├── index.ts           # Entry point, wiring only
    ├── config.ts          # Dumb config values only
    ├── utils.ts           # Pure helper functions
    └── components/        # TUI components (if needed)
        └── <name>.ts
```

**4. Clean Porting**
- Draw inspiration from functionality, not implementation
- Don't replicate convoluted code from reference repos
- Build cleaner, simpler, more maintainable
- If reference code is messy, interpret the intent and reimplement properly

---

## File Responsibilities

### `index.ts` — Entry Point

**Purpose:** Wire extension into pi lifecycle

**Contains:**
- Import statements
- Patch hooks (if modifying existing components)
- Event subscriptions (`pi.on()`)
- Tool/command registrations
- **No business logic** — delegate to utils/components

**Example:**
```typescript
import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { AssistantMessageComponent } from "@mariozechner/pi-coding-agent";
import { PATCH_FLAG } from "./utils.js";
import { createAssistantMessage } from "./components/assistant-message.js";
import { createThinkingMessage } from "./components/thinking-message.js";

export default function styledOutputs(pi: ExtensionAPI) {
  const proto = AssistantMessageComponent.prototype as any;
  if (proto[PATCH_FLAG]) return;

  const originalUpdateContent = proto.updateContent;
  proto.updateContent = function patchedUpdateContent(message: any) {
    if (!message?.content || !Array.isArray(message.content)) {
      return originalUpdateContent.call(this, message);
    }

    originalUpdateContent.call(this, message);

    const container = this.contentContainer;
    if (!container?.children) return;

    const mdTheme = this.markdownTheme;
    for (let i = container.children.length - 1; i >= 0; i--) {
      const child = container.children[i];
      if (child instanceof Markdown) {
        const text = child.text;
        if (!text) continue;

        const isThinking = !!child.defaultTextStyle?.italic;
        if (isThinking) {
          container.children[i] = createThinkingMessage(text, mdTheme);
        } else {
          container.children[i] = createAssistantMessage(text, mdTheme);
        }
      }
    }
  };

  proto[PATCH_FLAG] = true;
}
```

---

### `config.ts` — Configuration

**Purpose:** Single source of truth for configurable values

**Contains:**
- Plain values only (strings, numbers, objects)
- **No logic** — no functions, no computed values
- **No dependencies** on utils or other modules (unless unavoidable)

**Example:**
```typescript
export const CONFIG = {
  assistantPrefix: "●",
};
```

**Anti-pattern:**
```typescript
// ❌ Don't do this in config.ts
export const CONFIG = {
  assistantPrefix: "●",
  assistantPrefixWidth: 3,  // Hardcoded! Will break if assistantPrefix changes
  assistantPaddingPrefix: "   ", // Must manually sync with assistantPrefixWidth
};
```

---

### `utils.ts` — Utilities

**Purpose:** Pure helper functions used across the extension

**Contains:**
- String manipulation (strip ANSI, measure width, etc.)
- Validation helpers
- Computed value generators (padding from prefix, etc.)
- **No side effects** — pure functions only
- **No pi-specific logic** — keep generic/reusable

**Example:**
```typescript
export const PATCH_FLAG = Symbol.for("styled-outputs:patched");

export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

export function hasVisibleContent(line: string): boolean {
  return stripAnsi(line).trim().length > 0;
}

export function getVisibleWidth(text: string): number {
  return text.replace(/\x1b\[[0-9;]*m/g, "").length;
}

export function generatePadding(prefix: string): string {
  return " ".repeat(getVisibleWidth(prefix));
}
```

**Key Pattern:** Derived values computed from config
```typescript
// In component or module scope:
const ASSISTANT_PREFIX_WIDTH = getVisibleWidth(CONFIG.assistantPrefix) + 2;
const ASSISTANT_PADDING_PREFIX = " ".repeat(ASSISTANT_PREFIX_WIDTH);
```

---

### `components/<name>.ts` — TUI Components

**Purpose:** Custom rendering for pi TUI

**Contains:**
- Module-level derived config (computed from CONFIG values)
- Optional module-level helper functions (string building, color application)
- Exported TypeScript interface for the component shape
- Exported factory function → `{ render(width), invalidate() }` object
- State held in closure variables (truly private, no `this`)
- Cached rendering for performance
- **No pi lifecycle logic** — pure rendering only

**Standard file shape:**
```
components/<name>.ts
  ├── Module-level derived config (ASSISTANT_PREFIX_WIDTH, ASSISTANT_PADDING_PREFIX)
  ├── Optional helper fns (getFullPrefix, etc.)
  ├── Exported interface (type only)
  └── Exported factory fn → { render, invalidate }
```

**Example:**
```typescript
import { Markdown } from "@mariozechner/pi-tui";
import { CONFIG } from "../config.js";
import { getVisibleWidth, hasVisibleContent } from "../utils.js";

const ASSISTANT_PREFIX_WIDTH = getVisibleWidth(CONFIG.assistantPrefix) + 2;
const ASSISTANT_PADDING_PREFIX = " ".repeat(ASSISTANT_PREFIX_WIDTH);

export interface AssistantMessage {
  invalidate(): void;
  render(width: number): string[];
}

export function createAssistantMessage(text: string, markdownTheme: any): AssistantMessage {
  const md = new Markdown(text, 0, 0, markdownTheme);
  let cachedWidth: number | undefined;
  let cachedLines: string[] | undefined;

  function invalidate(): void {
    cachedWidth = undefined;
    cachedLines = undefined;
    md.invalidate();
  }

  function render(width: number): string[] {
    if (cachedLines && cachedWidth === width) return cachedLines;

    if (width <= ASSISTANT_PREFIX_WIDTH) {
      cachedWidth = width;
      cachedLines = [` ${CONFIG.assistantPrefix} `];
      return cachedLines;
    }

    const mdLines = md.render(width - ASSISTANT_PREFIX_WIDTH);
    let prefixPlaced = false;

    const rendered = mdLines.map((line: string) => {
      if (!prefixPlaced && hasVisibleContent(line)) {
        prefixPlaced = true;
        return ` ${CONFIG.assistantPrefix} ${line}`;
      }
      return `${ASSISTANT_PADDING_PREFIX}${line}`;
    });

    cachedWidth = width;
    cachedLines = rendered;
    return rendered;
  }

  return { invalidate, render };
}
```

---

## Patching Patterns

### When to Patch

Patch existing pi components when:
- You need to modify built-in rendering (messages, tools, etc.)
- The extension enhances existing functionality (not replaces)
- You want transparent integration with pi's UI

### Patch Structure

```typescript
import { PATCH_FLAG } from "./utils.js";

export default function myExtension(pi: ExtensionAPI) {
  const proto = TargetComponent.prototype as any;
  if (proto[PATCH_FLAG]) return;  // Prevent double-patching

  const originalMethod = proto.targetMethod;
  proto.targetMethod = function patchedMethod(...args: any[]) {
    // Call original
    const result = originalMethod.call(this, ...args);
    
    // Enhance/modify
    // ...
    
    return result;
  };

  proto[PATCH_FLAG] = true;
}
```

**Key Points:**
- Use `Symbol.for("unique-name:patched")` for patch flag
- Check flag before patching (prevents reload issues)
- Always call original method unless intentionally replacing
- Store original method reference before overwriting

---

## Config Derivation Pattern

**Problem:** Hardcoded values break when config changes

**Solution:** Compute derived values from base config

```typescript
// config.ts
export const CONFIG = {
  assistantPrefix: "●",  // Single source of truth
};

// utils.ts
export function getVisibleWidth(text: string): number {
  return text.replace(/\x1b\[[0-9;]*m/g, "").length;
}

// component.ts
const ASSISTANT_PREFIX_WIDTH = getVisibleWidth(CONFIG.assistantPrefix) + 2;  // Auto-computed
const ASSISTANT_PADDING_PREFIX = " ".repeat(ASSISTANT_PREFIX_WIDTH);  // Auto-matched
```

**Benefits:**
- Change `assistantPrefix` → everything auto-adjusts
- No manual sync required
- Impossible to have mismatched values

---

## Feature Extraction Checklist

When porting features from reference implementations:

1. **Understand the intent** — What does this feature do?
2. **Ignore the implementation** — Reference code might be messy
3. **Design clean architecture** — Apply separation of concerns
4. **Extract config** — What should be configurable?
5. **Identify utilities** — What helpers are needed?
6. **Build components** — What custom rendering is required?
7. **Wire it up** — Keep index.ts lean

**Example:** Reference repo has 200-line monolithic file
- Extract config values → `config.ts`
- Extract helper functions → `utils.ts`
- Extract rendering logic → `components/`
- Leave wiring in → `index.ts`

Result: 4 focused files, each doing one thing well.

---

## Common Pitfalls

### ❌ Hardcoded Duplication
```typescript
// config.ts
export const CONFIG = {
  assistantPrefix: "●",
  assistantPrefixWidth: 3,      // ❌ Hardcoded
  assistantPaddingPrefix: "   ",    // ❌ Must manually sync
};
```

### ✅ Derived Values
```typescript
// config.ts
export const CONFIG = {
  assistantPrefix: "●",
};

// component.ts
const WIDTH = getVisibleWidth(CONFIG.assistantPrefix) + 2;
const PADDING = " ".repeat(WIDTH);
```

---

### ❌ Logic in Config
```typescript
// config.ts
export const CONFIG = {
  assistantPrefix: "●",
  get assistantPrefixWidth() {  // ❌ Config should be dumb
    return getVisibleWidth(this.assistantPrefix);
  },
};
```

### ✅ Logic in Utils/Components
```typescript
// config.ts
export const CONFIG = { assistantPrefix: "●" };

// utils.ts
export function getVisibleWidth(text: string): number { ... }

// component.ts
const WIDTH = getVisibleWidth(CONFIG.assistantPrefix);
```

---

### ❌ Everything in index.ts
```typescript
// index.ts - 300 lines of everything
export default function(pi) {
  // config, utils, components, wiring - all mixed together
}
```

### ✅ Separated Concerns
```typescript
// index.ts - 40 lines of wiring only
import { createAssistantMessage } from "./components/assistant-message.js";
import { createThinkingMessage } from "./components/thinking-message.js";
import { PATCH_FLAG } from "./utils.js";

export default function(pi) {
  // Just wiring
}
```

---

## Testing Checklist

Before considering a feature complete:

- [ ] Config values are in `config.ts` (dumb values only)
- [ ] Helper functions are in `utils.ts` (pure functions)
- [ ] Components use factory functions + closures (not classes)
- [ ] Each component exports interface + factory fn → `{ render, invalidate }`
- [ ] `index.ts` is wiring only (no business logic)
- [ ] Derived values auto-compute from config
- [ ] Patch flag prevents double-patching
- [ ] No hardcoded duplication
- [ ] Reference code inspiration, not replication

---

### ❌ Using Classes for Components
```typescript
// ❌ Avoid classes — `this` binding issues, `private` is fake privacy, harder to compose
export class AssistantMessage {
  private md: InstanceType<typeof Markdown>;
  constructor(text: string, markdownTheme: any) {
    this.md = new Markdown(text, 0, 0, markdownTheme);
  }
  invalidate(): void { this.md.invalidate(); }
  render(width: number): string[] { /* ... */ }
}
```

### ✅ Factory Functions with Closures
```typescript
// ✅ Prefer factory functions — lexical scope, true privacy, no `this`
export function createAssistantMessage(text: string, markdownTheme: any) {
  const md = new Markdown(text, 0, 0, markdownTheme);
  let cachedWidth: number | undefined;

  function invalidate(): void { cachedWidth = undefined; md.invalidate(); }
  function render(width: number): string[] { /* use closure vars */ }

  return { invalidate, render };
}
```

---

## When to Deviate

These patterns are defaults. Deviate when:
- Extension is trivial (single file is fine)
- Performance requires different structure
- pi API constraints force different approach
- User explicitly requests different architecture

**Rule of thumb:** Start with this structure. Refactor if complexity demands it.

---

## Design Decisions

### Thinking Message: Continuation Lines Align to Prefix, Not Label

When `isLabelVisible: true`, the thinking message renders like:

```
 ✽ Thinking: first line of content
   continuation line
   another line
```

The `PADDING_PREFIX` aligns continuation lines with the prefix icon width (` ✽ `), **not** with the full first-line prefix (` ✽ Thinking: `). This is intentional — the label acts as a one-time header, and continuation lines flow under the standard prefix indent. Aligning to the full prefix would create excessive indentation for long labels.

### Config Groups: Sparse Overrides Fall Through to General

Group configs (`base`, `mcp`, `web`, `custom`) are sparse — users only set the properties they want to override. Everything else falls through to `CONFIG.tools.general` via `groupProp()`. This avoids duplicating defaults and keeps group configs minimal.
