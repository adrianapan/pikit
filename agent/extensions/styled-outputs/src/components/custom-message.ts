import { Markdown } from "@earendil-works/pi-tui";
import { CONFIG } from "../config.js";
import { getVisibleWidth, currentTheme, applyColor, getExpandToggleKey } from "../utils.js";
import { branchLine, indentLine } from "./tool-shared.js";

const CUSTOM_PREFIX_WIDTH = getVisibleWidth(CONFIG.customMessages.prefix) + 2;

export interface CustomMessageRenderable {
  setExpanded(value: boolean): void;
  invalidate(): void;
  render(width: number): string[];
}

export function createCustomMessage(
  customType: string,
  content: string,
  details: unknown,
  markdownTheme: any,
): CustomMessageRenderable {
  const md = new Markdown(content, 0, 0, markdownTheme);
  let expanded = false;
  let cachedWidth: number | undefined;
  let cachedExpanded: boolean | undefined;
  let cachedLines: string[] | undefined;

  function setExpanded(value: boolean): void {
    if (expanded !== value) {
      expanded = value;
      invalidate();
    }
  }

  function invalidate(): void {
    cachedWidth = undefined;
    cachedExpanded = undefined;
    cachedLines = undefined;
    md.invalidate();
  }

  function render(width: number): string[] {
    if (cachedLines && cachedWidth === width && cachedExpanded === expanded) return cachedLines;

    const t = currentTheme!;

    // Line 1: " ● Custom tool  custom-type-name"
    const dot = applyColor(t, CONFIG.customMessages.prefixColor, CONFIG.customMessages.prefix);
    const label = applyColor(t, CONFIG.customMessages.titleColor, t.bold("Custom tool"));
    const displayName = (details && typeof details === 'object' && 'title' in details && typeof (details as any).title === 'string')
      ? (details as any).title
      : customType;
    const name = applyColor(t, CONFIG.customMessages.nameColor, displayName);
    const header = ` ${dot} ${label}  ${name}`;

    // Line 2: branch + status
    const loaded = applyColor(t, CONFIG.customMessages.labelColor, "Done");

    if (!expanded) {
      cachedWidth = width;
      cachedExpanded = expanded;
      const hint = applyColor(t, CONFIG.customMessages.expandHintColor, ` • ${getExpandToggleKey()} to expand`);
      cachedLines = ["", header, branchLine(loaded, t) + hint];
      return cachedLines;
    }

    // Expanded: header + branch + indented markdown content
    const lines: string[] = [header, branchLine(loaded, t)];

    if (width > CUSTOM_PREFIX_WIDTH) {
      const mdLines = md.render(width - CUSTOM_PREFIX_WIDTH);
      for (const line of mdLines) {
        lines.push(indentLine(applyColor(t, CONFIG.customMessages.outputColor, line)));
      }
    }

    // Render details as pretty-printed JSON if present
    if (details !== undefined && details !== null) {
      try {
        const json = JSON.stringify(details, null, 2);
        for (const line of json.split("\n")) {
          lines.push(indentLine(applyColor(t, CONFIG.customMessages.outputColor, line)));
        }
      } catch {
        // Skip non-serializable details
      }
    }

    cachedWidth = width;
    cachedExpanded = expanded;
    cachedLines = lines;
    return cachedLines;
  }

  return { setExpanded, invalidate, render };
}