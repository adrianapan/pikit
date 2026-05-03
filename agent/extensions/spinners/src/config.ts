/**
 * Config loader for spinners extension.
 *
 * Reads ~/.pi/agent/configs/spinners.json if present.
 * Falls back to built-in defaults when file is absent or invalid.
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface ThemeTokens {
  verb: string;
  separator: string;
  status: string;
  separatorIcon: string;
}

export interface SpinnersConfig {
  themeTokens: ThemeTokens;
}

export const DEFAULT_THEME_TOKENS: ThemeTokens = {
  verb: "accent",
  separator: "separator",
  status: "muted",
  separatorIcon: "└─",
};

const CONFIG_PATH = join(homedir(), ".pi", "agent", "configs", "spinners.json");

function validateThemeTokens(tokens: unknown): ThemeTokens {
  if (typeof tokens !== "object" || tokens === null) {
    return DEFAULT_THEME_TOKENS;
  }
  const t = tokens as Record<string, unknown>;
  return {
    verb: typeof t.verb === "string" ? t.verb : DEFAULT_THEME_TOKENS.verb,
    separator: typeof t.separator === "string" ? t.separator : DEFAULT_THEME_TOKENS.separator,
    status: typeof t.status === "string" ? t.status : DEFAULT_THEME_TOKENS.status,
    separatorIcon: typeof t.separatorIcon === "string" ? t.separatorIcon : DEFAULT_THEME_TOKENS.separatorIcon,
  };
}

export function loadConfig(): SpinnersConfig {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    const themeTokens = validateThemeTokens(parsed.themeTokens);
    return { themeTokens };
  } catch {
    return { themeTokens: DEFAULT_THEME_TOKENS };
  }
}
