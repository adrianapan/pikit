import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { StyledOutputsUserConfig, ToolGeneralUserConfig } from "./types.js";

export const DEFAULT_CONFIG = {
  // Assistant message
  ASSISTANT_MESSAGE: {
    PREFIX: "●",
    COLOR: "text",
  },

  // User message
  USER_MESSAGE: {
    PREFIX: "❯",
    COLOR: "accent",
    IS_THEME_BACKGROUND_VISIBLE: true,
  },
  
  // Skill invocation
  SKILLS: {
    PREFIX: "●",
    PREFIX_COLOR: "accent",
    TITLE_COLOR: "toolTitle",
    NAME_COLOR: "text",
    LABEL_COLOR: "success",
    EXPAND_HINT_COLOR: "dim",
  },

  // Thinking message
  THINKING_MESSAGE: {
    PREFIX: "✽",
    PREFIX_COLOR: "accent",
    LABEL: "Thinking:",
    LABEL_COLOR: "muted",
    IS_LABEL_VISIBLE: false,
    MESSAGE_COLOR: "dim",
  },

  TOOLS: {
    TOOL_SPINNER_PREFIX: {
      PREFIX_CHARS: ["·", "✢", "✳", "✶", "✻", "✽"],   // tool loading spinner characters
      COLOR: "muted",                                 // color for the spinner prefix
    },
    TOOL_SUCCESS: {
      PREFIX: "●",                                    // icon for successful tool execution
      PREFIX_COLOR: "success",                        // color for the success prefix
      LABEL_COLOR: "success",                         // color for the success label (DONE on the 2nd line, the status line)
    },
    TOOL_ERROR: {
      PREFIX: "●",                                    // icon for error tool execution
      PREFIX_COLOR: "error",                          // color for the error prefix
      LABEL_COLOR: "error",                           // color for the error label (ERROR on the 2nd line, the status line)
    },
    TOOL_BRANCH: {
      PREFIX: "└─",                                   // icon use right before the status line
      COLOR: "separator",                             // color for the branch icon
    },
    GENERAL: {
      TITLE_COLOR: "toolTitle",                       // color for tool titles (bash, ls, read, write, etc.)
      SUMMARY_COLOR: "dim",                           // color for tool summary (1st line, right after the title)
      COUNT_COLOR: "muted",                           // color for tool counts (e.g., "Tool 1 of 3")
      EXPAND_HINT_COLOR: "dim",                       // color for hints about expanding tool outputs
      OUTPUT_COLOR: "dim",                            // color for tool outputs
      MAX_EXPANDED_LINES: 20,                         // max lines shown when a tool result is expanded
      MORE_COLOR: "muted",                            // color for the separator text
      MORE_BG_COLOR: "separator",                              // background color for the separator line (empty = no bg)
      IS_THEME_BACKGROUND_VISIBLE: false,             // whether to apply theme background color to tool outputs
      DIFF_ADDED_COLOR: "toolDiffAdded",                // color for diff added lines
      DIFF_REMOVED_COLOR: "toolDiffRemoved",            // color for diff removed lines
      DIFF_CONTEXT_COLOR: "toolDiffContext",            // color for diff context lines
    },
    GROUPS: {
      BASE: {},                                       // base tools (read, bash, edit, write, ls, grep, find) — falls through to GENERAL
      MCP: {},                                        // MCP server tools — falls through to GENERAL
      WEB: {},                                        // web tools (web_search, fetch_content) — falls through to GENERAL
      CUSTOM: {},                                     // custom user tools — falls through to GENERAL
    },
  },
};



