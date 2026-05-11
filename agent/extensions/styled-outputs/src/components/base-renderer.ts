import type { Component } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { renderDiff, getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { CONFIG } from "../config.js";
import { applyColor, shortenPath } from "../utils.js";
import {
  makeText, toolHeader, branchLine, expandHint,
  outputLines, getFirstTextContent, errorLabel, renderPartial, doneLabel,
  ensureSpinner, clearSpinner, spinnerDot, groupTitleColor,
  formatExpandedLines,
} from "./tool-shared.js";
import { createMarkdownResult } from "./markdown-result.js";

const BASE_TITLE_COLOR = groupTitleColor("base");

// --- Read tool ---

export function renderReadCall(args: any, theme: Theme, ctx: any): Component {
  const path = shortenPath(args.file_path ?? args.path ?? "", ctx.cwd ?? process.cwd());
  const summary = applyColor(theme, CONFIG.tools.general.summaryColor, path);
  if (ctx.isPartial) {
    const frame = ensureSpinner(ctx);
    return makeText(ctx.lastComponent, toolHeader("Read", summary, theme, spinnerDot(theme, frame), undefined, BASE_TITLE_COLOR) + "\n" + renderPartial(theme));
  }
  clearSpinner(ctx);
  return makeText(ctx.lastComponent, toolHeader("Read", summary, theme, undefined, ctx.isError, BASE_TITLE_COLOR));
}

export function renderReadResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: Theme, ctx: any): Component {
  const text = getFirstTextContent(result);

  if (ctx.isError) {
    const lines = outputLines(text).filter((l: string) => l.trim().length > 0);
    if (!options.expanded) {
      return makeText(ctx.lastComponent, errorLabel(theme) + expandHint(theme));
    }
    const styled = lines.map((l: string) => applyColor(theme, CONFIG.tools.general.outputColor, l));
    return makeText(ctx.lastComponent, errorLabel(theme) + formatExpandedLines(styled, "tail", theme));
  }

  const nonEmptyLines = outputLines(text).filter((l: string) => l.trim().length > 0);
  const count = nonEmptyLines.length > 0 ? { label: "lines", value: nonEmptyLines.length } : undefined;

  if (!options.expanded) {
    return makeText(ctx.lastComponent, doneLabel(theme, count) + (nonEmptyLines.length > 0 ? expandHint(theme) : ""));
  }

  // Use MarkdownResult for .md files
  const filePath = ctx.args?.file_path ?? ctx.args?.path ?? "";
  if (filePath.endsWith(".md")) {
    return createMarkdownResult(doneLabel(theme, count), text, getMarkdownTheme(), "head-tail", theme, true);
  }

  const styled = nonEmptyLines.map((l: string) => applyColor(theme, CONFIG.tools.general.outputColor, l));
  return makeText(ctx.lastComponent, doneLabel(theme, count) + formatExpandedLines(styled, "head-tail", theme));
}

// --- Grep tool ---

export function renderGrepCall(args: any, theme: Theme, ctx: any): Component {
  const pattern = args.pattern ?? "";
  const searchPath = shortenPath(args.path ?? ".", ctx.cwd ?? process.cwd());
  let summary = applyColor(theme, CONFIG.tools.general.summaryColor, `${pattern} in ${searchPath}`);
  if (args.glob) summary += applyColor(theme, CONFIG.tools.general.outputColor, ` (${args.glob})`);
  if (ctx.isPartial) {
    const frame = ensureSpinner(ctx);
    return makeText(ctx.lastComponent, toolHeader("Grep", summary, theme, spinnerDot(theme, frame), undefined, BASE_TITLE_COLOR) + "\n" + renderPartial(theme));
  }
  clearSpinner(ctx);
  return makeText(ctx.lastComponent, toolHeader("Grep", summary, theme, undefined, ctx.isError, BASE_TITLE_COLOR));
}

export function renderGrepResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: Theme, ctx: any): Component {
  const text = getFirstTextContent(result);
  const lines = outputLines(text).filter((l: string) => l.trim().length > 0);

  if (ctx.isError) {
    if (!options.expanded) {
      return makeText(ctx.lastComponent, errorLabel(theme) + expandHint(theme));
    }
    const styled = lines.map((l: string) => applyColor(theme, CONFIG.tools.general.outputColor, l));
    return makeText(ctx.lastComponent, errorLabel(theme) + formatExpandedLines(styled, "tail", theme));
  }

  const count = lines.length > 0 ? { label: "matches", value: lines.length } : undefined;

  if (!options.expanded) {
    return makeText(ctx.lastComponent, doneLabel(theme, count) + (lines.length > 0 ? expandHint(theme) : ""));
  }

  const styled = lines.map((l: string) => applyColor(theme, CONFIG.tools.general.outputColor, l));
  return makeText(ctx.lastComponent, doneLabel(theme, count) + formatExpandedLines(styled, "head", theme));
}

