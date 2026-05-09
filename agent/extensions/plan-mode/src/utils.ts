/** Pure utilities: isSafeCommand, extractPlanSteps, markCompletedSteps, plan file I/O */

import { SAFE_COMMAND_PATTERNS, DESTRUCTIVE_PATTERNS, PLAN_DIR, PLAN_FILE_PREFIX } from "./config.js";
import { existsSync, readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface TodoItem {
  step: number;
  text: string;
  completed: boolean;
}

/** Check if command matches safe patterns and not destructive patterns. */
export function isSafeCommand(command: string): boolean {
  return SAFE_COMMAND_PATTERNS.some((p) => p.test(command))
    && !DESTRUCTIVE_PATTERNS.some((p) => p.test(command));
}

/** Extract numbered plan steps from a "Plan:" header.
 *  Requires contiguous numbering from 1. Skips sub-bullets, code fences, and other non-step lines. */
export function extractPlanSteps(message: string): TodoItem[] {
  const planMatch = message.match(/^\s*Plan:\s*$/im);
  if (!planMatch) return [];

  const afterPlan = message.slice(planMatch.index! + planMatch[0].length);
  const lines = afterPlan.split("\n");
  const steps: TodoItem[] = [];
  let nextStep = 1;
  let inCodeFence = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Track code fences — skip content inside them
    if (trimmed.startsWith("```")) {
      inCodeFence = !inCodeFence;
      continue;
    }
    if (inCodeFence) continue;

    // Only match lines where step number appears at the start (with optional indentation)
    const stepMatch = line.match(/^\s*(\d+)\s*[.)]\s+(.+)/);
    if (stepMatch) {
      const num = parseInt(stepMatch[1], 10);
      const text = stepMatch[2].trim();
      if (num === nextStep && text.length > 0) {
        steps.push({ step: num, text, completed: false });
        nextStep = num + 1;
      }
    }
    // Non-matching lines (blank, bullets, prose) are just sub-content — skip
  }

  return steps;
}

/** Strip [DONE:n] markers from text (case-insensitive). Removes all occurrences. */
export function stripDoneMarkers(text: string): string {
  return text.replace(/\[done:\d+\]/gi, "");
}

/** Strip markdown bold/italic/code for plan file storage (keeps markers readable). */
export function stripMarkdownFormatting(text: string): string {
  return text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\*([^*]+)\*/g, "$1");
}

/** Render markdown bold/italic/code using theme styling for widget display. */
export function renderMarkdownStep(text: string, theme: { bold: (s: string) => string; italic: (s: string) => string; fg: (c: string, s: string) => string }): string {
  // Process code first (backticks), then bold (**), then italic (*)
  let result = text;
  result = result.replace(/`([^`]+)`/g, (_, content) => theme.fg("dim", content));
  result = result.replace(/\*\*([^*]+)\*\*/g, (_, content) => theme.bold(content));
  result = result.replace(/\*([^*]+)\*/g, (_, content) => theme.italic(content));
  return result;
}

/** Mark steps complete where [DONE:n] appears in text. Returns count of newly completed. */
export function markCompletedSteps(text: string, items: TodoItem[]): number {
  const doneRegex = /\[done:(\d+)\]/gi;
  let match: RegExpExecArray | null;
  let newlyCompleted = 0;

  while ((match = doneRegex.exec(text)) !== null) {
    const step = parseInt(match[1], 10);
    const item = items.find((i) => i.step === step);
    if (item && !item.completed) {
      item.completed = true;
      newlyCompleted++;
    }
  }

  return newlyCompleted;
}

// ─── Plan File I/O ────────────────────────────────────────────────────────────

/** Ensure .pi/plans/ exists, return its absolute path. */
export function ensurePlanDir(): string {
  const dir = join(process.cwd(), PLAN_DIR);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Parse plan file markdown content → TodoItem[].
 *  Reads lines matching `- [x] N. Text` or `- [ ] N. Text`. */
export function parsePlanFile(content: string): TodoItem[] {
  const items: TodoItem[] = [];
  const regex = /^- \[([ x])\] (\d+)\. (.+)$/gm;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(content)) !== null) {
    items.push({
      completed: match[1] === "x",
      step: parseInt(match[2], 10),
      text: match[3],
    });
  }
  return items;
}

/** Serialize TodoItem[] → plan file markdown content. */
export function serializePlanFile(title: string, items: TodoItem[]): string {
  const lines = [`# Plan: ${title}`];
  for (const item of items) {
    const check = item.completed ? "x" : " ";
    lines.push(`- [${check}] ${item.step}. ${item.text}`);
  }
  return lines.join("\n") + "\n";
}

/** Write [x] checkbox for a step in the plan file on disk. No-op if already checked or not found. */
export function markStepInFile(filePath: string, step: number): void {
  if (!existsSync(filePath)) return;
  const content = readFileSync(filePath, "utf-8");
  const regex = new RegExp(`^- \\[ \\] ${step}\\. `, "m");
  if (!regex.test(content)) return;
  const updated = content.replace(regex, `- [x] ${step}. `);
  writeFileSync(filePath, updated, "utf-8");
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
  display: string;
  done: number;
  total: number;
}

/** Sanitize a plan name — reject path traversal and invalid characters. Returns null if invalid. */
export function sanitizePlanName(name: string): string | null {
  const trimmed = name.trim();
  if (!trimmed) return null;
  if (trimmed.includes("/") || trimmed.includes("\\") || trimmed.includes("..")) return null;
  if (!/^[\w\s.-]+$/.test(trimmed)) return null;
  return trimmed.replace(/\s+/g, "-");
}

/** List available plan files in .pi/plans/ with completion counts. */
export function listPlanFiles(): PlanFileSummary[] {
  const dir = join(process.cwd(), PLAN_DIR);
  if (!existsSync(dir)) return [];

  const files = readdirSync(dir)
    .filter((f) => f.startsWith(PLAN_FILE_PREFIX) && f.endsWith(".md"))
    .sort();

  return files.map((filename) => {
    const content = readFileSync(join(dir, filename), "utf-8");
    const items = parsePlanFile(content);
    return {
      name: filename,
      display: titleFromFilename(filename),
      done: items.filter((i) => i.completed).length,
      total: items.length,
    };
  });
}