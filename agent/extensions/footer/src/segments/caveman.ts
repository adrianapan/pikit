import type { RenderedSegment, SegmentContext } from "../types.js";
import { color, withIcon } from "./helpers.js";

// Local mirror of CavemanState — no import dependency on the caveman extension.
// The globalThis contract: caveman extension writes __caveman, footer reads it.
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

    const status = state.enabled ? state.mode : "off";
    const content = withIcon(ctx.icons.caveman, `Caveman: ${status.toUpperCase()}`);
    return { content: color(ctx, "caveman", content), visible: true };
  },
};
