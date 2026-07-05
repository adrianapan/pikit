import { Markdown } from "@earendil-works/pi-tui";
import { CONFIG } from "../config.js";
import { getVisibleWidth, hasVisibleContent, currentTheme, applyColor } from "../utils.js";

const USER_PREFIX_WIDTH = getVisibleWidth(CONFIG.userMessage.prefix) + 2;
const PADDING_PREFIX = " ".repeat(USER_PREFIX_WIDTH);

export interface UserMessage {
  invalidate(): void;
  render(width: number): string[];
}

export function createUserMessage(text: string, markdownTheme: any): UserMessage {
  const md = new Markdown(text, 0, 0, markdownTheme, {
    color: (t: string) => {
      if (!currentTheme) return t;
      return applyColor(currentTheme, CONFIG.userMessage.bodyColor, t);
    },
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

    if (width <= USER_PREFIX_WIDTH) {
      cachedWidth = width;
      const prefix = currentTheme
        ? applyColor(currentTheme, CONFIG.userMessage.color, CONFIG.userMessage.prefix)
        : CONFIG.userMessage.prefix;
      cachedLines = [` ${prefix} `];
      return cachedLines;
    }

    const mdLines = md.render(width - USER_PREFIX_WIDTH);
    let prefixPlaced = false;

    const rendered = mdLines.map((line: string) => {
      if (!prefixPlaced && hasVisibleContent(line)) {
        prefixPlaced = true;
        const prefix = currentTheme
          ? applyColor(currentTheme, CONFIG.userMessage.color, CONFIG.userMessage.prefix)
          : CONFIG.userMessage.prefix;
        return ` ${prefix} ${line}`;
      }
      return `${PADDING_PREFIX}${line}`;
    });

    cachedWidth = width;
    cachedLines = rendered;
    return rendered;
  }

  return { invalidate, render };
}