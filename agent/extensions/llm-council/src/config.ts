import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

export interface CouncilConfig {
  members: string[];
  chairman: string;
}

export const DEFAULT_CONFIG: CouncilConfig = {
  members: ["gemma4:31b:cloud", "kimi-k2.6:cloud", "minimax-m2.7:cloud"],
  chairman: "glm-5.1:cloud",
};

const CONFIG_PATH = join(homedir(), ".pi", "agent", "configs", "llm-council.json");

export function loadConfig(): CouncilConfig {
  try {
    if (!existsSync(CONFIG_PATH)) return { ...DEFAULT_CONFIG };
    const raw = readFileSync(CONFIG_PATH, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      members: Array.isArray(parsed.members) ? parsed.members : DEFAULT_CONFIG.members,
      chairman: typeof parsed.chairman === "string" ? parsed.chairman : DEFAULT_CONFIG.chairman,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}