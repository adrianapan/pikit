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
import { CONFIG, MAX_PARALLEL_TASKS, MAX_CONCURRENCY, TASK_PREVIEW_LENGTH } from "./config.js";
import type { AgentConfig, SingleResult, SubagentDetails, TaskItem } from "./types.js";
import { applyColor, formatElapsed, getExpandToggleKey, getVisibleWidth, mapWithConcurrencyLimit, truncateParallelOutput } from "./utils.js";

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
  const s = summary ? applyColor(theme, CONFIG.shared.header.summaryColor, summary) : "";
  return `${d}${title}${s}`;
}

function makeText(lastComponent: any, text: string): Text {
  const comp = lastComponent instanceof Text ? lastComponent : new Text("", 0, 0);
  comp.setText(text);
  return comp;
}

// ── Agent tree rendering (shared by renderCall and renderResult) ─────────

function renderAgentTree(
  details: SubagentDetails,
  theme: Theme,
  spinnerFrame: number,
): string[] {
  const lines: string[] = [];
  for (const r of details.results) {
    // Icon
    let icon: string;
    if (r.status === "done") {
      icon = applyColor(theme, CONFIG.shared.successPrefix.color, CONFIG.shared.successPrefix.prefix);
    } else if (r.status === "error") {
      icon = applyColor(theme, CONFIG.shared.errorPrefix.color, CONFIG.shared.errorPrefix.prefix);
    } else if (r.status === "working") {
      icon = applyColor(theme, CONFIG.shared.spinner.color, SPINNER_FRAMES[spinnerFrame % SPINNER_FRAMES.length]);
    } else {
      icon = applyColor(theme, CONFIG.shared.status.waitingIconColor, CONFIG.shared.status.waitingIcon);
    }

    // Agent label
    const agentLabel = r.agent;
    const agentColored = applyColor(theme, CONFIG.shared.header.agentColor, agentLabel);

    // Task preview (strip {previous} for chain)
    let taskPreview = details.mode === "chain" ? r.task.replace(/\{previous\}/g, "") : r.task;
    if (taskPreview.length > TASK_PREVIEW_LENGTH) {
      taskPreview = taskPreview.slice(0, TASK_PREVIEW_LENGTH) + "...";
    }
    const taskPreviewColored = applyColor(theme, "dim", taskPreview);

    lines.push(indentLine(`${icon} ${agentColored} ${taskPreviewColored}`));

    // Status sub-line
    let statusLine: string;
    if (r.status === "done") {
      const lc = lineCount(r.text, theme);
      let st = applyColor(theme, CONFIG.shared.status.doneColor, CONFIG.shared.status.doneLabel);
      if (lc) st += statusSep(theme) + lc;
      st += statusSep(theme) + applyColor(theme, CONFIG.shared.status.elapsedColor, formatElapsed(r.startedAt, r.doneAt));
      statusLine = st;
    } else if (r.status === "error") {
      statusLine = `${applyColor(theme, CONFIG.shared.status.errorColor, CONFIG.shared.status.errorLabel)} · ${applyColor(theme, CONFIG.shared.status.elapsedColor, formatElapsed(r.startedAt, r.doneAt))}`;
    } else if (r.status === "working") {
      statusLine = applyColor(theme, CONFIG.shared.status.workingColor, CONFIG.shared.status.workingLabel);
    } else {
      statusLine = applyColor(theme, CONFIG.shared.status.workingColor, "Waiting...");
    }
    lines.push(indentLine(branchLine(statusLine, theme)));

    // Empty line between agents
    lines.push("");
  }
  return lines;
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

function createMultiExpandedView(details: SubagentDetails, theme: Theme, markdownTheme: any) {
  const memberMds = details.results.map((r) => ({
    r,
    md: r.status !== "error" && r.text ? new Markdown(r.text.trim(), 0, 0, markdownTheme) : null,
  }));

  let cachedWidth: number | undefined;
  let cachedLines: string[] | undefined;

  return {
    render(width: number): string[] {
      if (cachedLines && cachedWidth === width) return cachedLines;
      const cw = Math.max(1, width - INDENT_WIDTH * 2);
      const lines: string[] = [""];

      for (const { r, md } of memberMds) {
        const icon = r.status === "error"
          ? applyColor(theme, CONFIG.shared.errorPrefix.color, CONFIG.shared.errorPrefix.prefix)
          : applyColor(theme, CONFIG.shared.successPrefix.color, CONFIG.shared.successPrefix.prefix);
        const agentLabel = r.agent;
        let taskPreview = details.mode === "chain" ? r.task.replace(/\{previous\}/g, "") : r.task;
        if (taskPreview.length > TASK_PREVIEW_LENGTH) {
          taskPreview = taskPreview.slice(0, TASK_PREVIEW_LENGTH) + "...";
        }

        lines.push(indentLine(
          `${icon} ${applyColor(theme, CONFIG.shared.header.agentColor, agentLabel)} ${applyColor(theme, "dim", taskPreview)}`,
        ));

        if (r.status === "error") {
          lines.push(indentLine(branchLine(
            `${applyColor(theme, CONFIG.shared.status.errorColor, CONFIG.shared.status.errorLabel)} · ${applyColor(theme, CONFIG.shared.status.elapsedColor, formatElapsed(r.startedAt, r.doneAt))}`,
            theme,
          )));
          if (r.error) {
            lines.push(indentLine(indentLine(applyColor(theme, CONFIG.shared.status.errorColor, r.error))));
          }
        } else {
          const lc = lineCount(r.text, theme);
          let statusText = applyColor(theme, CONFIG.shared.status.doneColor, CONFIG.shared.status.doneLabel);
          if (lc) statusText += statusSep(theme) + lc;
          statusText += statusSep(theme) + applyColor(theme, CONFIG.shared.status.elapsedColor, formatElapsed(r.startedAt, r.doneAt));
          lines.push(indentLine(branchLine(statusText, theme)));

          if (md) {
            for (const l of md.render(cw)) lines.push(indentLine(indentLine(l)));
          }
        }
        lines.push("");
      }

      const aggregateElapsed = details.mode === "chain"
        ? details.results.reduce((sum, r) => sum + ((r.doneAt ?? 0) - (r.startedAt ?? 0)), 0)
        : Math.max(...details.results.map(r => r.doneAt ?? 0)) - Math.min(...details.results.map(r => r.startedAt || Infinity));
      lines.push(applyColor(theme, "dim", `Worked for ${(aggregateElapsed / 1000).toFixed(1)}s`));

      cachedWidth = width;
      cachedLines = lines;
      return lines;
    },
    invalidate() {
      cachedWidth = undefined;
      cachedLines = undefined;
      for (const { md } of memberMds) md?.invalidate();
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
  onUpdate?: (r: SingleResult) => void,
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
          // Emit partial update for live progress
          onUpdate?.({
            agent: agent.name,
            task,
            exitCode: 0,
            text,
            startedAt,
            doneAt: Date.now(),
          });
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
  // ── Live-details bridge (for renderCall live progress) ────────────
  let liveDetails: SubagentDetails | null = null;

  pi.registerTool({
    name: "subagent",
    label: "Subagent",
    description: `Delegate tasks to specialized subagents. Available agents: ${formatAgentList(discoverAgents(process.cwd()).agents)}. Three modes: single (one agent), tasks (parallel, max ${MAX_PARALLEL_TASKS}, ${MAX_CONCURRENCY} concurrent), chain (sequential, use {previous} to pipe output).`,
    promptSnippet: "Delegate to a subagent",
    promptGuidelines: [
      "Use subagent for complex, multi-step tasks that match a specialized agent's description.",
      "Prefer subagent when an agent's tools/model/skills are better suited to the task than your own.",
      "Do NOT use subagent for trivial one-line questions or tasks you can do directly.",
      "Chain multiple subagent calls sequentially if needed — each result is returned to you.",
    ],
    parameters: Type.Object({
      agent: Type.Optional(Type.String({ description: "Name of the agent to delegate to (single mode)" })),
      task: Type.Optional(Type.String({ description: "Task to delegate (single mode)" })),
      tasks: Type.Optional(Type.Array(Type.Object({
        agent: Type.String({ description: "Name of the agent to invoke" }),
        task: Type.String({ description: "Task to delegate to the agent" }),
        cwd: Type.Optional(Type.String({ description: "Working directory for this agent process" })),
      }), { description: "Array of {agent, task} for parallel execution. Max 8 tasks, 4 concurrent." })),
      chain: Type.Optional(Type.Array(Type.Object({
        agent: Type.String({ description: "Name of the agent to invoke" }),
        task: Type.String({ description: "Task with optional {previous} placeholder for prior step output" }),
        cwd: Type.Optional(Type.String({ description: "Working directory for this agent process" })),
      }), { description: "Array of {agent, task} for sequential execution. Use {previous} to reference prior output." })),
      cwd: Type.Optional(Type.String({ description: "Working directory for the agent process (applies to all modes; per-task cwd overrides it)" })),
    }),

    async execute(_toolCallId, params, signal, onUpdate, ctx) {
      const { agents } = discoverAgents(ctx.cwd);

      const parentModel = ctx.model?.id;
      const thinkingIdx = process.argv.indexOf("--thinking");
      const parentThinking = thinkingIdx !== -1 ? process.argv[thinkingIdx + 1] : undefined;

      // Validate exactly one mode
      const hasChain = (params.chain?.length ?? 0) > 0;
      const hasTasks = (params.tasks?.length ?? 0) > 0;
      const hasSingle = Boolean(params.agent && params.task);
      const modeCount = Number(hasChain) + Number(hasTasks) + Number(hasSingle);
      if (modeCount !== 1) {
        throw new Error("Provide exactly one mode: agent+task (single), tasks (parallel), or chain (sequential).");
      }

      // ── Chain mode ──────────────────────────────────────────────────
      if (params.chain && params.chain.length > 0) {
        const chain = params.chain as TaskItem[];
        const results: SingleResult[] = chain.map((step, i) => ({
          agent: step.agent,
          task: step.task,
          exitCode: 0,
          text: "",
          startedAt: 0,
          doneAt: 0,
          step: i + 1,
          status: "pending" as const,
        }));

        const emit = () => {
          liveDetails = { mode: "chain", results: results.map(r => ({ ...r })) };
          onUpdate?.({ content: [{ type: "text", text: `Chain step ${results.filter(r => r.status !== "pending").length + 1}/${chain.length}` }], details: liveDetails });
        };
        emit();

        let previousOutput = "";
        const chainCwd = params.cwd ?? ctx.cwd;

        for (let i = 0; i < chain.length; i++) {
          const step = chain[i];
          const stepCwd = step.cwd ?? chainCwd;
          const agent = agents.get(step.agent);
          if (!agent) {
            results[i].status = "error";
            results[i].error = `Unknown agent "${step.agent}"`;
            results[i].text = "";
            results[i].startedAt = Date.now();
            results[i].doneAt = Date.now();
            emit();
            return {
              content: [{ type: "text", text: `Chain stopped at step ${i + 1}: unknown agent "${step.agent}"` }],
              details: { mode: "chain" as const, results },
              isError: true,
            };
          }

          results[i].status = "working";
          results[i].startedAt = Date.now();
          emit();

          const substitutedTask = step.task.replace(/\{previous\}/g, previousOutput);

          try {
            const result = await runSubagent(
              agent,
              substitutedTask,
              stepCwd,
              parentModel,
              parentThinking,
              signal,
              (partial) => {
                results[i].text = partial.text;
                results[i].doneAt = Date.now();
                emit();
              },
            );

            if (result.exitCode !== 0) {
              results[i].status = "error";
              results[i].error = result.error;
              results[i].text = result.text;
              results[i].exitCode = result.exitCode;
              results[i].doneAt = result.doneAt;
              emit();
              return {
                content: [{ type: "text", text: `Chain stopped at step ${i + 1}` }],
                details: { mode: "chain" as const, results },
                isError: true,
              };
            }

            results[i].status = "done";
            results[i].text = result.text;
            results[i].doneAt = result.doneAt;
            previousOutput = result.text;
            emit();
          } catch (err: any) {
            results[i].status = "error";
            results[i].error = err?.message || "Unknown error";
            results[i].doneAt = Date.now();
            emit();
            return {
              content: [{ type: "text", text: `Chain stopped at step ${i + 1}` }],
              details: { mode: "chain" as const, results },
              isError: true,
            };
          }
        }

        const lastResult = results[results.length - 1];
        return {
          content: [{ type: "text", text: lastResult.text || "No output" }],
          details: { mode: "chain" as const, results },
        };
      }

      // ── Parallel mode ───────────────────────────────────────────────
      if (params.tasks && params.tasks.length > 0) {
        const tasks = params.tasks as TaskItem[];
        if (tasks.length > MAX_PARALLEL_TASKS) {
          throw new Error(`Maximum ${MAX_PARALLEL_TASKS} parallel tasks allowed, got ${tasks.length}.`);
        }

        const results: SingleResult[] = tasks.map((task) => ({
          agent: task.agent,
          task: task.task,
          exitCode: 0,
          text: "",
          startedAt: 0,
          doneAt: 0,
          status: "pending" as const,
        }));

        const parallelCwd = params.cwd ?? ctx.cwd;

        const emit = () => {
          liveDetails = { mode: "parallel", results: results.map(r => ({ ...r })) };
          onUpdate?.({ content: [{ type: "text", text: `Parallel ${results.filter(r => r.status === "done" || r.status === "error").length}/${tasks.length} done` }], details: liveDetails });
        };
        emit();

        await mapWithConcurrencyLimit(tasks, MAX_CONCURRENCY, async (task, index) => {
          const taskCwd = task.cwd ?? parallelCwd;
          const agent = agents.get(task.agent);
          if (!agent) {
            results[index].status = "error";
            results[index].error = `Unknown agent "${task.agent}"`;
            results[index].text = "";
            results[index].startedAt = Date.now();
            results[index].doneAt = Date.now();
            emit();
            return;
          }

          results[index].status = "working";
          results[index].startedAt = Date.now();
          emit();

          try {
            const result = await runSubagent(
              agent,
              task.task,
              taskCwd,
              parentModel,
              parentThinking,
              signal,
              (partial) => {
                results[index] = { ...results[index], text: partial.text, doneAt: Date.now() };
                emit();
              },
            );

            if (result.exitCode !== 0) {
              results[index].status = "error";
              results[index].error = result.error;
              results[index].text = result.text;
              results[index].exitCode = result.exitCode;
              results[index].doneAt = result.doneAt;
            } else {
              results[index].status = "done";
              results[index].text = result.text;
              results[index].doneAt = result.doneAt;
            }
          } catch (err: any) {
            results[index].status = "error";
            results[index].error = err?.message || "Unknown error";
            results[index].doneAt = Date.now();
          }
          emit();
        });

        // Build markdown summary
        let summaryText = "";
        for (const r of results) {
          const statusLabel = r.status === "error" ? "failed" : "completed";
          summaryText += `### ${r.agent} ${statusLabel}\n\n`;
          summaryText += truncateParallelOutput(r.text || r.error || "No output");
          summaryText += "\n\n";
        }

        return {
          content: [{ type: "text", text: summaryText }],
          details: { mode: "parallel" as const, results },
        };
      }

      // ── Single mode ─────────────────────────────────────────────────
      const agent = agents.get(params.agent!);
      if (!agent) {
        const available = [...agents.keys()].join(", ");
        throw new Error(`Unknown agent "${params.agent}". Available: ${available || "(none)"}`);
      }

      const result = await runSubagent(agent, params.task!, params.cwd ?? ctx.cwd, parentModel, parentThinking, signal);

      return {
        content: [{ type: "text", text: result.text || result.error || "No output" }],
        details: {
          mode: "single" as const,
          results: [result],
        } satisfies SubagentDetails,
      };
    },

    renderCall(args, theme, ctx) {
      // ── Multi-agent modes ───────────────────────────────────────
      if (args.chain || args.tasks) {
        if (!ctx?.isPartial) {
          clearSpinner(ctx);
          liveDetails = null;
          return makeText(ctx?.lastComponent, toolHeader("Subagent", "", theme));
        }

        const frame = ensureSpinner(ctx);
        const lines: string[] = [];

        if (!liveDetails) {
          lines.push(toolHeader("Subagent", "", theme, spinnerDot(theme, frame)));
          lines.push("");
          lines.push(indentLine(branchLine(
            applyColor(theme, CONFIG.shared.status.workingColor, "Starting..."),
            theme,
          )));
        } else {
          const done = liveDetails.results.filter(r => r.status === "done" || r.status === "error").length;
          const total = liveDetails.results.length;
          const headerSummary = liveDetails.mode === "chain"
            ? ` step ${Math.min(done + 1, total)}/${total}`
            : ` ${done}/${total} done`;
          lines.push(toolHeader("Subagent", headerSummary, theme, spinnerDot(theme, frame)));
          lines.push("");
          lines.push(...renderAgentTree(liveDetails, theme, frame));
        }

        return makeText(ctx?.lastComponent, lines.join("\n"));
      }

      // ── Single mode ─────────────────────────────────────────────
      const singleAgent = args.agent ?? "subagent";
      const singleTask: string = typeof args.task === "string" ? args.task : "";
      const preview = singleTask.length > TASK_PREVIEW_LENGTH
        ? singleTask.slice(0, TASK_PREVIEW_LENGTH) + "..."
        : singleTask;

      if (!ctx?.isPartial) {
        clearSpinner(ctx);
        return makeText(ctx?.lastComponent, toolHeader("Subagent", "", theme));
      }

      const frame = ensureSpinner(ctx);
      const icon = applyColor(theme, CONFIG.shared.spinner.color, SPINNER_FRAMES[frame % SPINNER_FRAMES.length]);
      const lines: string[] = [
        toolHeader("Subagent", "", theme, spinnerDot(theme, frame)),
        "",
        indentLine(`${icon} ${applyColor(theme, CONFIG.shared.header.agentColor, singleAgent)} ${applyColor(theme, "dim", preview)}`),
        indentLine(branchLine(
          applyColor(theme, CONFIG.shared.status.workingColor, CONFIG.shared.status.workingLabel),
          theme,
        )),
      ];
      return makeText(ctx?.lastComponent, lines.join("\n"));
    },

    renderResult(result, options, theme, ctx) {
      const details = result.details as SubagentDetails | undefined;
      const expanded = options?.expanded ?? false;

      // No details — plain text fallback
      if (!details || details.results.length === 0) {
        const text = result.content[0];
        return makeText(ctx?.lastComponent, text?.type === "text" ? text.text : "(no output)");
      }

      // ── Chain & Parallel modes ────────────────────────────────────
      if (details.mode === "chain" || details.mode === "parallel") {
        const stillRunning = details.results.some(r => r.status === "working" || r.status === "pending");
        const frame = ctx?.state?.spinnerFrame ?? 0;

        if (stillRunning || !expanded) {
          const lines: string[] = [""];
          lines.push(...renderAgentTree(details, theme, stillRunning ? frame : 0));

          if (!stillRunning) {
            const aggregateElapsed = details.mode === "chain"
              ? details.results.reduce((sum, r) => sum + ((r.doneAt ?? 0) - (r.startedAt ?? 0)), 0)
              : Math.max(...details.results.map(r => r.doneAt ?? 0)) - Math.min(...details.results.map(r => r.startedAt || Infinity));
            lines.push(applyColor(theme, "dim", `Worked for ${(aggregateElapsed / 1000).toFixed(1)}s`) + expandHint(theme));
          }

          return makeText(ctx?.lastComponent, lines.join("\n"));
        }

        // ── Expanded ──────────────────────────────────────────────
        return createMultiExpandedView(details, theme, getMarkdownTheme());
      }

      // ── Single mode ───────────────────────────────────────────────
      // Augment results with inferred status for tree rendering
      const augmentedResults = details.results.map(r => ({
        ...r,
        status: r.status ?? (r.exitCode !== 0 ? "error" as const : "done" as const),
      }));

      // No text yet (partial render during execution) — show running
      if (!options?.expanded && !augmentedResults[0].text && augmentedResults[0].exitCode === 0 && augmentedResults[0].status !== "error") {
        augmentedResults[0].status = "working";
        const singleDetails: SubagentDetails = { mode: "single", results: augmentedResults };
        const lines: string[] = ["", ...renderAgentTree(singleDetails, theme, ctx?.state?.spinnerFrame ?? 0)];
        return makeText(ctx?.lastComponent, lines.join("\n"));
      }

      // ── Collapsed view ──────────────────────────────────────────
      if (!expanded) {
        const singleDetails: SubagentDetails = { mode: "single", results: augmentedResults };
        const lines: string[] = ["", ...renderAgentTree(singleDetails, theme, 0)];
        const r = details.results[0];
        const elapsed = formatElapsed(r.startedAt, r.doneAt);
        lines.push(applyColor(theme, "dim", `Worked for ${elapsed}`) + expandHint(theme));
        return makeText(ctx?.lastComponent, lines.join("\n"));
      }

      // ── Expanded view ───────────────────────────────────────────
      const singleDetails: SubagentDetails = { mode: "single", results: augmentedResults };
      return createMultiExpandedView(singleDetails, theme, getMarkdownTheme());
    },
  });
}
