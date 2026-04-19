import type { RenderedSegment, SegmentContext } from "../types.js";
import { applyColor } from "../theme.js";

const LEVEL_TEXT: Record<string, string> = {
  off: "Off",
  minimal: "Min",
  low: "Low",
  medium: "Med",
  high: "High",
  xhigh: "Extra High",
};

const LEVEL_COLOR: Record<string, string> = {
  off: "dim",
  minimal: "muted",
  low: "muted",
  medium: "warning",
  high: "error",
  xhigh: "error",
};

export const thinkingSegment = {
  id: "thinking" as const,
  render(ctx: SegmentContext): RenderedSegment {
    const level = ctx.thinkingLevel || "off";
    const opts = ctx.options.thinking ?? {};

    const label = LEVEL_TEXT[level] || level;
    const textColor = LEVEL_COLOR[level] ?? "muted";

    const prefix = opts.prefix ?? "";
    const text = prefix ? `${prefix}${label}` : label;
    const icon = ctx.icons.thinking ? applyColor(ctx.theme, textColor as any, ctx.icons.thinking) : "";
    const coloredText = applyColor(ctx.theme, textColor as any, text);
    const content = icon ? `${icon} ${coloredText}` : coloredText;

    return { content, visible: true };
  },
};
