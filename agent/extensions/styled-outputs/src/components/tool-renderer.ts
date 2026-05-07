import { Text, type Component } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { CONFIG } from "../config.js";
import { applyColor, toolPrefix, errorPrefix, shortenPath, getVisibleWidth, getExpandToggleKey } from "../utils.js";

// --- Shared helpers ---

export function makeText(lastComponent: Text | undefined, text: string): Text {
  const comp = lastComponent ?? new Text("", 0, 0);
  comp.setText(text);
  return comp;
}

const SPINNER_CHARS = CONFIG.tools.toolSpinnerPrefix.prefixChars;
const SPINNER_FRAMES = [...SPINNER_CHARS, ...[...SPINNER_CHARS].reverse()];
const SPINNER_INTERVAL = 80;

function ensureSpinner(ctx: any): number {
  if (ctx.state.spinnerInterval) return ctx.state.spinnerFrame ?? 0;
  ctx.state.spinnerFrame = 0;
  ctx.state.spinnerInterval = setInterval(() => {
    ctx.state.spinnerFrame = (ctx.state.spinnerFrame + 1) % SPINNER_FRAMES.length;
    ctx.invalidate();
  }, SPINNER_INTERVAL);
  return 0;
}

function clearSpinner(ctx: any) {
  if (ctx.state.spinnerInterval) {
    clearInterval(ctx.state.spinnerInterval);
    ctx.state.spinnerInterval = undefined;
  }
}

function spinnerDot(theme: Theme, frame: number): string {
  return `${applyColor(theme, CONFIG.tools.toolSpinnerPrefix.color, SPINNER_FRAMES[frame % SPINNER_FRAMES.length])} `;
}

export function toolHeader(label: string, summary: string, theme: Theme, dot?: string, isError?: boolean): string {
  const d = dot ?? (isError ? errorPrefix(theme) : toolPrefix(theme));
  const title = applyColor(theme, CONFIG.tools.general.titleColor, theme.bold(label));
  return `${d}${title} ${summary}`;
}

export function branchLine(text: string, theme: Theme): string {
  const icon = applyColor(theme, CONFIG.tools.toolBranch.color, CONFIG.tools.toolBranch.prefix);
  return `${icon} ${text}`;
}

function indentLine(text: string): string {
  return `${" ".repeat(getVisibleWidth(CONFIG.tools.toolBranch.prefix) + 1)}${text}`;
}

function expandHint(theme: Theme): string {
  return applyColor(theme, CONFIG.tools.general.expandHintColor, ` • ${getExpandToggleKey()} to expand`);
}

const NO_OUTPUT_PLACEHOLDER = "(no output)";

function outputLines(text: string): string[] {
  if (text === NO_OUTPUT_PLACEHOLDER) return [];
  return text.split("\n");
}

export function getFirstTextContent(result: any): string {
  if (!result?.content) return "";
  for (const block of result.content) {
    if (block?.type === "text" && block.text) return block.text;
  }
  return "";
}

function errorLabel(theme: Theme): string {
  return branchLine(applyColor(theme, CONFIG.tools.toolError.labelColor, "Error"), theme);
}

function renderPartial(theme: Theme): string {
  return branchLine(applyColor(theme, CONFIG.tools.general.outputColor, "Running..."), theme);
}

function doneLabel(theme: Theme, count?: { label: string; value: number }): string {
  const done = applyColor(theme, CONFIG.tools.toolSuccess.labelColor, "Done");
  const text = count
    ? `${done} ${applyColor(theme, CONFIG.tools.general.countColor, `• ${count.value} ${count.label}`)}`
    : done;
  return branchLine(text, theme);
}

// --- Read tool ---

export function renderReadCall(args: any, theme: Theme, ctx: any): Component {
  const path = shortenPath(args.file_path ?? args.path ?? "", ctx.cwd ?? process.cwd());
  const summary = applyColor(theme, CONFIG.tools.general.summaryColor, path);
  if (ctx.isPartial) {
    const frame = ensureSpinner(ctx);
    return makeText(ctx.lastComponent, toolHeader("Read", summary, theme, spinnerDot(theme, frame)) + "\n" + renderPartial(theme));
  }
  clearSpinner(ctx);
  return makeText(ctx.lastComponent, toolHeader("Read", summary, theme, undefined, ctx.isError));
}

