/** OFF/CHAT state machine with session persistence via appendEntry blob. */

import { ENTRY_TYPE } from "./config.js";
import type { ChatMode, ChatModeBlob } from "./types.js";

/** Mutable state — shared within the extension module. */
const state: {
  mode: ChatMode;
} = {
  mode: "off",
};

// Expose read-only view for footer segment + chat-input border
(globalThis as Record<string, unknown>).__chatMode = { mode: state.mode };

/** Sync globalThis snapshot after state changes. */
function syncGlobalThis(): void {
  (globalThis as Record<string, unknown>).__chatMode = { mode: state.mode };
  const requestRender = (globalThis as Record<string, unknown>).__footerRequestRender;
  if (typeof requestRender === "function") requestRender();
}

/** Get current mode. */
export function getMode(): ChatMode {
  return state.mode;
}

/** Set mode and persist. */
export function transition(
  newMode: ChatMode,
  pi: { appendEntry: (type: string, data?: unknown) => void },
): void {
  state.mode = newMode;
  syncGlobalThis();
  persist(pi);
}

/** Persist current state to session. */
function persist(pi: { appendEntry: (type: string, data?: unknown) => void }): void {
  pi.appendEntry(ENTRY_TYPE, {
    mode: state.mode,
  });
}

/** Restore state from the last chat-mode session entry on the current branch. */
export function restore(entries: Array<{ type: string; customType?: string; data?: unknown }>): boolean {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.type === "custom" && entry.customType === ENTRY_TYPE) {
      const data = entry.data as ChatModeBlob | undefined;
      if (data?.mode) {
        state.mode = data.mode;
        syncGlobalThis();
        return true;
      }
    }
  }
  return false;
}

/** Reset state to off. */
export function resetState(): void {
  state.mode = "off";
  syncGlobalThis();
}