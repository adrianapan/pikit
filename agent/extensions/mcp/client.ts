import { spawn, type ChildProcess } from "node:child_process";
import { createInterface } from "node:readline";
import type { McpClient, McpServerConfig, McpTool, McpCallResult, JsonRpcRequest, JsonRpcResponse } from "./types.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function interpolateWithErrors(v: string): { value: string; unresolved: string[] } {
  const unresolved: string[] = [];
  const value = v.replace(/\$\{([^}]+)\}/g, (_, name: string) => {
    const found = process.env[name];
    if (found === undefined) unresolved.push(name);
    return found ?? "";
  });
  return { value, unresolved };
}

// ─── McpStdioClient ───────────────────────────────────────────────────────────

export class McpStdioClient implements McpClient {
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

    const allUnresolved: string[] = [];
    for (const [k, v] of Object.entries(config.env ?? {})) {
      const { value, unresolved } = interpolateWithErrors(v);
      env[k] = value;
      allUnresolved.push(...unresolved.map((n) => `env.${k} → ${n}`));
    }

    const resolvedArgs = (config.args ?? []).map((v) => {
      const { value, unresolved } = interpolateWithErrors(v);
      allUnresolved.push(...unresolved.map((n) => `arg → ${n}`));
      return value;
    });

    if (allUnresolved.length > 0) {
      throw new Error(
        `MCP server "${this.serverName}" requires missing env vars:\n  ${allUnresolved.join("\n  ")}`,
      );
    }

    this.proc = spawn(config.command!, resolvedArgs, {
      stdio: ["pipe", "pipe", "pipe"],
      env,
      shell: false,
    });

    this.proc.stderr?.on("data", (chunk: Buffer) => {
      const lines = chunk.toString().split("\n").filter(Boolean);
      // Fixed-size ring buffer: keep only last 20 lines
      for (const line of lines) {
        this.stderrLines.push(line);
        if (this.stderrLines.length > 20) this.stderrLines.shift();
      }
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
      clientInfo: { name: "mcp", version: "1.0.0" },
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
      this._dead = true;
      const err = new Error(`MCP server "${this.serverName}" closed`);
      for (const { reject, timer } of this.pending.values()) {
        clearTimeout(timer);
        reject(err);
      }
      this.pending.clear();
      this.proc.stdin?.end();
      this.proc.kill("SIGTERM");
    }
  }
}
