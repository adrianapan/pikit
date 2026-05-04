---
name: styled-outputs-builder
description: Architecture patterns for building the styled-outputs pi.dev extension. Load when adding features to styled-outputs extension. Covers separation of concerns, clean config patterns, modular component design, and porting from pi-cc-tools without replicating messy code.
---

## Extension Architecture Patterns

### Core Principles

**1. Single Source of Truth**
- Config values defined once, derived values computed automatically
- No hardcoded magic numbers that duplicate config
- If you change a config value, all dependent values auto-adjust

**2. Separation of Concerns**
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

**3. Clean Porting**
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
import { AssistantMessage } from "./components/assistant-message.js";

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
        if (!isThinking) {
          container.children[i] = new AssistantMessage(text, mdTheme);
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
  DOT_PREFIX: "●",
};
```

**Anti-pattern:**
```typescript
// ❌ Don't do this in config.ts
export const CONFIG = {
  DOT_PREFIX: "●",
  DOT_PREFIX_WIDTH: 3,  // Hardcoded! Will break if DOT_PREFIX changes
  PADDING_PREFIX: "   ", // Must manually sync with DOT_PREFIX_WIDTH
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
const DOT_PREFIX_WIDTH = getVisibleWidth(CONFIG.DOT_PREFIX) + 2;
const PADDING_PREFIX = " ".repeat(DOT_PREFIX_WIDTH);
```

---

### `components/<name>.ts` — TUI Components

**Purpose:** Custom rendering for pi TUI

**Contains:**
- Component classes implementing `render(width)` interface
- Cached rendering for performance
- **No pi lifecycle logic** — pure rendering only

**Example:**
```typescript
import { Markdown } from "@mariozechner/pi-tui";
import { CONFIG } from "../config.js";
import { getVisibleWidth, hasVisibleContent } from "../utils.js";

const DOT_PREFIX_WIDTH = getVisibleWidth(CONFIG.DOT_PREFIX) + 2;
const PADDING_PREFIX = " ".repeat(DOT_PREFIX_WIDTH);

export class AssistantMessage {
  private md: InstanceType<typeof Markdown>;
  private cachedWidth?: number;
  private cachedLines?: string[];

  constructor(text: string, markdownTheme: any) {
    this.md = new Markdown(text, 0, 0, markdownTheme);
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
    this.md.invalidate();
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    if (width <= DOT_PREFIX_WIDTH) {
      this.cachedWidth = width;
      this.cachedLines = [` ${CONFIG.DOT_PREFIX} `];
      return this.cachedLines;
    }

    const mdLines = this.md.render(width - DOT_PREFIX_WIDTH);
    let dotPlaced = false;

    const rendered = mdLines.map((line: string) => {
      if (!dotPlaced && hasVisibleContent(line)) {
        dotPlaced = true;
        return ` ${CONFIG.DOT_PREFIX} ${line}`;
      }
      return `${PADDING_PREFIX}${line}`;
    });

    this.cachedWidth = width;
    this.cachedLines = rendered;
    return rendered;
  }
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
  DOT_PREFIX: "●",  // Single source of truth
};

// utils.ts
export function getVisibleWidth(text: string): number {
  return text.replace(/\x1b\[[0-9;]*m/g, "").length;
}

// component.ts
const DOT_PREFIX_WIDTH = getVisibleWidth(CONFIG.DOT_PREFIX) + 2;  // Auto-computed
const PADDING_PREFIX = " ".repeat(DOT_PREFIX_WIDTH);  // Auto-matched
```

**Benefits:**
- Change `DOT_PREFIX` → everything auto-adjusts
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
  DOT_PREFIX: "●",
  DOT_PREFIX_WIDTH: 3,      // ❌ Hardcoded
  PADDING_PREFIX: "   ",    // ❌ Must manually sync
};
```

### ✅ Derived Values
```typescript
// config.ts
export const CONFIG = {
  DOT_PREFIX: "●",
};

// component.ts
const WIDTH = getVisibleWidth(CONFIG.DOT_PREFIX) + 2;
const PADDING = " ".repeat(WIDTH);
```

---

### ❌ Logic in Config
```typescript
// config.ts
export const CONFIG = {
  DOT_PREFIX: "●",
  get DOT_PREFIX_WIDTH() {  // ❌ Config should be dumb
    return getVisibleWidth(this.DOT_PREFIX);
  },
};
```

### ✅ Logic in Utils/Components
```typescript
// config.ts
export const CONFIG = { DOT_PREFIX: "●" };

// utils.ts
export function getVisibleWidth(text: string): number { ... }

// component.ts
const WIDTH = getVisibleWidth(CONFIG.DOT_PREFIX);
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
import { AssistantMessage } from "./components/assistant-message.js";
import { CONFIG } from "./config.js";
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
- [ ] Components are in `components/` (rendering only)
- [ ] `index.ts` is wiring only (no business logic)
- [ ] Derived values auto-compute from config
- [ ] Patch flag prevents double-patching
- [ ] No hardcoded duplication
- [ ] Reference code inspiration, not replication

---

## When to Deviate

These patterns are defaults. Deviate when:
- Extension is trivial (single file is fine)
- Performance requires different structure
- pi API constraints force different approach
- User explicitly requests different architecture

**Rule of thumb:** Start with this structure. Refactor if complexity demands it.
