import type { RenderedSegment, SegmentContext } from "../types.js";
import { applyColor } from "../theme.js";
import { color } from "./helpers.js";

export const modelSegment = {
  id: "model" as const,
  render(ctx: SegmentContext): RenderedSegment {
    let modelName = ctx.model?.name || ctx.model?.id || "no-model";

    if (modelName.startsWith("Claude ")) {
      modelName = modelName.slice(7);
    }

    let content = color(ctx, "model", modelName);

    if (ctx.model?.provider) {
      content += ` ${applyColor(ctx.theme, "dim", `(${ctx.model.provider})`)}`;
    }

    return { content, visible: true };
  },
};
