import type { RenderedSegment, SegmentContext } from "../types.js";
import { color, withIcon, formatTokens } from "./helpers.js";

function renderTokenSegment(
  ctx: SegmentContext,
  value: number,
  textLabel: string,
  icon: string,
  mode: "icons" | "text"
): RenderedSegment {
  const formatted = color(ctx, "tokens", formatTokens(value));
  const content = mode === "text" ? `${textLabel}${formatted}` : withIcon(icon, formatted);
  return { content, visible: true };
}

export const tokenInSegment = {
  id: "token_in" as const,
  render(ctx: SegmentContext): RenderedSegment {
    return renderTokenSegment(ctx, ctx.usageStats.input, "In: ", ctx.icons.input, ctx.options.token_in?.mode ?? "icons");
  },
};

export const tokenOutSegment = {
  id: "token_out" as const,
  render(ctx: SegmentContext): RenderedSegment {
    return renderTokenSegment(ctx, ctx.usageStats.output, "Out: ", ctx.icons.output, ctx.options.token_out?.mode ?? "icons");
  },
};

export const tokenTotalSegment = {
  id: "token_total" as const,
  render(ctx: SegmentContext): RenderedSegment {
    const { input, output, cacheRead, cacheWrite } = ctx.usageStats;
    return renderTokenSegment(ctx, input + output + cacheRead + cacheWrite, "Tokens: ", ctx.icons.tokens, ctx.options.token_total?.mode ?? "icons");
  },
};

export const cacheReadSegment = {
  id: "cache_read" as const,
  render(ctx: SegmentContext): RenderedSegment {
    const { cacheRead } = ctx.usageStats;
    if (!cacheRead) return { content: "", visible: false };
    const content = withIcon(ctx.icons.cacheRead, color(ctx, "tokens", formatTokens(cacheRead)));
    return { content, visible: true };
  },
};

export const cacheWriteSegment = {
  id: "cache_write" as const,
  render(ctx: SegmentContext): RenderedSegment {
    const { cacheWrite } = ctx.usageStats;
    if (!cacheWrite) return { content: "", visible: false };
    const content = withIcon(ctx.icons.cacheWrite, color(ctx, "tokens", formatTokens(cacheWrite)));
    return { content, visible: true };
  },
};
