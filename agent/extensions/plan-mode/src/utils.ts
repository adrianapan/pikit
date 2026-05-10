/** Pure utilities: isSafeCommand, extractPlanText, plan file I/O */

import { SAFE_COMMAND_PATTERNS, DESTRUCTIVE_PATTERNS, PLAN_DIR, PLAN_FILE_PREFIX } from "./config.js";
import { existsSync, readFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";

/** Check if command matches safe patterns and not destructive patterns. */
export function isSafeCommand(command: string): boolean {
  return SAFE_COMMAND_PATTERNS.some((p) => p.test(command))
    && !DESTRUCTIVE_PATTERNS.some((p) => p.test(command));
}

/** Extract the raw text under the "Plan:" header from a message. Returns null if no plan found. */
export function extractPlanText(message: string): string | null {
  const planMatch = message.match(/^\s*Plan:\s*$/im);
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

/** Derive display title from filename: strip prefix & extension, hyphens → spaces, title-case. */
export function titleFromFilename(filename: string): string {
  return filename
    .replace(/^plan-/, "")
    .replace(/\.md$/, "")
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

interface PlanFileSummary {
  name: string;
  title: string;
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