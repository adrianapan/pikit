import { Markdown } from "@earendil-works/pi-tui";
import { CONFIG } from "../config.js";
import { getVisibleWidth, hasVisibleContent, currentTheme, applyColor } from "../utils.js";

const PREFIX_WIDTH = getVisibleWidth(CONFIG.thinkingMessage.prefix) + 2;
const PADDING_PREFIX = " ".repeat(PREFIX_WIDTH);

function getFullPrefix(): string {
  const prefix = currentTheme
    ? applyColor(currentTheme, CONFIG.thinkingMessage.prefixColor, CONFIG.thinkingMessage.prefix)
    : CONFIG.thinkingMessage.prefix;
  const label = currentTheme
    ? applyColor(currentTheme, CONFIG.thinkingMessage.labelColor, CONFIG.thinkingMessage.label)
    : CONFIG.thinkingMessage.label;
  return ` ${prefix}${CONFIG.thinkingMessage.isLabelVisible ? ` ${label} ` : ` `}`;
}

export interface ThinkingMessage {
  invalidate(): void;
  render(width: number): string[];
}

export function createThinkingMessage(text: string, markdownTheme: any): ThinkingMessage {
  const md = new Markdown(text, 0, 0, markdownTheme, {
    color: (t: string) => {
      if (!currentTheme) return t;
      return applyColor(currentTheme, CONFIG.thinkingMessage.messageColor, t);
    },
    italic: true,
  });
  let cachedWidth: number | undefined;
  let cachedLines: string[] | undefined;

  function invalidate(): void {
    cachedWidth = undefined;
    cachedLines = undefined;
    md.invalidate();
  }

  function render(width: number): string[] {
    if (cachedLines && cachedWidth === width) return cachedLines;

    const fullPrefix = getFullPrefix();
    const firstLinePrefixWidth = getVisibleWidth(fullPrefix);

    if (width <= firstLinePrefixWidth) {
      cachedWidth = width;
      cachedLines = [fullPrefix.trimEnd()];
      return cachedLines;
    }

    const mdLines = md.render(width - firstLinePrefixWidth);
    let prefixPlaced = false;

    const rendered = mdLines.map((line: string) => {
      if (!prefixPlaced && hasVisibleContent(line)) {
        prefixPlaced = true;
        return `${fullPrefix}${line}`;
      }
      return `${PADDING_PREFIX}${line}`;
    });

    cachedWidth = width;
    cachedLines = rendered;
    return rendered;
  }

  return { invalidate, render };
}
