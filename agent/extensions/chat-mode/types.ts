/** Shared types for the chat-mode extension. */

export type ChatMode = "off" | "chat";

/** Persisted blob. */
export interface ChatModeBlob {
  mode: ChatMode;
}

// ─── User Config ─────────────────────────────────────────────────────────────

export interface UiUserConfig {
  hideNotify?: boolean;
  hideWidget?: boolean;
}

export interface ShortcutsUserConfig {
  toggleMode?: string;
}

export interface ChatLabelUserConfig {
  notify?: string;
  notifyType?: string;
  widget?: string;
  widgetColor?: string;
}

export interface OffLabelUserConfig {
  notify?: string;
  notifyType?: string;
}

export interface LabelsUserConfig {
  chat?: ChatLabelUserConfig;
  off?: OffLabelUserConfig;
}

export interface BashPatternsUserConfig {
  safePatterns?: string[];
  destructivePatterns?: string[];
}

export interface ChatModeUserConfig {
  ui?: UiUserConfig;
  shortcuts?: ShortcutsUserConfig;
  labels?: LabelsUserConfig;
  bashPatterns?: BashPatternsUserConfig;
  /** Replace-only: provide a list of tool names to replace the default CHAT mode tool set. Omit to keep defaults. */
  allowedTools?: string[];
}