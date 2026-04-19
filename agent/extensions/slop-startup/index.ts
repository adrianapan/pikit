import type { ExtensionAPI, Theme } from "@mariozechner/pi-coding-agent";
import { VERSION } from "@mariozechner/pi-coding-agent";
import { readdirSync, existsSync, statSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir as osHomedir } from "node:os";
import { cwd as osCwd } from "node:process";
import { visibleWidth, truncateToWidth } from "@mariozechner/pi-tui";

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

function bold(text: string): string {
  return `\x1b[1m${text}\x1b[22m`;
}

function centerText(text: string, width: number): string {
  const visLen = visibleWidth(text);
  if (visLen >= width) return truncateToWidth(text, width, "…");
  const leftPad = Math.floor((width - visLen) / 2);
  return " ".repeat(leftPad) + text + " ".repeat(width - visLen - leftPad);
}

function fitToWidth(str: string, width: number): string {
  const visLen = visibleWidth(str);
  if (visLen > width) return truncateToWidth(str, width, "…");
  return str + " ".repeat(width - visLen);
}

// ═══════════════════════════════════════════════════════════════════════════
// Discovery
// ═══════════════════════════════════════════════════════════════════════════

interface RecentSession {
  name: string;
  timeAgo: string;
}

interface LoadedCounts {
  contextFiles: number;
  extensions: number;
  skills: number;
  promptTemplates: number;
}

function formatTimeAgo(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return "just now";
}

function getRecentSessions(maxCount = 3): RecentSession[] {
  const homeDir = osHomedir();
  const sessionsDirs = [
    join(homeDir, ".pi", "agent", "sessions"),
    join(homeDir, ".pi", "sessions"),
  ];
  const sessions: { name: string; mtime: number }[] = [];

  function scanDir(dir: string) {
    if (!existsSync(dir)) return;
    try {
      for (const entry of readdirSync(dir)) {
        const entryPath = join(dir, entry);
        try {
          const stats = statSync(entryPath);
          if (stats.isDirectory()) {
            scanDir(entryPath);
          } else if (entry.endsWith(".jsonl")) {
            const parentName = basename(dir);
            let projectName = parentName;
            if (parentName.startsWith("--")) {
              const parts = parentName.split("-").filter((p) => p);
              projectName = parts[parts.length - 1] || parentName;
            }
            sessions.push({ name: projectName, mtime: stats.mtimeMs });
          }
        } catch {}
      }
    } catch {}
  }

  for (const dir of sessionsDirs) scanDir(dir);
  if (sessions.length === 0) return [];

  sessions.sort((a, b) => b.mtime - a.mtime);
  const seen = new Set<string>();
  const unique: typeof sessions = [];
  for (const s of sessions) {
    if (!seen.has(s.name)) {
      seen.add(s.name);
      unique.push(s);
    }
  }

  const now = Date.now();
  return unique.slice(0, maxCount).map((s) => ({
    name: s.name.length > 20 ? s.name.slice(0, 17) + "…" : s.name,
    timeAgo: formatTimeAgo(now - s.mtime),
  }));
}