export function renderReadResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: Theme, ctx: any): Component {
  const text = getFirstTextContent(result);

  if (ctx.isError) {
    const lines = outputLines(text).filter((l: string) => l.trim().length > 0);
    if (!options.expanded) {
      return makeText(ctx.lastComponent, errorLabel(theme) + expandHint(theme));
    }
    let display = errorLabel(theme);
    for (const line of lines) {
      display += "\n" + indentLine(applyColor(theme, CONFIG.tools.general.outputColor, line));
    }
    return makeText(ctx.lastComponent, display);
  }

  const nonEmptyLines = outputLines(text).filter((l: string) => l.trim().length > 0);
  const count = nonEmptyLines.length > 0 ? { label: "lines", value: nonEmptyLines.length } : undefined;

  if (!options.expanded) {
    return makeText(ctx.lastComponent, doneLabel(theme, count) + (nonEmptyLines.length > 0 ? expandHint(theme) : ""));
  }

  let display = doneLabel(theme, count);
  for (const line of nonEmptyLines) {
    display += "\n" + indentLine(applyColor(theme, CONFIG.tools.general.outputColor, line || " "));
  }
  return makeText(ctx.lastComponent, display);
}

// --- Grep tool ---

export function renderGrepCall(args: any, theme: Theme, ctx: any): Component {
  const pattern = args.pattern ?? "";
  const searchPath = shortenPath(args.path ?? ".", ctx.cwd ?? process.cwd());
  let summary = applyColor(theme, CONFIG.tools.general.summaryColor, `/${pattern}/`) + " in " + applyColor(theme, CONFIG.tools.general.summaryColor, searchPath);
  if (args.glob) summary += applyColor(theme, CONFIG.tools.general.outputColor, ` (${args.glob})`);
  if (ctx.isPartial) {
    const frame = ensureSpinner(ctx);
    return makeText(ctx.lastComponent, toolHeader("Grep", summary, theme, spinnerDot(theme, frame)) + "\n" + renderPartial(theme));
  }
  clearSpinner(ctx);
  return makeText(ctx.lastComponent, toolHeader("Grep", summary, theme, undefined, ctx.isError));
}

export function renderGrepResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: Theme, ctx: any): Component {
  const text = getFirstTextContent(result);
  const lines = outputLines(text).filter((l: string) => l.trim().length > 0);

  if (ctx.isError) {
    if (!options.expanded) {
      return makeText(ctx.lastComponent, errorLabel(theme) + expandHint(theme));
    }
    let display = errorLabel(theme);
    for (const line of lines) {
      display += "\n" + indentLine(applyColor(theme, CONFIG.tools.general.outputColor, line));
    }
    return makeText(ctx.lastComponent, display);
  }

  const count = lines.length > 0 ? { label: "matches", value: lines.length } : undefined;

  if (!options.expanded) {
    return makeText(ctx.lastComponent, doneLabel(theme, count) + (lines.length > 0 ? expandHint(theme) : ""));
  }

  let display = doneLabel(theme, count);
  for (const line of lines) {
    display += "\n" + indentLine(applyColor(theme, CONFIG.tools.general.outputColor, line));
  }
  return makeText(ctx.lastComponent, display);
}

// --- Find tool ---

export function renderFindCall(args: any, theme: Theme, ctx: any): Component {
  const pattern = args.pattern ?? "";
  const searchPath = shortenPath(args.path ?? ".", ctx.cwd ?? process.cwd());
  let summary = applyColor(theme, CONFIG.tools.general.summaryColor, pattern) + " in " + applyColor(theme, CONFIG.tools.general.summaryColor, searchPath);
  if (ctx.isPartial) {
    const frame = ensureSpinner(ctx);
    return makeText(ctx.lastComponent, toolHeader("Find", summary, theme, spinnerDot(theme, frame)) + "\n" + renderPartial(theme));
  }
  clearSpinner(ctx);
  return makeText(ctx.lastComponent, toolHeader("Find", summary, theme, undefined, ctx.isError));
}

