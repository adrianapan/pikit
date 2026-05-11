/** OFF/PLAN/EXECUTE state machine with session persistence via appendEntry blob. */

import { ENTRY_TYPE } from "./config.js";
import type { PlanMode, PlanModeBlob } from "./types.js";

/** Mutable state — shared within the extension module. */
const state: {
  mode: PlanMode;
  activePlanFile: string | null;
  refining: boolean;
} = {
  mode: "off",
  activePlanFile: null,
  refining: false,
};

// Expose read-only view for footer segment
(globalThis as Record<string, unknown>).__planMode = { mode: state.mode };

/** Sync globalThis snapshot after state changes. */
function syncGlobalThis(): void {
  (globalThis as Record<string, unknown>).__planMode = { mode: state.mode };
  const requestRender = (globalThis as Record<string, unknown>).__footerRequestRender;
  if (typeof requestRender === "function") requestRender();
}

/** Get current mode. */
export function getMode(): PlanMode {
  return state.mode;
}

/** Get active plan file (filename only, relative to .pi/plans/). */
export function getActivePlanFile(): string | null {
  return state.activePlanFile;
}

/** Set active plan file and persist. */
export function setActivePlanFile(file: string | null, pi: { appendEntry: (type: string, data?: unknown) => void }): void {
  state.activePlanFile = file;
  syncGlobalThis();
  persist(pi);
}

/** Get refining flag (ephemeral, in-memory only). */
export function getRefining(): boolean {
  return state.refining;
}

/** Set refining flag (ephemeral — no persist). */
export function setRefining(value: boolean): void {
  state.refining = value;
}

/** Transition to plan mode with a specific active plan file. Single persist — avoids double appendEntry. */
export function enterPlanWithFile(file: string | null, pi: { appendEntry: (type: string, data?: unknown) => void }): void {
  state.mode = "plan";
  state.activePlanFile = file;
  state.refining = false;
  syncGlobalThis();
  persist(pi);
}

/** Set mode, reset refining, and persist. */
export function transition(
  newMode: PlanMode,
  pi: { appendEntry: (type: string, data?: unknown) => void },
): void {
  if (newMode === "plan") {
    state.activePlanFile = null;
  }
  state.mode = newMode;
  state.refining = false;
  syncGlobalThis();
  persist(pi);
}

/** Persist current state to session. */
function persist(pi: { appendEntry: (type: string, data?: unknown) => void }): void {
  pi.appendEntry(ENTRY_TYPE, {
    mode: state.mode,
    activePlanFile: state.activePlanFile,
  });
}

/** Restore state from the last plan-mode session entry on the current branch. */
export function restore(entries: Array<{ type: string; customType?: string; data?: unknown }>): boolean {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.type === "custom" && entry.customType === ENTRY_TYPE) {
      const data = entry.data as PlanModeBlob | undefined;
      if (data?.mode) {
        state.mode = data.mode;
        state.activePlanFile = data.activePlanFile ?? null;
        state.refining = false;
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
  state.activePlanFile = null;
  state.refining = false;
  syncGlobalThis();
}