function discoverLoadedCounts(): LoadedCounts {
  const homeDir = osHomedir();
  const cwd = process.cwd();

  // Context files
  let contextFiles = 0;
  const contextPaths = [
    join(homeDir, ".pi", "agent", "AGENTS.md"),
    join(homeDir, ".claude", "AGENTS.md"),
    join(cwd, "AGENTS.md"),
    join(cwd, "CLAUDE.md"),
    join(cwd, ".pi", "AGENTS.md"),
  ];
  for (const p of contextPaths) {
    if (existsSync(p)) contextFiles++;
  }

  // Extensions
  let extensions = 0;
  const countedExtensions = new Set<string>();

  const settingsPaths = [
    join(homeDir, ".pi", "agent", "settings.json"),
    join(cwd, ".pi", "settings.json"),
  ];
  for (const settingsPath of settingsPaths) {
    if (!existsSync(settingsPath)) continue;
    try {
      const settings = JSON.parse(readFileSync(settingsPath, "utf-8"));
      const packages = settings?.packages;
      if (Array.isArray(packages)) {
        for (const pkg of packages) {
          const source = typeof pkg === "string" ? pkg : pkg?.source;
          if (typeof source !== "string" || !source.trim().startsWith("npm:")) continue;
          const body = source.trim().slice(4);
          const vIdx = body.lastIndexOf("@");
          const name = vIdx > 0 ? body.slice(0, vIdx) : body;
          if (name && !countedExtensions.has(name)) {
            countedExtensions.add(name);
            extensions++;
          }
        }
      }
    } catch {}
  }

  const extDirs = [
    join(homeDir, ".pi", "agent", "extensions"),
    join(cwd, ".pi", "extensions"),
    join(cwd, "extensions"),
  ];
  for (const dir of extDirs) {
    if (!existsSync(dir)) continue;
    try {
      for (const entry of readdirSync(dir)) {
        const entryPath = join(dir, entry);
        try {
          if (
            statSync(entryPath).isDirectory() &&
            (existsSync(join(entryPath, "index.ts")) ||
              existsSync(join(entryPath, "index.js")) ||
              existsSync(join(entryPath, "package.json")))
          ) {
            if (!countedExtensions.has(entry)) {
              countedExtensions.add(entry);
              extensions++;
            }
          }
        } catch {}
      }
    } catch {}
  }

  // Skills
  let skills = 0;
  const countedSkills = new Set<string>();
  const skillDirs = [
    join(homeDir, ".pi", "agent", "skills"),
    join(cwd, ".pi", "skills"),
    join(cwd, "skills"),
  ];
  for (const dir of skillDirs) {
    if (!existsSync(dir)) continue;
    try {
      for (const entry of readdirSync(dir)) {
        const entryPath = join(dir, entry);
        try {
          if (statSync(entryPath).isDirectory() && existsSync(join(entryPath, "SKILL.md"))) {
            if (!countedSkills.has(entry)) {
              countedSkills.add(entry);
              skills++;
            }
          }
        } catch {}
      }
    } catch {}
  }

  // Prompt templates
  let promptTemplates = 0;
  const countedTemplates = new Set<string>();
  const templateDirs = [
    join(homeDir, ".pi", "agent", "prompts"),
    join(homeDir, ".pi", "agent", "commands"),
    join(homeDir, ".claude", "commands"),
    join(cwd, ".pi", "commands"),
    join(cwd, ".claude", "commands"),
  ];

  function countTemplatesInDir(dir: string) {
    if (!existsSync(dir)) return;
    try {
      for (const entry of readdirSync(dir)) {
        const entryPath = join(dir, entry);
        try {
          const stats = statSync(entryPath);
          if (stats.isDirectory()) {
            countTemplatesInDir(entryPath);
          } else if (entry.endsWith(".md")) {
            const name = basename(entry, ".md");
            if (!countedTemplates.has(name)) {
              countedTemplates.add(name);
              promptTemplates++;
            }
          }
        } catch {}
      }
    } catch {}
  }

  for (const dir of templateDirs) countTemplatesInDir(dir);

  return { contextFiles, extensions, skills, promptTemplates };
}

// ═══════════════════════════════════════════════════════════════════════════
// Layout
// ═══════════════════════════════════════════════════════════════════════════

function buildLeftColumn(
  theme: Theme,
  modelName: string,
  providerName: string,
  thinkingLevel: string,
  cwd: string,
  colWidth: number,
): string[] {
  return [
    "",
    // centerText(bold(theme.fg("accent", "\uE22C")), colWidth),
    // centerText(bold(theme.fg("text", "Welcome back!")), colWidth),
    "",
    centerText(bold(`\x1b[38;2;215;135;175m\uEC19\x1b[0m`), colWidth),
    centerText(theme.fg("text", modelName), colWidth),
    centerText(theme.fg("dim", providerName), colWidth),
    "",
    centerText(bold(theme.fg("dim", "\uF115")), colWidth),
    centerText(theme.fg("text", basename(cwd)), colWidth),
    "",
    centerText(bold(theme.fg("dim", "\udb81\udcf9")), colWidth),
    centerText(theme.fg("text", "pi agent"), colWidth),
    centerText(theme.fg("dim", `v${VERSION}`), colWidth),
  ];
}

