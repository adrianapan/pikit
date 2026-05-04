import { Markdown } from "@mariozechner/pi-tui";
import { CONFIG } from "../config.js";
import { getVisibleWidth, hasVisibleContent } from "../utils.js";

const DOT_PREFIX_WIDTH = getVisibleWidth(CONFIG.DOT_PREFIX) + 2;
const PADDING_PREFIX = " ".repeat(DOT_PREFIX_WIDTH);

export class AssistantMessage {
  private md: InstanceType<typeof Markdown>;
  private cachedWidth?: number;
  private cachedLines?: string[];

  constructor(text: string, markdownTheme: any) {
    this.md = new Markdown(text, 0, 0, markdownTheme);
  }

  invalidate(): void {
    this.cachedWidth = undefined;
    this.cachedLines = undefined;
    this.md.invalidate();
  }

  render(width: number): string[] {
    if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;

    if (width <= DOT_PREFIX_WIDTH) {
      this.cachedWidth = width;
      this.cachedLines = [` ${CONFIG.DOT_PREFIX} `];
      return this.cachedLines;
    }

    const mdLines = this.md.render(width - DOT_PREFIX_WIDTH);
    let dotPlaced = false;

    const rendered = mdLines.map((line: string) => {
      if (!dotPlaced && hasVisibleContent(line)) {
        dotPlaced = true;
        return ` ${CONFIG.DOT_PREFIX} ${line}`;
      }
      return `${PADDING_PREFIX}${line}`;
    });

    this.cachedWidth = width;
    this.cachedLines = rendered;
    return rendered;
  }
}
