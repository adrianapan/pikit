/**
 * mcp — MCP bridge extension for pi.
 *
 * Connects to configured MCP servers on-demand (lazy), registers all tools via
 * a single proxy tool to keep context small, with per-server opt-in for direct
 * tool registration. Metadata is cached to disk so search/describe work without
 * live connections. Session lifecycle is properly managed across restarts.
 *
 * Config location:
 *   ~/.pi/agent/configs/mcp.json
 *
 * Config format (Claude Desktop-compatible + HTTP extension):
 * {
 *   "mcpServers": {
 *     "my-stdio-server": {
 *       "command": "npx",
 *       "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
 *       "env": { "MY_VAR": "${SOME_ENV_VAR}" },
 *       "directTools": true
 *     },
 *     "my-http-server": {
 *       "url": "https://my-mcp-server.com/mcp",
 *       "headers": { "Authorization": "Bearer ${MY_API_TOKEN}" }
 *     }
 *   }
 * }
 *
 * Transports:
 *   stdio  — spawns a local process and communicates over stdin/stdout.
 *            Use "command" + optional "args" and "env".
 *   http   — Streamable HTTP transport (MCP spec 2025-03-26).
 *            Sends JSON-RPC as POST requests to "url"; responses may be
 *            plain JSON or Server-Sent Events. Use "headers" for auth.
 *            Header values support ${ENV_VAR} interpolation.
 *
 * directTools:
 *   true         — register all tools from this server as individual pi tools
 *   ["t1","t2"]  — register only the named tools directly
 *   false/absent — proxy only (default, recommended for large servers)
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";
import { McpStdioClient } from "./client.js";
import { McpHttpClient } from "./http-client.js";
import { loadConfig } from "./config.js";
import { loadServerCache, saveServerCache } from "./cache.js";
import type { McpClient, McpTool } from "./types.js";
import {
  openBrowser,
  isOAuthUrl,
  sanitize,
  contentToText,
  buildProxyDescription,
  searchTools,
  formatSearchResults,
  findTool,
  formatSchema,
  buildStatusText,
} from "./helpers.js";

// Resolve known ${VAR} placeholders from process.env, leaving unresolvable ones intact.
// Called at factory time so secrets are captured before env-loader scrubs process.env.
function resolveKnownVars(v: string): string {
  return v.replace(/\$\{([^}]+)\}/g, (match, name: string) => {
    const found = process.env[name];
    return found !== undefined ? found : match;
  });
}

function resolveServerConfig(sc: ReturnType<typeof loadConfig>["mcpServers"][string]) {
  return {
    ...sc,
    args: sc.args?.map(resolveKnownVars),
    env: sc.env
      ? Object.fromEntries(Object.entries(sc.env).map(([k, v]) => [k, resolveKnownVars(v)]))
      : undefined,
    headers: sc.headers
      ? Object.fromEntries(Object.entries(sc.headers).map(([k, v]) => [k, resolveKnownVars(v)]))
      : undefined,
  };
}

export default function mcpExtension(pi: ExtensionAPI) {
  const config = loadConfig();
  const serverNames = Object.keys(config.mcpServers);

  if (serverNames.length === 0) return;

  // Pre-resolve all ${VAR} references now, while process.env still has the secrets.
  // env-loader will scrub its injected keys on session_start; by then all values are
  // already stored in JS memory here and no longer needed in the environment.
  const resolvedConfigs = new Map(
    Object.entries(config.mcpServers).map(([name, sc]) => [name, resolveServerConfig(sc)]),
  );

  // Seed tool metadata from per-server disk cache — enables search/describe without connecting
  const toolsCache = new Map<string, McpTool[]>();
  for (const name of serverNames) {
    const cached = loadServerCache(name);
    if (cached.length > 0) {
      const excluded = new Set(config.mcpServers[name]?.excludeTools ?? []);
      const tools = excluded.size ? cached.filter((t) => !excluded.has(t.name)) : cached;
      toolsCache.set(name, tools);
    }
  }

  // Live connection state — reset on each session_start
  let clients = new Map<string, McpClient>();
  let connecting = new Map<string, Promise<McpClient>>();

  // ─── Lazy connection management ──────────────────────────────────────────────

  async function getOrConnect(serverName: string, ctx: any): Promise<McpClient> {
    const existing = clients.get(serverName);
    if (existing && !existing.isDead) return existing;

    const pending = connecting.get(serverName);
    if (pending) return pending;

    const serverConfig = resolvedConfigs.get(serverName);
    if (!serverConfig?.command && !serverConfig?.url) {
      throw new Error(
        `MCP server "${serverName}" has no command (stdio) or url (http) configured`,
      );
    }

    const isHttp = !!serverConfig.url;

    const promise = (async () => {
      try {
        const excluded = new Set(serverConfig.excludeTools ?? []);

        if (isHttp) {
          // ── HTTP (Streamable HTTP) transport ─────────────────────────────────────────
          const client = new McpHttpClient(serverName, serverConfig);
          try {
            await client.initialize();
          } catch (err) {
            client.close();
            const msg = err instanceof Error ? err.message : String(err);
            throw new Error(`Failed to connect to "${serverName}" via HTTP: ${msg}`);
          }
          const tools = (await client.listTools()).filter((t) => !excluded.has(t.name));
          clients.set(serverName, client);
          toolsCache.set(serverName, tools);
          saveServerCache(serverName, tools);
          return client;
        } else {
          // ── stdio transport ───────────────────────────────────────────────────────
          const client = new McpStdioClient(serverName, serverConfig);
          const stderrLines: string[] = [];
          const openedUrls = new Set<string>();
          const removeStderr = client.onStderr((line) => {
            stderrLines.push(line);
            // Auto-open auth URLs (e.g. mcp-remote OAuth flow) as they appear.
            // Only open URLs that look like real OAuth prompts: URLs with query params
            // (authorization URLs always have ?client_id=... etc.) or localhost URLs
            // (OAuth callbacks). Plain server URLs logged as status info are skipped.
            const urlMatch = line.match(/https?:\/\/\S+/);
            if (urlMatch && !openedUrls.has(urlMatch[0]) && isOAuthUrl(urlMatch[0])) {
              openedUrls.add(urlMatch[0]);
              const url = urlMatch[0];
              ctx?.ui?.notify(`MCP [${serverName}]: opening browser for authentication\n${url}`, "info");
              setTimeout(() => openBrowser(url), 1000);
            }
          });

          try {
            await client.initialize();
          } catch (err) {
            removeStderr();
            client.close();
            const msg = err instanceof Error ? err.message : String(err);
            const detail = stderrLines.length ? `\n${stderrLines.join("\n")}` : "";
            throw new Error(`Failed to connect to "${serverName}": ${msg}${detail}`);
          }

          removeStderr();
          // initialize() succeeded — the connection is good.
          // All stderr collected during startup was just chatter (mcp-remote logs,
          // protocol traffic, etc.). Suppress it entirely; no regex filtering needed.
          // If initialize() had thrown, the full stderr would be included in the error above.

          const tools = (await client.listTools()).filter((t) => !excluded.has(t.name));
          clients.set(serverName, client);
          toolsCache.set(serverName, tools);
          saveServerCache(serverName, tools);
          return client;
        }
      } finally {
        connecting.delete(serverName);
      }
    })();

    connecting.set(serverName, promise);
    return promise;
  }

  // ─── Direct tool registration (opt-in per server) ────────────────────────────

  for (const [serverName, serverConfig] of Object.entries(config.mcpServers)) {
    const directTools = serverConfig.directTools;
    if (!directTools) continue;

    const cachedTools = toolsCache.get(serverName) ?? [];
    const toolsToRegister =
      directTools === true
        ? cachedTools
        : cachedTools.filter((t) => (directTools as string[]).includes(t.name));

    if (toolsToRegister.length === 0) continue;

    for (const tool of toolsToRegister) {
      const piToolName = `mcp__${sanitize(serverName)}__${sanitize(tool.name)}`;
      const schema = { type: "object", properties: {}, ...(tool.inputSchema ?? {}) };

      pi.registerTool({
        name: piToolName,
        label: `[MCP] ${serverName} › ${tool.name}`,
        description:
          (tool.description ?? `Tool "${tool.name}" from MCP server "${serverName}".`) +
          `\n\n(pi tool name: ${piToolName})`,
        parameters: Type.Unsafe<Record<string, unknown>>(schema),

        async execute(_id, params, _signal, _onUpdate, ctx) {
          const client = await getOrConnect(serverName, ctx);
          const result = await client.callTool(tool.name, params as Record<string, unknown>);
          const text = contentToText(result.content ?? []);
          if (result.isError) {
            throw new Error(text || `MCP tool "${tool.name}" reported an error`);
          }
          return {
            content: [{ type: "text", text: text || "(empty response)" }],
            details: { server: serverName, tool: tool.name },
          };
        },
      });
    }
  }

  // ─── Proxy tool ───────────────────────────────────────────────────────────────

  pi.registerTool({
    name: "mcp",
    label: "MCP",
    description: buildProxyDescription(config, toolsCache),
    promptSnippet: `MCP: ${serverNames.join(", ")} — search, describe, and call tools on demand`,
    parameters: Type.Object({
      tool: Type.Optional(
        Type.String({ description: 'Tool name to call, e.g. "read_file"' }),
      ),
      args: Type.Optional(
        Type.String({
          description: 'Tool arguments as a JSON string, e.g. \'{"path": "/tmp/file.txt"}\'',
        }),
      ),
      search: Type.Optional(
        Type.String({ description: "Search tools by name or description keyword" }),
      ),
      describe: Type.Optional(
        Type.String({ description: "Show full parameter schema for a named tool" }),
      ),
      connect: Type.Optional(
        Type.String({ description: "Explicitly connect a server by name" }),
      ),
      server: Type.Optional(
        Type.String({ description: "Filter search/describe/call to a specific server name" }),
      ),
    }),

    async execute(_id, params, _signal, _onUpdate, ctx) {
      // ── search ──────────────────────────────────────────────────────────────
      if (params.search) {
        const results = searchTools(params.search, params.server, toolsCache);
        return {
          content: [{ type: "text", text: formatSearchResults(results) }],
          details: { count: results.length },
        };
      }

      // ── describe ─────────────────────────────────────────────────────────────
      if (params.describe) {
        const found = findTool(params.describe, params.server, toolsCache);
        if (!found) {
          return {
            content: [
              {
                type: "text",
                text: `Tool "${params.describe}" not found in cache. Connect the server first: connect: "${params.server ?? "server_name"}"`,
              },
            ],
            details: {},
          };
        }
        return {
          content: [{ type: "text", text: formatSchema(found.tool) }],
          details: { server: found.serverName },
        };
      }

      // ── connect ──────────────────────────────────────────────────────────────
      if (params.connect) {
        if (!config.mcpServers[params.connect]) {
          return {
            content: [
              {
                type: "text",
                text: `Unknown server "${params.connect}". Configured: ${serverNames.join(", ")}`,
              },
            ],
            details: {},
          };
        }
        await getOrConnect(params.connect, ctx);
        const tools = toolsCache.get(params.connect) ?? [];
        return {
          content: [
            {
              type: "text",
              text: `Connected to "${params.connect}". ${tools.length} tools available.\n\nUse search: "keyword" to find tools.`,
            },
          ],
          details: { server: params.connect, toolCount: tools.length },
        };
      }

      // ── tool call ─────────────────────────────────────────────────────────────
      if (params.tool) {
        let parsedArgs: Record<string, unknown> = {};
        if (params.args) {
          try {
            const a = JSON.parse(params.args) as unknown;
            if (typeof a !== "object" || a === null || Array.isArray(a)) {
              throw new Error(
                `args must be a JSON object, got ${Array.isArray(a) ? "array" : typeof a}`,
              );
            }
            parsedArgs = a as Record<string, unknown>;
          } catch (e) {
            throw new Error(
              `Invalid args JSON: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }

        const found = findTool(params.tool, params.server, toolsCache);
        let targetServer = found?.serverName;

        if (!targetServer) {
          if (params.server) {
            // User specified a server; connect it and try — cache may just be stale
            targetServer = params.server;
          } else {
            return {
              content: [
                {
                  type: "text",
                  text: `Tool "${params.tool}" not found in cache. Use search: "keyword" to discover tools, or connect: "server_name" to refresh the cache.`,
                },
              ],
              details: {},
            };
          }
        }

        const client = await getOrConnect(targetServer, ctx);
        const result = await client.callTool(params.tool, parsedArgs);
        const text = contentToText(result.content ?? []);

        if (result.isError) {
          throw new Error(text || `MCP tool "${params.tool}" reported an error`);
        }

        return {
          content: [{ type: "text", text: text || "(empty response)" }],
          details: { server: targetServer, tool: params.tool },
        };
      }

      // ── status (default) ──────────────────────────────────────────────────────
      return {
        content: [{ type: "text", text: buildStatusText(config, clients, toolsCache) }],
        details: {
          servers: serverNames.length,
          connected: [...clients.values()].filter((c) => !c.isDead).length,
        },
      };
    },
  });

  // ─── Session lifecycle ────────────────────────────────────────────────────────

  pi.on("session_start", async () => {
    for (const client of clients.values()) client.close();
    clients = new Map();
    connecting = new Map();
  });

  pi.on("session_shutdown", async () => {
    for (const client of clients.values()) client.close();
    clients.clear();
    connecting.clear();
  });

  // ─── /mcp command ─────────────────────────────────────────────────────────────

  pi.registerCommand("mcp", {
    description:
      "MCP server management. Subcommands: status · tools [server] · reconnect [server] · search <query>",
    handler: async (args, ctx) => {
      if (!ctx.hasUI) return;

      const parts = (args ?? "").trim().split(/\s+/).filter(Boolean);
      const sub = parts[0] ?? "status";
      const arg = parts.slice(1).join(" ");

      switch (sub) {
        case "tools": {
          const targetServer = arg || undefined;
          const lines: string[] = [];
          for (const [name, tools] of toolsCache) {
            if (targetServer && name !== targetServer) continue;
            lines.push(`${name} (${tools.length} tools):`);
            for (const t of tools) {
              const desc = (t.description ?? "").slice(0, 80);
              lines.push(`  ${t.name}${desc ? ` — ${desc}` : ""}`);
            }
            lines.push("");
          }
          if (lines.length === 0) {
            ctx.ui.notify(
              targetServer
                ? `No cached tools for "${targetServer}". Try /mcp reconnect ${targetServer}`
                : "No cached tool metadata. Connect a server first.",
              "info",
            );
          } else {
            ctx.ui.notify(lines.join("\n").trimEnd(), "info");
          }
          break;
        }

        case "reconnect": {
          const targets = arg ? [arg] : serverNames;
          for (const name of targets) {
            if (!config.mcpServers[name]) {
              ctx.ui.notify(`Unknown server: "${name}"`, "error");
              continue;
            }
            clients.get(name)?.close();
            clients.delete(name);
            connecting.delete(name);
            try {
              await getOrConnect(name, ctx);
              ctx.ui.notify(`MCP: reconnected to "${name}"`, "info");
            } catch (err) {
              ctx.ui.notify(
                `MCP: failed to reconnect "${name}": ${err instanceof Error ? err.message : String(err)}`,
                "error",
              );
            }
          }
          break;
        }

        case "search": {
          if (!arg) {
            ctx.ui.notify("Usage: /mcp search <query>", "info");
            break;
          }
          const results = searchTools(arg, undefined, toolsCache);
          ctx.ui.notify(formatSearchResults(results), "info");
          break;
        }

        case "status":
        default: {
          ctx.ui.notify(buildStatusText(config, clients, toolsCache), "info");
          break;
        }
      }
    },
  });
}