// --- Find tool ---

export function renderFindCall(args: any, theme: Theme, ctx: any): Component {
  const pattern = args.pattern ?? "";
  const searchPath = shortenPath(args.path ?? ".", ctx.cwd ?? process.cwd());
  let summary = applyColor(theme, CONFIG.tools.general.summaryColor, `${pattern} in ${searchPath}`);
  if (ctx.isPartial) {
    const frame = ensureSpinner(ctx);
    return makeText(ctx.lastComponent, toolHeader("Find", summary, theme, spinnerDot(theme, frame), undefined, BASE_TITLE_COLOR) + "\n" + renderPartial(theme));
  }
  clearSpinner(ctx);
  return makeText(ctx.lastComponent, toolHeader("Find", summary, theme, undefined, ctx.isError, BASE_TITLE_COLOR));
}

export function renderFindResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: Theme, ctx: any): Component {
  const text = getFirstTextContent(result);
  const items = outputLines(text).filter((l: string) => l.trim().length > 0);

  if (ctx.isError) {
    if (!options.expanded) {
      return makeText(ctx.lastComponent, errorLabel(theme) + expandHint(theme));
    }
    const styled = items.map((l: string) => applyColor(theme, CONFIG.tools.general.outputColor, l));
    return makeText(ctx.lastComponent, errorLabel(theme) + formatExpandedLines(styled, "tail", theme));
  }

  const count = items.length > 0 ? { label: "files", value: items.length } : undefined;

  if (!options.expanded) {
    return makeText(ctx.lastComponent, doneLabel(theme, count) + (items.length > 0 ? expandHint(theme) : ""));
  }

  const styled = items.map((item: string) => {
    const isDir = item.endsWith("/");
    return isDir
      ? applyColor(theme, "accent", theme.bold(item))
      : applyColor(theme, CONFIG.tools.general.outputColor, item);
  });
  return makeText(ctx.lastComponent, doneLabel(theme, count) + formatExpandedLines(styled, "head", theme));
}

// --- Bash tool ---

export function renderBashCall(args: any, theme: Theme, ctx: any): Component {
  const cmd = args.command ?? "";
  const maxPreview = 60;
  const preview = cmd.length > maxPreview ? cmd.slice(0, maxPreview) + "…" : cmd;
  const summary = applyColor(theme, CONFIG.tools.general.summaryColor, preview);
  if (ctx.isPartial) {
    const frame = ensureSpinner(ctx);
    return makeText(ctx.lastComponent, toolHeader("Bash", summary, theme, spinnerDot(theme, frame), undefined, BASE_TITLE_COLOR) + "\n" + renderPartial(theme));
  }
  clearSpinner(ctx);
  return makeText(ctx.lastComponent, toolHeader("Bash", summary, theme, undefined, ctx.isError, BASE_TITLE_COLOR));
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
    const display = branchLine(applyColor(theme, CONFIG.tools.toolError.labelColor, statusText), theme);
    if (!options.expanded) {
      return makeText(ctx.lastComponent, display + expandHint(theme));
    }
    const styled = nonEmptyLines.map((l: string) => applyColor(theme, CONFIG.tools.general.outputColor, l));
    return makeText(ctx.lastComponent, display + formatExpandedLines(styled, "tail", theme));
  }

  const count = nonEmptyLines.length > 0 ? { label: "lines", value: nonEmptyLines.length } : undefined;

  if (!options.expanded) {
    return makeText(ctx.lastComponent, doneLabel(theme, count) + (nonEmptyLines.length > 0 ? expandHint(theme) : ""));
  }

  const styled = nonEmptyLines.map((l: string) => applyColor(theme, CONFIG.tools.general.outputColor, l));
  return makeText(ctx.lastComponent, doneLabel(theme, count) + formatExpandedLines(styled, "tail", theme));
}

// --- Edit tool ---

