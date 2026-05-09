/** Pure utilities: isSafeCommand, extractPlanSteps, markCompletedSteps */

import { SAFE_COMMAND_PATTERNS, DESTRUCTIVE_PATTERNS } from "./config.js";

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