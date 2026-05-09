/** OFF/PLAN/EXECUTE state machine with session persistence. */

import { ENTRY_TYPE } from "./config.js";
import type { TodoItem } from "./utils.js";

export type PlanMode = "off" | "plan" | "execute";

export interface PlanModeState {
  mode: PlanMode;
  todos: TodoItem[];
  refining: boolean;
}

/** Mutable state — shared within the extension module. */
const state: PlanModeState = {
  mode: "off",
  todos: [],
  refining: false,
};

/** Get current mode (read-only reference). */
export function getMode(): PlanMode {
  return state.mode;
}

/** Get current todos (mutable reference for in-place updates). */
export function getTodos(): TodoItem[] {
  return state.todos;
}

/** Set mode, reset refining, and persist. Clears todos when entering plan mode. */
export function transition(
  newMode: PlanMode,
  pi: { appendEntry: (type: string, data?: unknown) => void },
): void {
  if (newMode === "plan") {
    state.todos = [];
  }
  state.mode = newMode;
  state.refining = false;
  persist(pi);
}

/** Update todos in-place and persist. */
export function setTodos(
  todos: TodoItem[],
  pi: { appendEntry: (type: string, data?: unknown) => void },
): void {
  state.todos = todos;
  persist(pi);
}

export function getRefining(): boolean {
  return state.refining;
}

export function setRefining(value: boolean, pi: { appendEntry: (type: string, data?: unknown) => void }): void {
  state.refining = value;
  persist(pi);
}

/** Persist current state to session. */
function persist(pi: { appendEntry: (type: string, data?: unknown) => void }): void {
  pi.appendEntry(ENTRY_TYPE, {
    mode: state.mode,
    todos: state.todos,
    refining: state.refining,
  });
}

/** Restore state from the last plan-mode session entry on the current branch.
 *  Scans branch entries backwards (most recent first) for the latest plan-mode entry.
 *  Returns true if state was restored, false if no plan-mode entry found. */
export function restore(entries: Array<{ type: string; customType?: string; data?: unknown }>): boolean {
  for (let i = entries.length - 1; i >= 0; i--) {
    const entry = entries[i];
    if (entry.type === "custom" && entry.customType === ENTRY_TYPE) {
      const data = entry.data as PlanModeState | undefined;
      if (data?.mode) {
        state.mode = data.mode;
        state.todos = data.todos ?? [];
        state.refining = data.refining ?? false;
        return true;
      }
    }
  }
  return false;
}

/** Reset state to off — used when navigating to a branch with no plan-mode entry. */
export function resetState(): void {
  state.mode = "off";
  state.todos = [];
  state.refining = false;
}