import type { RenderedSegment, SegmentContext } from "../types.js";
import { applyColor } from "../theme.js";
import { color } from "./helpers.js";

interface PlanModeState {
  mode: string;
}

function readPlanModeState(): PlanModeState | undefined {
  return (globalThis as Record<string, unknown>).__planMode as PlanModeState | undefined;
}

export const planModeSegment = {
  id: "plan_mode" as const,
  render(ctx: SegmentContext): RenderedSegment {
    const state = readPlanModeState();
    if (!state) return { content: "", visible: false };

    const label = applyColor(ctx.theme, "dim", "Plan mode:");
    const value = state.mode === "off" ? "OFF" : state.mode === "plan" ? "ON" : state.mode.toUpperCase();

    return { content: `${label} ${color(ctx, "modeIndicator", value)}`, visible: true };
  },
};