import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import { getKeybindings } from "@earendil-works/pi-tui";
import type { SingleResult } from "./types.js";
import { PER_TASK_OUTPUT_CAP } from "./config.js";

function isHexColor(color: string): boolean {
  return typeof color === "string" && color.startsWith("#");
}

export function applyColor(theme: Theme, color: string, text: string): string {
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

export function getVisibleWidth(text: string): number {
  return text.replace(/\x1b\[[0-9;]*m/g, "").length;
}

export function formatElapsed(startedAt: number | undefined, endedAt?: number): string {
  if (startedAt == null) return "";
  const ms = (endedAt ?? Date.now()) - startedAt;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function getExpandToggleKey(): string {
  return getKeybindings().getKeys("app.tools.expand")[0] ?? "ctrl+o";
}

// ── Concurrent map ─────────────────────────────────────────────────────

export async function mapWithConcurrencyLimit<TIn, TOut>(
  items: TIn[],
  concurrency: number,
  fn: (item: TIn, index: number) => Promise<TOut>,
): Promise<TOut[]> {
  const results: TOut[] = new Array(items.length);
  let nextIndex = 0;

  async function worker(): Promise<void> {
    while (true) {
      const i = nextIndex++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, () => worker());
  await Promise.all(workers);
  return results;
}

// ── Output truncation ──────────────────────────────────────────────────

export function truncateParallelOutput(output: string): string {
  const byteLen = Buffer.byteLength(output, "utf8");
  if (byteLen <= PER_TASK_OUTPUT_CAP) return output;

  let byteCount = 0;
  let charIndex = 0;
  for (; charIndex < output.length; charIndex++) {
    const charBytes = Buffer.byteLength(output[charIndex], "utf8");
    if (byteCount + charBytes > PER_TASK_OUTPUT_CAP) break;
    byteCount += charBytes;
  }
  const truncated = output.slice(0, charIndex);
  const omitted = byteLen - byteCount;
  return truncated + `\n\n[Output truncated: ${omitted} bytes omitted. Full output preserved in tool details.]`;
}

// ── Result check ───────────────────────────────────────────────────────

export function isFailedResult(r: SingleResult): boolean {
  return r.exitCode !== 0 || r.status === "error";
}
