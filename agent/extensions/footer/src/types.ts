import type { Theme, ThemeColor } from "@mariozechner/pi-coding-agent";
import type { IconSet } from "./icons.js";

// Theme color - either a pi theme color name or a custom hex color
export type ColorValue = ThemeColor | `#${string}`;

// Semantic color names for segments
export type SemanticColor =
  | "pi"
  | "model"
  | "path"
  | "git"
  | "gitDirty"
  | "gitClean"
  | "thinking"
  | "thinkingIcon"
  | "thinkingOff"
  | "thinkingMinimal"
  | "thinkingLow"
  | "thinkingMedium"
  | "thinkingHigh"
  | "thinkingXhigh"
  | "context"
  | "contextWarn"
  | "contextError"
  | "cost"
  | "tokens"
  | "separator";

// Color scheme mapping semantic names to actual colors
export type ColorScheme = Partial<Record<SemanticColor, ColorValue>>;

// Segment identifiers
export type StatusLineSegmentId =
  | "pi"
  | "model"
  | "path"
  | "git"
  | "token_in"
  | "token_out"
  | "token_total"
  | "cost"
  | "context_pct"
  | "context_total"
  | "cache_read"
  | "cache_write"
  | "thinking"
  | "separator"
  | `text:${string}`;

// Per-segment options
export interface StatusLineSegmentOptions {
  model?: { showThinkingLevel?: boolean };
  path?: {
    mode?: "basename" | "abbreviated" | "full";
    maxLength?: number;
  };
  git?: {
    showBranch?: boolean;
    showStaged?: boolean;
    showUnstaged?: boolean;
    showUntracked?: boolean;
  };
  thinking?: { prefix?: string };
  context_pct?: { showAutoIcon?: boolean };
  token_in?: { mode?: "icons" | "text" };
  token_out?: { mode?: "icons" | "text" };
  token_total?: { mode?: "icons" | "text" };
}

// Git status data
export interface GitStatus {
  branch: string | null;
  staged: number;
  unstaged: number;
  untracked: number;
}

// Usage statistics
export interface UsageStats {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  cost: number;
}

// Context passed to segment render functions
export interface SegmentContext {
  model: { id: string; name?: string; reasoning?: boolean; contextWindow?: number } | undefined;
  thinkingLevel: string;
  sessionId: string | undefined;
  usageStats: UsageStats;
  contextPercent: number;
  contextWindow: number;
  autoCompactEnabled: boolean;
  usingSubscription: boolean;
  sessionStartTime: number;
  git: GitStatus;
  options: StatusLineSegmentOptions;
  width: number;
  theme: Theme;
  colors: ColorScheme;
  icons: IconSet;
}

// Rendered segment output
export interface RenderedSegment {
  content: string;
  visible: boolean;
}

// User configuration from footer.json
export interface SlopFooterUserConfig {
  leftSegments?: StatusLineSegmentId[];
  rightSegments?: StatusLineSegmentId[];
  colors?: ColorScheme;
  segmentOptions?: StatusLineSegmentOptions;
  icons?: Partial<IconSet>;
}
