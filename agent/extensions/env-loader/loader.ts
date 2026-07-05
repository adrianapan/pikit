import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LoadResult {
  /** Keys successfully injected into process.env */
  keys: string[];
  /** Vars skipped because the key already existed in the shell environment */
  skipped: number;
  /** File read error, if any */
  error?: string;
}

// ─── Loader ───────────────────────────────────────────────────────────────────

const CONFIG_PATH = join(homedir(), ".pi", "agent", "configs", ".env");

/**
 * Reads ~/.pi/agent/configs/.env and injects each entry into process.env.
 * Shell environment takes precedence — existing values are never overwritten.
 *
 * Supported syntax:
 *   KEY=value
 *   KEY="value"   or   KEY='value'
 *   export KEY=value
 *   # comment lines and blank lines are ignored
 */
export function loadEnvFile(): LoadResult {
  if (!existsSync(CONFIG_PATH)) return { keys: [], skipped: 0 };

  let content: string;
  try {
    content = readFileSync(CONFIG_PATH, "utf-8");
  } catch (e) {
    return {
      keys: [],
      skipped: 0,
      error: `could not read .env — ${e instanceof Error ? e.message : String(e)}`,
    };
  }

  const keys: string[] = [];
  let skipped = 0;

  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) continue;

    // Strip optional 'export ' prefix
    const stripped = line.startsWith("export ") ? line.slice(7).trimStart() : line;

    const eqIdx = stripped.indexOf("=");
    if (eqIdx === -1) continue;

    const key = stripped.slice(0, eqIdx).trim();
    if (!key) continue;

    let value = stripped.slice(eqIdx + 1);

    // Strip matching outer quotes; trim unquoted values
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.trim();
    }

    if (process.env[key] !== undefined) {
      skipped++;
      continue; // shell env takes precedence
    }

    process.env[key] = value;
    keys.push(key);
  }

  return { keys, skipped };
}
