import { Text, type Component } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { CONFIG } from "../config.js";
import { applyColor, toolDot, shortenPath, getVisibleWidth } from "../utils.js";

// --- Shared helpers ---

export function makeText(lastComponent: Text | undefined, text: string): Text {
  const comp = lastComponent ?? new Text("", 0, 0);
  comp.setText(text);
  return comp;
}

export function toolHeader(label: string, summary: string, theme: Theme): string {
  const dot = toolDot(theme);
  const title = applyColor(theme, CONFIG.toolTitleColor, theme.bold(label));
  return `${dot}${title} ${summary}`;
}

export function branchLine(text: string, theme: Theme): string {
  const icon = applyColor(theme, CONFIG.toolBranchColor, CONFIG.toolBranch);
  return `${icon} ${text}`;
}

function indentLine(text: string): string {
  return `${" ".repeat(getVisibleWidth(CONFIG.toolBranch) + 1)}${text}`;
}

function expandHint(theme: Theme): string {
  return applyColor(theme, CONFIG.toolExpandHintColor, " • ctrl+o to expand");
}

function outputLines(text: string): string[] {
  return text.split("\n");
}

export function getFirstTextContent(result: any): string {
  if (!result?.content) return "";
  for (const block of result.content) {
    if (block?.type === "text" && block.text) return block.text;
  }
  return "";
}

function renderPartial(theme: Theme): string {
  return branchLine(applyColor(theme, CONFIG.toolOutputColor, "Running..."), theme);
}

function doneLabel(theme: Theme, count?: { label: string; value: number }): string {
  const done = applyColor(theme, CONFIG.toolSuccessColor, "Done");
  const text = count
    ? `${done} ${applyColor(theme, CONFIG.toolSummaryColor, `• ${count.value} ${count.label}`)}`
    : done;
  return branchLine(text, theme);
}

// --- Read tool ---

export function renderReadCall(args: any, theme: Theme, ctx: any): Component {
  const path = shortenPath(args.file_path ?? args.path ?? "", ctx.cwd ?? process.cwd());
  const summary = applyColor(theme, CONFIG.toolSummaryColor, path);
  const header = toolHeader("Read", summary, theme);
  return makeText(ctx.lastComponent, ctx.isPartial ? header + "\n" + renderPartial(theme) : header);
}

export function renderReadResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: Theme, ctx: any): Component {
  const text = getFirstTextContent(result);

  if (ctx.isError) {
    return makeText(ctx.lastComponent, branchLine(applyColor(theme, CONFIG.toolErrorColor, text), theme));
  }

  const nonEmptyLines = outputLines(text).filter((l: string) => l.trim().length > 0);
  const count = { label: "lines", value: nonEmptyLines.length };

  if (!options.expanded) {
    return makeText(ctx.lastComponent, doneLabel(theme, count) + expandHint(theme));
  }

  let display = doneLabel(theme, count);
  for (const line of nonEmptyLines) {
    display += "\n" + indentLine(applyColor(theme, CONFIG.toolOutputColor, line || " "));
  }
  return makeText(ctx.lastComponent, display);
}

// --- Bash tool ---

export function renderBashCall(args: any, theme: Theme, ctx: any): Component {
  const cmd = args.command ?? "";
  const maxPreview = 60;
  const preview = cmd.length > maxPreview ? cmd.slice(0, maxPreview) + "…" : cmd;
  const summary = applyColor(theme, CONFIG.toolSummaryColor, preview);
  const header = toolHeader("Bash", summary, theme);
  return makeText(ctx.lastComponent, ctx.isPartial ? header + "\n" + renderPartial(theme) : header);
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
    let display = branchLine(applyColor(theme, CONFIG.toolErrorColor, statusText), theme);
    if (options.expanded) {
      for (const line of nonEmptyLines) {
        display += "\n" + indentLine(applyColor(theme, CONFIG.toolOutputColor, line));
      }
    } else {
      display += expandHint(theme);
    }
    return makeText(ctx.lastComponent, display);
  }

  const count = { label: "lines", value: nonEmptyLines.length };

  if (!options.expanded) {
    return makeText(ctx.lastComponent, doneLabel(theme, count) + (nonEmptyLines.length > 0 ? expandHint(theme) : ""));
  }

  let display = doneLabel(theme, count);
  for (const line of nonEmptyLines) {
    display += "\n" + indentLine(applyColor(theme, CONFIG.toolOutputColor, line));
  }
  return makeText(ctx.lastComponent, display);
}

// --- Edit tool ---

export function renderEditCall(args: any, theme: Theme, ctx: any): Component {
  const path = shortenPath(args.path ?? "", ctx.cwd ?? process.cwd());
  const operations = args.edits ?? [];
  const count = operations.length;
  const opSummary = count > 0 ? ` (${count} edit${count > 1 ? "s" : ""})` : "";
  const summary = applyColor(theme, CONFIG.toolSummaryColor, `${path}${opSummary}`);
  const header = toolHeader("Edit", summary, theme);
  return makeText(ctx.lastComponent, ctx.isPartial ? header + "\n" + renderPartial(theme) : header);
}

export function renderEditResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: Theme, ctx: any): Component {
  if (ctx.isError) {
    const text = getFirstTextContent(result);
    return makeText(ctx.lastComponent, branchLine(applyColor(theme, CONFIG.toolErrorColor, text), theme));
  }

  return makeText(ctx.lastComponent, doneLabel(theme));
}

// --- Write tool ---

export function renderWriteCall(args: any, theme: Theme, ctx: any): Component {
  const path = shortenPath(args.path ?? "", ctx.cwd ?? process.cwd());
  const content = args.content ?? "";
  const lineCount = content.split("\n").length;
  const summary = applyColor(theme, CONFIG.toolSummaryColor, `${path} (${lineCount} lines)`);
  const header = toolHeader("Write", summary, theme);
  return makeText(ctx.lastComponent, ctx.isPartial ? header + "\n" + renderPartial(theme) : header);
}

export function renderWriteResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: Theme, ctx: any): Component {
  if (ctx.isError) {
    const text = getFirstTextContent(result);
    return makeText(ctx.lastComponent, branchLine(applyColor(theme, CONFIG.toolErrorColor, text), theme));
  }

  return makeText(ctx.lastComponent, doneLabel(theme));
}

// --- Ls tool ---

export function renderLsCall(args: any, theme: Theme, ctx: any): Component {
  const path = shortenPath(args.path ?? ".", ctx.cwd ?? process.cwd());
  const summary = applyColor(theme, CONFIG.toolSummaryColor, path);
  const header = toolHeader("Ls", summary, theme);
  return makeText(ctx.lastComponent, ctx.isPartial ? header + "\n" + renderPartial(theme) : header);
}

export function renderLsResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: Theme, ctx: any): Component {
  const text = getFirstTextContent(result);
  const items = outputLines(text).filter((l: string) => l.trim().length > 0);

  if (ctx.isError) {
    return makeText(ctx.lastComponent, branchLine(applyColor(theme, CONFIG.toolErrorColor, text), theme));
  }

  const count = { label: "entries", value: items.length };

  if (!options.expanded) {
    return makeText(ctx.lastComponent, doneLabel(theme, count) + (items.length > 0 ? expandHint(theme) : ""));
  }

  let display = doneLabel(theme, count);
  for (const item of items) {
    const isDir = item.endsWith("/");
    const styled = isDir
      ? applyColor(theme, "accent", theme.bold(item))
      : applyColor(theme, CONFIG.toolOutputColor, item);
    display += "\n" + indentLine(styled);
  }
  return makeText(ctx.lastComponent, display);
}
