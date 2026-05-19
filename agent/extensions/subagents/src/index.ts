/**
 * Subagents Tool — Delegate tasks to specialized subagents.
 *
 * Spawns a child pi process with agent-specific config (model, tools,
 * thinking, extensions, skills). The parent LLM delegates work via
 * the `subagent` tool — one agent at a time, synchronous.
 *
 * Rendering follows styled-outputs visual vocabulary:
 * ✓/✗ prefix, └─ branch lines, · indent, expand hints.
 * All labels, colors, and symbols are configurable via
 * ~/.pi/agent/configs/subagents.json
 */

import { spawn } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import type { ExtensionAPI, Theme } from "@earendil-works/pi-coding-agent";
import { getMarkdownTheme } from "@earendil-works/pi-coding-agent";
import { Markdown, Text } from "@earendil-works/pi-tui";
import { Type } from "typebox";

import { discoverAgents, formatAgentList } from "./agents.js";
import { CONFIG } from "./config.js";
import type { AgentConfig, SingleResult, SubagentDetails } from "./types.js";
import { applyColor, formatElapsed, getExpandToggleKey, getVisibleWidth } from "./utils.js";

// ── Derived constants (computed once from CONFIG) ────────────────────────

const SPINNER_FRAMES = [...CONFIG.shared.spinner.prefixChars, ...[...CONFIG.shared.spinner.prefixChars].reverse()];
const INDENT_WIDTH = getVisibleWidth(CONFIG.shared.branch.prefix) + 1;

// ── Styling helpers ──────────────────────────────────────────────────────

function successPrefix(theme: Theme): string {
  return `${applyColor(theme, CONFIG.shared.successPrefix.color, CONFIG.shared.successPrefix.prefix)} `;
}

function errorPrefix(theme: Theme): string {
  return `${applyColor(theme, CONFIG.shared.errorPrefix.color, CONFIG.shared.errorPrefix.prefix)} `;
}

function branchLine(text: string, theme: Theme): string {
  return `${applyColor(theme, CONFIG.shared.branch.color, CONFIG.shared.branch.prefix)} ${text}`;
}

function indentLine(text: string): string {
  return `${" ".repeat(INDENT_WIDTH)}${text}`;
}

function expandHint(theme: Theme): string {
  return applyColor(theme, CONFIG.shared.expandHint.color, ` • ${getExpandToggleKey()} to expand`);
}

function lineCount(text: string | undefined, theme: Theme): string | null {
  if (!text) return null;
  const nonEmpty = text.split("\n").filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return null;
  return applyColor(theme, CONFIG.shared.status.countColor, `${nonEmpty.length} lines`);
}

function toolHeader(label: string, summary: string, theme: Theme, dot?: string, isError?: boolean): string {
  const d = dot ?? (isError ? errorPrefix(theme) : successPrefix(theme));
  const title = applyColor(theme, CONFIG.shared.header.titleColor, theme.bold(label));
  return `${d}${title}${summary}`;
}

function makeText(lastComponent: any, text: string): Text {
  const comp = lastComponent instanceof Text ? lastComponent : new Text("", 0, 0);
  comp.setText(text);
  return comp;
}

// ── Spinner helpers ──────────────────────────────────────────────────────

function ensureSpinner(ctx: any): number {
  if (ctx?.state?.spinnerInterval) return ctx.state.spinnerFrame ?? 0;
  if (!ctx?.state) ctx.state = {};
  ctx.state.spinnerFrame = 0;
  ctx.state.spinnerInterval = setInterval(() => {
    ctx.state.spinnerFrame = (ctx.state.spinnerFrame + 1) % SPINNER_FRAMES.length;
    ctx.invalidate?.();
  }, CONFIG.shared.spinner.interval);
  return 0;
}

function clearSpinner(ctx: any) {
  if (ctx?.state?.spinnerInterval) {
    clearInterval(ctx.state.spinnerInterval);
    ctx.state.spinnerInterval = undefined;
  }
}

function spinnerDot(theme: Theme, frame: number): string {
  return `${applyColor(theme, CONFIG.shared.spinner.color, SPINNER_FRAMES[frame % SPINNER_FRAMES.length])} `;
}

// ── Collapsed / expanded views ───────────────────────────────────────────

function statusSep(theme: Theme): string {
  return applyColor(theme, CONFIG.shared.status.separatorColor, " • ");
}

