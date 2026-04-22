import { readdirSync, existsSync, statSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir as osHomedir } from "node:os";

export interface RecentSession {
  name: string;
  timeAgo: string;
}

export interface LoadedCounts {
  contextFiles: number;
  extensions: number;
  skills: number;
  promptTemplates: number;
  mcpServers: number;
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

export function getRecentSessions(maxCount = 3): RecentSession[] {
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

export function discoverLoadedCounts(): LoadedCounts {
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

  // MCP servers — count unique server names from the pi config
  let mcpServers = 0;
  const mcpConfigPath = join(homeDir, ".pi", "agent", "configs", "slop-mcp.json");
  if (existsSync(mcpConfigPath)) {
    try {
      const cfg = JSON.parse(readFileSync(mcpConfigPath, "utf-8"));
      if (cfg?.mcpServers && typeof cfg.mcpServers === "object") {
        mcpServers = Object.keys(cfg.mcpServers).length;
      }
    } catch {}
  }

  return { contextFiles, extensions, skills, promptTemplates, mcpServers };
}
