import type { RenderedSegment, SegmentContext } from "../types.js";
import { applyColor } from "../theme.js";
import { color, formatTokens } from "./helpers.js";

function lbl(ctx: SegmentContext, text: string): string {
  return applyColor(ctx.theme, "dim", text);
}

function val(ctx: SegmentContext, text: string): string {
  return color(ctx, "tokens", text);
}

export const tokenTotalSegment = {
  id: "token_total" as const,
  render(ctx: SegmentContext): RenderedSegment {
    const { input, output, cacheRead, cacheWrite } = ctx.usageStats;
    const total = input + output + cacheRead + cacheWrite;
    const cached = cacheRead + cacheWrite;

    const content =
      lbl(ctx, "T:") + " " + val(ctx, formatTokens(total)) +
      " " + lbl(ctx, "(") + val(ctx, formatTokens(cached)) + lbl(ctx, " cached)") +
      " " + lbl(ctx, "↑") + " " + val(ctx, formatTokens(input)) +
      " " + lbl(ctx, "↓") + " " + val(ctx, formatTokens(output));

    return { content, visible: true };
  },
};

export const tokenInSegment = {
  id: "token_in" as const,
  render(ctx: SegmentContext): RenderedSegment {
    return {
      content: lbl(ctx, "↑") + " " + val(ctx, formatTokens(ctx.usageStats.input)),
      visible: true,
    };
  },
};

export const tokenOutSegment = {
  id: "token_out" as const,
  render(ctx: SegmentContext): RenderedSegment {
    return {
      content: lbl(ctx, "↓") + " " + val(ctx, formatTokens(ctx.usageStats.output)),
      visible: true,
    };
  },
};

export const cacheReadSegment = {
  id: "cache_read" as const,
  render(ctx: SegmentContext): RenderedSegment {
    const { cacheRead } = ctx.usageStats;
    if (!cacheRead) return { content: "", visible: false };
    return { content: val(ctx, formatTokens(cacheRead)), visible: true };
  },
};

export const cacheWriteSegment = {
  id: "cache_write" as const,
  render(ctx: SegmentContext): RenderedSegment {
    const { cacheWrite } = ctx.usageStats;
    if (!cacheWrite) return { content: "", visible: false };
    return { content: val(ctx, formatTokens(cacheWrite)), visible: true };
  },
};
