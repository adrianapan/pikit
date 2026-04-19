import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { cwd as osCwd } from "node:process";
import { getRecentSessions, discoverLoadedCounts } from "./discovery.js";
import { renderBox } from "./layout.js";

export default function slopStartup(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    const model = ctx.model as any;
    const rawName = model?.name || model?.id || "unknown";
    // If id is "provider/model", split it
    const slashIdx = rawName.indexOf("/");
    const modelName = slashIdx >= 0 ? rawName.slice(slashIdx + 1) : rawName;
    const providerName = model?.provider ?? (slashIdx >= 0 ? rawName.slice(0, slashIdx) : "");

    const recentSessions = getRecentSessions(3);
    const counts = discoverLoadedCounts();
    const cwd = osCwd();

    ctx.ui.setHeader((_tui, theme) => ({
      render(termWidth: number): string[] {
        return renderBox(theme, modelName, providerName, cwd, recentSessions, counts, termWidth);
      },
      invalidate() {},
    }));
  });
}
