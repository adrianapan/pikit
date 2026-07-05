// ─── Types ────────────────────────────────────────────────────────────────────

export interface McpServerConfig {
  // stdio transport
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  // http (Streamable HTTP) transport
  url?: string;
  headers?: Record<string, string>;
  // shared
  directTools?: boolean | string[];
  excludeTools?: string[];
}

/** Shared interface implemented by both McpStdioClient and McpHttpClient. */
export interface McpClient {
  readonly serverName: string;
  readonly isDead: boolean;
  initialize(): Promise<void>;
  listTools(): Promise<McpTool[]>;
  callTool(name: string, args: Record<string, unknown>): Promise<McpCallResult>;
  close(): void;
}

export interface McpConfig {
  mcpServers: Record<string, McpServerConfig>;
}

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: {
    type?: string;
    properties?: Record<string, unknown>;
    required?: string[];
    [key: string]: unknown;
  };
}

export interface McpCallResult {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
}

export interface JsonRpcRequest {
  jsonrpc: "2.0";
  id: number;
  method: string;
  params?: unknown;
}

export interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number;
  result?: unknown;
  error?: { code: number; message: string; data?: unknown };
}

export interface ServerCache {
  version: 1;
  tools: McpTool[];
}
