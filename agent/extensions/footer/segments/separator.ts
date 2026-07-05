import type { RenderedSegment, SegmentContext } from "../types.js";
import { color } from "./helpers.js";

export const separatorSegment = {
  id: "separator" as const,
  render(ctx: SegmentContext): RenderedSegment {
    return { content: color(ctx, "separator", ctx.icons.separator), visible: true };
  },
};