function buildStatusLine(r: SingleResult, theme: Theme, includeHint: boolean): string {
  const elapsed = applyColor(theme, CONFIG.shared.status.elapsedColor, formatElapsed(r.startedAt, r.doneAt));
  const count = lineCount(r.text, theme);
  const done = applyColor(theme, CONFIG.shared.status.doneColor, CONFIG.shared.status.doneLabel);

  if (r.exitCode !== 0) {
    const err = applyColor(theme, CONFIG.shared.status.errorColor, CONFIG.shared.status.errorLabel);
    return branchLine(err + (includeHint ? expandHint(theme) : ""), theme);
  }

  let text = done;
  if (count) text += statusSep(theme) + count;
  text += statusSep(theme) + elapsed;
  if (includeHint) text += expandHint(theme);
  return branchLine(text, theme);
}

function buildCollapsedView(detail: SubagentDetails, theme: Theme): string[] {
  const lines: string[] = [];
  for (const r of detail.results) {
    lines.push(buildStatusLine(r, theme, true));
    if (r.exitCode !== 0 && r.error) {
      lines.push(indentLine(applyColor(theme, CONFIG.shared.status.errorColor, r.error)));
    }
    lines.push("");
  }
  return lines;
}

function createExpandedView(details: SubagentDetails, theme: Theme, markdownTheme: any) {
  const text = details.results[0]?.text?.trim();
  const md = text ? new Markdown(text, 0, 0, markdownTheme) : null;

  let cachedWidth: number | undefined;
  let cachedLines: string[] | undefined;

  return {
    render(width: number): string[] {
      if (cachedLines && cachedWidth === width) return cachedLines;
      const cw = Math.max(1, width - INDENT_WIDTH);
      const lines: string[] = [""];

      for (const r of details.results) {
        lines.push(buildStatusLine(r, theme, false));

        if (r.exitCode !== 0 && r.error) {
          lines.push(indentLine(applyColor(theme, CONFIG.shared.status.errorColor, r.error)));
        } else if (md) {
          for (const l of md.render(cw)) lines.push(indentLine(l));
        }
        lines.push("");
      }

      cachedWidth = width;
      cachedLines = lines;
      return lines;
    },
    invalidate() {
      cachedWidth = undefined;
      cachedLines = undefined;
      md?.invalidate();
    },
  };
}

// ── Subprocess ───────────────────────────────────────────────────────────

interface ExecConfig {
  model?: string;
  tools: string[];
  thinking?: string;
  extensions: string[];
  skills: string[];
}