function mapGroupConfig(user?: ToolGeneralUserConfig, defaults: Record<string, any> = {}): ToolGeneralUserConfig {
  return {
    titleColor: user?.titleColor ?? defaults.TITLE_COLOR,
    summaryColor: user?.summaryColor ?? defaults.SUMMARY_COLOR,
    countColor: user?.countColor ?? defaults.COUNT_COLOR,
    expandHintColor: user?.expandHintColor ?? defaults.EXPAND_HINT_COLOR,
    outputColor: user?.outputColor ?? defaults.OUTPUT_COLOR,
    maxExpandedLines: user?.maxExpandedLines ?? defaults.MAX_EXPANDED_LINES,
    moreColor: user?.moreColor ?? defaults.MORE_COLOR,
    moreBgColor: user?.moreBgColor ?? defaults.MORE_BG_COLOR,
    isThemeBackgroundVisible: user?.isThemeBackgroundVisible ?? defaults.IS_THEME_BACKGROUND_VISIBLE,
    diffAddedColor: user?.diffAddedColor ?? defaults.DIFF_ADDED_COLOR,
    diffRemovedColor: user?.diffRemovedColor ?? defaults.DIFF_REMOVED_COLOR,
    diffContextColor: user?.diffContextColor ?? defaults.DIFF_CONTEXT_COLOR,
  };
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
  assistantMessage: {
    prefix: userConfig.assistantMessage?.prefix ?? DEFAULT_CONFIG.ASSISTANT_MESSAGE.PREFIX,
    color: userConfig.assistantMessage?.color ?? DEFAULT_CONFIG.ASSISTANT_MESSAGE.COLOR,
  },
  skills: {
    prefix: userConfig.skills?.prefix ?? DEFAULT_CONFIG.SKILLS.PREFIX,
    prefixColor: userConfig.skills?.prefixColor ?? DEFAULT_CONFIG.SKILLS.PREFIX_COLOR,
    titleColor: userConfig.skills?.titleColor ?? DEFAULT_CONFIG.SKILLS.TITLE_COLOR,
    nameColor: userConfig.skills?.nameColor ?? DEFAULT_CONFIG.SKILLS.NAME_COLOR,
    labelColor: userConfig.skills?.labelColor ?? DEFAULT_CONFIG.SKILLS.LABEL_COLOR,
    expandHintColor: userConfig.skills?.expandHintColor ?? DEFAULT_CONFIG.SKILLS.EXPAND_HINT_COLOR,
  },
  userMessage: {
    prefix: userConfig.userMessage?.prefix ?? DEFAULT_CONFIG.USER_MESSAGE.PREFIX,
    color: userConfig.userMessage?.color ?? DEFAULT_CONFIG.USER_MESSAGE.COLOR,
    isThemeBackgroundVisible: userConfig.userMessage?.isThemeBackgroundVisible ?? DEFAULT_CONFIG.USER_MESSAGE.IS_THEME_BACKGROUND_VISIBLE,
  },
  thinkingMessage: {
    prefix: userConfig.thinkingMessage?.prefix ?? DEFAULT_CONFIG.THINKING_MESSAGE.PREFIX,
    prefixColor: userConfig.thinkingMessage?.prefixColor ?? DEFAULT_CONFIG.THINKING_MESSAGE.PREFIX_COLOR,
    label: userConfig.thinkingMessage?.label ?? DEFAULT_CONFIG.THINKING_MESSAGE.LABEL,
    labelColor: userConfig.thinkingMessage?.labelColor ?? DEFAULT_CONFIG.THINKING_MESSAGE.LABEL_COLOR,
    isLabelVisible: userConfig.thinkingMessage?.isLabelVisible ?? DEFAULT_CONFIG.THINKING_MESSAGE.IS_LABEL_VISIBLE,
    messageColor: userConfig.thinkingMessage?.messageColor ?? DEFAULT_CONFIG.THINKING_MESSAGE.MESSAGE_COLOR,
  },
  tools: {
    toolSpinnerPrefix: {
      prefixChars: userConfig.tools?.toolSpinnerPrefix?.prefixChars ?? DEFAULT_CONFIG.TOOLS.TOOL_SPINNER_PREFIX.PREFIX_CHARS,
      color: userConfig.tools?.toolSpinnerPrefix?.color ?? DEFAULT_CONFIG.TOOLS.TOOL_SPINNER_PREFIX.COLOR,
    },
    toolSuccess: {
      prefix: userConfig.tools?.toolSuccess?.prefix ?? DEFAULT_CONFIG.TOOLS.TOOL_SUCCESS.PREFIX,
      prefixColor: userConfig.tools?.toolSuccess?.prefixColor ?? DEFAULT_CONFIG.TOOLS.TOOL_SUCCESS.PREFIX_COLOR,
      labelColor: userConfig.tools?.toolSuccess?.labelColor ?? DEFAULT_CONFIG.TOOLS.TOOL_SUCCESS.LABEL_COLOR,
    },
    toolError: {
      prefix: userConfig.tools?.toolError?.prefix ?? DEFAULT_CONFIG.TOOLS.TOOL_ERROR.PREFIX,
      prefixColor: userConfig.tools?.toolError?.prefixColor ?? DEFAULT_CONFIG.TOOLS.TOOL_ERROR.PREFIX_COLOR,
      labelColor: userConfig.tools?.toolError?.labelColor ?? DEFAULT_CONFIG.TOOLS.TOOL_ERROR.LABEL_COLOR,
    },
    toolBranch: {
      prefix: userConfig.tools?.toolBranch?.prefix ?? DEFAULT_CONFIG.TOOLS.TOOL_BRANCH.PREFIX,
      color: userConfig.tools?.toolBranch?.color ?? DEFAULT_CONFIG.TOOLS.TOOL_BRANCH.COLOR,
    },
    general: {
      titleColor: userConfig.tools?.general?.titleColor ?? DEFAULT_CONFIG.TOOLS.GENERAL.TITLE_COLOR,
      summaryColor: userConfig.tools?.general?.summaryColor ?? DEFAULT_CONFIG.TOOLS.GENERAL.SUMMARY_COLOR,
      countColor: userConfig.tools?.general?.countColor ?? DEFAULT_CONFIG.TOOLS.GENERAL.COUNT_COLOR,
      expandHintColor: userConfig.tools?.general?.expandHintColor ?? DEFAULT_CONFIG.TOOLS.GENERAL.EXPAND_HINT_COLOR,
      outputColor: userConfig.tools?.general?.outputColor ?? DEFAULT_CONFIG.TOOLS.GENERAL.OUTPUT_COLOR,
      maxExpandedLines: userConfig.tools?.general?.maxExpandedLines ?? DEFAULT_CONFIG.TOOLS.GENERAL.MAX_EXPANDED_LINES,
      moreColor: userConfig.tools?.general?.moreColor ?? DEFAULT_CONFIG.TOOLS.GENERAL.MORE_COLOR,
      moreBgColor: userConfig.tools?.general?.moreBgColor ?? DEFAULT_CONFIG.TOOLS.GENERAL.MORE_BG_COLOR,
      isThemeBackgroundVisible: userConfig.tools?.general?.isThemeBackgroundVisible ?? DEFAULT_CONFIG.TOOLS.GENERAL.IS_THEME_BACKGROUND_VISIBLE,
      diffAddedColor: userConfig.tools?.general?.diffAddedColor ?? DEFAULT_CONFIG.TOOLS.GENERAL.DIFF_ADDED_COLOR,
      diffRemovedColor: userConfig.tools?.general?.diffRemovedColor ?? DEFAULT_CONFIG.TOOLS.GENERAL.DIFF_REMOVED_COLOR,
      diffContextColor: userConfig.tools?.general?.diffContextColor ?? DEFAULT_CONFIG.TOOLS.GENERAL.DIFF_CONTEXT_COLOR,
    },
    groups: {
      base: mapGroupConfig(userConfig.tools?.groups?.base, DEFAULT_CONFIG.TOOLS.GROUPS.BASE),
      mcp: mapGroupConfig(userConfig.tools?.groups?.mcp, DEFAULT_CONFIG.TOOLS.GROUPS.MCP),
      web: mapGroupConfig(userConfig.tools?.groups?.web, DEFAULT_CONFIG.TOOLS.GROUPS.WEB),
      custom: mapGroupConfig(userConfig.tools?.groups?.custom, DEFAULT_CONFIG.TOOLS.GROUPS.CUSTOM),
    },
  },
};