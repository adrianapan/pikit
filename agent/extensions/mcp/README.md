# mcp

MCP bridge extension for pi. Connects to configured MCP servers on-demand and exposes their tools via a single proxy tool — keeping context window usage minimal — with optional per-server direct tool registration. Supports both **stdio** (local process) and **HTTP** (Streamable HTTP, MCP spec 2025-03-26) transports.

## How it works

Instead of registering every MCP tool individually at startup (which burns the entire tool schema list into the context window whether or not they're used), mcp registers a single `mcp` proxy tool (~200 tokens). The LLM calls `mcp({ search: "keyword" })` to discover what's available, `mcp({ describe: "tool_name" })` to inspect schemas, and `mcp({ tool: "tool_name", args: '{"k":"v"}' })` to call tools. Servers connect lazily — only when a tool is actually needed.

Tool metadata is cached to `~/.pi/agent/cache/mcp-{serverName}.json` (one file per server) after each connection, so search and describe work instantly without starting any server processes. Splitting by server keeps cache files small and independently manageable regardless of how many servers you configure.

## Features

- **Lazy connections**: Servers only connect when a tool is actually called
- **Proxy tool pattern**: One `mcp` tool instead of N tool definitions — dramatically reduces context usage
- **Two transports**: stdio (local process) and HTTP (Streamable HTTP — single endpoint, JSON or SSE responses)
- **Metadata cache**: Tool names and descriptions cached to `~/.pi/agent/cache/mcp-{serverName}.json` (one file per server); search/describe work without live connections
- **Direct tools (opt-in)**: Per-server `directTools` config registers specific tools individually alongside the proxy
- **Session restart resilience**: Connections are closed and reset on each new session; servers reconnect lazily
- **`${VAR}` interpolation**: Reference environment variables in `env` (stdio) and `headers` (http) values without hardcoding secrets
- **Rich `/mcp` command**: status, tools, reconnect, and search subcommands

## Structure

```
mcp/
├── package.json
├── README.md
├── mcp.json.example
└── src/
    ├── types.ts        — all interfaces and shared types (McpClient, McpServerConfig, …)
    ├── client.ts       — McpStdioClient (stdio JSON-RPC transport)
    ├── http-client.ts  — McpHttpClient (Streamable HTTP transport)
    ├── config.ts       — loadConfig() from ~/.pi/agent/configs/mcp.json
    ├── cache.ts        — disk cache read/write per server
    ├── helpers.ts      — utilities and proxy tool formatters
    └── index.ts        — extension entry point and wiring
```

## Installation

Auto-discovered from `~/.pi/agent/extensions/`. No additional registration required.

## Configuration

Create `~/.pi/agent/configs/mcp.json`:

### stdio servers (local process)

```json
{
  "mcpServers": {
    "sentry": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.sentry.dev/mcp"]
    },
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"],
      "env": { "EXTRA_VAR": "value" }
    }
  }
}
```

### HTTP servers (Streamable HTTP)

For servers that expose a Streamable HTTP endpoint (MCP spec 2025-03-26): POST requests to a single URL, responses as JSON or SSE.

```json
{
  "mcpServers": {
    "my-api": {
      "url": "https://my-mcp-server.com/mcp",
      "headers": { "Authorization": "Bearer ${MY_API_TOKEN}" }
    }
  }
}
```

### All server options

**stdio fields:**

| Field | Description |
|-------|-------------|
| `command` | Executable to spawn (`npx`, absolute path, etc.) |
| `args` | Arguments passed to the command |
| `env` | Environment variables merged into the process environment. Supports `${VAR}` interpolation |

**HTTP fields:**

| Field | Description |
|-------|-------------|
| `url` | Full endpoint URL for the MCP server |
| `headers` | HTTP headers sent with every request (e.g. `Authorization`). Supports `${VAR}` interpolation |

**Shared fields:**

| Field | Description |
|-------|-------------|
| `directTools` | `true`, `["tool1","tool2"]`, or `false` (default) — see below |
| `excludeTools` | `["tool1","tool2"]` — hide these tools everywhere: search, describe, direct registration |

### Direct tools (opt-in)

By default all MCP tools are accessed through the `mcp` proxy. Set `directTools` on a server to register specific tools directly in pi's tool list instead:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_TOKEN": "${GITHUB_TOKEN}" },
      "directTools": ["search_repositories", "get_file_contents"]
    },
    "browser": {
      "command": "npx",
      "args": ["-y", "some-browser-mcp"],
      "directTools": true
    }
  }
}
```

| Value | Behavior |
|-------|----------|
| `false` / absent | Proxy only — default, recommended for large servers |
| `true` | Register all cached tools from this server directly |
| `["tool_a", "tool_b"]` | Register only these tools directly (use original MCP names) |

Direct tools require a warm cache. Connect the server at least once (`/mcp reconnect server_name`) for them to appear.

### Excluding tools

Use `excludeTools` to hide specific tools from a server. Excluded tools won't appear in search results, describe, or direct tool registration — as if they don't exist:

```json
{
  "mcpServers": {
    "filesystem": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-filesystem", "/"],
      "excludeTools": ["delete_file", "move_file"]
    }
  }
}
```

Exclusion is applied both when loading from the disk cache and when a fresh tool list is fetched from a live connection.

## Usage

### Proxy tool (LLM-facing)

The `mcp` proxy tool supports these modes:

```
mcp({ search: "screenshot" })
→ find tools matching "screenshot" across all servers

