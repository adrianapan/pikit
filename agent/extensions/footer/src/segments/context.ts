import type { RenderedSegment, SegmentContext } from "../types.js";
import { applyColor, resolveColorToRgb } from "../theme.js";
import { color } from "./helpers.js";
import { formatTokens } from "./helpers.js";

// Set to a number (0–100) to override context % for visual testing, null to disable
const DEBUG_PCT: number | null = 75;

const DEFAULT_BAR_WIDTH     = 18;
const DEFAULT_FILLED_CHAR   = "▋";
const DEFAULT_UNFILLED_CHAR = "▋";
const DEFAULT_UNFILLED_COLOR = "#4e4c49";
const DEFAULT_START = { r: 0xf2, g: 0x93, b: 0x73 };
const DEFAULT_MID   = { r: 0xd6, g: 0x78, b: 0x58 };
const DEFAULT_END   = { r: 0xae, g: 0x4f, b: 0x2f };
const DEFAULT_MID_FRAC = 0.55; // 0–1: where MID sits along the gradient

function lerp(a: number, b: number, t: number): number {
  return Math.round(a + (b - a) * t);
}

function positionColor(
  pos: number,
  barWidth: number,
  start: { r: number; g: number; b: number },
  mid: { r: number; g: number; b: number },
  end: { r: number; g: number; b: number },
  midFrac: number,
): string {
  const t = pos / Math.max(barWidth - 1, 1);
  let r: number, g: number, b: number;
  if (t <= midFrac) {
    const f = t / midFrac;
    r = lerp(start.r, mid.r, f);
    g = lerp(start.g, mid.g, f);
    b = lerp(start.b, mid.b, f);
  } else {
    const f = (t - midFrac) / (1 - midFrac);
    r = lerp(mid.r, end.r, f);
    g = lerp(mid.g, end.g, f);
    b = lerp(mid.b, end.b, f);
  }
  return `\x1b[38;2;${r};${g};${b}m`;
}

export const contextPctSegment = {
  id: "context_pct" as const,
  render(ctx: SegmentContext): RenderedSegment {
    const pct = DEBUG_PCT ?? ctx.contextPercent;
    const barOpts = ctx.options.contextBar ?? {};

    const barWidth     = barOpts.barWidth     ?? DEFAULT_BAR_WIDTH;
    const filledChar   = barOpts.filledChar   ?? DEFAULT_FILLED_CHAR;
    const unfilledChar = barOpts.unfilledChar ?? DEFAULT_UNFILLED_CHAR;
    const unfilledColor = barOpts.unfilledColor ?? DEFAULT_UNFILLED_COLOR;
    const start   = (barOpts.gradientStart ? resolveColorToRgb(ctx.theme, barOpts.gradientStart) : null) ?? DEFAULT_START;
    const mid     = (barOpts.gradientMid   ? resolveColorToRgb(ctx.theme, barOpts.gradientMid)   : null) ?? DEFAULT_MID;
    const end     = (barOpts.gradientEnd   ? resolveColorToRgb(ctx.theme, barOpts.gradientEnd)   : null) ?? DEFAULT_END;
    const midFrac = barOpts.gradientMidPoint ?? DEFAULT_MID_FRAC;

    const filled = Math.round((pct / 100) * barWidth);

    let bar = "";
    for (let i = 0; i < barWidth; i++) {
      if (i < filled) {
        bar += positionColor(i, barWidth, start, mid, end, midFrac) + filledChar;
      } else {
        bar += applyColor(ctx.theme, unfilledColor, unfilledChar);
      }
    }
    bar += "\x1b[0m";

    const pctLabel = `${pct.toFixed(1)}%`;
    const pctStr = color(ctx, "contextLabel", pctLabel);
    const tokensLabel = `/ ${formatTokens(ctx.contextWindow)}`;
    const tokensStr = color(ctx, "contextLabel", tokensLabel);

    return { content: `${bar} ${pctStr} ${tokensStr}`, visible: true };
  },
};

export const contextTotalSegment = {
  id: "context_total" as const,
  render(ctx: SegmentContext): RenderedSegment {
    const window = ctx.contextWindow;
    if (!window) return { content: "", visible: false };
    return {
      content: color(ctx, "context", `${window}`),
      visible: true,
    };
  },
};
