import type { RenderedSegment, SegmentContext } from "../types.js";

export const separatorSegment = {
  id: "separator" as const,
  render(ctx: SegmentContext): RenderedSegment {
    return { content: ctx.icons.separator, visible: true };
  },
};
