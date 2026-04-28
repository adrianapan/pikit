import type { RenderedSegment, SegmentContext, SemanticColor } from "../types.js";
import { applyColor, rainbow } from "../theme.js";

const LEVEL_TEXT: Record<string, string> = {
  off: "Off",
  minimal: "Min",
  low: "Low",
  medium: "Med",
  high: "High",
  xhigh: "Extra High",
  max: "Max",
};

// Per-level semantic color keys in the color scheme
const LEVEL_COLOR_KEY: Record<string, SemanticColor> = {
  off: "thinkingOff",
  minimal: "thinkingMinimal",
  low: "thinkingLow",
  medium: "thinkingMedium",
  high: "thinkingHigh",
  xhigh: "thinkingXhigh",
  max: "thinkingMax",
};

// Fallback defaults — used when the user hasn't configured a per-level color
const LEVEL_COLOR_FALLBACK: Record<string, string> = {
  off: "dim",
  minimal: "muted",
  low: "warning",
  medium: "success",
  high: "#afb9fe",
  xhigh: "#9575cd",
  max: "error",
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
    const useRainbow = level === "xhigh" || level === "max";
    const icon = ctx.icons.thinking
      ? applyColor(ctx.theme, textColor as any, ctx.icons.thinking)
      : "";
    const coloredText = useRainbow ? rainbow(text) : applyColor(ctx.theme, textColor as any, text);
    const content = icon ? `${icon} ${coloredText}` : coloredText;

    return { content, visible: true };
  },
};