mcp({ describe: "take_screenshot" })
→ show full parameter schema for that tool

mcp({ tool: "take_screenshot", args: '{"format": "png"}' })
→ call the tool (auto-connects its server if needed)

mcp({ connect: "browser" })
→ explicitly connect a server and refresh its tool list

mcp({ server: "github", search: "repo" })
→ filter search to a specific server

mcp()
→ show connection status for all configured servers
```

Note: `args` is always a JSON string, not an object.

### `/mcp` command (human-facing)

| Command | Description |
|---------|-------------|
| `/mcp` or `/mcp status` | Show all servers with connection state and tool counts |
| `/mcp tools [server]` | List all cached tools (optionally filtered to one server) |
| `/mcp reconnect [server]` | Reconnect one or all servers |
| `/mcp search <query>` | Search cached tools by name or description |

## Authentication

### stdio — OAuth (via mcp-remote)

Authenticate once in a terminal to cache tokens:

```bash
npx mcp-remote https://mcp.sentry.dev/mcp
# Complete the browser OAuth flow, then Ctrl+C
```

Any stderr output during connection (auth URLs, warnings) appears as a pi notification. When an OAuth URL is detected, it is shown immediately so it can be copied, and the browser opens automatically after a 1-second delay.

### stdio — API key via env

```json
{
  "mcpServers": {
    "my-api": {
      "command": "npx",
      "args": ["-y", "some-mcp-server"],
      "env": { "API_KEY": "${MY_API_KEY_ENV_VAR}" }
    }
  }
}
```

### HTTP — bearer token or custom headers

```json
{
  "mcpServers": {
    "my-api": {
      "url": "https://my-mcp-server.com/mcp",
      "headers": {
        "Authorization": "Bearer ${MY_API_TOKEN}",
        "X-Tenant-Id": "my-org"
      }
    }
  }
}
```

Header values support `${VAR}` interpolation from the environment, same as `env` does for stdio servers. All headers are sent with every request (initialize, tools/list, tools/call, and the session DELETE on close).

## Environment variables

All `${VAR}` references in `env` and `headers` are read from the environment pi inherits at startup. The recommended way to manage these without touching your shell profile is the **env-loader** extension — see [`agent/extensions/env-loader/README.md`](../env-loader/README.md).

Create `~/.pi/agent/configs/.env` (gitignored):

```
SLACK_MCP_TOKEN=xoxp-...
GITHUB_TOKEN=ghp-...
```

Alternatively, export the variables in your shell profile before launching pi:

```bash
# ~/.zshrc
export SLACK_MCP_TOKEN="xoxp-..."
export GITHUB_TOKEN="ghp-..."
```

## Tool naming (direct tools)

When using `directTools`, each tool is registered as:

```
mcp__{serverName}__{toolName}
```

Special characters in server or tool names are replaced with `_`. For example, tool `read_file` on server `my-filesystem` becomes `mcp__my_filesystem__read_file`.
