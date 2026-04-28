import type { ExtensionAPI, ReadonlyFooterDataProvider, Theme, AssistantMessage, ExtensionContext } from "@mariozechner/pi-coding-agent";
import { visibleWidth, truncateToWidth } from "@mariozechner/pi-tui";
import type { TUI } from "@mariozechner/pi-tui";

import type { SegmentContext, StatusLineSegmentId, UsageStats, SessionEvent, ThinkingLevelEvent, AssistantMessageEvent, ToolResultEvent, UserBashEvent } from "./types.js";
import { renderSegment } from "./segments/index.js";
import { getGitStatus, invalidateGitStatus, invalidateGitBranch } from "./git-status.js";
import { getEffectiveConfig } from "./config.js";
import { getIcons } from "./icons.js";
import { getDefaultColors } from "./theme.js";

const GIT_BRANCH_PATTERNS: RegExp[] = [
  /\bgit\s+(checkout|switch|branch\s+-[dDmM]|merge|rebase|pull|reset|worktree)/,
  /\bgit\s+stash\s+(pop|apply)/,
];

// ═══════════════════════════════════════════════════════════════════════════
// Status Line Builder
// ═══════════════════════════════════════════════════════════════════════════

/** Render a single segment and return its content with width */
function renderSegmentWithWidth(
  segId: StatusLineSegmentId,
  ctx: SegmentContext
): { content: string; width: number; visible: boolean } {
  const rendered = renderSegment(segId, ctx);
  if (!rendered.visible || !rendered.content) {
    return { content: "", width: 0, visible: false };
  }
  return { content: rendered.content, width: visibleWidth(rendered.content), visible: true };
}

/**
 * Build footer content from left and right segments.
 * Left segments are left-aligned, right segments are right-aligned.
 */
function buildFooterContent(
  ctx: SegmentContext,
  leftSegments: StatusLineSegmentId[],
  rightSegments: StatusLineSegmentId[],
  availableWidth: number,
): string {
  const maxContentWidth = Math.max(0, availableWidth - 2);

  // Render left segments
  const leftParts: string[] = [];
  for (const segId of leftSegments) {
    const { content, visible } = renderSegmentWithWidth(segId, ctx);
    if (visible) {
      leftParts.push(content);
    }
  }

  // Render right segments
  const rightParts: string[] = [];
  let rightWidth = 0;
  for (const segId of rightSegments) {
    const { content, width, visible } = renderSegmentWithWidth(segId, ctx);
    if (visible) {
      rightParts.push(content);
      rightWidth += width + 1; // +1 for space between
    }
  }
  if (rightParts.length > 0) {
    rightWidth -= 1; // Remove trailing space
  }

  let leftStr = leftParts.join(" ");
  let rightStr = rightParts.join(" ");

  // Handle case with no right segments
  if (rightParts.length === 0) {
    const finalLeft = truncateToWidth(leftStr, maxContentWidth);
    return " " + finalLeft + " ".repeat(Math.max(0, maxContentWidth - visibleWidth(finalLeft))) + " ";
  }

  // If right side alone is too big, just show right side
  if (rightWidth >= maxContentWidth) {
    return " " + truncateToWidth(rightStr, maxContentWidth) + " ";
  }

  // Ensure at least 1 space between left and right
  const maxLeftWidth = maxContentWidth - rightWidth - 1;
  const finalLeft = truncateToWidth(leftStr, Math.max(0, maxLeftWidth));
  const finalLeftWidth = visibleWidth(finalLeft);

  const padding = maxContentWidth - finalLeftWidth - rightWidth;

  const result = " " + finalLeft + " ".repeat(padding) + rightStr + " ";
  return truncateToWidth(result, availableWidth);
}

// ═══════════════════════════════════════════════════════════════════════════
// Extension
// ═══════════════════════════════════════════════════════════════════════════

