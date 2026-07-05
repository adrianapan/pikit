import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { McpConfig } from "./types.js";

// ─── Config ───────────────────────────────────────────────────────────────────

/** Load config from ~/.pi/agent/configs/mcp.json */
export function loadConfig(): McpConfig {
  const p = join(homedir(), ".pi", "agent", "configs", "mcp.json");
  if (!existsSync(p)) return { mcpServers: {} };
  try {
    const raw = JSON.parse(readFileSync(p, "utf-8")) as Partial<McpConfig>;
    if (raw?.mcpServers && typeof raw.mcpServers === "object") {
      return { mcpServers: raw.mcpServers };
    }
  } catch {}
  return { mcpServers: {} };
}
