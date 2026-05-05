import { Markdown } from "@mariozechner/pi-tui";
import { CONFIG } from "../config.js";
import { getVisibleWidth, hasVisibleContent, currentTheme, applyColor } from "../utils.js";

const PREFIX_WIDTH = getVisibleWidth(CONFIG.thinkingPrefix) + 2;
const PADDING_PREFIX = " ".repeat(PREFIX_WIDTH);

function getFullPrefix(): string {
  const prefix = currentTheme
    ? applyColor(currentTheme, CONFIG.thinkingPrefixColor, CONFIG.thinkingPrefix)
    : CONFIG.thinkingPrefix;
  const label = currentTheme
    ? applyColor(currentTheme, CONFIG.thinkingLabelColor, CONFIG.thinkingLabel)
    : CONFIG.thinkingLabel;
  return ` ${prefix}${CONFIG.isThinkingLabelVisible ? ` ${label} ` : ` `}`;
}

export class ThinkingMessage {
  private md: InstanceType<typeof Markdown>;
  private cachedWidth?: number;
  private cachedLines?: string[];

  constructor(text: string, markdownTheme: any) {
    this.md = new Markdown(text, 0, 0, markdownTheme, {
      color: (t: string) => {
        if (!currentTheme) return t;
        return applyColor(currentTheme, CONFIG.thinkingMessageColor, t);
      },
      italic: true,
    });
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
    this.md.invalidate();
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    const fullPrefix = getFullPrefix();
    const firstLinePrefixWidth = getVisibleWidth(fullPrefix);

    if (width <= firstLinePrefixWidth) {
      this.cachedWidth = width;
      this.cachedLines = [fullPrefix.trimEnd()];
      return this.cachedLines;
    }

    const mdLines = this.md.render(width - firstLinePrefixWidth);
    let prefixPlaced = false;

    const rendered = mdLines.map((line: string) => {
      if (!prefixPlaced && hasVisibleContent(line)) {
        prefixPlaced = true;
        return `${fullPrefix}${line}`;
      }
      return `${PADDING_PREFIX}${line}`;
    });

    this.cachedWidth = width;
    this.cachedLines = rendered;
    return rendered;
  }
}
