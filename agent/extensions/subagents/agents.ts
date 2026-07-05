import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { getAgentDir, parseFrontmatter } from "@earendil-works/pi-coding-agent";

import { DEFAULT_AGENT_TOOLS, DEFAULT_AGENT_EXTENSIONS, DEFAULT_AGENT_SKILLS } from "./config.js";
import type { AgentConfig, AgentDiscoveryResult } from "./types.js";

// ── Parsing ───────────────────────────────────────────────────────────────

function splitField(raw: unknown): string[] {
  if (typeof raw === "string") {
    const trimmed = raw.trim();
    if (trimmed === "") return [];
    return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (Array.isArray(raw)) {
    return raw.map((s) => String(s).trim()).filter(Boolean);
  }
  return [];
}

export function loadAgentsFromDir(dir: string, source: "user" | "project"): AgentConfig[] {
  if (!existsSync(dir)) return [];

  const agents: AgentConfig[] = [];

  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return [];
  }

  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const filePath = join(dir, entry);

    let raw: string;
    try {
      raw = readFileSync(filePath, "utf8");
    } catch {
      continue;
    }

    const parsed = parseFrontmatter(raw);
    const fm = parsed?.frontmatter ?? {};
    const body = parsed?.body ?? raw;

    const name = typeof fm.name === "string" ? fm.name.trim() : undefined;
    const description = typeof fm.description === "string" ? fm.description.trim() : undefined;

    if (!name || !description) continue;

    // Tools: absent → default list, empty → [], values → split
    let tools: string[];
    if (fm.tools === undefined || fm.tools === null) {
      tools = [...DEFAULT_AGENT_TOOLS];
    } else {
      tools = splitField(fm.tools);
    }

    // Extensions: absent → default list, empty → [], values → override
    let extensions: string[];
    if (fm.extensions === undefined || fm.extensions === null) {
      extensions = [...DEFAULT_AGENT_EXTENSIONS];
    } else {
      extensions = splitField(fm.extensions);
    }

    // Skills: same pattern
    let skills: string[];
    if (fm.skills === undefined || fm.skills === null) {
      skills = [...DEFAULT_AGENT_SKILLS];
    } else {
      skills = splitField(fm.skills);
    }

    const model = typeof fm.model === "string" ? fm.model.trim() : undefined;
    const thinking = typeof fm.thinking === "string" ? fm.thinking.trim() : undefined;

    agents.push({
      name,
      description,
      tools,
      model,
      thinking,
      extensions,
      skills,
      systemPrompt: body.trim(),
      source,
      filePath,
    });
  }

  return agents;
}

// ── Discovery ─────────────────────────────────────────────────────────────

export function findNearestProjectAgentsDir(cwd: string): string | null {
  let current = cwd;

  while (true) {
    const agentsDir = join(current, ".pi", "agents");
    if (existsSync(agentsDir)) return agentsDir;
    const parent = dirname(current);
    if (parent === current) break;
    current = parent;
  }
  return null;
}

export function discoverAgents(cwd: string): AgentDiscoveryResult {
  const all = new Map<string, AgentConfig>();

  // User agents
  const userDir = join(getAgentDir(), "agents");
  for (const agent of loadAgentsFromDir(userDir, "user")) {
    all.set(agent.name, agent);
  }

  // Project agents (overwrite on name conflict)
  const projectAgentsDir = findNearestProjectAgentsDir(cwd);
  if (projectAgentsDir) {
    for (const agent of loadAgentsFromDir(projectAgentsDir, "project")) {
      all.set(agent.name, agent);
    }
  }

  return { agents: all };
}

export function formatAgentList(agents: Map<string, AgentConfig>): string {
  const entries: string[] = [];
  for (const [name, config] of agents) {
    entries.push(`${name} (${config.source}): ${config.description}`);
  }
  return entries.join("; ");
}
