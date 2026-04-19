export interface IconSet {
  pi: string;
  model: string;
  folder: string;
  branch: string;
  git: string;
  tokens: string;
  contextPct: string;
  contextTotal: string;
  cost: string;
  cacheRead: string;
  cacheWrite: string;
  input: string;
  output: string;
  thinking: string;
  separator: string;
  auto: string;
}

// Nerd Font icons
export const NERD_ICONS: IconSet = {
  pi: "\uE22C",         // nf-oct-pi
  model: "\uEC19",      // nf-md-chip
  folder: "\uF115",     // nf-fa-folder_open
  branch: "\uF126",     // nf-fa-code_fork
  git: "\uF1D3",        // nf-fa-git
  tokens: "\uede8",     // nf-fa-coins
  contextPct: "\ueea8", // nf-fa-layer_group
  contextTotal: "\uE70F", // nf-dev-database
  cost: "\uF155",       // nf-fa-dollar
  cacheRead: "\uF1C0",  // nf-fa-database
  cacheWrite: "\uF1C0", // nf-fa-database
  input: "\uf062",      // nf-fa-arrow_up
  output: "\uf063",     // nf-fa-arrow_down
  thinking: "\uf400",   // nf-oct-light_bulb
  separator: "\uE0B1",  // nf-pl-left_soft_divider
  auto: "\uF0068",      // nf-md-lightning_bolt
};

// ASCII/Unicode fallback icons
export const ASCII_ICONS: IconSet = {
  pi: "π",
  model: "◈",
  folder: "📁",
  branch: "⎇",
  git: "⎇",
  tokens: "⊛",
  contextPct: "◫",
  contextTotal: "◫",
  cost: "$",
  cacheRead: "↙",
  cacheWrite: "↗",
  input: "↑",
  output: "↓",
  thinking: "🧠",
  separator: "|",
  auto: "⚡",
};

// Detect Nerd Font support
export function hasNerdFonts(): boolean {
  if (process.env.SLOP_FOOTER_NERD_FONTS === "1") return true;
  if (process.env.SLOP_FOOTER_NERD_FONTS === "0") return false;
  
  if (process.env.GHOSTTY_RESOURCES_DIR) return true;
  
  const term = (process.env.TERM_PROGRAM || "").toLowerCase();
  const nerdTerms = ["iterm", "wezterm", "kitty", "ghostty", "alacritty"];
  return nerdTerms.some(t => term.includes(t));
}

export function getIcons(customIcons?: Partial<IconSet>): IconSet {
  const baseIcons = hasNerdFonts() ? NERD_ICONS : ASCII_ICONS;
  if (!customIcons || Object.keys(customIcons).length === 0) {
    return baseIcons;
  }
  return { ...baseIcons, ...customIcons };
}
