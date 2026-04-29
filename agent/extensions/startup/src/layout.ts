import type { Theme } from "@mariozechner/pi-coding-agent";
import { VERSION } from "@mariozechner/pi-coding-agent";
import { bold, centerText, fitToWidth, hasNerdFonts } from "./helpers.js";
import { visibleWidth } from "@mariozechner/pi-tui";
import type { LoadedCounts } from "./discovery.js";

const PI_ART = [
  "██████╗ ██╗",
  "██╔══██╗██║",
  "██████╔╝██║",
  "██╔═══╝ ██║",
  "╚═╝     ╚═╝",
];

function buildLeftColumn(theme: Theme, colWidth: number): string[] {
  return [
    "",
    ...PI_ART.map((line) => centerText(bold(theme.fg("accent", line)), colWidth)),
  ];
}

function buildTipsColumn(theme: Theme, colWidth: number): string[] {
  const dim = (s: string) => theme.fg("dim", s);
  return [
    "",
    ` ${dim("/")} for commands`,
    ` ${dim("!")} to run bash`,
    ` ${dim("Ctrl+P")} cycle model`,
    ` ${dim("Shift+Tab")} cycle thinking`,
  ];
}

function buildRightColumn(theme: Theme, counts: LoadedCounts, colWidth: number): string[] {
  const dim = (s: string) => theme.fg("dim", s);
  const { contextFiles, extensions, skills, promptTemplates, mcpServers } = counts;
  const itemPrefix = dim("• ");
  const countLines: string[] = [
    ` ${itemPrefix}${theme.fg(extensions > 0 ? "success" : "dim", `${extensions}`)} extension${extensions !== 1 ? "s" : ""}`,
    ` ${itemPrefix}${theme.fg(skills > 0 ? "success" : "dim", `${skills}`)} skill${skills !== 1 ? "s" : ""}`,
    ` ${itemPrefix}${theme.fg(mcpServers > 0 ? "success" : "dim", `${mcpServers}`)} MCP config${mcpServers !== 1 ? "s" : ""}`,
    //@TODO: to be re-added when we add a new shortcut to the right column
    // ` ${itemPrefix}${theme.fg(promptTemplates > 0 ? "success" : "dim", `${promptTemplates}`)} prompt template${promptTemplates !== 1 ? "s" : ""}`,
    ` ${itemPrefix}${theme.fg(contextFiles > 0 ? "success" : "dim", `${contextFiles}`)} context file${contextFiles !== 1 ? "s" : ""}`,
  ];

  return ["", ...countLines, ""];
}

export function renderBox(
  theme: Theme,
  counts: LoadedCounts,
  termWidth: number,
): string[] {
  const minLayoutWidth = 44;
  if (termWidth < minLayoutWidth) return [];

  const boxWidth = Math.min(termWidth, Math.max(76, Math.min(termWidth - 2, 78)));
  const leftCol = 20;
  const configCol = 28;
  const tipsCol = Math.max(1, boxWidth - leftCol - configCol - 2);
  const hChar = "─";
  const nerd = hasNerdFonts();
  const separator = (s: string) => { try { return theme.fg("separator", s); } catch { return theme.fg("dim", s); } };
  const dim = (s: string) => theme.fg("dim", s);

  const leftLines = buildLeftColumn(theme, leftCol);
  const configLines = buildRightColumn(theme, counts, configCol);
  const tipsLines = buildTipsColumn(theme, tipsCol);

  const lines: string[] = [];
  lines.push("");

  const icon = nerd ? "\uE22C" : "";
  const titleContent = icon !== "" ? `  pi.dev agent v${VERSION}` : ` pi.dev agent v${VERSION} `;
  const titleVisLen = 2 + visibleWidth(icon) + visibleWidth(titleContent);
  const afterTitle = (boxWidth - 2) - titleVisLen;
  lines.push(
    separator("╭") +
    separator(hChar.repeat(2)) + theme.fg("accent", icon) + dim(titleContent) +
    separator(hChar.repeat(Math.max(1, afterTitle))) +
    separator("╮")
  );

  const maxRows = Math.max(leftLines.length, configLines.length, tipsLines.length);
  for (let i = 0; i < maxRows; i++) {
    const left   = fitToWidth(leftLines[i]   ?? "", leftCol);
    const config = fitToWidth(configLines[i] ?? "", configCol);
    const tips   = fitToWidth(tipsLines[i]   ?? "", tipsCol);
    lines.push(separator("│") + left + config + tips + separator("│"));
  }

  lines.push(separator("╰") + separator(hChar.repeat(boxWidth - 2)) + separator("╯"));
  lines.push("");

  return lines;
}
