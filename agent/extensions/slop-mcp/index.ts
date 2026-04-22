/**
 * slop-mcp — MCP bridge extension for pi.
 *
 * Connects to configured MCP servers on-demand (lazy), registers all tools via
 * a single proxy tool to keep context small, with per-server opt-in for direct
 * tool registration. Metadata is cached to disk so search/describe work without
 * live connections. Session lifecycle is properly managed across restarts.
 *
 * Config location:
 *   ~/.pi/agent/configs/slop-mcp.json
 *
 * Config format (Claude Desktop-compatible):
 * {
 *   "mcpServers": {
 *     "my-server": {
 *       "command": "npx",
 *       "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
 *       "env": { "MY_VAR": "${SOME_ENV_VAR}" },
 *       "directTools": true
 *     }
 *   }
 * }
 *
 * directTools:
 *   true         — register all tools from this server as individual pi tools
 *   ["t1","t2"]  — register only the named tools directly
 *   false/absent — proxy only (default, recommended for large servers)
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

// ─── Types ────────────────────────────────────────────────────────────────────

interface McpServerConfig {
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  directTools?: boolean | string[];
  excludeTools?: string[];
}

interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

interface McpCallResult {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
}

interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

interface ServerCache {
  version: 1;
  tools: McpTool[];
}

// ─── McpStdioClient ───────────────────────────────────────────────────────────

class McpStdioClient {
  private proc: ChildProcess;
  private pending = new Map<
    number,
    { resolve: (r: JsonRpcResponse) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> }
  >();
  private nextId = 1;
  private _dead = false;
  private stderrLines: string[] = [];
  private stderrHandlers: Array<(line: string) => void> = [];

  constructor(
    readonly serverName: string,
    private config: McpServerConfig,
    private timeoutMs = 120_000,
  ) {
    // Build env: process.env + server env, with ${VAR} interpolation in values
    const env: Record<string, string> = {};
    for (const [k, v] of Object.entries(process.env)) {
      if (v !== undefined) env[k] = v;
    }
    for (const [k, v] of Object.entries(config.env ?? {})) {
      env[k] = v.replace(/\$\{([^}]+)\}/g, (_, name) => process.env[name] ?? "");
    }

    this.proc = spawn(config.command!, config.args ?? [], {
      stdio: ["pipe", "pipe", "pipe"],
      env,
      shell: false,
    });

    this.proc.stderr?.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      this.stderrLines.push(...lines);
      if (this.stderrLines.length > 20) this.stderrLines.splice(0, this.stderrLines.length - 20);
      for (const line of lines) {
        for (const h of this.stderrHandlers) h(line);
      }
    });

    const rl = createInterface({ input: this.proc.stdout! });
    rl.on("line", (line) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      try {
        const msg = JSON.parse(trimmed) as JsonRpcResponse;
        if (typeof msg.id !== "number") return; // ignore server-sent notifications
        const pending = this.pending.get(msg.id);
        if (!pending) return;
        clearTimeout(pending.timer);
        this.pending.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(`MCP error ${msg.error.code}: ${msg.error.message}`));
        } else {
          pending.resolve(msg);
        }
      } catch {
        // ignore non-JSON lines (startup noise, etc.)
      }
    });

    this.proc.on("exit", (code) => {
      this._dead = true;
      const err = new Error(
        `MCP server "${this.serverName}" exited (code ${code ?? "unknown"})` +
          (this.stderrLines.length ? `\nstderr:\n${this.stderrLines.join("\n")}` : ""),
      );
      for (const { reject, timer } of this.pending.values()) {
        clearTimeout(timer);
        reject(err);
      }
      this.pending.clear();
    });
  }

  private send(method: string, params?: unknown): Promise<JsonRpcResponse> {
    if (this._dead) {
      return Promise.reject(new Error(`MCP server "${this.serverName}" is not running`));
    }
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request "${method}" timed out after ${this.timeoutMs}ms`));
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      const msg: JsonRpcRequest = { jsonrpc: "2.0", id, method, params: params ?? {} };
      this.proc.stdin!.write(JSON.stringify(msg) + "\n");
    });
  }

  onStderr(handler: (line: string) => void): () => void {
    this.stderrHandlers.push(handler);
    return () => {
      this.stderrHandlers = this.stderrHandlers.filter((h) => h !== handler);
    };
  }

  get isDead(): boolean {
    return this._dead;
  }

  async initialize(): Promise<void> {
    await this.send("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      clientInfo: { name: "slop-mcp", version: "2.0.0" },
    });
    this.proc.stdin!.write(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n",
    );
  }

  async listTools(): Promise<McpTool[]> {
    const tools: McpTool[] = [];
    let cursor: string | undefined;
    do {
      const res = await this.send("tools/list", cursor ? { cursor } : undefined);
      const result = res.result as { tools?: McpTool[]; nextCursor?: string };
      tools.push(...(result.tools ?? []));
      cursor = result.nextCursor;
    } while (cursor);
    return tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpCallResult> {
    const res = await this.send("tools/call", { name, arguments: args });
    return res.result as McpCallResult;
  }

  close(): void {
    if (!this._dead) {
      this.proc.stdin?.end();
      this.proc.kill("SIGTERM");
    }
  }
}

// ─── Config ───────────────────────────────────────────────────────────────────

/** Load config from ~/.pi/agent/configs/slop-mcp.json */
function loadConfig(): McpConfig {
  const p = join(homedir(), ".pi", "agent", "configs", "slop-mcp.json");
  if (!existsSync(p)) return { mcpServers: {} };
  try {
    const raw = JSON.parse(readFileSync(p, "utf-8")) as Partial<McpConfig>;
    if (raw?.mcpServers && typeof raw.mcpServers === "object") {
      return { mcpServers: raw.mcpServers };
    }
  } catch {}
  return { mcpServers: {} };
}

