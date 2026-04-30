import { readdirSync, existsSync, statSync, readFileSync } from "node:fs";
import { join, basename } from "node:path";
import { homedir as osHomedir } from "node:os";

export interface LoadedCounts {
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

function countSkills(homeDir: string, cwd: string): number {
  const seen = new Set<string>();
  const dirs = [
    join(homeDir, ".pi", "agent", "skills"),
    join(cwd, ".pi", "skills"),
    join(cwd, "skills"),
  ];
  for (const dir of dirs) {
    if (!existsSync(dir)) continue;
    try {
      for (const entry of readdirSync(dir)) {
        const entryPath = join(dir, entry);
        try {
          if (statSync(entryPath).isDirectory() && existsSync(join(entryPath, "SKILL.md"))) {
            seen.add(entry);
          }
        } catch {}
      }
    } catch {}
  }
  return seen.size;
}

function collectTemplateNames(dir: string): Set<string> {
  const names = new Set<string>();
  if (!existsSync(dir)) return names;
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        for (const name of collectTemplateNames(join(dir, entry.name))) names.add(name);
      } else if (entry.isFile() && entry.name.endsWith(".md")) {
        names.add(basename(entry.name, ".md"));
      }
    }
  } catch {}
  return names;
}

function countTemplates(homeDir: string, cwd: string): number {
  const dirs = [
    join(homeDir, ".pi", "agent", "prompts"),
    join(homeDir, ".pi", "agent", "commands"),
    join(homeDir, ".claude", "commands"),
    join(cwd, ".pi", "commands"),
    join(cwd, ".claude", "commands"),
  ];
  const allNames = new Set<string>();
  for (const dir of dirs) {
    for (const name of collectTemplateNames(dir)) allNames.add(name);
  }
  return allNames.size;
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

export function discoverLoadedCounts(): LoadedCounts {
  const homeDir = osHomedir();
  const cwd = process.cwd();
  return {
    contextFiles: countContextFiles(homeDir, cwd),
    extensions: countExtensions(homeDir, cwd),
    skills: countSkills(homeDir, cwd),
    promptTemplates: countTemplates(homeDir, cwd),
    mcpServers: countMcpServers(homeDir),
  };
}
