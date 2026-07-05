import type { RenderedSegment, SegmentContext } from "../types.js";
import { color } from "./helpers.js";

export const piSegment = {
  id: "pi" as const,
  render(ctx: SegmentContext): RenderedSegment {
    if (!ctx.icons.pi) return { content: "", visible: false };
    const content = `${ctx.icons.pi} `;
    return { content: color(ctx, "pi", content), visible: true };
  },
};