function buildExecArgs(exec: ExecConfig): string[] {
  const args: string[] = [];

  // model
  if (exec.model) {
    args.push("--model", exec.model);
  }

  // tools: always defined → --tools <list> or --no-tools
  if (exec.tools.length === 0) {
    args.push("--no-tools");
  } else {
    args.push("--tools", exec.tools.join(","));
  }

  // thinking
  if (exec.thinking) {
    args.push("--thinking", exec.thinking);
  }

  // extensions: always explicit — empty → --no-extensions, values → --no-extensions -e <path>
  if (exec.extensions.length === 0) {
    args.push("--no-extensions");
  } else {
    args.push("--no-extensions");
    for (const name of exec.extensions) {
      args.push("-e", path.join(os.homedir(), ".pi", "agent", "extensions", name, "src", "index.ts"));
    }
  }

  // skills: always explicit — empty → --no-skills, values → --no-skills --skill <path>
  if (exec.skills.length === 0) {
    args.push("--no-skills");
  } else {
    args.push("--no-skills");
    for (const name of exec.skills) {
      args.push("--skill", path.join(os.homedir(), ".pi", "agent", "skills", name, "SKILL.md"));
    }
  }

  // always no context files
  args.push("--no-context-files");

  return args;
}

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
  agent: AgentConfig,
  task: string,
  cwd: string,
  parentModel?: string,
  parentThinking?: string,
  signal?: AbortSignal,
): Promise<SingleResult> {
  const baseArgs: string[] = ["--mode", "json", "-p", "--no-session"];
  const execConfig: ExecConfig = {
    model: agent.model ?? parentModel,
    tools: agent.tools,
    thinking: agent.thinking ?? parentThinking,
    extensions: agent.extensions,
    skills: agent.skills,
  };
  const execArgs = buildExecArgs(execConfig);
  const args: string[] = [...baseArgs, ...execArgs];

  const startedAt = Date.now();

  let tmpDir: string | null = null;
  let tmpFile: string | null = null;

  try {
    if (agent.systemPrompt) {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "pi-subagent-"));
      tmpFile = path.join(tmpDir, "system-prompt.md");
      fs.writeFileSync(tmpFile, agent.systemPrompt, { mode: 0o600 });
      args.push("--append-system-prompt", tmpFile);
    }

    if (process.env.PI_SUBAGENT_DEPTH) {
      throw new Error("Subagents cannot spawn further subprocesses");
    }

    args.push(task);

    let text = "";
    let stderr = "";
    let error: string | undefined;

    const exitCode = await new Promise<number>((resolve) => {
      const invocation = getPiInvocation(args);
      const proc = spawn(invocation.command, invocation.args, {
        cwd,
        shell: false,
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, PI_SUBAGENT_DEPTH: "1" },
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
                text += part.text;
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
        stderr += data.toString();
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

    const doneAt = Date.now();

    if (exitCode !== 0 && !text && stderr) {
      error = stderr.split("\n").filter(Boolean).pop() || "Process failed";
    }

    return { agent: agent.name, task, exitCode, text, error, startedAt, doneAt };
  } finally {
    if (tmpFile) {
      try { fs.unlinkSync(tmpFile); } catch { /* ignore */ }
    }
    if (tmpDir) {
      try { fs.rmdirSync(tmpDir); } catch { /* ignore */ }
    }
  }
}

// ── Tool registration ────────────────────────────────────────────────────

export default function (pi: ExtensionAPI) {
  pi.registerTool({
    name: "subagent",
    label: "Subagent",
    description: `Delegate a task to a specialized subagent. Available agents: ${formatAgentList(discoverAgents(process.cwd()).agents)}`,
    promptSnippet: "Delegate to a subagent",
    promptGuidelines: [
      "Use subagent for complex, multi-step tasks that match a specialized agent's description.",
      "Prefer subagent when an agent's tools/model/skills are better suited to the task than your own.",
      "Do NOT use subagent for trivial one-line questions or tasks you can do directly.",
      "Chain multiple subagent calls sequentially if needed — each result is returned to you.",
    ],
    parameters: Type.Object({
      agent: Type.String({ description: "Name of the agent to delegate to" }),
      task: Type.String({ description: "The task or question for the subagent" }),
    }),

    async execute(_toolCallId, params, signal, _onUpdate, ctx) {
      const { agents } = discoverAgents(ctx.cwd);

      const agent = agents.get(params.agent);
      if (!agent) {
        const available = [...agents.keys()].join(", ");
        throw new Error(`Unknown agent "${params.agent}". Available: ${available || "(none)"}`);
      }

      // Extract parent model and thinking for inheritance
      const parentModel = ctx.model ? `${ctx.model.id}:${ctx.model.provider}` : undefined;
      const thinkingIdx = process.argv.indexOf("--thinking");
      const parentThinking = thinkingIdx !== -1 ? process.argv[thinkingIdx + 1] : undefined;

      const result = await runSubagent(agent, params.task, ctx.cwd, parentModel, parentThinking, signal);

      return {
        content: [{ type: "text", text: result.text || result.error || "No output" }],
        details: {
          mode: "single" as const,
          results: [result],
        } satisfies SubagentDetails,
      };
    },

    renderCall(args, theme, ctx) {
      const agent = applyColor(theme, CONFIG.shared.header.agentColor, args.agent ?? "subagent");
      const headerText = ` ${agent}`;

      if (!ctx?.isPartial) {
        clearSpinner(ctx);
        return makeText(ctx?.lastComponent, toolHeader("Subagent", headerText, theme));
      }

      const frame = ensureSpinner(ctx);
      const running = branchLine(
        applyColor(theme, CONFIG.shared.status.workingColor, CONFIG.shared.status.workingLabel),
        theme,
      );
      return makeText(ctx?.lastComponent, toolHeader("Subagent", headerText, theme, spinnerDot(theme, frame)) + "\n" + running);
    },

    renderResult(result, options, theme, ctx) {
      const details = result.details as SubagentDetails | undefined;
      const expanded = options?.expanded ?? false;

      // No details — plain text fallback
      if (!details || details.results.length === 0) {
        const text = result.content[0];
        return makeText(ctx?.lastComponent, text?.type === "text" ? text.text : "(no output)");
      }

      const r = details.results[0];

      // No text yet (partial render during execution) — show running
      if (!options?.expanded && !r.text && r.exitCode === 0) {
        const running = branchLine(
          applyColor(theme, CONFIG.shared.status.workingColor, CONFIG.shared.status.workingLabel),
          theme,
        );
        return makeText(ctx?.lastComponent, running);
      }

      // ── Collapsed view ──────────────────────────────────────────────
      if (!expanded) {
        return makeText(ctx?.lastComponent, buildCollapsedView(details, theme).join("\n"));
      }

      // ── Expanded view ───────────────────────────────────────────────
      return createExpandedView(details, theme, getMarkdownTheme());
    },
  });
}
