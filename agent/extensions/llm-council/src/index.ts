/**
 * LLM Council Tool — Ask multiple models, synthesize with a chairman.
 *
 * Spawns member models in parallel, then a chairman model
 * that synthesizes the answers into a final response.
 * Progress streams inline via renderResult.
 *
 * Rendering follows styled-outputs visual vocabulary:
 * ✓/✗ prefiix, └─ branch lines, · indent, expand hints.
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI, Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Markdown, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";
import { loadConfig } from "./config.js";

// ── Styling helpers (styled-outputs vocabulary) ──────────────────────────

function isHexColor(color: string): boolean {
  return typeof color === "string" && color.startsWith("#");
}

function applyColor(theme: Theme, color: string, text: string): string {
  if (isHexColor(color)) {
    const h = color.replace("#", "");
    if (!/^[0-9a-fA-F]{6}$/.test(h)) return text;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
  }
  try {
    return theme.fg(color as ThemeColor, text);
  } catch {
    return text;
  }
}

function getVisibleWidth(text: string): number {
  return text.replace(/\x1b\[[0-9;]*m/g, "").length;
}

function getExpandToggleKey(): string {
  const kbPath = path.join(os.homedir(), ".pi", "agent", "keybindings.json");
  try {
    if (!fs.existsSync(kbPath)) return "ctrl+o";
    const bindings = JSON.parse(fs.readFileSync(kbPath, "utf-8"));
    return (bindings["app.tools.expand"] as string) ?? "ctrl+o";
  } catch {
    return "ctrl+o";
  }
}

const SUCCESS_PREFIX = "✓";
const ERROR_PREFIX = "✗";
const BRANCH_PREFIX = "└─";
const SPINNER_CHARS = ["·", "✢", "✳", "✶", "✻", "✽"];
const SPINNER_FRAMES = [...SPINNER_CHARS, ...[...SPINNER_CHARS].reverse()];
const SPINNER_INTERVAL = 80;
const INDENT_WIDTH = getVisibleWidth(BRANCH_PREFIX) + 1; // "└─ "

function successPrefix(theme: Theme): string {
  return `${applyColor(theme, "success", SUCCESS_PREFIX)} `;
}

function errorPrefix(theme: Theme): string {
  return `${applyColor(theme, "error", ERROR_PREFIX)} `;
}

function branchLine(text: string, theme: Theme): string {
  return `${applyColor(theme, "separator", BRANCH_PREFIX)} ${text}`;
}

function indentLine(text: string): string {
  return `${" ".repeat(INDENT_WIDTH)}${text}`;
}

function expandHint(theme: Theme): string {
  return applyColor(theme, "dim", ` • ${getExpandToggleKey()} to expand`);
}

function toolHeader(label: string, summary: string, theme: Theme, dot?: string, isError?: boolean): string {
  const d = dot ?? (isError ? errorPrefix(theme) : successPrefix(theme));
  const title = applyColor(theme, "toolTitle", theme.bold(label));
  return `${d}${title} ${summary}`;
}


function makeText(lastComponent: any, text: string): Text {
  const comp = lastComponent instanceof Text ? lastComponent : new Text("", 0, 0);
  comp.setText(text);
  return comp;
}

function renderMemberTree(
  details: CouncilDetails,
  theme: Theme,
  spinnerFrame: number,
  opts: {
    memberSubLine: (m: MemberResult) => string;
    chairmanSubLine: string;
    chairmanSubLineSuffix?: string;
  },
): string[] {
  const lines: string[] = [];
  for (const m of details.members) {
    const icon =
      m.status === "done" ? applyColor(theme, "success", "✓") :
      m.status === "error" ? applyColor(theme, "error", "✗") :
      m.status === "working" ? applyColor(theme, "muted", SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length]) :
      applyColor(theme, "muted", "·");
    lines.push(indentLine(`${icon} ${applyColor(theme, "accent", m.label)}: ${applyColor(theme, "dim", m.model)}`));
    lines.push(indentLine(branchLine(opts.memberSubLine(m), theme)));
  }
  if (details.chairman) {
    const cIcon =
      details.chairman.status === "done" ? applyColor(theme, "success", "✓") :
      details.chairman.status === "error" ? applyColor(theme, "error", "✗") :
      details.chairman.status === "working" ? applyColor(theme, "muted", SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length]) :
      applyColor(theme, "muted", "·");
    lines.push(indentLine(`${cIcon} 👑 ${applyColor(theme, "dim", `Chairman: ${details.chairman.model}`)}`));
    const suffix = opts.chairmanSubLineSuffix ?? "";
    lines.push(indentLine(branchLine(opts.chairmanSubLine + suffix, theme)));
  }
  return lines;
}

function ensureSpinner(ctx: any): number {
  if (ctx?.state?.spinnerInterval) return ctx.state.spinnerFrame ?? 0;
  if (!ctx?.state) ctx.state = {};
  ctx.state.spinnerFrame = 0;
  ctx.state.spinnerInterval = setInterval(() => {
    ctx.state.spinnerFrame = (ctx.state.spinnerFrame + 1) % SPINNER_FRAMES.length;
    ctx.invalidate?.();
  }, SPINNER_INTERVAL);
  return 0;
}

function clearSpinner(ctx: any) {
  if (ctx?.state?.spinnerInterval) {
    clearInterval(ctx.state.spinnerInterval);
    ctx.state.spinnerInterval = undefined;
  }
}

function formatElapsed(startedAt: number | undefined, endedAt?: number): string {
  if (!startedAt) return "";
  const ms = (endedAt ?? Date.now()) - startedAt;
  return `(${(ms / 1000).toFixed(1)}s)`;
}

function spinnerDot(theme: Theme, frame: number): string {
  return `${applyColor(theme, "muted", SPINNER_FRAMES[frame % SPINNER_FRAMES.length])} `;
}

function createExpandedView(details: CouncilDetails, theme: Theme, markdownTheme: any) {
  const memberMds = details.members.map((m) => ({
    m,
    md: m.status === "done" && m.text ? new Markdown(m.text.trim(), 0, 0, markdownTheme) : null,
  }));
  const chairmanMd = details.chairman?.text
    ? new Markdown(details.chairman.text.trim(), 0, 0, markdownTheme)
    : null;

  let cachedWidth: number | undefined;
  let cachedLines: string[] | undefined;

  return {
    render(width: number): string[] {
      if (cachedLines && cachedWidth === width) return cachedLines;
      const cw = Math.max(1, width - INDENT_WIDTH * 2);
      const lines: string[] = [];

      for (const { m, md } of memberMds) {
        const icon = m.status === "error" ? applyColor(theme, "error", "✗") : applyColor(theme, "success", "✓");
        lines.push(indentLine(`${icon} ${applyColor(theme, "accent", m.label)}: ${applyColor(theme, "dim", m.model)}`));
        if (m.status === "error") {
          lines.push(indentLine(branchLine(`${applyColor(theme, "error", "Failed")} ${applyColor(theme, "dim", formatElapsed(m.startedAt, m.doneAt))}`, theme)));
          if (m.error) lines.push(indentLine(indentLine(applyColor(theme, "error", m.error))));
        } else {
          lines.push(indentLine(branchLine(`${applyColor(theme, "success", "Done")} ${applyColor(theme, "dim", formatElapsed(m.startedAt, m.doneAt))}`, theme)));
          if (md) for (const l of md.render(cw)) lines.push(indentLine(indentLine(l)));
        }
      }

      if (details.chairman) {
        const cIcon = details.chairman.status === "error" ? applyColor(theme, "error", "✗") : applyColor(theme, "success", "✓");
        const cStatus = details.chairman.status === "done"
          ? applyColor(theme, "success", "Done")
          : applyColor(theme, "error", "Failed");
        lines.push(indentLine(`${cIcon} 👑 ${applyColor(theme, "dim", `Chairman: ${details.chairman.model}`)}`));
        lines.push(indentLine(branchLine(cStatus, theme)));
        if (details.chairman.status === "error" && details.chairman.error) {
          lines.push(indentLine(indentLine(applyColor(theme, "error", details.chairman.error))));
        } else if (chairmanMd) {
          for (const l of chairmanMd.render(cw)) lines.push(indentLine(indentLine(l)));
        }
      }

      cachedWidth = width;
      cachedLines = lines;
      return lines;
    },
    invalidate() {
      cachedWidth = undefined;
      cachedLines = undefined;
      for (const { md } of memberMds) md?.invalidate();
      chairmanMd?.invalidate();
    },
  };
}

// ── System prompts ────────────────────────────────────────────────────────

const MEMBER_SYSTEM_PROMPT =
  "You are a member of an LLM Council. Answer the user's question thoroughly and concisely. Provide your best reasoning.";

const CHAIRMAN_SYSTEM_PROMPT =
  "You are the Chairman of an LLM Council. Multiple AI models answered the same question anonymously, labeled A, B, C, etc. " +
  "Synthesize the best answer, drawing on the strongest points from each response. " +
  "Resolve any disagreements. Present a unified, well-reasoned answer. " +
  "Do not mention which model gave which answer — treat them as anonymous perspectives.";

// ── Types ────────────────────────────────────────────────────────────────

interface MemberResult {
  label: string;
  model: string;
  status: "pending" | "working" | "done" | "error";
  text: string;
  error?: string;
  startedAt?: number;
  doneAt?: number;
}

interface CouncilDetails {
  stage: "members" | "chairman" | "complete" | "error";
  members: MemberResult[];
  chairman?: { model: string; status: "pending" | "working" | "done" | "error"; text: string; error?: string; startedAt?: number; doneAt?: number };
}

interface SubagentResult {
  text: string;
  exitCode: number;
  stderr: string;
  error?: string;
}


// ── Subprocess ───────────────────────────────────────────────────────────

function getPiInvocation(args: string[]): { command: string; args: string[] } {
  const currentScript = process.argv[1];
  const isBunVirtualScript = currentScript?.startsWith("/$bunfs/root/");
  if (currentScript && !isBunVirtualScript && fs.existsSync(currentScript)) {
    return { command: process.execPath, args: [currentScript, ...args] };
  }
  const execName = path.basename(process.execPath).toLowerCase();
  const isGenericRuntime = /^(node|bun)(\.exe)?$/.test(execName);
  if (!isGenericRuntime) {
    return { command: process.execPath, args };
  }
  return { command: "pi", args };
}

async function runSubagent(
  model: string,
  prompt: string,
  systemPrompt: string | undefined,
  cwd: string,
  signal?: AbortSignal,
): Promise<SubagentResult> {
  const args: string[] = ["--mode", "json", "-p", "--no-session", "--model", model, "--no-tools"];

  let tmpDir: string | null = null;
  let tmpFile: string | null = null;

  try {
    if (systemPrompt) {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-council-"));
      tmpFile = path.join(tmpDir, "system-prompt.md");
      fs.writeFileSync(tmpFile, systemPrompt, { mode: 0o600 });
      args.push("--append-system-prompt", tmpFile);
    }

    args.push(prompt);

    const result: SubagentResult = { text: "", exitCode: 0, stderr: "" };

    result.exitCode = await new Promise<number>((resolve) => {
      const invocation = getPiInvocation(args);
      const proc = spawn(invocation.command, invocation.args, {
        cwd,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
      });

      let buffer = "";

      const processLine = (line: string) => {
        if (!line.trim()) return;
        let event: any;
        try {
          event = JSON.parse(line);
        } catch {
          return;
        }
        if (event.type === "message_end" && event.message) {
          const msg = event.message;
          if (msg.role === "assistant") {
            for (const part of msg.content) {
              if (part.type === "text") {
                result.text += part.text;
              }
            }
          }
        }
      };

      proc.stdout.on("data", (data: Buffer) => {
        buffer += data.toString();
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) processLine(line);
      });

      proc.stderr.on("data", (data: Buffer) => {
        result.stderr += data.toString();
      });

      proc.on("close", (code) => {
        if (buffer.trim()) processLine(buffer);
        resolve(code ?? 0);
      });

      proc.on("error", () => {
        resolve(1);
      });

      if (signal) {
        const killProc = () => {
          proc.kill("SIGTERM");
          setTimeout(() => {
            if (!proc.killed) proc.kill("SIGKILL");
          }, 5000);
        };
        if (signal.aborted) killProc();
        else signal.addEventListener("abort", killProc, { once: true });
      }
    });

    if (result.exitCode !== 0 && !result.text && result.stderr) {
      result.error = result.stderr.split("\n").filter(Boolean).pop() || "Process failed";
    }

    return result;
  } finally {
    if (tmpFile) {
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }
    if (tmpDir) {
      try { fs.rmdirSync(tmpDir); } catch { /* ignore */ }
    }
  }
}

