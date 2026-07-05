import { visibleWidth, truncateToWidth } from "@earendil-works/pi-tui";

export function hasNerdFonts(): boolean {
  if (process.env.FOOTER_NERD_FONTS === "1") return true;
  if (process.env.FOOTER_NERD_FONTS === "0") return false;

  if (process.env.GHOSTTY_RESOURCES_DIR) return true;

  const termProg = (process.env.TERM_PROGRAM || "").toLowerCase();
  const nerdTerms = ["iterm", "wezterm", "kitty", "ghostty", "alacritty", "foot", "rio", "contour"];
  if (nerdTerms.some(t => termProg.includes(t))) return true;

  const term = (process.env.TERM || "").toLowerCase();
  const nerdTermVars = ["xterm-kitty", "xterm-ghostty", "alacritty", "foot", "rio", "contour"];
  return nerdTermVars.some(t => term.includes(t));
}

export function bold(text: string): string {
  return `\x1b[1m${text}\x1b[22m`;
}

export function centerText(text: string, width: number): string {
  const visLen = visibleWidth(text);
  if (visLen >= width) return truncateToWidth(text, width, "…");
  const leftPad = Math.floor((width - visLen) / 2);
  return " ".repeat(leftPad) + text + " ".repeat(width - visLen - leftPad);
}

export function fitToWidth(str: string, width: number): string {
  const visLen = visibleWidth(str);
  if (visLen > width) return truncateToWidth(str, width, "…");
  return str + " ".repeat(width - visLen);
}
