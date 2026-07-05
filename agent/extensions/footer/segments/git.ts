import type { RenderedSegment, SegmentContext } from "../types.js";
import { applyColor } from "../theme.js";
import { color, withIcon } from "./helpers.js";

export const gitSegment = {
  id: "git" as const,
  render(ctx: SegmentContext): RenderedSegment {
    const opts = ctx.options.git ?? {};
    const { branch, staged, unstaged, untracked } = ctx.git;

    if (!branch && staged === 0 && unstaged === 0 && untracked === 0) {
      return { content: "", visible: false };
    }

    const isDirty = staged > 0 || unstaged > 0 || untracked > 0;
    const showBranch = opts.showBranch !== false;
    const branchColor = isDirty ? "gitDirty" : "gitClean";

    let content = "";
    if (showBranch && branch) {
      content = color(ctx, branchColor, withIcon(ctx.icons.branch, branch));
    }

    const indicators: string[] = [];
    if (opts.showUnstaged !== false && unstaged > 0) {
      indicators.push(applyColor(ctx.theme, "warning", `*${unstaged}`));
    }
    if (opts.showStaged !== false && staged > 0) {
      indicators.push(applyColor(ctx.theme, "success", `+${staged}`));
    }
    if (opts.showUntracked !== false && untracked > 0) {
      indicators.push(applyColor(ctx.theme, "muted", `?${untracked}`));
    }

    if (indicators.length > 0) {
      const indicatorText = indicators.join(" ");
      if (!content && showBranch === false) {
        content = color(ctx, branchColor, ctx.icons.git ? `${ctx.icons.git} ` : "") + indicatorText;
      } else {
        content += content ? ` ${indicatorText}` : indicatorText;
      }
    }

    if (!content) return { content: "", visible: false };
    return { content, visible: true };
  },
};