// ── Council logic ─────────────────────────────────────────────────────────

async function runCouncil(
  question: string,
  config: { members: string[]; chairman: string },
  cwd: string,
  signal: AbortSignal | undefined,
  onUpdate: (details: CouncilDetails) => void,
): Promise<{ content: { type: "text"; text: string }[]; details: CouncilDetails }> {
  const labels = ["A", "B", "C", "D", "E", "F", "G", "H"];

  const details: CouncilDetails = {
    stage: "members",
    members: config.members.map((model, i) => ({
      label: labels[i] ?? String(i + 1),
      model,
      status: "pending" as const,
      text: "",
    })),
    chairman: { model: config.chairman, status: "pending", text: "" },
  };

  const emit = () => onUpdate(details);

  // Phase 1: Run members in parallel
  emit();

  const memberPromises = details.members.map(async (m) => {
    m.status = "working";
    m.startedAt = Date.now();
    emit();
    const result = await runSubagent(m.model, question, MEMBER_SYSTEM_PROMPT, cwd, signal);
    if (result.exitCode === 0 && result.text) {
      m.status = "done";
      m.doneAt = Date.now();
      m.text = result.text;
    } else {
      m.status = "error";
      m.doneAt = Date.now();
      m.error = result.error || "Failed";
      m.text = result.text || "";
    }
    emit();
  });

  await Promise.all(memberPromises);

  const successfulMembers = details.members.filter((m) => m.status === "done" && m.text);
  if (successfulMembers.length === 0) {
    details.stage = "error";
    emit();
    return {
      content: [{ type: "text", text: `Council failed: no models returned valid responses.` }],
      details,
    };
  }

  // Phase 2: Run chairman
  details.chairman = { model: config.chairman, status: "working", text: "", startedAt: Date.now() };
  details.stage = "chairman";
  emit();

  let chairmanPrompt = `Question: ${question}\n\nHere are anonymous answers from council members:\n`;
  for (const m of successfulMembers) {
    chairmanPrompt += `\n--- Member ${m.label} ---\n${m.text}\n`;
  }
  chairmanPrompt += "\n---\nSynthesize a unified answer incorporating the best points from each response.";

  const chairmanResult = await runSubagent(config.chairman, chairmanPrompt, CHAIRMAN_SYSTEM_PROMPT, cwd, signal);

  if (chairmanResult.exitCode === 0 && chairmanResult.text) {
    details.chairman.status = "done";
    details.chairman.doneAt = Date.now();
    details.chairman.text = chairmanResult.text;
  } else {
    details.chairman.status = "error";
    details.chairman.doneAt = Date.now();
    details.chairman.error = chairmanResult.error || "Chairman failed";
    details.chairman.text = chairmanResult.text || "";
  }

  details.stage = "complete";
  emit();

  const finalText = details.chairman.text || details.chairman.error || "No output from chairman";
  return {
    content: [{ type: "text", text: finalText }],
    details,
  };
}

