import type { RenderedSegment, SegmentContext } from "../types.js";
import { applyColor } from "../theme.js";
import { color } from "./helpers.js";

interface ChatModeState {
  mode: string;
}

function readChatModeState(): ChatModeState | undefined {
  return (globalThis as Record<string, unknown>).__chatMode as ChatModeState | undefined;
}

export const chatModeSegment = {
  id: "chat_mode" as const,
  render(ctx: SegmentContext): RenderedSegment {
    const state = readChatModeState();
    if (!state) return { content: "", visible: false };

    const label = applyColor(ctx.theme, "dim", "Chat mode:");
    const value = state.mode === "off" ? "OFF" : "ON";

    return { content: `${label} ${color(ctx, "modeIndicator", value)}`, visible: true };
  },
};