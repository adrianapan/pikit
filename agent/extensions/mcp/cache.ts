import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { McpTool, ServerCache } from "./types.js";

// ─── Metadata cache ───────────────────────────────────────────────────────────

function cacheDir(): string {
  return join(homedir(), ".pi", "agent", "cache");
}

function serverCachePath(serverName: string): string {
  return join(cacheDir(), `mcp-${serverName}.json`);
}

export function loadServerCache(serverName: string): McpTool[] {
  try {
    const p = serverCachePath(serverName);
    if (existsSync(p)) {
      const raw = JSON.parse(readFileSync(p, "utf-8")) as ServerCache;
      if (raw?.version === 1 && Array.isArray(raw.tools)) return raw.tools;
    }
  } catch {}
  return [];
}

export function saveServerCache(serverName: string, tools: McpTool[]): void {
  try {
    const dir = cacheDir();
    mkdirSync(dir, { recursive: true });
    const cache: ServerCache = { version: 1, tools };
    writeFileSync(serverCachePath(serverName), JSON.stringify(cache, null, 2), "utf-8");
  } catch {}
}