function buildRightColumn(
  theme: Theme,
  recentSessions: RecentSession[],
  counts: LoadedCounts,
  colWidth: number,
): string[] {
  const hChar = "─";
  const dim = (s: string) => theme.fg("dim", s);
  const separator = ` ${dim(hChar.repeat(colWidth - 2))}`;

  // Recent sessions
  const sessionLines: string[] =
    recentSessions.length === 0
      ? [` ${dim("No recent sessions")}`]
      : recentSessions.map(
          (s) => ` ${dim("• ")}${theme.fg("text", s.name)}${dim(` (${s.timeAgo})`)}`,
        );

  // Loaded counts
  const { contextFiles, extensions, skills, promptTemplates } = counts;
  const itemPrefix = dim("- ");
  const countLines: string[] = [
    ` ${itemPrefix}${theme.fg(contextFiles > 0 ? "success" : "dim", `${contextFiles}`)} context file${contextFiles !== 1 ? "s" : ""}`,
    ` ${itemPrefix}${theme.fg(extensions > 0 ? "success" : "dim", `${extensions}`)} extension${extensions !== 1 ? "s" : ""}`,
    ` ${itemPrefix}${theme.fg(skills > 0 ? "success" : "dim", `${skills}`)} skill${skills !== 1 ? "s" : ""}`,
    ` ${itemPrefix}${theme.fg(promptTemplates > 0 ? "success" : "dim", `${promptTemplates}`)} prompt template${promptTemplates !== 1 ? "s" : ""}`,
  ];

  return [
    ` ${bold(theme.fg("accent", "Tips"))}`,
    ` ${dim("/")} for commands`,
    ` ${dim("!")} to run bash`,
    ` ${dim("Shift+Tab")} cycle thinking`,
    separator,
    ` ${bold(theme.fg("accent", "Loaded"))}`,
    ...countLines,
    separator,
    ` ${bold(theme.fg("accent", "Recent sessions"))}`,
    ...sessionLines,
    "",
  ];
}

function renderBox(
  theme: Theme,
  modelName: string,
  providerName: string,
  thinkingLevel: string,
  cwd: string,
  recentSessions: RecentSession[],
  counts: LoadedCounts,
  termWidth: number,
): string[] {
  const minLayoutWidth = 44;
  if (termWidth < minLayoutWidth) return [];

  const boxWidth = Math.min(termWidth, Math.max(76, Math.min(termWidth - 2, 96)));
  const leftCol = 26;
  const rightCol = Math.max(1, boxWidth - leftCol - 3);
  const hChar = "─";

  const dim = (s: string) => theme.fg("dim", s);
  const v = dim("│");
  const tl = dim("╭");
  const tr = dim("╮");
  const bl = dim("╰");
  const br = dim("╯");

  const leftLines = buildLeftColumn(theme, modelName, providerName, thinkingLevel, cwd, leftCol);
  const rightLines = buildRightColumn(theme, recentSessions, counts, rightCol);
  const contentWidth = boxWidth - 2;

  const lines: string[] = [];

  // Top border with title: ───<icon> pi agent vX.X.X ───...
  const icon = "\uE22C";
  const titleText = ` pi agent v${VERSION}`;
  const titleStyled = dim(hChar.repeat(2)) + theme.fg("accent", icon) + dim(" ") + dim(titleText);
  const titleVisLen = 2 + visibleWidth(icon) + 1 + visibleWidth(titleText);
  const afterTitle = contentWidth - titleVisLen;
  lines.push(tl + titleStyled + (afterTitle > 0 ? dim(hChar.repeat(afterTitle)) : "") + tr);

  // Two-column content rows
  const maxRows = Math.max(leftLines.length, rightLines.length);
  for (let i = 0; i < maxRows; i++) {
    const left = fitToWidth(leftLines[i] ?? "", leftCol);
    const right = fitToWidth(rightLines[i] ?? "", rightCol);
    lines.push(v + left + v + right + v);
  }

  // Bottom border with column separator
  const bottomLine = dim(hChar.repeat(leftCol)) + dim("┴") + dim(hChar.repeat(rightCol));
  lines.push(bl + bottomLine + br);
  lines.push("");

  return lines;
}

// ═══════════════════════════════════════════════════════════════════════════
// Extension
// ═══════════════════════════════════════════════════════════════════════════

export default function slopStartup(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    if (!ctx.hasUI) return;

    const model = ctx.model as any;
    const rawName = model?.name || model?.id || "unknown";
    // If id is "provider/model", split it
    const slashIdx = rawName.indexOf("/");
    const modelName = slashIdx >= 0 ? rawName.slice(slashIdx + 1) : rawName;
    const providerName = model?.provider ?? (slashIdx >= 0 ? rawName.slice(0, slashIdx) : "");

    const recentSessions = getRecentSessions(3);
    const counts = discoverLoadedCounts();
    const thinkingLevel = (ctx as any).thinkingLevel ?? (ctx as any).thinking ?? "unknown";
    const cwd = osCwd();

    ctx.ui.setHeader((_tui, theme) => ({
      render(termWidth: number): string[] {
        return renderBox(theme, modelName, providerName, thinkingLevel, cwd, recentSessions, counts, termWidth);
      },
      invalidate() {},
    }));
  });
}
