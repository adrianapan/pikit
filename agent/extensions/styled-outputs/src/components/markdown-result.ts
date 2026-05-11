import { Markdown } from "@earendil-works/pi-tui";
import type { Component, MarkdownTheme } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { CONFIG } from "../config.js";
import { getVisibleWidth } from "../utils.js";
import { formatExpandedLines, indentLine } from "./tool-shared.js";
import type { TrimStrategy } from "../types.js";

const INDENT_WIDTH = getVisibleWidth(CONFIG.tools.toolBranch.prefix) + 1;

export interface MarkdownResult extends Component {
  render(width: number): string[];
  invalidate(): void;
}

export function createMarkdownResult(
  label: string,
  text: string,
  markdownTheme: MarkdownTheme,
  trimStrategy: TrimStrategy,
  toolTheme: Theme,
  noTruncate?: boolean,
): MarkdownResult {
  const md = new Markdown(text, 0, 0, markdownTheme);
  let cachedWidth: number | undefined;
  let cachedLines: string[] | undefined;

  function invalidate(): void {
    cachedWidth = undefined;
    cachedLines = undefined;
    md.invalidate();
  }

  function render(width: number): string[] {
    if (cachedLines && cachedWidth === width) return cachedLines;

    // Render markdown at reduced width to account for indent added by formatExpandedLines
    const contentWidth = Math.max(1, width - INDENT_WIDTH);
    const mdLines = md.render(contentWidth);

    let formatted: string;
    if (noTruncate) {
      // Indent only, no truncation — full document display
      formatted = mdLines.map(l => "\n" + indentLine(l)).join("");
    } else {
      // Apply truncation + indent on rendered lines
      formatted = formatExpandedLines(mdLines, trimStrategy, toolTheme);
    }

    const fullText = label + formatted;
    const lines = fullText.split("\n");

    cachedWidth = width;
    cachedLines = lines;
    return lines;
  }

  return { invalidate, render };
}