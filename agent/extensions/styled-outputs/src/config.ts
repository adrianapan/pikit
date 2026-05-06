import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_CONFIG = {
  // Assistant message
  ASSISTANT_PREFIX: "●",
  ASSISTANT_PREFIX_COLOR: "text",

  // User message
  USER_PREFIX: "❯",
  USER_PREFIX_COLOR: "accent",
  IS_THEME_BACKGROUND_VISIBLE: true,
  
  // Thinking message
  THINKING_PREFIX: "✽",
  THINKING_PREFIX_COLOR: "accent",
  THINKING_LABEL: "Thinking:",
  THINKING_LABEL_COLOR: "muted",
  IS_THINKING_LABEL_VISIBLE: false,
  THINKING_MESSAGE_COLOR: "dim",

  // Tools
  TOOL_DOT: "●",
  TOOL_SUCCESS_COLOR: "success",
  TOOL_ERROR_COLOR: "error",
  TOOL_BRANCH: "└─",
  TOOL_BRANCH_COLOR: "dim",
  TOOL_TITLE_COLOR: "toolTitle",
  TOOL_SUMMARY_COLOR: "dim",
  TOOL_OUTPUT_COLOR: "dim",
  TOOL_EXPAND_HINT_COLOR: "dim",
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
  userPrefix?: string;
  userPrefixColor?: string;
  isThemeBackgroundVisible?: boolean;
  toolDot?: string;
  toolSuccessColor?: string;
  toolErrorColor?: string;
  toolBranch?: string;
  toolBranchColor?: string;
  toolTitleColor?: string;
  toolSummaryColor?: string;
  toolOutputColor?: string;
  toolExpandHintColor?: string;
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
  userPrefix: userConfig.userPrefix ?? DEFAULT_CONFIG.USER_PREFIX,
  userPrefixColor: userConfig.userPrefixColor ?? DEFAULT_CONFIG.USER_PREFIX_COLOR,
  isThemeBackgroundVisible: userConfig.isThemeBackgroundVisible ?? DEFAULT_CONFIG.IS_THEME_BACKGROUND_VISIBLE,
  toolDot: userConfig.toolDot ?? DEFAULT_CONFIG.TOOL_DOT,
  toolSuccessColor: userConfig.toolSuccessColor ?? DEFAULT_CONFIG.TOOL_SUCCESS_COLOR,
  toolErrorColor: userConfig.toolErrorColor ?? DEFAULT_CONFIG.TOOL_ERROR_COLOR,
  toolBranch: userConfig.toolBranch ?? DEFAULT_CONFIG.TOOL_BRANCH,
  toolBranchColor: userConfig.toolBranchColor ?? DEFAULT_CONFIG.TOOL_BRANCH_COLOR,
  toolTitleColor: userConfig.toolTitleColor ?? DEFAULT_CONFIG.TOOL_TITLE_COLOR,
  toolSummaryColor: userConfig.toolSummaryColor ?? DEFAULT_CONFIG.TOOL_SUMMARY_COLOR,
  toolOutputColor: userConfig.toolOutputColor ?? DEFAULT_CONFIG.TOOL_OUTPUT_COLOR,
  toolExpandHintColor: userConfig.toolExpandHintColor ?? DEFAULT_CONFIG.TOOL_EXPAND_HINT_COLOR,
};
