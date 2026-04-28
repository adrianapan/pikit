import type { Theme, ThemeColor } from "@mariozechner/pi-coding-agent";
import type { ColorScheme, ColorValue, SemanticColor } from "./types.js";

// Default color scheme
const DEFAULT_COLORS: Required<ColorScheme> = {
  pi: "accent",
  model: "#d787af",
  path: "dim",
  git: "success",
  gitDirty: "warning",
  gitClean: "success",
  thinking: "muted",
  thinkingIcon: "warning",
  thinkingOff: "dim",
  thinkingMinimal: "muted",
  thinkingLow: "warning",
  thinkingMedium: "success",
  thinkingHigh: "#afb9fe",
  thinkingXhigh: "#9575cd",
  thinkingMax: "error",
  context: "dim",
  contextWarn: "warning",
  contextError: "error",
  cost: "text",
  tokens: "dim",
  separator: "dim",
  caveman: "muted",
};

function isHexColor(color: ColorValue): color is `#${string}` {
  return typeof color === "string" && color.startsWith("#");
}

function hexToAnsi(hex: string): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

export function applyColor(
  theme: Theme,
  color: ColorValue,
  text: string
): string {
  if (isHexColor(color)) {
    return `${hexToAnsi(color)}${text}\x1b[0m`;
  }
  return theme.fg(color as ThemeColor, text);
}

export function fg(
  theme: Theme,
  semantic: SemanticColor,
  text: string,
  presetColors?: ColorScheme
): string {
  const color = presetColors?.[semantic] ?? DEFAULT_COLORS[semantic];
  return applyColor(theme, color, text);
}

export function getDefaultColors(): Required<ColorScheme> {
  return { ...DEFAULT_COLORS };
}