export function renderEditCall(args: any, theme: Theme, ctx: any): Component {
  const path = shortenPath(args.path ?? "", ctx.cwd ?? process.cwd());
  const operations = args.edits ?? [];
  ctx.state.editCount = operations.length;
  const summary = applyColor(theme, CONFIG.tools.general.summaryColor, path);
  if (ctx.isPartial) {
    const frame = ensureSpinner(ctx);
    return makeText(ctx.lastComponent, toolHeader("Edit", summary, theme, spinnerDot(theme, frame), undefined, BASE_TITLE_COLOR) + "\n" + renderPartial(theme));
  }
  clearSpinner(ctx);
  return makeText(ctx.lastComponent, toolHeader("Edit", summary, theme, undefined, ctx.isError, BASE_TITLE_COLOR));
}

export function renderEditResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: Theme, ctx: any): Component {
  if (ctx.isError) {
    const text = getFirstTextContent(result);
    const lines = outputLines(text).filter((l: string) => l.trim().length > 0);
    if (!options.expanded) {
      return makeText(ctx.lastComponent, errorLabel(theme) + expandHint(theme));
    }
    const styled = lines.map((l: string) => applyColor(theme, CONFIG.tools.general.outputColor, l));
    return makeText(ctx.lastComponent, errorLabel(theme) + formatExpandedLines(styled, "tail", theme));
  }

  const editCount = (ctx.state.editCount as number | undefined) ?? 0;
  const count = editCount > 0 ? { label: `edit${editCount > 1 ? "s" : ""}`, value: editCount } : undefined;

  if (options.expanded && result.details?.diff) {
    const diffLines = renderDiff(result.details.diff).split("\n");
    return makeText(ctx.lastComponent, doneLabel(theme, count) + formatExpandedLines(diffLines, "head-tail", theme));
  }

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
    return makeText(ctx.lastComponent, toolHeader("Write", summary, theme, spinnerDot(theme, frame), undefined, BASE_TITLE_COLOR) + "\n" + renderPartial(theme));
  }
  clearSpinner(ctx);
  return makeText(ctx.lastComponent, toolHeader("Write", summary, theme, undefined, ctx.isError, BASE_TITLE_COLOR));
}

export function renderWriteResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: Theme, ctx: any): Component {
  if (ctx.isError) {
    const text = getFirstTextContent(result);
    const lines = outputLines(text).filter((l: string) => l.trim().length > 0);
    if (!options.expanded) {
      return makeText(ctx.lastComponent, errorLabel(theme) + expandHint(theme));
    }
    const styled = lines.map((l: string) => applyColor(theme, CONFIG.tools.general.outputColor, l));
    return makeText(ctx.lastComponent, errorLabel(theme) + formatExpandedLines(styled, "tail", theme));
  }

  const lineCount = (ctx.state.lineCount as number | undefined) ?? 0;
  const count = lineCount > 0 ? { label: `line${lineCount > 1 ? "s" : ""}`, value: lineCount } : undefined;
  return makeText(ctx.lastComponent, doneLabel(theme, count));
}

// --- Ls tool ---

export function renderLsCall(args: any, theme: Theme, ctx: any): Component {
  const path = shortenPath(args.path ?? ".", ctx.cwd ?? process.cwd());
  const summary = applyColor(theme, CONFIG.tools.general.summaryColor, path);
  if (ctx.isPartial) {
    const frame = ensureSpinner(ctx);
    return makeText(ctx.lastComponent, toolHeader("ls", summary, theme, spinnerDot(theme, frame), undefined, BASE_TITLE_COLOR) + "\n" + renderPartial(theme));
  }
  clearSpinner(ctx);
  return makeText(ctx.lastComponent, toolHeader("ls", summary, theme, undefined, ctx.isError, BASE_TITLE_COLOR));
}

export function renderLsResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: Theme, ctx: any): Component {
  const text = getFirstTextContent(result);
  const items = outputLines(text).filter((l: string) => l.trim().length > 0);

  if (ctx.isError) {
    if (!options.expanded) {
      return makeText(ctx.lastComponent, errorLabel(theme) + expandHint(theme));
    }
    const styled = items.map((l: string) => applyColor(theme, CONFIG.tools.general.outputColor, l));
    return makeText(ctx.lastComponent, errorLabel(theme) + formatExpandedLines(styled, "tail", theme));
  }

  const count = items.length > 0 ? { label: "entries", value: items.length } : undefined;

  if (!options.expanded) {
    return makeText(ctx.lastComponent, doneLabel(theme, count) + (items.length > 0 ? expandHint(theme) : ""));
  }

  const styled = items.map((item: string) => {
    const isDir = item.endsWith("/");
    return isDir
      ? applyColor(theme, "accent", theme.bold(item))
      : applyColor(theme, CONFIG.tools.general.outputColor, item);
  });
  return makeText(ctx.lastComponent, doneLabel(theme, count) + formatExpandedLines(styled, "head", theme));
}