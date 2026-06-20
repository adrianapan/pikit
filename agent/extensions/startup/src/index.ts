import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { getKeybindings } from "@earendil-works/pi-tui";
import { readFileSync, existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { discoverLoadedCounts } from "./discovery.js";
import { renderBox } from "./layout.js";
import type { KeyMap } from "./layout.js";

/** Read shortcuts.toggleMode from an extension config; fall back to default. */
function readToggleMode(configName: string, fallback: string): string {
  const path = join(homedir(), ".pi", "agent", "configs", configName);
  try {
    if (existsSync(path)) {
      const cfg = JSON.parse(readFileSync(path, "utf8"));
      const k = cfg?.shortcuts?.toggleMode;
      if (typeof k === "string" && k.trim()) return k.trim();
    }
  } catch {}
  return fallback;
}

export default function startup(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    const counts = discoverLoadedCounts();
    const kb = getKeybindings();
    const keyMap: KeyMap = {
      "app.model.cycleForward": kb.getKeys("app.model.cycleForward")[0] ?? "ctrl+p",
      "app.thinking.cycle": kb.getKeys("app.thinking.cycle")[0] ?? "shift+tab",
      "chat-mode.toggle": readToggleMode("chat-mode.json", "ctrl+shift+c"),
      "plan-mode.toggle": readToggleMode("plan-mode.json", "ctrl+shift+l"),
    };

    ctx.ui.setHeader((_tui, theme) => ({
      render(termWidth: number): string[] {
        return renderBox(theme, counts, termWidth, keyMap);
      },
      invalidate() {},
    }));
  });
}
