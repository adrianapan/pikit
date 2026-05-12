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

// ─── User Config ─────────────────────────────────────────────────────────────

export interface CleanupUserConfig {
  cleanupOnComplete?: boolean;
}

export interface UiUserConfig {
  hideNotify?: boolean;
  hideWidget?: boolean;
}

export interface ShortcutsUserConfig {
  toggleMode?: string;
}

export interface PlanLabelUserConfig {
  notify?: string;
  notifyType?: string;
  notifyWithTitle?: string;
  notifyLoaded?: string;
  widget?: string;
  widgetWithTitle?: string;
  widgetColor?: string;
}

export interface ExecuteLabelUserConfig {
  notify?: string;
  notifyWithTitle?: string;
  notifyType?: string;
  widget?: string;
  widgetWithTitle?: string;
  widgetColor?: string;
}

export interface OffLabelUserConfig {
  notify?: string;
  notifyType?: string;
}

export interface LabelsUserConfig {
  plan?: PlanLabelUserConfig;
  execute?: ExecuteLabelUserConfig;
  off?: OffLabelUserConfig;
}

export interface BashPatternsUserConfig {
  safePatterns?: string[];
  destructivePatterns?: string[];
}

export interface PlanModeUserConfig {
  cleanup?: CleanupUserConfig;
  ui?: UiUserConfig;
  shortcuts?: ShortcutsUserConfig;
  labels?: LabelsUserConfig;
  bashPatterns?: BashPatternsUserConfig;
}