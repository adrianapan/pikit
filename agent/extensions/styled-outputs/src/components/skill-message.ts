import { Markdown } from "@mariozechner/pi-tui";
import { CONFIG } from "../config.js";
import { getVisibleWidth, currentTheme, applyColor, getExpandToggleKey } from "../utils.js";
import { branchLine, indentLine } from "./tool-shared.js";

const SKILL_PREFIX_WIDTH = getVisibleWidth(CONFIG.skills.prefix) + 2;

export interface SkillInvocationMessage {
  setExpanded(value: boolean): void;
  invalidate(): void;
  render(width: number): string[];
}

export function createSkillInvocationMessage(
  skillName: string,
  skillContent: string,
  markdownTheme: any,
): SkillInvocationMessage {
  const md = new Markdown(skillContent, 0, 0, markdownTheme);
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

    // Line 1: " ● Skill  skill-name"
    const dot = applyColor(t, CONFIG.skills.prefixColor, CONFIG.skills.prefix);
    const label = applyColor(t, CONFIG.skills.titleColor, t.bold("Skill"));
    const name = applyColor(t, CONFIG.skills.nameColor, skillName);
    const header = ` ${dot} ${label}  ${name}`;

    // Line 2: branch + status
    const loaded = applyColor(t, CONFIG.skills.labelColor, "Loaded");

    if (!expanded) {
      cachedWidth = width;
      cachedExpanded = expanded;
      const hint = applyColor(t, CONFIG.skills.expandHintColor, ` • ${getExpandToggleKey()} to expand`);
      cachedLines = [header, branchLine(loaded, t) + hint];
      return cachedLines;
    }

    // Expanded: header + branch + indented markdown content
    const lines: string[] = [header, branchLine(loaded, t)];

    if (width > SKILL_PREFIX_WIDTH) {
      const mdLines = md.render(width - SKILL_PREFIX_WIDTH);
      for (const line of mdLines) {
        lines.push(indentLine(applyColor(t, CONFIG.skills.outputColor, line)));
      }
    }

    cachedWidth = width;
    cachedExpanded = expanded;
    cachedLines = lines;
    return cachedLines;
  }

  return { setExpanded, invalidate, render };
}