import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { COMPANION_ARTS, ROTATION_INTERVAL_MS } from "./config.js";

function isHexColor(color: string): boolean {
	return color.startsWith("#");
}

function hexToAnsi(hex: string): string {
	const h = hex.replace("#", "");
	if (!/^[0-9a-fA-F]{6}$/.test(h)) return "";
	const r = parseInt(h.slice(0, 2), 16);
	const g = parseInt(h.slice(2, 4), 16);
	const b = parseInt(h.slice(4, 6), 16);
	return `\x1b[38;2;${r};${g};${b}m`;
}

/** Apply a color to text — supports hex (#RRGGBB) or theme token names. */
export function applyColor(theme: Theme, color: string, text: string): string {
	if (isHexColor(color)) {
		return `${hexToAnsi(color)}${text}\x1b[0m`;
	}
	return theme.fg(color as ThemeColor, text);
}

export function getCompanionArt(now: number): { line1: string; line2: string } {
	const idx = Math.floor(now / ROTATION_INTERVAL_MS) % COMPANION_ARTS.length;
	const [line1, line2] = COMPANION_ARTS[idx]!;
	return { line1, line2 };
}