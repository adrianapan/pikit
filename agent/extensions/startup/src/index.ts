import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { discoverLoadedCounts } from "./discovery.js";
import { renderBox } from "./layout.js";

export default function slopStartup(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    const counts = discoverLoadedCounts();

    ctx.ui.setHeader((_tui, theme) => ({
      render(termWidth: number): string[] {
        return renderBox(theme, counts, termWidth);
      },
      invalidate() {},
    }));
  });
}
