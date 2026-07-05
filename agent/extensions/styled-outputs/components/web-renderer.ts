import type { Component } from "@earendil-works/pi-tui";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { CONFIG } from "../config.js";
import { applyColor } from "../utils.js";
import {
  makeText, toolHeader, expandHint,
  outputLines, getFirstTextContent, errorLabel, renderPartial, doneLabel,
  ensureSpinner, clearSpinner, spinnerDot, groupTitleColor,
  formatExpandedLines,
} from "./tool-shared.js";
import { createMarkdownResult } from "./markdown-result.js";

const WEB_TITLE_COLOR = groupTitleColor("web");

// --- web_search tool ---

export function renderWebSearchCall(args: any, theme: Theme, ctx: any): Component {
  const query = args.query ?? (args.queries ? args.queries.join(", ") : "");
  const summary = applyColor(theme, CONFIG.tools.general.summaryColor, query);
  if (ctx.isPartial) {
    const frame = ensureSpinner(ctx);
    return makeText(ctx.lastComponent, toolHeader("Web Search", summary, theme, spinnerDot(theme, frame), undefined, WEB_TITLE_COLOR) + "\n" + renderPartial(theme));
  }
  clearSpinner(ctx);
  return makeText(ctx.lastComponent, toolHeader("Web Search", summary, theme, undefined, ctx.isError, WEB_TITLE_COLOR));
}

export function renderWebSearchResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: Theme, ctx: any): Component {
  const text = getFirstTextContent(result);
  const lines = outputLines(text).filter((l: string) => l.trim().length > 0);

  if (ctx.isError) {
    if (!options.expanded) {
      return makeText(ctx.lastComponent, errorLabel(theme) + expandHint(theme));
    }
    const styled = lines.map((l: string) => applyColor(theme, CONFIG.tools.general.outputColor, l));
    return makeText(ctx.lastComponent, errorLabel(theme) + formatExpandedLines(styled, "tail", theme));
  }

  const count = lines.length > 0 ? { label: "lines", value: lines.length } : undefined;

  if (!options.expanded) {
    return makeText(ctx.lastComponent, doneLabel(theme, count) + (lines.length > 0 ? expandHint(theme) : ""));
  }

  return createMarkdownResult(doneLabel(theme, count), text, getMarkdownTheme(), "head", theme);
}

// --- fetch_content tool ---

export function renderFetchContentCall(args: any, theme: Theme, ctx: any): Component {
  const url = args.url ?? (args.urls ? args.urls.join(", ") : "");
  const summary = applyColor(theme, CONFIG.tools.general.summaryColor, url);
  if (ctx.isPartial) {
    const frame = ensureSpinner(ctx);
    return makeText(ctx.lastComponent, toolHeader("Fetch", summary, theme, spinnerDot(theme, frame), undefined, WEB_TITLE_COLOR) + "\n" + renderPartial(theme));
  }
  clearSpinner(ctx);
  return makeText(ctx.lastComponent, toolHeader("Fetch", summary, theme, undefined, ctx.isError, WEB_TITLE_COLOR));
}

export function renderFetchContentResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: Theme, ctx: any): Component {
  const text = getFirstTextContent(result);
  const lines = outputLines(text).filter((l: string) => l.trim().length > 0);

  if (ctx.isError) {
    if (!options.expanded) {
      return makeText(ctx.lastComponent, errorLabel(theme) + expandHint(theme));
    }
    const styled = lines.map((l: string) => applyColor(theme, CONFIG.tools.general.outputColor, l));
    return makeText(ctx.lastComponent, errorLabel(theme) + formatExpandedLines(styled, "tail", theme));
  }

  const count = lines.length > 0 ? { label: "lines", value: lines.length } : undefined;

  if (!options.expanded) {
    return makeText(ctx.lastComponent, doneLabel(theme, count) + (lines.length > 0 ? expandHint(theme) : ""));
  }

  return createMarkdownResult(doneLabel(theme, count), text, getMarkdownTheme(), "head-tail", theme);
}

// --- get_search_content tool ---

export function renderGetSearchContentCall(args: any, theme: Theme, ctx: any): Component {
  const id = args.responseId ?? "";
  const summary = applyColor(theme, CONFIG.tools.general.summaryColor, id.length > 20 ? id.slice(0, 20) + "…" : id);
  if (ctx.isPartial) {
    const frame = ensureSpinner(ctx);
    return makeText(ctx.lastComponent, toolHeader("Get Content", summary, theme, spinnerDot(theme, frame), undefined, WEB_TITLE_COLOR) + "\n" + renderPartial(theme));
  }
  clearSpinner(ctx);
  return makeText(ctx.lastComponent, toolHeader("Get Content", summary, theme, undefined, ctx.isError, WEB_TITLE_COLOR));
}

export function renderGetSearchContentResult(result: any, options: { expanded: boolean; isPartial: boolean }, theme: Theme, ctx: any): Component {
  const text = getFirstTextContent(result);
  const lines = outputLines(text).filter((l: string) => l.trim().length > 0);

  if (ctx.isError) {
    if (!options.expanded) {
      return makeText(ctx.lastComponent, errorLabel(theme) + expandHint(theme));
    }
    const styled = lines.map((l: string) => applyColor(theme, CONFIG.tools.general.outputColor, l));
    return makeText(ctx.lastComponent, errorLabel(theme) + formatExpandedLines(styled, "tail", theme));
  }

  const count = lines.length > 0 ? { label: "lines", value: lines.length } : undefined;

  if (!options.expanded) {
    return makeText(ctx.lastComponent, doneLabel(theme, count) + (lines.length > 0 ? expandHint(theme) : ""));
  }

  return createMarkdownResult(doneLabel(theme, count), text, getMarkdownTheme(), "head-tail", theme);
}