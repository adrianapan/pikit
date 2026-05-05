import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_CONFIG = {
  // Assistant message
  ASSISTANT_PREFIX: "●",
  ASSISTANT_PREFIX_COLOR: "text",
  
  // Thinking message
  THINKING_PREFIX: "✽",
  THINKING_PREFIX_COLOR: "accent",
  THINKING_LABEL: "Thinking:",
  THINKING_LABEL_COLOR: "muted",
  IS_THINKING_LABEL_VISIBLE: false,
  THINKING_MESSAGE_COLOR: "dim",
};

interface StyledOutputsUserConfig {
  assistantPrefix?: string;
  thinkingPrefix?: string;
  thinkingLabel?: string;
  assistantPrefixColor?: string;
  thinkingPrefixColor?: string;
  thinkingLabelColor?: string;
  isThinkingLabelVisible?: boolean;
  thinkingMessageColor?: string;
}

const CONFIG_PATH = join(homedir(), ".pi", "agent", "configs", "styled-outputs.json");

function loadUserConfig(): StyledOutputsUserConfig {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const userConfig = loadUserConfig();

export const CONFIG = {
  assistantPrefix: userConfig.assistantPrefix ?? DEFAULT_CONFIG.ASSISTANT_PREFIX,
  thinkingPrefix: userConfig.thinkingPrefix ?? DEFAULT_CONFIG.THINKING_PREFIX,
  thinkingLabel: userConfig.thinkingLabel ?? DEFAULT_CONFIG.THINKING_LABEL,
  assistantPrefixColor: userConfig.assistantPrefixColor ?? DEFAULT_CONFIG.ASSISTANT_PREFIX_COLOR,
  thinkingPrefixColor: userConfig.thinkingPrefixColor ?? DEFAULT_CONFIG.THINKING_PREFIX_COLOR,
  thinkingLabelColor: userConfig.thinkingLabelColor ?? DEFAULT_CONFIG.THINKING_LABEL_COLOR,
  isThinkingLabelVisible: userConfig.isThinkingLabelVisible ?? DEFAULT_CONFIG.IS_THINKING_LABEL_VISIBLE,
  thinkingMessageColor: userConfig.thinkingMessageColor ?? DEFAULT_CONFIG.THINKING_MESSAGE_COLOR,
};
