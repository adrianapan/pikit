/** Shared types for the plan-mode extension. */

export type PlanMode = "off" | "plan" | "execute";

/** Persisted blob — plan file is the source of truth for steps. */
export interface PlanModeBlob {
  mode: PlanMode;
  activePlanFile: string | null;
}

export interface PlanFileSummary {
  name: string;
  title: string;
}