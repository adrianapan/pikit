/**
 * Permission Gate Extension
 *
 * Intercepts bash tool calls and prompts for confirmation before running
 * commands that match dangerous patterns (rm -rf, sudo, chmod/chown 777).
 *
 * Patterns are configurable via ~/.pi/agent/configs/permission-gate.json.
 * When no config is present the three built-in defaults apply.
 *
 * Config location:
 *   ~/.pi/agent/configs/permission-gate.json
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { Container, SelectList, Spacer, Text, type SelectItem } from "@earendil-works/pi-tui";
import { loadConfig } from "./config.js";

export default function permissionGateExtension(pi: ExtensionAPI) {
  const { patterns, blockWithoutUI, errors } = loadConfig();

  if (errors?.length) {
    pi.on("session_start", async (_event, ctx) => {
      ctx.ui?.notify(
        `[permission-gate] Bad pattern(s) in config:\n${(errors ?? []).join("\n")}\n\nFalling back to built-in defaults. Edit ~/.pi/agent/configs/permission-gate.json to fix.`,
        "warning",
      );
    });
  }

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return undefined;

    const command = event.input.command as string;
    const isDangerous = patterns.some((p) => p.test(command));

    if (!isDangerous) return undefined;

    if (!ctx.hasUI) {
      if (blockWithoutUI) {
        return { block: true, reason: "[permission-gate] Command blocked \u2014 matches a dangerous pattern. You can override this by editing ~/.pi/agent/configs/permission-gate.json." };
      }
      return undefined;
    }

    const items: SelectItem[] = [
      { value: "yes", label: "Yes" },
      { value: "no", label: "No" },
    ];

    const choice = await ctx.ui.custom<string | null>((tui, theme, kb, done) => {
      const border = new DynamicBorder((s: string) => theme.fg("border", s));
      const label = new Text(theme.fg("text", "⚠️ Dangerous command detected:"), 1, 0);
      const cmd = new Text(theme.fg("error", command), 1, 0);
      const question = new Text(theme.fg("text", "Allow this command?"), 1, 0);

      const selectList = new SelectList(items, Math.min(items.length, 10), {
        selectedPrefix: (t) => theme.fg("accent", t),
        selectedText: (t) => theme.fg("accent", t),
        description: (t) => theme.fg("muted", t),
        scrollInfo: (t) => theme.fg("dim", t),
        noMatch: (t) => theme.fg("warning", t),
      });
      selectList.onSelect = (item) => done(item.value);
      selectList.onCancel = () => done(null);

      const help = new Text(theme.fg("dim", "↑↓") + theme.fg("muted", " navigate ") + theme.fg("dim", "enter") + theme.fg("muted", " select ") + theme.fg("dim", "esc") + theme.fg("muted", " cancel"), 1, 0);

      const container = new Container();
      container.addChild(border);
      container.addChild(new Spacer());
      container.addChild(label);
      container.addChild(new Spacer());
      container.addChild(cmd);
      container.addChild(new Spacer());
      container.addChild(question);
      container.addChild(selectList);
      container.addChild(new Spacer());
      container.addChild(help);
      container.addChild(border);

      return {
        render(width: number) { return container.render(width); },
        invalidate() { container.invalidate(); },
        handleInput(data: string) {
          if (kb.matches(data, "app.tools.expand")) { ctx.ui.setToolsExpanded(!ctx.ui.getToolsExpanded()); return; }
          selectList.handleInput(data);
          tui.requestRender();
        },
      };
    });

    if (choice !== "yes") {
      return { block: true, reason: "[permission-gate] Command blocked by user \u2014 matches a dangerous pattern. You can override this by editing ~/.pi/agent/configs/permission-gate.json." };
    }

    return undefined;
  });
}
