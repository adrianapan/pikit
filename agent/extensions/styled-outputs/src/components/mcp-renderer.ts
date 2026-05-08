import type { Component } from "@mariozechner/pi-tui";
import type { Theme } from "@mariozechner/pi-coding-agent";
import { CONFIG } from "../config.js";
import { applyColor } from "../utils.js";
import {
  makeText, toolHeader, indentLine, expandHint,
  outputLines, getFirstTextContent, errorLabel, renderPartial, doneLabel,
  ensureSpinner, clearSpinner, spinnerDot, groupTitleColor,
} from "./tool-shared.js";

const MCP_TITLE_COLOR = groupTitleColor("mcp");

function argsSummary(args: any): string {
  if (!args || typeof args !== "object" || !Object.keys(args).length) return "";
  const query = args.query ?? args.name ?? args.path ?? args.input ?? args.text ?? args.command ?? args.url ?? args.keyword ?? args.search;
  if (typeof query === "string" && query) return query;
  for (const value of Object.values(args)) {
    if (typeof value === "string" && (value as string).length > 0) return value as string;
  }
  try {
    const json = JSON.stringify(args);
    return json.length > 60 ? json.slice(0, 60) + "…" : json;
  } catch {
    return "";
  }
}

export function renderMcpCall(toolName: string, args: any, theme: Theme, ctx: any): Component {
  const summary = applyColor(theme, CONFIG.tools.general.summaryColor, argsSummary(args));
  if (ctx.isPartial) {
    const frame = ensureSpinner(ctx);
    return makeText(ctx.lastComponent, toolHeader(toolName, summary, theme, spinnerDot(theme, frame), undefined, MCP_TITLE_COLOR) + "\n" + renderPartial(theme));
  }
  clearSpinner(ctx);
  return makeText(ctx.lastComponent, toolHeader(toolName, summary, theme, undefined, ctx.isError, MCP_TITLE_COLOR));
}

export function renderMcpResult(toolName: string, result: any, options: { expanded: boolean; isPartial: boolean }, theme: Theme, ctx: any): Component {
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

  const count = lines.length > 0 ? { label: "lines", value: lines.length } : undefined;

  if (!options.expanded) {
    return makeText(ctx.lastComponent, doneLabel(theme, count) + (lines.length > 0 ? expandHint(theme) : ""));
  }

  let display = doneLabel(theme, count);
  for (const line of lines) {
    display += "\n" + indentLine(applyColor(theme, CONFIG.tools.general.outputColor, line || " "));
  }
  return makeText(ctx.lastComponent, display);
}