/**
 * Config loader for the permission-gate extension.
 *
 * Reads ~/.pi/agent/configs/permission-gate.json if present.
 * Falls back to built-in defaults when the file is absent or unreadable.
 *
 * Config shape:
 * {
 *   "patterns": ["\\brm\\s+(-rf?|--recursive)", "\\bsudo\\b", ...],
 *   "blockWithoutUI": true
 * }
 */

import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export interface PermissionGateConfig {
  /** Compiled regex patterns to match against bash commands. */
  patterns: RegExp[];
  /** Block dangerous commands when no UI is available. Default: true. */
  blockWithoutUI: boolean;
  /** Descriptions of invalid pattern strings found in the config. */
  errors?: string[];
}

const DEFAULT_PATTERNS: RegExp[] = [
  /\brm\s+(-rf?|--recursive)/i,
  /\bsudo\b/i,
  /\b(chmod|chown)\s+(?:-[a-z]+\s+)*777(?:\b|$)/i,
  /\bprintenv\b/i,
  /(^|\s)env(\s|$)/i,
];

const CONFIG_PATH = join(homedir(), ".pi", "agent", "configs", "permission-gate.json");

export function loadConfig(): PermissionGateConfig {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);

    const blockWithoutUI =
      typeof parsed.blockWithoutUI === "boolean" ? parsed.blockWithoutUI : true;

    const patternStrings =
      Array.isArray(parsed.patterns) && parsed.patterns.length > 0
        ? (parsed.patterns as unknown[]).filter((p): p is string => typeof p === "string")
        : null;

    if (!patternStrings || patternStrings.length === 0) {
      return { patterns: DEFAULT_PATTERNS, blockWithoutUI };
    }

    const patterns: RegExp[] = [];
    const errors: string[] = [];

    for (const p of patternStrings) {
      try {
        patterns.push(new RegExp(p, "i"));
      } catch {
        errors.push(`Invalid pattern: "${p}"`);
      }
    }

    return {
      patterns: patterns.length > 0 ? patterns : DEFAULT_PATTERNS,
      blockWithoutUI,
      errors: errors.length > 0 ? errors : undefined,
    };
  } catch {
    // File absent or unreadable — use defaults
    return { patterns: DEFAULT_PATTERNS, blockWithoutUI: true };
  }
}
