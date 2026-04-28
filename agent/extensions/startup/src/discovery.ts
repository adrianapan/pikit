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
  const mcpConfigPath = join(homeDir, ".pi", "agent", "configs", "mcp.json");
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
