import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";
import { discoverLoadedCounts } from "./discovery.js";
import { renderBox } from "./layout.js";
import type { KeyMap } from "./layout.js";

const DEFAULT_KEYS: KeyMap = {
  "app.model.cycleForward": "ctrl+p",
  "app.thinking.cycle": "shift+tab",
};

function loadKeyMap(): KeyMap {
  const configPath = join(homedir(), ".pi", "agent", "keybindings.json");
  if (!existsSync(configPath)) return DEFAULT_KEYS;
  try {
    const raw = JSON.parse(readFileSync(configPath, "utf-8"));
    return {
      "app.model.cycleForward": raw["app.model.cycleForward"] ?? DEFAULT_KEYS["app.model.cycleForward"],
      "app.thinking.cycle": raw["app.thinking.cycle"] ?? DEFAULT_KEYS["app.thinking.cycle"],
    };
  } catch {
    return DEFAULT_KEYS;
  }
}

export default function startup(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    const counts = discoverLoadedCounts();
    const keyMap = loadKeyMap();

    ctx.ui.setHeader((_tui, theme) => ({
      render(termWidth: number): string[] {
        return renderBox(theme, counts, termWidth, keyMap);
      },
      invalidate() {},
    }));
  });
}
