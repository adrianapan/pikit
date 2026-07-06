import { readdirSync, existsSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir as osHomedir } from "node:os";

export interface LoadedCounts {
  models: number;
  contextFiles: number;
  extensions: number;
  skills: number;
  promptTemplates: number;
  mcpServers: number;
}

function countContextFiles(homeDir: string, cwd: string): number {
  const paths = [
    join(homeDir, ".pi", "agent", "AGENTS.md"),
    join(homeDir, ".claude", "AGENTS.md"),
    join(cwd, "AGENTS.md"),
    join(cwd, "CLAUDE.md"),
    join(cwd, ".pi", "AGENTS.md"),
  ];
  return paths.filter(existsSync).length;
}

function countExtensions(homeDir: string, cwd: string): number {
  const seen = new Set<string>();

  const settingsPaths = [
    join(homeDir, ".pi", "agent", "settings.json"),
    join(cwd, ".pi", "settings.json"),
  ];
  for (const path of settingsPaths) {
    if (!existsSync(path)) continue;
    try {
      const settings = JSON.parse(readFileSync(path, "utf-8"));
      for (const pkg of (settings?.packages ?? [])) {
        const source = typeof pkg === "string" ? pkg : pkg?.source;
        if (typeof source !== "string" || !source.trim().startsWith("npm:")) continue;
        const body = source.trim().slice(4);
        const vIdx = body.lastIndexOf("@");
        const name = vIdx > 0 ? body.slice(0, vIdx) : body;
        if (name) seen.add(name);
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
            seen.add(entry);
          }
        } catch {}
      }
    } catch {}
  }

  return seen.size;
}

type CommandLike = ReadonlyArray<{ source: string; name: string }>;

// Count skills from pi's command registry so package-installed skills are
// included, not just those under ~/.pi/agent/skills.
function countSkills(commands: CommandLike): number {
  const seen = new Set<string>();
  for (const c of commands) {
    if (c.source === "skill") seen.add(c.name);
  }
  return seen.size;
}

// Count prompt templates from pi's command registry so package-installed
// prompts are included, not just those under ~/.pi/agent/prompts.
function countTemplates(commands: CommandLike): number {
  const seen = new Set<string>();
  for (const c of commands) {
    if (c.source === "prompt") seen.add(c.name);
  }
  return seen.size;
}

function countModels(homeDir: string, cwd: string): number {
  const seen = new Set<string>();
  const paths = [
    join(homeDir, ".pi", "agent", "settings.json"),
    join(cwd, ".pi", "settings.json"),
  ];
  for (const path of paths) {
    if (!existsSync(path)) continue;
    try {
      const settings = JSON.parse(readFileSync(path, "utf8"));
      const arr = settings?.enabledModels;
      if (Array.isArray(arr)) {
        for (const m of arr) if (typeof m === "string" && m.trim()) seen.add(m.trim());
      }
    } catch {}
  }
  return seen.size;
}

function countMcpServers(homeDir: string): number {
  const configPath = join(homeDir, ".pi", "agent", "configs", "mcp.json");
  if (!existsSync(configPath)) return 0;
  try {
    const cfg = JSON.parse(readFileSync(configPath, "utf-8"));
    if (cfg?.mcpServers && typeof cfg.mcpServers === "object") {
      return Object.keys(cfg.mcpServers).length;
    }
  } catch {}
  return 0;
}

export function discoverLoadedCounts(commands: CommandLike): LoadedCounts {
  const homeDir = osHomedir();
  const cwd = process.cwd();
  return {
    models: countModels(homeDir, cwd),
    contextFiles: countContextFiles(homeDir, cwd),
    extensions: countExtensions(homeDir, cwd),
    skills: countSkills(commands),
    promptTemplates: countTemplates(commands),
    mcpServers: countMcpServers(homeDir),
  };
}