// ─── Metadata cache ───────────────────────────────────────────────────────────

function cacheDir(): string {
  return join(homedir(), ".pi", "agent", "cache");
}

function serverCachePath(serverName: string): string {
  return join(cacheDir(), `slop-mcp-${serverName}.json`);
}

function loadServerCache(serverName: string): McpTool[] {
  try {
    const p = serverCachePath(serverName);
    if (existsSync(p)) {
      const raw = JSON.parse(readFileSync(p, "utf-8")) as ServerCache;
      if (raw?.version === 1 && Array.isArray(raw.tools)) return raw.tools;
    }
  } catch {}
  return [];
}

function saveServerCache(serverName: string, tools: McpTool[]): void {
  try {
    const dir = cacheDir();
    mkdirSync(dir, { recursive: true });
    const cache: ServerCache = { version: 1, tools };
    writeFileSync(serverCachePath(serverName), JSON.stringify(cache, null, 2), "utf-8");
  } catch {}
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function openBrowser(url: string): void {
  const cmd = process.platform === "darwin" ? "open"
    : process.platform === "win32" ? "start"
    : "xdg-open";
  spawn(cmd, [url], { detached: true, stdio: "ignore" }).unref();
}

function sanitize(s: string): string {
  return s.replace(/[^a-zA-Z0-9_]/g, "_");
}

function contentToText(content: McpCallResult["content"]): string {
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

function buildProxyDescription(config: McpConfig, toolsCache: Map<string, McpTool[]>): string {
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
    '  search: "keyword"                        — find tools by name or description',
    '  describe: "tool_name"                    — show full parameter schema for a tool',
    "  tool: \"tool_name\", args: \'{}\'          — call a tool (auto-connects its server)",
    '  connect: "server_name"                   — explicitly connect a server',
    '  server: "server_name"                    — filter search/describe to one server',
    "  (no params)                              — show server connection status",
  );

  return lines.join("\n");
}

function searchTools(
  query: string,
  serverFilter: string | undefined,
  toolsCache: Map<string, McpTool[]>,
): Array<{ toolName: string; serverName: string; description: string; score: number }> {
  const q = query.toLowerCase();
  const results: Array<{ toolName: string; serverName: string; description: string; score: number }> =
    [];

  for (const [serverName, tools] of toolsCache) {
    if (serverFilter && serverName !== serverFilter) continue;
    for (const tool of tools) {
      const nameMatch = tool.name.toLowerCase().includes(q);
      const descMatch = (tool.description ?? "").toLowerCase().includes(q);
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

function formatSearchResults(
  results: Array<{ toolName: string; serverName: string; description: string }>,
): string {
  if (results.length === 0) return "No tools found matching that query.";
  return results
    .map((r) => `${r.toolName}  [${r.serverName}]\n  ${r.description}`)
    .join("\n\n");
}

function findTool(
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

function formatSchema(tool: McpTool): string {
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

function buildStatusText(
  config: McpConfig,
  clients: Map<string, McpStdioClient>,
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
    const status = connected ? "connected" : "idle";
    const tools = toolsCache.get(name);
    const toolInfo = tools ? `${tools.length} tools` : "no cache";
    lines.push(`  • ${name}: ${status} (${toolInfo})`);
  }

  return [
    `MCP: ${connectedCount}/${serverNames.length} server(s) connected`,
    ...lines,
  ].join("\n");
}

// ─── Extension ────────────────────────────────────────────────────────────────

export default function slopMcp(pi: ExtensionAPI) {
  const config = loadConfig();
  const serverNames = Object.keys(config.mcpServers);

  if (serverNames.length === 0) return;

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
  let clients = new Map<string, McpStdioClient>();
  let connecting = new Map<string, Promise<McpStdioClient>>();

  // ─── Lazy connection management ──────────────────────────────────────────────

  async function getOrConnect(serverName: string, ctx: any): Promise<McpStdioClient> {
    const existing = clients.get(serverName);
    if (existing && !existing.isDead) return existing;

    // Reuse an in-flight connection attempt
    const pending = connecting.get(serverName);
    if (pending) return pending;

    const serverConfig = config.mcpServers[serverName];
    if (!serverConfig?.command) {
      throw new Error(`MCP server "${serverName}" has no command configured`);
    }

    const promise = (async () => {
      const client = new McpStdioClient(serverName, serverConfig);
      const stderrLines: string[] = [];
      const openedUrls = new Set<string>();
      const removeStderr = client.onStderr((line) => {
        stderrLines.push(line);
        // Auto-open auth URLs (e.g. mcp-remote OAuth flow) as they appear
        const urlMatch = line.match(/https?:\/\/\S+/);
        if (urlMatch && !openedUrls.has(urlMatch[0])) {
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
        connecting.delete(serverName);
        const msg = err instanceof Error ? err.message : String(err);
        const detail = stderrLines.length ? `\n${stderrLines.join("\n")}` : "";
        throw new Error(`Failed to connect to "${serverName}": ${msg}${detail}`);
      }

      removeStderr();
      if (stderrLines.length) {
        ctx?.ui?.notify(`MCP [${serverName}] stderr:\n${stderrLines.join("\n")}`, "info");
      }

      const excluded = new Set(serverConfig.excludeTools ?? []);
      const tools = (await client.listTools()).filter((t) => !excluded.has(t.name));
      clients.set(serverName, client);
      connecting.delete(serverName);
      toolsCache.set(serverName, tools);
      saveServerCache(serverName, tools);
      return client;
    })();

    connecting.set(serverName, promise);
    promise.catch(() => connecting.delete(serverName));
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

        // Find the server that owns this tool (via cache)
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

  pi.on("session_start", async (_event, ctx) => {
    // Close existing connections — they will reconnect lazily on first use
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
            // Force-close then reconnect
            clients.get(name)?.close();
            clients.delete(name);
            connecting.delete(name);
            try {
              await getOrConnect(name, ctx);
              ctx.ui.notify(`MCP: reconnected to "${name}"`, "success");
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
