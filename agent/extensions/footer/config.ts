import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { FooterUserConfig, StatusLineSegmentId, ColorScheme, StatusLineSegmentOptions } from "./types.js";
import { getDefaultColors } from "./theme.js";
import type { IconSet } from "./icons.js";

// Default segment configuration — two rows
const DEFAULT_ROW1_LEFT: StatusLineSegmentId[] = ["pi", "separator", "model", "separator", "path", "git"];
const DEFAULT_ROW1_RIGHT: StatusLineSegmentId[] = ["context_pct"];
const DEFAULT_ROW2_LEFT: StatusLineSegmentId[] = ["thinking", "separator", "caveman", "separator", "plan_mode", "separator", "chat_mode"];
const DEFAULT_ROW2_RIGHT: StatusLineSegmentId[] = ["token_total", "separator", "cost"];

const DEFAULT_SEGMENT_OPTIONS: StatusLineSegmentOptions = {
  path: { mode: "full" },
  git: {
    showBranch: true,
    showStaged: true,
    showUnstaged: true,
    showUntracked: true,
  },
};

// Cache for user config
let userConfigCache: FooterUserConfig | null = null;
let userConfigCacheTime = 0;
const CACHE_TTL = 5000; // 5 seconds

function getConfigPath(): string {
  const homeDir = process.env.HOME || process.env.USERPROFILE || "";
  return join(homeDir, ".pi", "agent", "configs", "footer.json");
}

export function loadUserConfig(): FooterUserConfig | null {
  const now = Date.now();
  if (userConfigCache && now - userConfigCacheTime < CACHE_TTL) {
    return userConfigCache;
  }

  const configPath = getConfigPath();
  try {
    if (existsSync(configPath)) {
      const content = readFileSync(configPath, "utf-8");
      const parsed = JSON.parse(content);
      userConfigCache = parsed as FooterUserConfig;
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
  row1LeftSegments: StatusLineSegmentId[];
  row1RightSegments: StatusLineSegmentId[];
  row2LeftSegments: StatusLineSegmentId[];
  row2RightSegments: StatusLineSegmentId[];
  colors: ColorScheme;
  segmentOptions: StatusLineSegmentOptions;
  icons: Partial<IconSet>;
} {
  const userConfig = loadUserConfig();

  return {
    row1LeftSegments: userConfig?.row1LeftSegments ?? DEFAULT_ROW1_LEFT,
    row1RightSegments: userConfig?.row1RightSegments ?? DEFAULT_ROW1_RIGHT,
    row2LeftSegments: userConfig?.row2LeftSegments ?? DEFAULT_ROW2_LEFT,
    row2RightSegments: userConfig?.row2RightSegments ?? DEFAULT_ROW2_RIGHT,
    colors: userConfig?.colors ?? getDefaultColors(),
    segmentOptions: {
      ...DEFAULT_SEGMENT_OPTIONS,
      ...userConfig?.segmentOptions,
    },
    icons: userConfig?.icons ?? {},
  };
}
