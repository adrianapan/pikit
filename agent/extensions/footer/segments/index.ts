import type { RenderedSegment, SegmentContext, StatusLineSegmentId } from "../types.js";
import { piSegment } from "./pi.js";
import { modelSegment } from "./model.js";
import { pathSegment } from "./path.js";
import { gitSegment } from "./git.js";
import { thinkingSegment } from "./thinking.js";
import { tokenInSegment, tokenOutSegment, tokenTotalSegment, cacheReadSegment, cacheWriteSegment } from "./tokens.js";
import { costSegment } from "./cost.js";
import { contextPctSegment, contextTotalSegment } from "./context.js";
import { separatorSegment } from "./separator.js";
import { cavemanSegment } from "./caveman.js";
import { planModeSegment } from "./plan-mode.js";
import { chatModeSegment } from "./chat-mode.js";

const SEGMENTS = {
  pi: piSegment,
  model: modelSegment,
  path: pathSegment,
  git: gitSegment,
  thinking: thinkingSegment,
  token_in: tokenInSegment,
  token_out: tokenOutSegment,
  token_total: tokenTotalSegment,
  cost: costSegment,
  context_pct: contextPctSegment,
  context_total: contextTotalSegment,
  cache_read: cacheReadSegment,
  cache_write: cacheWriteSegment,
  separator: separatorSegment,
  caveman: cavemanSegment,
  plan_mode: planModeSegment,
  chat_mode: chatModeSegment,
};

export function renderSegment(id: StatusLineSegmentId, ctx: SegmentContext): RenderedSegment {
  if (id.startsWith("text:")) {
    const text = id.slice(5);
    return { content: text, visible: text.length > 0 };
  }

  const segment = SEGMENTS[id as keyof typeof SEGMENTS];
  if (!segment) {
    return { content: "", visible: false };
  }
  return segment.render(ctx);
}
