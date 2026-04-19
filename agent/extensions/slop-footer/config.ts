import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { SlopFooterUserConfig, StatusLineSegmentId, ColorScheme, StatusLineSegmentOptions } from "./types.js";
import { getDefaultColors } from "./theme.js";
import type { IconSet } from "./icons.js";

// Default segment configuration
const DEFAULT_LEFT_SEGMENTS: StatusLineSegmentId[] = [
  "pi",
    "separator",
    "model",
    "separator",
    "thinking",
    "separator",
    "path",
    "git"
  
];

const DEFAULT_RIGHT_SEGMENTS: StatusLineSegmentId[] = [
  "context_pct",
    "separator",
    "token_total",
    "token_in",
    "token_out",
    "separator",
    "cost"
];

const DEFAULT_SEGMENT_OPTIONS: StatusLineSegmentOptions = {
  model: { showThinkingLevel: false },
  path: { mode: "basename" },
  git: { 
    showBranch: true, 
    showStaged: true, 
    showUnstaged: true, 
    showUntracked: true 
  },
  context_pct: { showAutoIcon: false }
};

// Cache for user config
let userConfigCache: SlopFooterUserConfig | null = null;
let userConfigCacheTime = 0;
const CACHE_TTL = 5000; // 5 seconds

function getConfigPath(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  return join(homeDir, ".pi", "agent", "slop-footer.json");
}

export function loadUserConfig(): SlopFooterUserConfig | null {
  const now = Date.now();
  if (userConfigCache && now - userConfigCacheTime < CACHE_TTL) {
    return userConfigCache;
  }

  const configPath = getConfigPath();
  try {
    if (existsSync(configPath)) {
      const content = readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(content);
      userConfigCache = parsed as SlopFooterUserConfig;
      userConfigCacheTime = now;
      return userConfigCache;
    }
  } catch {
    // Ignore errors, return null
  }

  userConfigCache = null;
  userConfigCacheTime = now;
  return null;
}

export function clearUserConfigCache(): void {
  userConfigCache = null;
  userConfigCacheTime = 0;
}

export function getEffectiveConfig(): {
  leftSegments: StatusLineSegmentId[];
  rightSegments: StatusLineSegmentId[];
  colors: ColorScheme;
  segmentOptions: StatusLineSegmentOptions;
  icons: Partial<IconSet>;
} {
  const userConfig = loadUserConfig();

  return {
    leftSegments: userConfig?.leftSegments ?? DEFAULT_LEFT_SEGMENTS,
    rightSegments: userConfig?.rightSegments ?? DEFAULT_RIGHT_SEGMENTS,
    colors: userConfig?.colors ?? getDefaultColors(),
    segmentOptions: {
      ...DEFAULT_SEGMENT_OPTIONS,
      ...userConfig?.segmentOptions,
    },
    icons: userConfig?.icons ?? {},
  };
}
