import type { RenderedSegment, SegmentContext } from "../types.js";
import { applyColor } from "../theme.js";
import { color } from "./helpers.js";

export const costSegment = {
  id: "cost" as const,
  render(ctx: SegmentContext): RenderedSegment {
    const { cost } = ctx.usageStats;
    const costDisplay = `$${cost.toFixed(2)}`;

    if (!ctx.usingSubscription) {
      const suffix = applyColor(ctx.theme, "dim", " (local model)");
      return { content: color(ctx, "cost", costDisplay) + suffix, visible: true };
    }

    return { content: color(ctx, "cost", costDisplay), visible: true };
  },
};