export function renderFindResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: Theme, ctx: any): Component {
  const text = getFirstTextContent(result);
  const items = outputLines(text).filter((l: string) => l.trim().length > 0);

  if (ctx.isError) {
    if (!options.expanded) {
      return makeText(ctx.lastComponent, errorLabel(theme) + expandHint(theme));
    }
    let display = errorLabel(theme);
    for (const line of items) {
      display += "\n" + indentLine(applyColor(theme, CONFIG.tools.general.outputColor, line));
    }
    return makeText(ctx.lastComponent, display);
  }

  const count = items.length > 0 ? { label: "files", value: items.length } : undefined;

  if (!options.expanded) {
    return makeText(ctx.lastComponent, doneLabel(theme, count) + (items.length > 0 ? expandHint(theme) : ""));
  }

  let display = doneLabel(theme, count);
  for (const item of items) {
    const isDir = item.endsWith("/");
    const styled = isDir
      ? applyColor(theme, "accent", theme.bold(item))
      : applyColor(theme, CONFIG.tools.general.outputColor, item);
    display += "\n" + indentLine(styled);
  }
  return makeText(ctx.lastComponent, display);
}

// --- Bash tool ---

export function renderBashCall(args: any, theme: Theme, ctx: any): Component {
  const cmd = args.command ?? "";
  const maxPreview = 60;
  const preview = cmd.length > maxPreview ? cmd.slice(0, maxPreview) + "…" : cmd;
  const summary = applyColor(theme, CONFIG.tools.general.summaryColor, preview);
  if (ctx.isPartial) {
    const frame = ensureSpinner(ctx);
    return makeText(ctx.lastComponent, toolHeader("Bash", summary, theme, spinnerDot(theme, frame)) + "\n" + renderPartial(theme));
  }
  clearSpinner(ctx);
  return makeText(ctx.lastComponent, toolHeader("Bash", summary, theme, undefined, ctx.isError));
}

export function renderBashResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: Theme, ctx: any): Component {
  const output = getFirstTextContent(result);
  const nonEmptyLines = outputLines(output).filter((l: string) => l.trim().length > 0);

  if (ctx.isError) {
    const exitMatch = output.match(/Command exited with code (\d+)/);
    const exitCode = exitMatch ? parseInt(exitMatch[1], 10) : null;
    const isAborted = output.includes("Command aborted") || output.includes("Command timed out");
    const statusText = exitCode !== null
      ? `Exit ${exitCode}`
      : isAborted ? "Aborted" : "Failed";
    let display = branchLine(applyColor(theme, CONFIG.tools.toolError.labelColor, statusText), theme);
    if (options.expanded) {
      for (const line of nonEmptyLines) {
        display += "\n" + indentLine(applyColor(theme, CONFIG.tools.general.outputColor, line));
      }
    } else {
      display += expandHint(theme);
    }
    return makeText(ctx.lastComponent, display);
  }

  const count = nonEmptyLines.length > 0 ? { label: "lines", value: nonEmptyLines.length } : undefined;

  if (!options.expanded) {
    return makeText(ctx.lastComponent, doneLabel(theme, count) + (nonEmptyLines.length > 0 ? expandHint(theme) : ""));
  }

  let display = doneLabel(theme, count);
  for (const line of nonEmptyLines) {
    display += "\n" + indentLine(applyColor(theme, CONFIG.tools.general.outputColor, line));
  }
  return makeText(ctx.lastComponent, display);
}

// --- Edit tool ---

export function renderEditCall(args: any, theme: Theme, ctx: any): Component {
  const path = shortenPath(args.path ?? "", ctx.cwd ?? process.cwd());
  const operations = args.edits ?? [];
  ctx.state.editCount = operations.length;
  const summary = applyColor(theme, CONFIG.tools.general.summaryColor, path);
  if (ctx.isPartial) {
    const frame = ensureSpinner(ctx);
    return makeText(ctx.lastComponent, toolHeader("Edit", summary, theme, spinnerDot(theme, frame)) + "\n" + renderPartial(theme));
  }
  clearSpinner(ctx);
  return makeText(ctx.lastComponent, toolHeader("Edit", summary, theme, undefined, ctx.isError));
}

