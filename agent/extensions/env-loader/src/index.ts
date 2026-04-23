/**
 * env-loader — injects ~/.pi/agent/configs/.env into process.env at startup.
 *
 * Loads synchronously in the factory function so vars are available to all
 * other extensions before session_start fires. Shell environment always takes
 * precedence — existing values are never overwritten.
 *
 * Config location:
 *   ~/.pi/agent/configs/.env
 *
 * Config format:
 *   SLACK_MCP_TOKEN=xoxp-...
 *   GITHUB_TOKEN=ghp-...
 *
 * Use /env to inspect loaded key names (values are never shown).
 */

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { loadEnvFile } from "./loader.js";

export default function envLoaderExtension(pi: ExtensionAPI) {
  // Load synchronously — runs before session_start, before any other extension
  // that needs these vars (e.g. mcp) tries to use them.
  const result = loadEnvFile();

  // Surface file read errors as a notification once the UI is ready.
  if (result.error) {
    pi.on("session_start", async (_event, ctx) => {
      ctx.ui.notify(`env-loader: ${result.error}`, "error");
    });
  }

  // ─── /env command ─────────────────────────────────────────────────────────

  pi.registerCommand("env", {
    description: "Show env vars loaded from .env (key names only — no values)",
    handler: async (_args, ctx) => {
      if (!ctx.hasUI) return;

      if (result.error) {
        ctx.ui.notify(`env-loader: ${result.error}`, "error");
        return;
      }

      if (result.keys.length === 0 && result.skipped === 0) {
        ctx.ui.notify(
          "No .env found at ~/.pi/agent/configs/.env\n" +
            "Copy .env.example from the env-loader extension to get started.",
          "info",
        );
        return;
      }

      const lines: string[] = [];

      if (result.keys.length > 0) {
        lines.push(`${result.keys.length} var(s) loaded from .env:`);
        for (const key of result.keys) lines.push(`  ${key}`);
      }

      if (result.skipped > 0) {
        lines.push(`${result.skipped} var(s) skipped (already set in shell env)`);
      }

      ctx.ui.notify(lines.join("\n"), "info");
    },
  });
}
