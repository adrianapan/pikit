import { basename } from "node:path";
import type { RenderedSegment, SegmentContext } from "../types.js";
import { color, withIcon } from "./helpers.js";

export const pathSegment = {
  id: "path" as const,
  render(ctx: SegmentContext): RenderedSegment {
    const opts = ctx.options.path ?? {};
    const mode = opts.mode ?? "basename";

    let pwd = process.cwd();
    const home = process.env.HOME || process.env.USERPROFILE;

    if (mode === "basename") {
      pwd = basename(pwd) || pwd;
    } else {
      if (home && pwd.startsWith(home)) {
        pwd = `~${pwd.slice(home.length)}`;
      }
      if (pwd.startsWith("/work/")) {
        pwd = pwd.slice(6);
      }
      if (mode === "abbreviated") {
        const maxLen = opts.maxLength ?? 40;
        if (pwd.length > maxLen) {
          pwd = `…${pwd.slice(-(maxLen - 1))}`;
        }
      }
    }

    const content = withIcon(ctx.icons.folder, pwd);
    return { content: color(ctx, "path", content), visible: true };
  },
};
