import type { RenderedSegment, SegmentContext, SemanticColor } from "../types.js";
import { applyColor } from "../theme.js";

const LEVEL_TEXT: Record<string, string> = {
  off: "Off",
  minimal: "Min",
  low: "Low",
  medium: "Med",
  high: "High",
  xhigh: "Extra High",
};

// Per-level semantic color keys in the color scheme
const LEVEL_COLOR_KEY: Record<string, SemanticColor> = {
  off: "thinkingOff",
  minimal: "thinkingMinimal",
  low: "thinkingLow",
  medium: "thinkingMedium",
  high: "thinkingHigh",
  xhigh: "thinkingXhigh",
};

// Fallback defaults — used when the user hasn't configured a per-level color
const LEVEL_COLOR_FALLBACK: Record<string, string> = {
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

    // Try the user-configured per-level color first, fall back to hardcoded default
    const colorKey = LEVEL_COLOR_KEY[level];
    const configured = colorKey !== undefined ? ctx.colors[colorKey] : undefined;
    const textColor = configured ?? LEVEL_COLOR_FALLBACK[level] ?? "muted";

    const prefix = opts.prefix ?? "";
    const text = prefix ? `${prefix}${label}` : label;
    const icon = ctx.icons.thinking ? applyColor(ctx.theme, textColor as any, ctx.icons.thinking) : "";
    const coloredText = applyColor(ctx.theme, textColor as any, text);
    const content = icon ? `${icon} ${coloredText}` : coloredText;

    return { content, visible: true };
  },
};
