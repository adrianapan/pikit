/** Pure utilities: isSafeCommand, color helpers. */

import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";

import { SAFE_COMMAND_PATTERNS, DESTRUCTIVE_PATTERNS } from "./config.js";

/** Check if command matches safe patterns and not destructive patterns. */
export function isSafeCommand(command: string): boolean {
  return SAFE_COMMAND_PATTERNS.some((p) => p.test(command))
    && !DESTRUCTIVE_PATTERNS.some((p) => p.test(command));
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