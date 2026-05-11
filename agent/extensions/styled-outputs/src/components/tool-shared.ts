import { Text } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { CONFIG } from "../config.js";
import type { TrimStrategy } from "../types.js";
import { applyColor, applyBgColor, toolPrefix, errorPrefix, getVisibleWidth, getExpandToggleKey } from "../utils.js";

// --- Group-aware config resolution ---

type GeneralConfigKey = keyof typeof CONFIG.tools.general;

export function groupProp<K extends GeneralConfigKey>(
  group: keyof typeof CONFIG.tools.groups,
  prop: K,
): (typeof CONFIG.tools.general)[K] {
  const val = (CONFIG.tools.groups[group] as any)?.[prop];
  return val !== undefined ? val : CONFIG.tools.general[prop];
}

export function groupTitleColor(group: keyof typeof CONFIG.tools.groups): string {
  return groupProp(group, "titleColor");
}

// --- Text component helper ---

export function makeText(lastComponent: Text | undefined, text: string): Text {
  const comp = (lastComponent instanceof Text) ? lastComponent : new Text("", 0, 0);
  comp.setText(text);
  return comp;
}

// --- Spinner ---

const SPINNER_CHARS = CONFIG.tools.toolSpinnerPrefix.prefixChars;
const SPINNER_FRAMES = [...SPINNER_CHARS, ...[...SPINNER_CHARS].reverse()];
const SPINNER_INTERVAL = 80;

export function ensureSpinner(ctx: any): number {
  if (ctx.state.spinnerInterval) return ctx.state.spinnerFrame ?? 0;
  ctx.state.spinnerFrame = 0;
  ctx.state.spinnerInterval = setInterval(() => {
    ctx.state.spinnerFrame = (ctx.state.spinnerFrame + 1) % SPINNER_FRAMES.length;
    ctx.invalidate();
  }, SPINNER_INTERVAL);
  return 0;
}

export function clearSpinner(ctx: any) {
  if (ctx.state.spinnerInterval) {
    clearInterval(ctx.state.spinnerInterval);
    ctx.state.spinnerInterval = undefined;
  }
}

export function spinnerDot(theme: Theme, frame: number): string {
  return `${applyColor(theme, CONFIG.tools.toolSpinnerPrefix.color, SPINNER_FRAMES[frame % SPINNER_FRAMES.length])} `;
}

// --- Header / status / output helpers ---

export function toolHeader(label: string, summary: string, theme: Theme, dot?: string, isError?: boolean, titleColor?: string): string {
  const d = dot ?? (isError ? errorPrefix(theme) : toolPrefix(theme));
  const color = titleColor ?? CONFIG.tools.general.titleColor;
  const title = applyColor(theme, color, theme.bold(label));
  return `${d}${title} ${summary}`;
}

export function branchLine(text: string, theme: Theme): string {
  const icon = applyColor(theme, CONFIG.tools.toolBranch.color, CONFIG.tools.toolBranch.prefix);
  return `${icon} ${text}`;
}

export function indentLine(text: string): string {
  return `${" ".repeat(getVisibleWidth(CONFIG.tools.toolBranch.prefix) + 1)}${text}`;
}

export function expandHint(theme: Theme): string {
  return applyColor(theme, CONFIG.tools.general.expandHintColor, ` • ${getExpandToggleKey()} to expand`);
}

const NO_OUTPUT_PLACEHOLDER = "(no output)";

export function outputLines(text: string): string[] {
  if (text === NO_OUTPUT_PLACEHOLDER) return [];
  return text.split("\n");
}

export function getFirstTextContent(result: any): string {
  if (!result?.content) return "";
  for (const block of result.content) {
    if (block?.type === "text" && block.text) return block.text;
  }
  return "";
}

export function errorLabel(theme: Theme): string {
  return branchLine(applyColor(theme, CONFIG.tools.toolError.labelColor, "Error"), theme);
}

export function renderPartial(theme: Theme): string {
  return branchLine(applyColor(theme, CONFIG.tools.general.outputColor, "Running..."), theme);
}

export function doneLabel(theme: Theme, count?: { label: string; value: number }): string {
  const done = applyColor(theme, CONFIG.tools.toolSuccess.labelColor, "Done");
  const text = count
    ? `${done} ${applyColor(theme, CONFIG.tools.general.countColor, `• ${count.value} ${count.label}`)}`
    : done;
  return branchLine(text, theme);
}

// --- Expanded output trimming ---

export function formatExpandedLines(lines: string[], strategy: TrimStrategy, theme: Theme): string {
  const max = CONFIG.tools.general.maxExpandedLines;

  if (max < 1 || lines.length <= max) {
    return lines.map(l => "\n" + indentLine(l)).join("");
  }

  const more = (count: number, label: string) => {
    const text = applyColor(theme, CONFIG.tools.general.moreColor, `─── ${count} ${label} ───`);
    const withBg = applyBgColor(theme, CONFIG.tools.general.moreBgColor || undefined, text);
    return indentLine(withBg);
  };
  const half = Math.floor(max / 2);

  switch (strategy) {
    case "head":
      return lines.slice(0, max).map(l => "\n" + indentLine(l)).join("")
        + "\n" + more(lines.length - max, "more lines");

    case "tail": {
      const hidden = lines.length - max;
      return "\n" + more(hidden, "lines above")
        + lines.slice(-max).map(l => "\n" + indentLine(l)).join("");
    }

    case "head-tail": {
      const hidden = lines.length - max;
      return lines.slice(0, half).map(l => "\n" + indentLine(l)).join("")
        + "\n" + more(hidden, "more lines")
        + lines.slice(-half).map(l => "\n" + indentLine(l)).join("");
    }
  }
}