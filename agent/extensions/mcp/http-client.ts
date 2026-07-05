import type {
  McpClient,
  McpServerConfig,
  McpTool,
  McpCallResult,
  JsonRpcRequest,
  JsonRpcResponse,
} from "./types.js";

// ─── McpHttpClient (Streamable HTTP transport) ────────────────────────────────
//
// Implements the MCP Streamable HTTP transport (spec 2025-03-26).
// All JSON-RPC messages are sent as POST requests to a single endpoint.
// The server may reply with either:
//   • application/json          — a single JSON-RPC response
//   • text/event-stream (SSE)   — a stream of JSON-RPC messages
//
// Session continuity is tracked via the Mcp-Session-Id response header.
// On close(), a DELETE request is sent to release the server-side session.

export class McpHttpClient implements McpClient {
  private _dead = false;
  private sessionId: string | undefined;
  private readonly resolvedHeaders: Record<string, string>;
  private nextId = 1;

  constructor(
    readonly serverName: string,
    private readonly config: McpServerConfig,
    private readonly timeoutMs = 120_000,
  ) {
    // Resolve ${VAR} placeholders in header values from process.env
    this.resolvedHeaders = {};
    const unresolved: string[] = [];
    for (const [k, v] of Object.entries(config.headers ?? {})) {
      const result = v.replace(/\$\{([^}]+)\}/g, (_, name: string) => {
        const found = process.env[name];
        if (found === undefined) unresolved.push(`${k} → ${name}`);
        return found ?? "";
      });
      this.resolvedHeaders[k] = result;
    }
    if (unresolved.length > 0) {
      throw new Error(
        `MCP HTTP server "${this.serverName}" requires missing env vars:\n  ${unresolved.join("\n  ")}`,
      );
    }
  }

  get isDead(): boolean {
    return this._dead;
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private buildHeaders(extra?: Record<string, string>): Record<string, string> {
    const h: Record<string, string> = { ...this.resolvedHeaders, ...extra };
    if (this.sessionId) h["Mcp-Session-Id"] = this.sessionId;
    return h;
  }

  /** Send a JSON-RPC request and return the result. */
  private async sendRequest(method: string, params?: unknown): Promise<unknown> {
    const id = this.nextId++;
    const body: JsonRpcRequest = { jsonrpc: "2.0", id, method, params: params ?? {} };

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let response: Response;
    try {
      response = await fetch(this.config.url!, {
        method: "POST",
        headers: this.buildHeaders({
          "Content-Type": "application/json",
          Accept: "application/json, text/event-stream",
        }),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const msg = err instanceof Error ? err.message : String(err);
      throw new Error(`MCP HTTP request to "${this.serverName}" failed: ${msg}`);
    }
    clearTimeout(timer);

    // Capture session ID from first (or any subsequent) response
    const sid = response.headers.get("Mcp-Session-Id");
    if (sid) this.sessionId = sid;

    if (!response.ok) {
      let text = "";
      try {
        text = await response.text();
      } catch {}
      throw new Error(
        `MCP server "${this.serverName}" returned HTTP ${response.status}` +
          (text ? `: ${text.slice(0, 300)}` : ""),
      );
    }

    const ct = (response.headers.get("Content-Type") ?? "").toLowerCase();
    if (ct.includes("text/event-stream")) {
      return this.readSSEResponse(response, id);
    }

    const json = (await response.json()) as JsonRpcResponse;
    if (json.error) {
      throw new Error(`MCP error ${json.error.code}: ${json.error.message}`);
    }
    return json.result;
  }

  /** Consume an SSE response body and return the result matching `expectedId`. */
  private async readSSEResponse(response: Response, expectedId: number): Promise<unknown> {
    if (!response.body) {
      throw new Error(`MCP server "${this.serverName}": empty SSE response body`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buf = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });

        // Normalize \r\n → \n for cross-platform SSE compliance, then split on blank lines
        const normalized = buf.replace(/\r\n/g, "\n");
        if (normalized !== buf) buf = normalized;

        let boundary: number;
        while ((boundary = buf.indexOf("\n\n")) !== -1) {
          const block = buf.slice(0, boundary);
          buf = buf.slice(boundary + 2);

          const eventData: string[] = [];
          for (const line of block.split("\n")) {
            const trimmed = line.trimEnd();
            if (trimmed.startsWith("data:")) {
              eventData.push(trimmed.slice(5).trimStart());
            }
            // event: field is intentionally ignored — we only need the JSON-RPC payloads
          }
          const data = eventData.join("\n");
          if (!data || data === "[DONE]") continue;
          try {
            const msg = JSON.parse(data) as JsonRpcResponse;
            if (msg.id === expectedId) {
              await reader.cancel().catch(() => {});
              if (msg.error) {
                throw new Error(`MCP error ${msg.error.code}: ${msg.error.message}`);
              }
              return msg.result;
            }
          } catch (e) {
            if (e instanceof Error && e.message.startsWith("MCP error")) throw e;
            // ignore parse errors for non-JSON SSE events (heartbeats, etc.)
          }
        }
      }
    } finally {
      reader.releaseLock();
    }

    throw new Error(
      `MCP server "${this.serverName}": SSE stream closed without a matching response (id=${expectedId})`,
    );
  }

  /** Send a JSON-RPC notification (no response expected). */
  private async sendNotification(method: string, params?: unknown): Promise<void> {
    try {
      const res = await fetch(this.config.url!, {
        method: "POST",
        headers: this.buildHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          jsonrpc: "2.0",
          method,
          ...(params !== undefined ? { params } : {}),
        }),
      });
      // Drain/cancel the body so the connection is properly released
      res.body?.cancel().catch(() => {});
    } catch {
      // Notifications are fire-and-forget — ignore errors
    }
  }

  // ── McpClient interface ──────────────────────────────────────────────────────

  async initialize(): Promise<void> {
    await this.sendRequest("initialize", {
      protocolVersion: "2024-11-05",
      capabilities: { tools: {} },
      clientInfo: { name: "mcp", version: "1.0.0" },
    });
    await this.sendNotification("notifications/initialized");
  }

  async listTools(): Promise<McpTool[]> {
    const tools: McpTool[] = [];
    let cursor: string | undefined;
    do {
      const result = (await this.sendRequest(
        "tools/list",
        cursor ? { cursor } : undefined,
      )) as { tools?: McpTool[]; nextCursor?: string };
      tools.push(...(result.tools ?? []));
      cursor = result.nextCursor;
    } while (cursor);
    return tools;
  }

  async callTool(name: string, args: Record<string, unknown>): Promise<McpCallResult> {
    return (await this.sendRequest("tools/call", {
      name,
      arguments: args,
    })) as McpCallResult;
  }

  /** Close the client and release the server-side session via DELETE. */
  close(): void {
    if (this._dead) return;
    this._dead = true;
    if (this.sessionId) {
      // Best-effort DELETE to let the server clean up session resources
      fetch(this.config.url!, {
        method: "DELETE",
        headers: this.buildHeaders(),
      }).catch(() => {});
    }
  }
}
