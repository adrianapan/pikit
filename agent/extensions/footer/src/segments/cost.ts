import type { RenderedSegment, SegmentContext } from "../types.js";
import { applyColor } from "../theme.js";

export const costSegment = {
  id: "cost" as const,
  render(ctx: SegmentContext): RenderedSegment {
    const { cost } = ctx.usageStats;
    const value = cost.toFixed(2);
    const costDisplay = applyColor(ctx.theme, "dim", `${ctx.icons.cost}${value}`);

    if (ctx.isLocalModel) {
      const suffix = applyColor(ctx.theme, "dim", " (local model)");
      return { content: costDisplay + suffix, visible: true };
    }

    return { content: costDisplay, visible: true };
  },
};