// ── Live progress bridge (renderCall workaround for isPartial bug) ────────
let liveDetails: CouncilDetails | null = null;

// ── Tool registration ────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "llm_council",
    label: "LLM Council",
    description: [
      "Convene an LLM Council — multiple models answer a question independently,",
      "then a chairman synthesizes their answers into a unified response.",
      "Use for questions that benefit from multiple perspectives, cross-checking,",
      "or when accuracy matters. Not for simple factual questions.",
    ].join(" "),
    promptSnippet: "Ask multiple LLMs for a council opinion",
    promptGuidelines: [
      "Use llm_council for complex questions that benefit from multiple LLM perspectives or cross-checking.",
      "Do NOT use llm_council for simple factual questions or routine tasks.",
    ],
    parameters: Type.Object({
      question: Type.String({ description: "The question to pose to the council" }),
    }),

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const config = loadConfig();
      return runCouncil(params.question, config, ctx.cwd, signal, (details) => {
        liveDetails = details;
        const stageLabels: Record<string, string> = {
          members: "Members deliberating...",
          chairman: "Chairman synthesizing...",
          complete: "Complete",
          error: "Failed",
        };
        const doneCount = details.members.filter((m) => m.status === "done" || m.status === "error").length;
        const stageText = stageLabels[details.stage] || details.stage;
        let text = `[Council] ${stageText}`;
        if (details.stage === "members") {
          text += ` ${doneCount}/${details.members.length} done`;
        }
        onUpdate?.({
          content: [{ type: "text", text }],
          details,
        });
      });
    },

    renderCall(args, theme, ctx) {
      const preview = args.question?.length > 40 ? `${args.question.slice(0, 40)}…` : (args.question || "…");
      const summary = applyColor(theme, "dim", preview);

      if (!ctx?.isPartial) {
        clearSpinner(ctx);
        liveDetails = null;
        return makeText(ctx?.lastComponent, toolHeader("LLM Council", summary, theme));
      }

      const frame = ensureSpinner(ctx);
      const dot = applyColor(theme, "muted", SPINNER_FRAMES[frame % SPINNER_FRAMES.length]);
      const lines = [toolHeader("LLM Council", summary, theme, spinnerDot(theme, frame))];

      if (!liveDetails) {
        // Skeleton before first onUpdate fires
        if (!ctx.state.config) ctx.state.config = loadConfig();
        const config = ctx.state.config;
        const labels = ["A", "B", "C", "D", "E", "F", "G", "H"];
        for (const [i, model] of config.members.entries()) {
          const label = labels[i] ?? String(i + 1);
          lines.push(indentLine(`${dot} ${applyColor(theme, "accent", label)}: ${applyColor(theme, "dim", model)}`));
          lines.push(indentLine(branchLine(applyColor(theme, "muted", "Spawning"), theme)));
        }
        lines.push(indentLine(`${dot} 👑 ${applyColor(theme, "dim", `Chairman: ${config.chairman}`)}`));
        lines.push(indentLine(branchLine(applyColor(theme, "muted", "Waiting for members"), theme)));
        return makeText(ctx.lastComponent, lines.join("\n"));
      }

      // Live progress from onUpdate
      const details = liveDetails;
      lines.push(...renderMemberTree(details, theme, frame, {
        memberSubLine: (m) =>
          m.status === "done"    ? `${applyColor(theme, "success", "Done")} ${applyColor(theme, "dim", formatElapsed(m.startedAt, m.doneAt))}` :
          m.status === "working" ? applyColor(theme, "muted", "Working…") :
          m.status === "error"   ? `${applyColor(theme, "error", m.error?.slice(0, 60) || "Error")} ${applyColor(theme, "dim", formatElapsed(m.startedAt, m.doneAt))}` :
                                   applyColor(theme, "muted", "Pending"),
        chairmanSubLine:
          details.stage === "chairman" && details.chairman?.status === "working"
            ? applyColor(theme, "muted", "Synthesizing…")
            : applyColor(theme, "muted", "Waiting for members"),
      }));
      return makeText(ctx.lastComponent, lines.join("\n"));
    },

    renderResult(result, options, theme, ctx) {
      const details = result.details as CouncilDetails | undefined;
      const expanded = options?.expanded ?? false;

      // No details — plain text fallback
      if (!details) {
        const text = result.content[0];
        return makeText(ctx?.lastComponent, text?.type === "text" ? text.text : "(no output)");
      }

      const frame = ctx?.state?.spinnerFrame ?? 0;

      // ── Error state ──────────────────────────────────────────────────
      if (details.stage === "error") {
        const lines = renderMemberTree(details, theme, 0, {
          memberSubLine: (m) => applyColor(theme, "error", m.error?.slice(0, 60) || "Unknown error"),
          chairmanSubLine: applyColor(theme, "muted", "Not started"),
        });
        return makeText(ctx?.lastComponent, lines.join("\n"));
      }

      // ── Progress: members deliberating ─────────────────────────────────
      if (details.stage === "members") {
        const lines = renderMemberTree(details, theme, frame, {
          memberSubLine: (m) =>
            m.status === "done"    ? `${applyColor(theme, "success", "Done")} ${applyColor(theme, "dim", formatElapsed(m.startedAt, m.doneAt))}` :
            m.status === "working" ? applyColor(theme, "muted", "Working…") :
            m.status === "error"   ? `${applyColor(theme, "error", m.error?.slice(0, 60) || "Error")} ${applyColor(theme, "dim", formatElapsed(m.startedAt, m.doneAt))}` :
            applyColor(theme, "muted", "Pending"),
          chairmanSubLine: applyColor(theme, "muted", "Waiting for members"),
        });
        return makeText(ctx?.lastComponent, lines.join("\n"));
      }

      // ── Progress: chairman synthesizing ────────────────────────────────
      if (details.stage === "chairman") {
        const lines = renderMemberTree(details, theme, frame, {
          memberSubLine: (m) =>
            m.status === "done"  ? `${applyColor(theme, "success", "Done")} ${applyColor(theme, "dim", formatElapsed(m.startedAt, m.doneAt))}` :
            `${applyColor(theme, "error", m.error?.slice(0, 60) || "Error")} ${applyColor(theme, "dim", formatElapsed(m.startedAt, m.doneAt))}`,
          chairmanSubLine:
            details.chairman?.status === "working" ? applyColor(theme, "muted", "Synthesizing…") :
            details.chairman?.status === "error"   ? applyColor(theme, "error", details.chairman.error?.slice(0, 60) || "Failed") :
            details.chairman?.status === "done"    ? applyColor(theme, "success", "Done") :
            applyColor(theme, "muted", "Waiting for members"),
        });
        return makeText(ctx?.lastComponent, lines.join("\n"));
      }

      // ── Complete: collapsed ────────────────────────────────────────────
      if (!expanded) {
        const lines = renderMemberTree(details, theme, 0, {
          memberSubLine: (m) =>
            m.status === "done"  ? `${applyColor(theme, "success", "Done")} ${applyColor(theme, "dim", formatElapsed(m.startedAt, m.doneAt))}` :
            `${applyColor(theme, "error", m.error?.slice(0, 60) || "Error")} ${applyColor(theme, "dim", formatElapsed(m.startedAt, m.doneAt))}`,
          chairmanSubLine: details.chairman?.status === "error"
            ? applyColor(theme, "error", details.chairman.error?.slice(0, 60) || "Failed")
            : applyColor(theme, "success", "Done"),
          chairmanSubLineSuffix: expandHint(theme),
        });
        return makeText(ctx?.lastComponent, lines.join("\n"));
      }

      // ── Complete: expanded ────────────────────────────────────────────
      return createExpandedView(details, theme, getMarkdownTheme());
    },
  });
}