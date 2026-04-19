import type { Theme } from "@mariozechner/pi-coding-agent";
import { VERSION } from "@mariozechner/pi-coding-agent";
import { basename } from "node:path";
import { visibleWidth } from "@mariozechner/pi-tui";
import { bold, centerText, fitToWidth } from "./helpers.js";
import type { RecentSession, LoadedCounts } from "./discovery.js";

function buildLeftColumn(
  theme: Theme,
  modelName: string,
  providerName: string,
  cwd: string,
  colWidth: number,
): string[] {
  return [
    "",
    "",
    centerText(bold(`\x1b[38;2;215;135;175m\uEC19\x1b[0m`), colWidth),
    centerText(theme.fg("text", modelName), colWidth),
    centerText(theme.fg("dim", providerName), colWidth),
    "",
    centerText(bold(theme.fg("dim", "\uF115")), colWidth),
    centerText(theme.fg("text", basename(cwd)), colWidth),
    "",
    centerText(bold(theme.fg("dim", "\udb81\udcf9")), colWidth),
    centerText(theme.fg("text", "pi agent"), colWidth),
    centerText(theme.fg("dim", `v${VERSION}`), colWidth),
  ];
}

function buildRightColumn(
  theme: Theme,
  recentSessions: RecentSession[],
  counts: LoadedCounts,
  colWidth: number,
): string[] {
  const hChar = "─";
  const dim = (s: string) => theme.fg("dim", s);
  const separator = ` ${dim(hChar.repeat(colWidth - 2))}`;

  // Recent sessions
  const sessionLines: string[] =
    recentSessions.length === 0
      ? [` ${dim("No recent sessions")}`]
      : recentSessions.map(
          (s) => ` ${dim("• ")}${theme.fg("text", s.name)}${dim(` (${s.timeAgo})`)}`,
        );

  // Loaded counts
  const { contextFiles, extensions, skills, promptTemplates } = counts;
  const itemPrefix = dim("- ");
  const countLines: string[] = [
    ` ${itemPrefix}${theme.fg(contextFiles > 0 ? "success" : "dim", `${contextFiles}`)} context file${contextFiles !== 1 ? "s" : ""}`,
    ` ${itemPrefix}${theme.fg(extensions > 0 ? "success" : "dim", `${extensions}`)} extension${extensions !== 1 ? "s" : ""}`,
    ` ${itemPrefix}${theme.fg(skills > 0 ? "success" : "dim", `${skills}`)} skill${skills !== 1 ? "s" : ""}`,
    ` ${itemPrefix}${theme.fg(promptTemplates > 0 ? "success" : "dim", `${promptTemplates}`)} prompt template${promptTemplates !== 1 ? "s" : ""}`,
  ];

  return [
    ` ${bold(theme.fg("accent", "Tips"))}`,
    ` ${dim("/")} for commands`,
    ` ${dim("!")} to run bash`,
    ` ${dim("Shift+Tab")} cycle thinking`,
    separator,
    ` ${bold(theme.fg("accent", "Loaded"))}`,
    ...countLines,
    separator,
    ` ${bold(theme.fg("accent", "Recent sessions"))}`,
    ...sessionLines,
    "",
  ];
}

export function renderBox(
  theme: Theme,
  modelName: string,
  providerName: string,
  cwd: string,
  recentSessions: RecentSession[],
  counts: LoadedCounts,
  termWidth: number,
): string[] {
  const minLayoutWidth = 44;
  if (termWidth < minLayoutWidth) return [];

  const boxWidth = Math.min(termWidth, Math.max(76, Math.min(termWidth - 2, 96)));
  const leftCol = 26;
  const rightCol = Math.max(1, boxWidth - leftCol - 3);
  const hChar = "─";

  const dim = (s: string) => theme.fg("dim", s);
  const v = dim("│");
  const tl = dim("╭");
  const tr = dim("╮");
  const bl = dim("╰");
  const br = dim("╯");

  const leftLines = buildLeftColumn(theme, modelName, providerName, cwd, leftCol);
  const rightLines = buildRightColumn(theme, recentSessions, counts, rightCol);
  const contentWidth = boxWidth - 2;

  const lines: string[] = [];

  // Top border with title: ───<icon> pi agent vX.X.X ───...
  const icon = "\uE22C";
  const titleText = ` pi agent v${VERSION}`;
  const titleStyled = dim(hChar.repeat(2)) + theme.fg("accent", icon) + dim(" ") + dim(titleText);
  const titleVisLen = 2 + visibleWidth(icon) + 1 + visibleWidth(titleText);
  const afterTitle = contentWidth - titleVisLen;
  lines.push(tl + titleStyled + (afterTitle > 0 ? dim(hChar.repeat(afterTitle)) : "") + tr);

  // Two-column content rows
  const maxRows = Math.max(leftLines.length, rightLines.length);
  for (let i = 0; i < maxRows; i++) {
    const left = fitToWidth(leftLines[i] ?? "", leftCol);
    const right = fitToWidth(rightLines[i] ?? "", rightCol);
    lines.push(v + left + v + right + v);
  }

  // Bottom border with column separator
  const bottomLine = dim(hChar.repeat(leftCol)) + dim("┴") + dim(hChar.repeat(rightCol));
  lines.push(bl + bottomLine + br);
  lines.push("");

  return lines;
}