export function renderEditResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: Theme, ctx: any): Component {
  if (ctx.isError) {
    const text = getFirstTextContent(result);
    const lines = outputLines(text).filter((l: string) => l.trim().length > 0);
    if (!options.expanded) {
      return makeText(ctx.lastComponent, errorLabel(theme) + expandHint(theme));
    }
    let display = errorLabel(theme);
    for (const line of lines) {
      display += "\n" + indentLine(applyColor(theme, CONFIG.tools.general.outputColor, line));
    }
    return makeText(ctx.lastComponent, display);
  }

  const editCount = (ctx.state.editCount as number | undefined) ?? 0;
  const count = editCount > 0 ? { label: `edit${editCount > 1 ? "s" : ""}`, value: editCount } : undefined;
  return makeText(ctx.lastComponent, doneLabel(theme, count));
}

// --- Write tool ---

export function renderWriteCall(args: any, theme: Theme, ctx: any): Component {
  const path = shortenPath(args.path ?? "", ctx.cwd ?? process.cwd());
  const content = args.content ?? "";
  ctx.state.lineCount = content.split("\n").length;
  const summary = applyColor(theme, CONFIG.tools.general.summaryColor, path);
  if (ctx.isPartial) {
    const frame = ensureSpinner(ctx);
    return makeText(ctx.lastComponent, toolHeader("Write", summary, theme, spinnerDot(theme, frame)) + "\n" + renderPartial(theme));
  }
  clearSpinner(ctx);
  return makeText(ctx.lastComponent, toolHeader("Write", summary, theme, undefined, ctx.isError));
}

export function renderWriteResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: Theme, ctx: any): Component {
  if (ctx.isError) {
    const text = getFirstTextContent(result);
    const lines = outputLines(text).filter((l: string) => l.trim().length > 0);
    if (!options.expanded) {
      return makeText(ctx.lastComponent, errorLabel(theme) + expandHint(theme));
    }
    let display = errorLabel(theme);
    for (const line of lines) {
      display += "\n" + indentLine(applyColor(theme, CONFIG.tools.general.outputColor, line));
    }
    return makeText(ctx.lastComponent, display);
  }

  const lineCount = (ctx.state.lineCount as number | undefined) ?? 0;
  const count = lineCount > 0 ? { label: `line${lineCount > 1 ? "s" : ""}`, value: lineCount } : undefined;
  return makeText(ctx.lastComponent, doneLabel(theme, count));
}

// --- Ls tool (also used by Find for dir styling) ---

export function renderLsCall(args: any, theme: Theme, ctx: any): Component {
  const path = shortenPath(args.path ?? ".", ctx.cwd ?? process.cwd());
  const summary = applyColor(theme, CONFIG.tools.general.summaryColor, path);
  if (ctx.isPartial) {
    const frame = ensureSpinner(ctx);
    return makeText(ctx.lastComponent, toolHeader("ls", summary, theme, spinnerDot(theme, frame)) + "\n" + renderPartial(theme));
  }
  clearSpinner(ctx);
  return makeText(ctx.lastComponent, toolHeader("ls", summary, theme, undefined, ctx.isError));
}

export function renderLsResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: Theme, ctx: any): Component {
  const text = getFirstTextContent(result);
  const items = outputLines(text).filter((l: string) => l.trim().length > 0);

  if (ctx.isError) {
    if (!options.expanded) {
      return makeText(ctx.lastComponent, errorLabel(theme) + expandHint(theme));
    }
    let display = errorLabel(theme);
    for (const line of items) {
      display += "\n" + indentLine(applyColor(theme, CONFIG.tools.general.outputColor, line));
    }
    return makeText(ctx.lastComponent, display);
  }

  const count = items.length > 0 ? { label: "entries", value: items.length } : undefined;

  if (!options.expanded) {
    return makeText(ctx.lastComponent, doneLabel(theme, count) + (items.length > 0 ? expandHint(theme) : ""));
  }

  let display = doneLabel(theme, count);
  for (const item of items) {
    const isDir = item.endsWith("/");
    const styled = isDir
      ? applyColor(theme, "accent", theme.bold(item))
      : applyColor(theme, CONFIG.tools.general.outputColor, item);
    display += "\n" + indentLine(styled);
  }
  return makeText(ctx.lastComponent, display);
}
