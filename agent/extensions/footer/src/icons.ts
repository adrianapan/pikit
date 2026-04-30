export interface IconSet {
  pi: string;
  folder: string;
  branch: string;
  git: string;
  separator: string;
}

// Nerd Font icons
export const NERD_ICONS: IconSet = {
  pi: "\uE22C",         // nf-oct-pi
  folder: "\uF115",     // nf-fa-folder_open
  branch: "\uF126",     // nf-fa-code_fork
  git: "\uF1D3",        // nf-fa-git
  separator: "|",
};

// ASCII/Unicode fallback icons
export const ASCII_ICONS: IconSet = {
  pi: "π",
  folder: "📂",
  branch: "⎇",
  git: "⎇",
  separator: "|",
};

// Detect Nerd Font support
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

export function getIcons(customIcons?: Partial<IconSet>): IconSet {
  const baseIcons = hasNerdFonts() ? NERD_ICONS : ASCII_ICONS;
  if (!customIcons || Object.keys(customIcons).length === 0) {
    return baseIcons;
  }
  return { ...baseIcons, ...customIcons };
}
