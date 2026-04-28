import type { RenderedSegment, SegmentContext } from "../types.js";
import { hasNerdFonts } from "../icons.js";
import { color, withIcon } from "./helpers.js";
import { applyColor } from "../theme.js";

const SEP_DOT = " · ";

const THINKING_TEXT_NERD: Record<string, string> = {
  minimal: "\u{F0E7} min",
  low: "\u{F10C} low",
  medium: "\u{F192} med",
  high: "\u{F111} high",
  xhigh: "\u{F06D} xhi",
};

const THINKING_TEXT_ASCII: Record<string, string> = {
  minimal: "[min]",
  low: "[low]",
  medium: "[med]",
  high: "[high]",
  xhigh: "[xhi]",
};

const THINKING_TEXT = hasNerdFonts() ? THINKING_TEXT_NERD : THINKING_TEXT_ASCII;

function getThinkingText(level: string): string | undefined {
  return THINKING_TEXT[level];
}

function getProviderLabel(provider: string | undefined): string | undefined {
  if (!provider) return undefined;
  return `(${provider})`;
}

export const modelSegment = {
  id: "model" as const,
  render(ctx: SegmentContext): RenderedSegment {
    const opts = ctx.options.model ?? {};
    let modelName = ctx.model?.name || ctx.model?.id || "no-model";

    if (modelName.startsWith("Claude ")) {
      modelName = modelName.slice(7);
    }

    let content = withIcon(ctx.icons.model, modelName);

    const providerLabel = getProviderLabel(ctx.model?.provider);
    if (providerLabel) {
      content += ` ${applyColor(ctx.theme, "dim", providerLabel)}`;
    }

    if (opts.showThinkingLevel !== false && ctx.model?.reasoning) {
      const level = ctx.thinkingLevel || "off";
      if (level !== "off") {
        const thinkingText = getThinkingText(level);
        if (thinkingText) {
          content += `${SEP_DOT}${thinkingText}`;
        }
      }
    }

    return { content: color(ctx, "model", content), visible: true };
  },
};
