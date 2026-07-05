import type { RenderedSegment, SegmentContext, SemanticColor } from "../types.js";
import { applyColor, rainbow } from "../theme.js";

const LEVEL_CAPS: Record<string, string> = {
  off: "OFF",
  minimal: "MINIMAL",
  low: "LOW",
  medium: "MEDIUM",
  high: "HIGH",
  xhigh: "EXTRA HIGH",
  max: "MAX",
};

const LEVEL_COLOR_KEY: Record<string, SemanticColor> = {
  off: "thinkingOff",
  minimal: "thinkingMinimal",
  low: "thinkingLow",
  medium: "thinkingMedium",
  high: "thinkingHigh",
  // xhigh/max absent from DEFAULT_COLORS — presence here enables user override
  xhigh: "thinkingXhigh",
  max: "thinkingMax",
};

const LEVEL_COLOR_FALLBACK: Record<string, string> = {
  off: "dim",
  minimal: "muted",
  low: "warning",
  medium: "success",
  high: "#afb9fe",
};

export const thinkingSegment = {
  id: "thinking" as const,
  render(ctx: SegmentContext): RenderedSegment {
    const level = ctx.thinkingLevel || "off";

    const label = applyColor(ctx.theme, "dim", "Thinking:");
    const text = LEVEL_CAPS[level] || level.toUpperCase();

    const colorKey = LEVEL_COLOR_KEY[level];
    const configured = colorKey !== undefined ? ctx.colors[colorKey] : undefined;
    const textColor = configured ?? LEVEL_COLOR_FALLBACK[level] ?? "muted";

    // Rainbow is the default for xhigh/max; an explicit color config overrides it
    const useRainbow = !configured && (level === "xhigh" || level === "max");
    const coloredText = useRainbow ? rainbow(text) : applyColor(ctx.theme, textColor as any, text);

    return { content: `${label} ${coloredText}`, visible: true };
  },
};
