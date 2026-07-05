import { Markdown } from "@earendil-works/pi-tui";
import { CONFIG } from "../config.js";
import { getVisibleWidth, hasVisibleContent, currentTheme, applyColor } from "../utils.js";

const ASSISTANT_PREFIX_WIDTH = getVisibleWidth(CONFIG.assistantMessage.prefix) + 2;
const PADDING_PREFIX = " ".repeat(ASSISTANT_PREFIX_WIDTH);

export interface AssistantMessage {
  invalidate(): void;
  render(width: number): string[];
}

export function createAssistantMessage(text: string, markdownTheme: any): AssistantMessage {
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

    if (width <= ASSISTANT_PREFIX_WIDTH) {
      cachedWidth = width;
      const prefix = currentTheme
        ? applyColor(currentTheme, CONFIG.assistantMessage.color, CONFIG.assistantMessage.prefix)
        : CONFIG.assistantMessage.prefix;
      cachedLines = [` ${prefix} `];
      return cachedLines;
    }

    const mdLines = md.render(width - ASSISTANT_PREFIX_WIDTH);
    let dotPlaced = false;

    const rendered = mdLines.map((line: string) => {
      if (!dotPlaced && hasVisibleContent(line)) {
        dotPlaced = true;
        const prefix = currentTheme
          ? applyColor(currentTheme, CONFIG.assistantMessage.color, CONFIG.assistantMessage.prefix)
          : CONFIG.assistantMessage.prefix;
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
