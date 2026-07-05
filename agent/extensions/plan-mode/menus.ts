/** Shared select-menu dialog: bordered title + SelectList + help footer. */

import type { ExtensionContext } from "@earendil-works/pi-coding-agent";
import { DynamicBorder } from "@earendil-works/pi-coding-agent";
import { Container, Text, Spacer, SelectList, type SelectItem } from "@earendil-works/pi-tui";

export interface SelectMenuOptions {
  /** Render the title bold (default true). */
  bold?: boolean;
  /** Dim suffix appended after the title, e.g. a warning hint. */
  dimSuffix?: string;
}

/** Show a bordered select menu and resolve with the chosen item's value, or null when cancelled. */
export function showSelectMenu(
  ctx: ExtensionContext,
  title: string,
  items: SelectItem[],
  opts: SelectMenuOptions = {},
): Promise<string | null> {
  const { bold = true, dimSuffix } = opts;

  return ctx.ui.custom<string | null>((tui, theme, kb, done) => {
    const border = new DynamicBorder((s: string) => theme.fg("border", s));
    const titleText = theme.fg("text", bold ? theme.bold(title) : title) + (dimSuffix ? theme.fg("dim", dimSuffix) : "");
    const titleLine = new Text(titleText, 1, 0);

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
    container.addChild(titleLine);
    container.addChild(new Spacer());
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
}
