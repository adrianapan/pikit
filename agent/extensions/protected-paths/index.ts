/**
 * Protected Paths Extension
 *
 * Blocks read, write, edit, and/or bash tool calls to protected paths.
 * Each entry defines a path and an explicit deny list.
 *
 * Two matching strategies depending on the entry format:
 *
 *   Bare entries (e.g. ".env", "node_modules/")
 *     → split the incoming path into segments and check each one exactly.
 *       ".env" only matches a file literally named ".env" at any depth.
 *       "node_modules/" matches any directory literally named "node_modules"
 *       at any depth. No false positives from substring matching.
 *
 *   Absolute / home-relative entries (e.g. "/etc/hosts", "~/.pi/agent/configs/")
 *     → both paths are resolved to absolute and a startsWith check is used.
 *       Any file nested inside the protected directory is also blocked.
 *
 * Config location:
 *   ~/.pi/agent/configs/protected-paths.json
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { homedir } from "node:os";
import { resolve } from "node:path";
import { loadConfig, type Op, type PathEntry } from "./config.js";

function matchesEntry(toolPath: string, entry: PathEntry): boolean {
  const { path: entryPath } = entry;

  if (entryPath.startsWith("/") || entryPath.startsWith("~/")) {
    // Absolute / home-relative → resolve both and use startsWith
    const resolvedEntry = entryPath.startsWith("~/")
      ? resolve(homedir(), entryPath.slice(2))
      : resolve(entryPath);
    const resolvedTool = resolve(toolPath);

    // Ensure directory boundary: /foo/bar should not match /foo/barbaz
    const dirEntry = resolvedEntry.endsWith("/") ? resolvedEntry : resolvedEntry + "/";
    return resolvedTool === resolvedEntry || resolvedTool.startsWith(dirEntry);
  }

  // Bare entry → exact segment match at any depth
  const segment = entryPath.replace(/\/$/, ""); // strip optional trailing slash
  return toolPath.split("/").some((p) => p === segment);
}

function getBlockedOps(toolPath: string, paths: PathEntry[]): Op[] | null {
  for (const entry of paths) {
    if (matchesEntry(toolPath, entry)) {
      return entry.deny;
    }
  }
  return null;
}

export default function protectedPathsExtension(pi: ExtensionAPI) {
  const { paths } = loadConfig();

  // Pre-process entries that carry bash protection.
  // Absolute/home-relative: match against resolved path in command string.
  // Bare entries (e.g. ".env"): match against the bare name as a substring — catches
  // "cat .env", "cat project/.env", etc. Also hits .envrc/.env.local, which is
  // acceptable since those are sensitive files too.
  const bashGuarded = paths
    .filter((e) => e.deny.includes("bash"))
    .map((e) => {
      const isAbsolute = e.path.startsWith("/") || e.path.startsWith("~/");
      return {
        entry: e,
        resolved: isAbsolute
          ? (e.path.startsWith("~/") ? resolve(homedir(), e.path.slice(2)) : resolve(e.path))
          : null,
        bare: isAbsolute ? null : e.path.replace(/\/$/, ""),
      };
    });

  pi.on("tool_call", async (event, ctx) => {
    // ── read / write / edit ──────────────────────────────────────────────────
    const toolName = event.toolName as Op;
    if (toolName === "read" || toolName === "write" || toolName === "edit") {
      const toolPath = (event.input as Record<string, unknown>).path as string;
      const blockedOps = getBlockedOps(toolPath, paths);
      if (!blockedOps || !blockedOps.includes(toolName)) return undefined;
      if (ctx.hasUI) {
        ctx.ui.notify(`[protected-paths] Blocked ${toolName} on protected path: ${toolPath}\nEdit configs/protected-paths.json to adjust.`, "warning");
      }
      return { block: true, reason: `[protected-paths] Path "${toolPath}" is protected (${toolName} denied). You can override this by editing ~/.pi/agent/configs/protected-paths.json.` };
    }

    // ── bash ─────────────────────────────────────────────────────────────────
    if (toolName === "bash" && bashGuarded.length > 0) {
      const command = (event.input as Record<string, unknown>).command as string;
      for (const { entry, resolved, bare } of bashGuarded) {
        const hit = resolved
          ? (command.includes(resolved) || command.includes(entry.path))
          : command.includes(bare!);
        if (hit) {
          if (ctx.hasUI) {
            ctx.ui.notify(`[protected-paths] Blocked bash command referencing protected path: ${entry.path}\nEdit configs/protected-paths.json to adjust.`, "warning");
          }
          return { block: true, reason: `[protected-paths] Bash command references protected path "${entry.path}" (bash denied). You can override this by editing ~/.pi/agent/configs/protected-paths.json.` };
        }
      }
    }

    return undefined;
  });
}
