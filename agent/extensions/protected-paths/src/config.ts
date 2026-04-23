/**
 * Config loader for the protected-paths extension.
 *
 * Reads ~/.pi/agent/configs/protected-paths.json if present.
 * Falls back to built-in defaults when the file is absent or unreadable.
 *
 * Config shape:
 * {
 *   "paths": [
 *     { "path": ".env",          "ops": ["read", "write", "edit"] },
 *     { "path": ".git/",         "ops": ["read", "write", "edit"] },
 *     { "path": "node_modules/", "ops": ["write", "edit"] }
 *   ]
 * }
 *
 * ops is a denylist — the listed operations are blocked for that path.
 */

import { readFileSync } from "fs";
import { homedir } from "os";
import { join } from "path";

export type Op = "read" | "write" | "edit";

export interface PathEntry {
  path: string;
  ops: Op[];
}

export interface ProtectedPathsConfig {
  paths: PathEntry[];
}

export const DEFAULT_PATHS: PathEntry[] = [
  { path: ".env",          ops: ["read", "write", "edit"] },
  { path: ".git/",         ops: ["read", "write", "edit"] },
  { path: "node_modules/", ops: ["write", "edit"] },
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
