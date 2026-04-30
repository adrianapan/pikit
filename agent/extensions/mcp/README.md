# mcp

MCP bridge extension for pi. Connects to configured MCP servers on-demand and exposes their tools via a single proxy tool — keeping context window usage minimal — with optional per-server direct tool registration. Supports both **stdio** (local process) and **HTTP** (Streamable HTTP, MCP spec 2025-03-26) transports.

## How it works

Instead of registering every MCP tool individually at startup (which burns the entire tool schema list into the context window whether or not they're used), mcp registers a single `mcp` proxy tool (~200 tokens). The LLM calls `mcp({ search: "keyword" })` to discover what's available, `mcp({ describe: "tool_name" })` to inspect schemas, and `mcp({ tool: "tool_name", args: '{"k":"v"}' })` to call tools. Servers connect lazily — only when a tool is actually needed.

Tool metadata is cached to `~/.pi/agent/cache/mcp-{serverName}.json` (one file per server) after each connection, so search and describe work instantly without starting any server processes.

## Features

- **Lazy connections**: Servers only connect when a tool is actually called
- **Proxy tool pattern**: One `mcp` tool instead of N tool definitions — dramatically reduces context usage
- **Two transports**: stdio (local process) and HTTP (Streamable HTTP — single endpoint, JSON or SSE responses)
- **Metadata cache**: Tool names and descriptions cached to disk; search/describe work without live connections
- **Direct tools (opt-in)**: Per-server `directTools` config registers specific tools individually alongside the proxy
- **Session restart resilience**: Connections are closed and reset on each new session; servers reconnect lazily
- **`${VAR}` interpolation**: Reference environment variables in `args`, `env` (stdio), and `headers` (http) values without hardcoding secrets
- **Auto OAuth**: When a stdio server (via `mcp-remote`) prints an OAuth URL, pi detects it, shows a notification, and opens your browser automatically
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

Create `~/.pi/agent/configs/mcp.json` (gitignored — never committed):

### stdio servers (local process)

The most common setup. Pi spawns the process and communicates over stdin/stdout. Works for both local tools and remote servers (via `mcp-remote`).

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

For servers with a direct HTTP endpoint that accept a pre-existing token. Pi calls the endpoint directly — no subprocess involved.

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
| `args` | Arguments passed to the command. Supports `${VAR}` interpolation |
| `env` | Environment variables merged into the process environment. Supports `${VAR}` interpolation |

**HTTP fields:**

| Field | Description |
|-------|-------------|
| `url` | Full endpoint URL for the MCP server |
| `headers` | HTTP headers sent with every request. Supports `${VAR}` interpolation |

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
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}" },
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

Excluded tools won't appear in search results, describe, or direct tool registration.

## Usage

### Proxy tool (LLM-facing)

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

There are three patterns depending on the server:

### Pattern 1 — mcp-remote with automatic OAuth (Sentry, Atlassian)

Some hosted MCP servers support dynamic client registration, meaning they can hand out credentials on the fly without you pre-registering an app. `mcp-remote` handles the full OAuth flow for you:

1. Pi starts `mcp-remote` as a subprocess
2. `mcp-remote` detects the server needs OAuth and prints the auth URL to stderr
3. Pi catches the URL and opens your browser automatically
4. You approve access in the browser
5. `mcp-remote` catches the callback on its own internal server (port 3334), exchanges the code for a token, and caches it in `~/.mcp-auth/`
6. Done — tokens are reused on future connections

**No manual steps. No token to store.**

```json
{
  "mcpServers": {
    "sentry": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.sentry.dev/mcp"]
    }
  }
}
```

### Pattern 2 — mcp-remote with static client credentials (Slack)

Some servers (Slack being the main example) require you to pre-register an OAuth app and supply a client ID and secret. `mcp-remote` still handles the callback and token exchange automatically — you just need to pass the credentials it needs.

```json
{
  "mcpServers": {
    "slack": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://mcp.slack.com/mcp",
        "--static-oauth-client-info",
        "{\"client_id\":\"${SLACK_CLIENT_ID}\",\"client_secret\":\"${SLACK_CLIENT_SECRET}\"}"
      ]
    }
  }
}
```

Store the credentials in `~/.pi/agent/configs/.env`:

```
SLACK_CLIENT_ID=your-client-id
SLACK_CLIENT_SECRET=your-client-secret
```

The OAuth flow is the same as Pattern 1 — browser opens automatically, you approve, done. The difference is that Slack needs the registered app's credentials to start the flow.

### Pattern 3 — static API token (GitHub)