export default function slopFooter(pi: ExtensionAPI) {
  let sessionStartTime = Date.now();
  let currentCtx: ExtensionContext | null = null;
  let footerDataRef: ReadonlyFooterDataProvider | null = null;
  let getThinkingLevelFn: (() => string) | null = null;
  let tuiRef: TUI | null = null;

  // Track session start
  pi.on("session_start", async (_event: unknown, ctx: ExtensionContext) => {
    sessionStartTime = Date.now();
    currentCtx = ctx;

    if (typeof ctx.getThinkingLevel === 'function') {
      getThinkingLevelFn = () => ctx.getThinkingLevel();
    }

    if (ctx.hasUI) {
      setupFooter(ctx);
    }
  });

  // Invalidate git status on file changes
  pi.on("tool_result", async (event: ToolResultEvent, _ctx: ExtensionContext) => {
    if (event.toolName === "write" || event.toolName === "edit") {
      invalidateGitStatus();
    }
    if (event.toolName === "bash" && event.input?.command) {
      const cmd = String(event.input.command);
      if (GIT_BRANCH_PATTERNS.some(p => p.test(cmd))) {
        invalidateGitStatus();
        invalidateGitBranch();
        setTimeout(() => tuiRef?.requestRender(), 100);
      }
    }
  });

  // Also catch user escape commands (! prefix)
  pi.on("user_bash", async (event: UserBashEvent, _ctx: ExtensionContext) => {
    if (GIT_BRANCH_PATTERNS.some(p => p.test(event.command))) {
      invalidateGitStatus();
      invalidateGitBranch();
      setTimeout(() => tuiRef?.requestRender(), 100);
      setTimeout(() => tuiRef?.requestRender(), 300);
      setTimeout(() => tuiRef?.requestRender(), 500);
    }
  });

  function buildSegmentContext(ctx: ExtensionContext, width: number, theme: Theme): SegmentContext {
    const effectiveConfig = getEffectiveConfig();
    const colors = effectiveConfig.colors ?? getDefaultColors();

    const sessionEvents = (ctx.sessionManager?.getBranch?.() ?? []) as SessionEvent[];

    const isThinkingEvent = (e: SessionEvent): e is ThinkingLevelEvent =>
      e.type === "thinking_level_change";

    const isAssistantMessageEvent = (e: SessionEvent): e is AssistantMessageEvent =>
      e.type === "message" && (e as AssistantMessageEvent).message.role === "assistant";

    const thinkingLevelFromSession = sessionEvents
      .filter(isThinkingEvent)
      .reduce((_, e) => e.thinkingLevel ?? "off", "off");

    const completedMessages = sessionEvents
      .filter(isAssistantMessageEvent)
      .map(e => e.message as AssistantMessage)
      .filter(m => m.stopReason !== "error" && m.stopReason !== "aborted");

    const usageStats = completedMessages.reduce<UsageStats>(
      (acc, m) => ({
        input: acc.input + m.usage.input,
        output: acc.output + m.usage.output,
        cacheRead: acc.cacheRead + m.usage.cacheRead,
        cacheWrite: acc.cacheWrite + m.usage.cacheWrite,
        cost: acc.cost + m.usage.cost.total,
      }),
      { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, cost: 0 },
    );

    const lastAssistant = completedMessages.at(-1);

    // Calculate context percentage
    const contextTokens = lastAssistant
      ? lastAssistant.usage.input + lastAssistant.usage.output +
        lastAssistant.usage.cacheRead + lastAssistant.usage.cacheWrite
      : 0;
    const contextWindow = ctx.model?.contextWindow || 0;
    const contextPercent = contextWindow > 0 ? (contextTokens / contextWindow) * 100 : 0;

    // Get git status (cached)
    const gitBranch = footerDataRef?.getGitBranch() ?? null;
    const gitStatus = getGitStatus(gitBranch);

    // Check if using OAuth subscription
    const usingSubscription = ctx.model
      ? ctx.modelRegistry?.isUsingOAuth?.(ctx.model) ?? false
      : false;

    return {
      model: ctx.model,
      thinkingLevel: thinkingLevelFromSession || getThinkingLevelFn?.() || "off",
      sessionId: ctx.sessionManager?.getSessionId?.(),
      usageStats,
      contextPercent,
      contextWindow,
      autoCompactEnabled: ctx.settingsManager?.getCompactionSettings?.()?.enabled ?? true,
      usingSubscription,
      sessionStartTime,
      git: gitStatus,
      options: effectiveConfig.segmentOptions ?? {},
      width,
      theme,
      colors,
      icons: getIcons(effectiveConfig.icons),
    };
  }

  function setupFooter(ctx: ExtensionContext) {
    ctx.ui.setFooter((tui: TUI, theme: Theme, footerData: ReadonlyFooterDataProvider) => {
      footerDataRef = footerData;
      tuiRef = tui;

      // Subscribe to branch changes for re-render
      const unsub = footerData.onBranchChange(() => tui.requestRender());

      return {
        dispose: unsub,
        invalidate() {},
        render(width: number): string[] {
          if (!currentCtx) return [];

          const effectiveConfig = getEffectiveConfig();
          let segmentCtx;
          try {
            segmentCtx = buildSegmentContext(currentCtx, width, theme);
          } catch {
            return [];
          }

          const content = buildFooterContent(
            segmentCtx,
            effectiveConfig.leftSegments,
            effectiveConfig.rightSegments,
            width,
          );

          return [content];
        },
      };
    });
  }
}
