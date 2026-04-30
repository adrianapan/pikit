import type { Theme, ThemeColor } from "@mariozechner/pi-coding-agent";
import type { ColorScheme, ColorValue, SemanticColor } from "./types.js";

// Default color scheme — thinkingXhigh and thinkingMax are intentionally absent;
// their absence signals "use rainbow" in thinking.ts.
const DEFAULT_COLORS: ColorScheme = {
  pi: "accent",
  model: "#c07898",
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
  context: "dim",
  contextWarn: "warning",
  contextError: "error",
  contextLabel: "muted",
  cost: "muted",
  tokens: "muted",
  separator: "#4e4c49",
  modeIndicator: "muted",
};

function isHexColor(color: ColorValue): color is `#${string}` {
  return typeof color === "string" && color.startsWith("#");
}

function hexToAnsi(hex: string): string {
  const h = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return "";
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
  if (color === undefined) return text;
  return applyColor(theme, color, text);
}

function hslToAnsi(h: number, s: number, l: number): string {
  if (!Number.isFinite(h) || !Number.isFinite(s) || !Number.isFinite(l)) return "";
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const v = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
    return Math.round(v * 255);
  };
  return `\x1b[38;2;${f(0)};${f(8)};${f(4)}m`;
}

// Spread hues evenly across all non-space characters
export function rainbow(text: string): string {
  const visibleChars = [...text].filter(c => c !== " " && c !== ":").length;
  let result = "";
  let colorIndex = 0;
  for (const char of text) {
    if (char === " " || char === ":") {
      result += char;
    } else {
      const hue = (colorIndex / Math.max(visibleChars - 1, 1)) * 300;
      result += hslToAnsi(hue, 0.85, 0.65) + char;
      colorIndex++;
    }
  }
  return result + "\x1b[0m";
}

export function getDefaultColors(): ColorScheme {
  return { ...DEFAULT_COLORS };
}
