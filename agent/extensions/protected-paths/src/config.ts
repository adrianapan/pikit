/**
 * Config loader for the protected-paths extension.
 *
 * Reads ~/.pi/agent/configs/protected-paths.json if present.
 * Falls back to built-in defaults when the file is absent or unreadable.
 *
 * Config shape:
 * {
 *   "paths": [
 *     { "path": ".env",                    "deny": ["read", "write", "edit"] },
 *     { "path": ".git/",                   "deny": ["read", "write", "edit"] },
 *     { "path": "node_modules/",           "deny": ["write", "edit"] },
 *     { "path": "~/.pi/agent/auth.json",   "deny": ["read", "write", "edit"] }
 *   ]
 * }
 *
 * deny is a denylist — the listed operations are blocked for that path.
 */

import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export type Op = "read" | "write" | "edit";

export interface PathEntry {
  path: string;
  deny: Op[];
}

export interface ProtectedPathsConfig {
  paths: PathEntry[];
}

export const DEFAULT_PATHS: PathEntry[] = [
  { path: ".env",          deny: ["read", "write", "edit"] },
  { path: ".git/",         deny: ["read", "write", "edit"] },
  { path: "node_modules/", deny: ["write", "edit"] },
  { path: "~/.pi/agent/auth.json", deny: ["read", "write", "edit"] },
];

const CONFIG_PATH = join(homedir(), ".pi", "agent", "configs", "protected-paths.json");

export function loadConfig(): ProtectedPathsConfig {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);

    const paths =
      Array.isArray(parsed.paths) && parsed.paths.length > 0
        ? parsed.paths as PathEntry[]
        : DEFAULT_PATHS;

    return { paths };
  } catch {
    // File absent or unreadable — use defaults
    return { paths: DEFAULT_PATHS };
  }
}
