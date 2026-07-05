import type { RenderedSegment, SegmentContext } from "../types.js";
import { applyColor } from "../theme.js";
import { color } from "./helpers.js";

interface CavemanState {
  enabled: boolean;
  mode: string;
}

function readCavemanState(): CavemanState | undefined {
  return (globalThis as Record<string, unknown>).__caveman as CavemanState | undefined;
}

export const cavemanSegment = {
  id: "caveman" as const,
  render(ctx: SegmentContext): RenderedSegment {
    const state = readCavemanState();
    if (!state) return { content: "", visible: false };

    const label = applyColor(ctx.theme, "dim", "Caveman mode:");
    const value = state.enabled ? state.mode.toUpperCase() : "OFF";

    return { content: `${label} ${color(ctx, "modeIndicator", value)}`, visible: true };
  },
};
