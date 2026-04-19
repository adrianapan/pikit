import type { RenderedSegment, SegmentContext } from "../types.js";
import { color, withIcon, formatTokens } from "./helpers.js";

export const contextPctSegment = {
  id: "context_pct" as const,
  render(ctx: SegmentContext): RenderedSegment {
    const pct = ctx.contextPercent;
    const window = ctx.contextWindow;
    const opts = ctx.options.context_pct ?? {};

    const showAuto = opts.showAutoIcon !== false && ctx.icons.auto;
    const autoIcon = ctx.autoCompactEnabled && showAuto ? ` ${ctx.icons.auto}` : "";
    const text = `${pct.toFixed(1)}%/${formatTokens(window)}${autoIcon}`;

    let content: string;
    if (pct > 90) {
      content = withIcon(ctx.icons.contextPct, color(ctx, "contextError", text));
    } else if (pct > 70) {
      content = withIcon(ctx.icons.contextPct, color(ctx, "contextWarn", text));
    } else {
      content = withIcon(ctx.icons.contextPct, color(ctx, "context", text));
    }

    return { content, visible: true };
  },
};

export const contextTotalSegment = {
  id: "context_total" as const,
  render(ctx: SegmentContext): RenderedSegment {
    const window = ctx.contextWindow;
    if (!window) return { content: "", visible: false };
    return {
      content: color(ctx, "context", withIcon(ctx.icons.contextTotal, formatTokens(window))),
      visible: true,
    };
  },
};
