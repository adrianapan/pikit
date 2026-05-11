/** Pure utilities: isSafeCommand, extractPlanText, plan file I/O, color helpers */

import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { SAFE_COMMAND_PATTERNS, DESTRUCTIVE_PATTERNS, PLAN_DIR, PLAN_FILE_PREFIX } from "./config.js";
import type { PlanFileSummary } from "./types.js";
import { existsSync, readFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/** Check if command matches safe patterns and not destructive patterns. */
export function isSafeCommand(command: string): boolean {
  return SAFE_COMMAND_PATTERNS.some((p) => p.test(command))
    && !DESTRUCTIVE_PATTERNS.some((p) => p.test(command));
}

/** Extract the raw text under the "Plan:" header from a message. Returns null if no plan found. */
export function extractPlanText(message: string): string | null {
  const planMatch = message.match(/^\s*(?:#{1,6}\s*)?(?:\*{1,2})?Plan:(?:\*{1,2})?[^\n]*$/im);
  if (!planMatch) return null;
  const afterPlan = message.slice(planMatch.index! + planMatch[0].length);
  return afterPlan.trim();
}

// ─── Plan File I/O ────────────────────────────────────────────────────────────

/** Ensure .pi/plans/ exists, return its absolute path. */
export function ensurePlanDir(): string {
  const dir = join(process.cwd(), PLAN_DIR);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Derive display title from filename.
 *  For named plans (e.g. plan-add-auth.md) → "Add Auth".
 *  For timestamp plans (e.g. plan-2026-05-10-14-30.md) → "May 10, 2026 14:30". */
export function titleFromFilename(filename: string): string {
  const stem = filename.replace(/^plan-/ , "").replace(/\.md$/, "");

  // Detect timestamp pattern: YYYY-MM-DD-HH-MM
  const tsMatch = stem.match(/^(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})$/);
  if (tsMatch) {
    const [, y, m, d, h, min] = tsMatch;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const month = months[parseInt(m, 10) - 1] ?? m;
    return `${month} ${parseInt(d, 10)}, ${y} ${h}:${min}`;
  }

  // Named plan: hyphens → spaces, title-case
  return stem.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Sanitize a plan name — reject path traversal and invalid characters. Returns null if invalid. */
export function sanitizePlanName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) return null;
  if (!/^[\w\s.-]+$/.test(trimmed)) return null;
  return trimmed.replace(/\s+/g, "-");
}

/** List available plan files in .pi/plans/ with titles from # Plan: heading. */
export function listPlanFiles(): PlanFileSummary[] {
  const dir = join(process.cwd(), PLAN_DIR);
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir)
    .filter((f) => f.startsWith(PLAN_FILE_PREFIX) && f.endsWith(".md"))
    .sort();

  return files.map((filename) => {
    const content = readFileSync(join(dir, filename), "utf-8");
    const titleMatch = content.match(/^# Plan:\s*(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : titleFromFilename(filename);
    return { name: filename, title };
  });
}

/** Extract text content from an LLM message (string or array of content blocks). */
export function extractTextFromMessage(message: Record<string, unknown>): string | null {
  const content = message.content;
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((block: unknown): block is { type: string; text?: string } =>
        typeof block === "object" && block !== null && "type" in block && (block as { type: string }).type === "text",
      )
      .map((block) => block.text ?? "")
      .join("\n");
  }
  return null;
}

// ─── Color Utilities ────────────────────────────────────────────────────────

/** Check if a color string is a hex color (e.g. "#ff6600"). */
export function isHexColor(color: string): boolean {
  return color.startsWith("#");
}

/** Convert hex color string to ANSI truecolor escape. */
function hexToAnsi(hex: string): string {
  const h = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return "";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

/** Apply a color to text — supports pi theme tokens and hex values. */
export function applyLabelColor(theme: Theme, color: string, text: string): string {
  if (isHexColor(color)) {
    const ansi = hexToAnsi(color);
    if (!ansi) return text;
    return `${ansi}${text}\x1b[39m`;
  }
  try {
    return theme.fg(color as ThemeColor, text);
  } catch {
    return text;
  }
}