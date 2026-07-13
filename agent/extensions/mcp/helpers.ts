import { spawn } from "node:child_process";
import type { McpConfig, McpClient, McpTool, McpCallResult } from "./types.js";

// ─── General helpers ──────────────────────────────────────────────────────────

/**
 * Returns true only for URLs that are genuine OAuth prompts:
 *  - localhost URLs  (OAuth callback redirect target)
 *  - URLs with a query string (authorization URLs always carry client_id, etc.)
 * Plain server endpoint URLs logged as status info (no query string, not localhost)
 * are excluded so we don't open a browser window on every reconnect.
 */
export function isOAuthUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.hostname === "localhost" || u.hostname === "127.0.0.1") return true;
    if (u.search.length > 1) return true; // has ?params
    return false;
  } catch {
    return false;
  }
}

export function openBrowser(url: string): void {
  // win32: `start` is a cmd.exe built-in and cannot be spawned directly, so use
  // rundll32 url.dll,FileProtocolHandler instead.
  const [cmd, args] = process.platform === "darwin"
    ? ["open", [url]]
    : process.platform === "win32"
      ? ["rundll32", ["url.dll,FileProtocolHandler", url]]
      : ["xdg-open", [url]];
  spawn(cmd, args, { detached: true, stdio: "ignore" })
    .on("error", (err) => console.warn(`openBrowser: ${cmd} failed: ${err.message}`))
    .unref();
}

export function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_]/g, "_");
}

export function contentToText(content: McpCallResult["content"]): string {
  return content
    .map((c) => {
      if (c.type === "text") return c.text ?? "";
      if (c.type === "image") return `[image: ${c.mimeType ?? "unknown"}]`;
      if (c.type === "resource") return c.text ?? "[resource]";
      return `[${c.type}]`;
    })
    .join("\n");
}

// ─── Proxy tool helpers ───────────────────────────────────────────────────────

export function buildProxyDescription(config: McpConfig, toolsCache: Map<string, McpTool[]>): string {
  const serverNames = Object.keys(config.mcpServers);
  const lines: string[] = [
    "MCP gateway — search, describe, and call tools from configured MCP servers.",
    "Servers connect lazily on first use. Use search to discover tools before calling.",
    "",
    "Configured servers:",
  ];

  for (const name of serverNames) {
    const count = toolsCache.get(name)?.length;
    const info = count !== undefined ? `${count} tools` : "not yet connected";
    lines.push(`  • ${name}: ${info}`);
  }

  lines.push(
    "",
    "Modes (pass one parameter at a time):",
    '  search: "keyword"                        — find tools by name or description (use single keywords for best results)',
    '  describe: "tool_name"                    — show full parameter schema for a tool',
    "  tool: \"tool_name\", args: \'{}\'          — call a tool (auto-connects its server)",
    '  connect: "server_name"                   — explicitly connect a server',
    '  server: "server_name"                    — filter search/describe to one server',
    "  (no params)                              — show server connection status",
  );

  return lines.join("\n");
}

export function searchTools(
  query: string,
  serverFilter: string | undefined,
  toolsCache: Map<string, McpTool[]>,
): Array<{ toolName: string; serverName: string; description: string; score: number }> {
  // Split into words, drop stop-words and short tokens so "show me errors"
  // doesn't match half the catalogue via "me" as a substring.
  const words = query.toLowerCase().split(/\s+/).filter((w) => w.length >= 3);
  const results: Array<{ toolName: string; serverName: string; description: string; score: number }> = [];

  for (const [serverName, tools] of toolsCache) {
    if (serverFilter && serverName !== serverFilter) continue;
    for (const tool of tools) {
      const name = tool.name.toLowerCase();
      const desc = (tool.description ?? "").toLowerCase();
      const nameMatch = words.some((w) => name.includes(w));
      const descMatch = words.some((w) => desc.includes(w));
      if (nameMatch || descMatch) {
        results.push({
          toolName: tool.name,
          serverName,
          description: tool.description ?? "(no description)",
          score: nameMatch ? 2 : 1,
        });
      }
    }
  }

  return results.sort((a, b) => b.score - a.score);
}

export function formatSearchResults(
  results: Array<{ toolName: string; serverName: string; description: string }>,
): string {
  if (results.length === 0) return "No tools found matching that query.";
  return results
    .map((r) => `${r.toolName}  [${r.serverName}]\n  ${r.description}`)
    .join("\n\n");
}

export function findTool(
  toolName: string,
  serverFilter: string | undefined,
  toolsCache: Map<string, McpTool[]>,
): { tool: McpTool; serverName: string } | null {
  for (const [serverName, tools] of toolsCache) {
    if (serverFilter && serverName !== serverFilter) continue;
    const tool = tools.find((t) => t.name === toolName);
    if (tool) return { tool, serverName };
  }
  return null;
}

export function formatSchema(tool: McpTool): string {
  const schema = tool.inputSchema;
  const lines: string[] = [tool.name, `  ${tool.description ?? "(no description)"}`];

  if (!schema?.properties || Object.keys(schema.properties).length === 0) {
    lines.push("  No parameters.");
    return lines.join("\n");
  }

  lines.push("", "  Parameters:");
  const required = new Set<string>(Array.isArray(schema.required) ? schema.required : []);
  for (const [propName, propSchema] of Object.entries(
    schema.properties as Record<string, Record<string, unknown>>,
  )) {
    const req = required.has(propName) ? " (required)" : "";
    const type = (propSchema?.type as string) ?? "any";
    const desc = propSchema?.description ? ` — ${propSchema.description}` : "";
    lines.push(`    ${propName}: ${type}${req}${desc}`);
  }

  return lines.join("\n");
}

export function buildStatusText(
  config: McpConfig,
  clients: Map<string, McpClient>,
  toolsCache: Map<string, McpTool[]>,
): string {
  const serverNames = Object.keys(config.mcpServers);
  if (serverNames.length === 0) return "No MCP servers configured.";

  const lines: string[] = [];
  let connectedCount = 0;

  for (const name of serverNames) {
    const client = clients.get(name);
    const connected = !!client && !client.isDead;
    if (connected) connectedCount++;
    const transport = config.mcpServers[name]?.url ? "http" : "stdio";
    const status = connected ? "connected" : "idle";
    const tools = toolsCache.get(name);
    const toolInfo = tools ? `${tools.length} tools` : "no cache";
    lines.push(`  • ${name} [${transport}]: ${status} (${toolInfo})`);
  }

  return [
    `MCP: ${connectedCount}/${serverNames.length} server(s) connected`,
    ...lines,
  ].join("\n");
}
