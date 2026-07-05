import type { RenderedSegment, SegmentContext } from "../types.js";
import { applyColor } from "../theme.js";
import { color } from "./helpers.js";

export const costSegment = {
  id: "cost" as const,
  render(ctx: SegmentContext): RenderedSegment {
    const { cost } = ctx.usageStats;
    const content = color(ctx, "cost", `$${cost.toFixed(2)}`);

    if (ctx.isLocalModel) {
      return { content: content + applyColor(ctx.theme, "dim", " (local model)"), visible: true };
    }

    return { content, visible: true };
  },
};