Some servers don't use OAuth at all — they just need a token passed as an environment variable. Generate the token once, store it in `.env`, reference it in the config.

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}" }
    }
  }
}
```

## Authentication & secrets

**Never hardcode tokens directly in `mcp.json`.** The config file may be read by the coding agent during grep, find, or file exploration and secrets would land in the LLM context window.

**Recommended pattern:** store all tokens in `~/.pi/agent/configs/.env` (loaded by the env-loader extension) and reference them via `${VAR}` in `mcp.json`:

```env
# ~/.pi/agent/configs/.env
GITHUB_TOKEN=ghp_...
MY_API_TOKEN=sk-...
```

```json
{ "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}" } }
```

The `${VAR}` references are resolved at runtime from environment variables before the subprocess starts. The `.env` file is protected from agent reads by default (via the protected-paths extension).

For servers that need credentials:

- **stdio servers:** reference the token via `${VAR}` in `env`
- **HTTP servers:** reference the token via `${VAR}` in `headers`
- **mcp-remote OAuth (Sentry, Atlassian):** no token needed — OAuth is fully automatic

## Server setup guides

### Sentry

**Auth pattern:** automatic OAuth via mcp-remote (Pattern 1)
**What you need:** a sentry.io account

```json
{
  "mcpServers": {
    "sentry": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.sentry.dev/mcp"]
    }
  }
}
```

That's it. First time you use a Sentry tool, `mcp-remote` kicks off OAuth, pi opens your browser, you log in and approve. Token is cached at `~/.mcp-auth/` — never need to do it again.

To clear cached credentials and re-authenticate: `rm -rf ~/.mcp-auth`

---

### Atlassian (Jira + Confluence)

**Auth pattern:** automatic OAuth via mcp-remote (Pattern 1)
**What you need:** an Atlassian Cloud account

```json
{
  "mcpServers": {
    "atlassian": {
      "command": "npx",
      "args": ["-y", "mcp-remote", "https://mcp.atlassian.com/v1/mcp"]
    }
  }
}
```

Same fully automatic OAuth flow as Sentry.

**Multiple Atlassian workspaces:** use the `--resource` flag to isolate OAuth sessions per site:

```json
{
  "mcpServers": {
    "atlassian-work": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://mcp.atlassian.com/v1/mcp",
        "--resource", "https://your-work-site.atlassian.net/"
      ]
    },
    "atlassian-personal": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://mcp.atlassian.com/v1/mcp",
        "--resource", "https://your-personal-site.atlassian.net/"
      ]
    }
  }
}
```

To clear cached credentials and re-authenticate: `rm -rf ~/.mcp-auth`

---

### GitHub

**Auth pattern:** static PAT — no OAuth (Pattern 3)
**What you need:** a GitHub Personal Access Token

#### 1. Generate a token

Go to [github.com/settings/tokens](https://github.com/settings/tokens) → **Generate new token (classic)**.

Select scopes based on what you need:
- `repo` - (the parent checkbox — this covers all sub-scopes including private repo access)
- `read:org` under `admin:org`
- `read:user` under `user`

Copy the `ghp_...` token.

#### 2. Add to .env and mcp.json

Add the token to `~/.pi/agent/configs/.env`:

```
GITHUB_TOKEN=ghp_your-token-here
```

Then reference it in `mcp.json`:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": { "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}" }
    }
  }
}
```

No browser flow, no callbacks. The token never expires unless you revoke it.

---

### Slack

**Auth pattern:** mcp-remote with static client credentials (Pattern 2)
**What you need:** a registered Slack app (one-time setup)

Messages sent via the MCP server appear **as you** — your name, your avatar, no bot badge.

> **Work Slack / Enterprise Grid**: admin approval for app installs may be required. Creating the app is always fine; the install step is where you'd hit that gate.

#### 1. Create the app

Go to [api.slack.com/apps](https://api.slack.com/apps) → **Create New App** → **From a manifest** → pick your workspace → paste this manifest:

```json
{
  "display_information": {
    "name": "pidev-mcp",
    "description": "MCP client access to Slack",
    "background_color": "#2c2d30"
  },
  "features": {
    "bot_user": {
      "display_name": "pidev-mcp",
      "always_online": false
    }
  },
  "oauth_config": {
    "redirect_urls": ["http://localhost:3334/callback"],
    "scopes": {
      "bot": ["users:read"],
      "user": [
        "search:read.public", "search:read.private",
        "search:read.mpim", "search:read.im",
        "search:read.files", "search:read.users",
        "chat:write",
        "channels:history", "groups:history",
        "mpim:history", "im:history",
        "canvases:read", "canvases:write",
        "users:read", "users:read.email"
      ]
    }
  },
  "settings": {
    "org_deploy_enabled": true
  }
}
```

> The `bot_user` block and `users:read` bot scope are a required quirk — Slack's OAuth flow silently fails without a bot user present. The bot is never used at runtime.

#### 2. Enable two settings

- **OAuth & Permissions** → scroll down → *Proof Key for Code Exchange (PKCE)* → **Opt In**
- **Agents & AI Apps** → *Model Context Protocol* → toggle **On**

#### 3. Install to workspace

Hit **Install to Workspace**. Completes immediately or triggers an admin approval flow — wait for approval before continuing.

#### 4. Get your credentials

Go to **Basic Information → App Credentials** and copy:
- **Client ID**
- **Client Secret**

#### 5. Add to .env and mcp.json

Add the credentials to `~/.pi/agent/configs/.env`:

```
SLACK_CLIENT_ID=your-client-id-here
SLACK_CLIENT_SECRET=your-client-secret-here
```

Then reference them in `mcp.json`:

```json
{
  "mcpServers": {
    "slack": {
      "command": "npx",
      "args": [
        "-y", "mcp-remote",
        "https://mcp.slack.com/mcp",
        "--static-oauth-client-info",
        "{\"client_id\":\"${SLACK_CLIENT_ID}\",\"client_secret\":\"${SLACK_CLIENT_SECRET}\"}"
      ]
    }
  }
}
```

#### 6. Connect

Restart pi. The next time you use a Slack tool, `mcp-remote` starts the OAuth flow — your browser opens automatically, you approve, and tokens are cached at `~/.mcp-auth/`. Done.

To verify: `/mcp reconnect slack`

#### Notes

- Tokens are cached by `mcp-remote` in `~/.mcp-auth/` and reused automatically
- To re-authenticate: `rm -rf ~/.mcp-auth` and reconnect
- Messages sent via `chat:write` appear as you — not as a bot
- The bot user shows in the workspace app directory but never joins channels or posts anything

---

## Tool naming (direct tools)

When using `directTools`, each tool is registered as:

```
mcp__{serverName}__{toolName}
```

Special characters in server or tool names are replaced with `_`. For example, tool `read_file` on server `my-filesystem` becomes `mcp__my_filesystem__read_file`.
