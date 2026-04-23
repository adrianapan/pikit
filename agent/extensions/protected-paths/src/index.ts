/**
 * Protected Paths Extension
 *
 * Blocks read, write, and/or edit operations to protected paths.
 * Each entry defines a path and an explicit ops denylist.
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

import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { homedir } from "os";
import { resolve } from "path";
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

function getBlockedOps(toolPath: string, paths: PathEntry[]): Set<Op> | null {
  for (const entry of paths) {
    if (matchesEntry(toolPath, entry)) {
      return new Set(entry.ops);
    }
  }
  return null;
}

export default function protectedPathsExtension(pi: ExtensionAPI) {
  const { paths } = loadConfig();

  pi.on("tool_call", async (event, ctx) => {
    const toolName = event.toolName as Op;
    if (toolName !== "read" && toolName !== "write" && toolName !== "edit") return undefined;

    const toolPath = event.input.path as string;
    const blockedOps = getBlockedOps(toolPath, paths);

    if (!blockedOps || !blockedOps.has(toolName)) return undefined;

    if (ctx.hasUI) {
      ctx.ui.notify(`Blocked ${toolName} on protected path: ${toolPath}`, "warning");
    }
    return { block: true, reason: `Path "${toolPath}" is protected (${toolName} denied)` };
  });
}
