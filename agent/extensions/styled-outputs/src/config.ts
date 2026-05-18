import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { StyledOutputsUserConfig } from "./types.js";


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
    BODY_COLOR: "text",
    IS_THEME_BACKGROUND_VISIBLE: true,
  },
  
  // Skill invocation
  SKILLS: {
    PREFIX: "✓",
    PREFIX_COLOR: "accent",
    TITLE_COLOR: "toolTitle",
    NAME_COLOR: "dim",
    LABEL_COLOR: "success",
    EXPAND_HINT_COLOR: "dim",
    OUTPUT_COLOR: "dim",
  },

  // Custom message
  CUSTOM_MESSAGES: {
    PREFIX: "✓",
    PREFIX_COLOR: "accent",
    TITLE_COLOR: "toolTitle",
    NAME_COLOR: "dim",
    LABEL_COLOR: "success",
    EXPAND_HINT_COLOR: "dim",
    OUTPUT_COLOR: "dim",
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

  // Bash execution (! and !! commands)
  BASH_EXECUTION: {
    TITLE_COLOR: "bashMode",
  },

  TOOLS: {
    TOOL_SPINNER_PREFIX: {
      PREFIX_CHARS: ["·", "✢", "✳", "✶", "✻", "✽"],   // tool loading spinner characters
      COLOR: "muted",                                 // color for the spinner prefix
    },
    TOOL_SUCCESS: {
      PREFIX: "✓",                                    // icon for successful tool execution
      PREFIX_COLOR: "success",                        // color for the success prefix
      LABEL_COLOR: "success",                         // color for the success label (DONE on the 2nd line, the status line)
    },
    TOOL_ERROR: {
      PREFIX: "✗",                                    // icon for error tool execution
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
      MAX_EXPANDED_LINES: 40,                         // max lines shown when a tool result is expanded
      MORE_COLOR: "muted",                            // color for the separator text
      MORE_BG_COLOR: "separator",                     // background color for the separator line (empty = no bg)
      IS_THEME_BACKGROUND_VISIBLE: false,             // whether to apply theme background color to tool outputs
      VERTICAL_PADDING: 0,                            // paddingY for tool content box (0 = compact, core default = 1)
      HORIZONTAL_PADDING: 3,                          // paddingX for tool content box (1 = default, controls left+right indent)
      DIFF_ADDED_COLOR: "toolDiffAdded",              // color for diff added lines
      DIFF_REMOVED_COLOR: "toolDiffRemoved",          // color for diff removed lines
      DIFF_CONTEXT_COLOR: "toolDiffContext",          // color for diff context lines
      MAX_DIFF_FILE_SIZE: "1MB",                      // skip diff for files exceeding this size
    },
  },
};



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
    outputColor: userConfig.skills?.outputColor ?? DEFAULT_CONFIG.SKILLS.OUTPUT_COLOR,
  },
  userMessage: {
    prefix: userConfig.userMessage?.prefix ?? DEFAULT_CONFIG.USER_MESSAGE.PREFIX,
    color: userConfig.userMessage?.color ?? DEFAULT_CONFIG.USER_MESSAGE.COLOR,
    bodyColor: userConfig.userMessage?.bodyColor ?? DEFAULT_CONFIG.USER_MESSAGE.BODY_COLOR,
    isThemeBackgroundVisible: userConfig.userMessage?.isThemeBackgroundVisible ?? DEFAULT_CONFIG.USER_MESSAGE.IS_THEME_BACKGROUND_VISIBLE,
  },
  customMessages: {
    prefix: userConfig.customMessages?.prefix ?? DEFAULT_CONFIG.CUSTOM_MESSAGES.PREFIX,
    prefixColor: userConfig.customMessages?.prefixColor ?? DEFAULT_CONFIG.CUSTOM_MESSAGES.PREFIX_COLOR,
    titleColor: userConfig.customMessages?.titleColor ?? DEFAULT_CONFIG.CUSTOM_MESSAGES.TITLE_COLOR,
    nameColor: userConfig.customMessages?.nameColor ?? DEFAULT_CONFIG.CUSTOM_MESSAGES.NAME_COLOR,
    labelColor: userConfig.customMessages?.labelColor ?? DEFAULT_CONFIG.CUSTOM_MESSAGES.LABEL_COLOR,
    expandHintColor: userConfig.customMessages?.expandHintColor ?? DEFAULT_CONFIG.CUSTOM_MESSAGES.EXPAND_HINT_COLOR,
    outputColor: userConfig.customMessages?.outputColor ?? DEFAULT_CONFIG.CUSTOM_MESSAGES.OUTPUT_COLOR,
  },
  thinkingMessage: {
    prefix: userConfig.thinkingMessage?.prefix ?? DEFAULT_CONFIG.THINKING_MESSAGE.PREFIX,
    prefixColor: userConfig.thinkingMessage?.prefixColor ?? DEFAULT_CONFIG.THINKING_MESSAGE.PREFIX_COLOR,
    label: userConfig.thinkingMessage?.label ?? DEFAULT_CONFIG.THINKING_MESSAGE.LABEL,
    labelColor: userConfig.thinkingMessage?.labelColor ?? DEFAULT_CONFIG.THINKING_MESSAGE.LABEL_COLOR,
    isLabelVisible: userConfig.thinkingMessage?.isLabelVisible ?? DEFAULT_CONFIG.THINKING_MESSAGE.IS_LABEL_VISIBLE,
    messageColor: userConfig.thinkingMessage?.messageColor ?? DEFAULT_CONFIG.THINKING_MESSAGE.MESSAGE_COLOR,
  },
  bashExecution: {
    titleColor: userConfig.bashExecution?.titleColor ?? DEFAULT_CONFIG.BASH_EXECUTION.TITLE_COLOR,
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
      verticalPadding: userConfig.tools?.general?.verticalPadding ?? DEFAULT_CONFIG.TOOLS.GENERAL.VERTICAL_PADDING,
      horizontalPadding: userConfig.tools?.general?.horizontalPadding ?? DEFAULT_CONFIG.TOOLS.GENERAL.HORIZONTAL_PADDING,
      diffAddedColor: userConfig.tools?.general?.diffAddedColor ?? DEFAULT_CONFIG.TOOLS.GENERAL.DIFF_ADDED_COLOR,
      diffRemovedColor: userConfig.tools?.general?.diffRemovedColor ?? DEFAULT_CONFIG.TOOLS.GENERAL.DIFF_REMOVED_COLOR,
      diffContextColor: userConfig.tools?.general?.diffContextColor ?? DEFAULT_CONFIG.TOOLS.GENERAL.DIFF_CONTEXT_COLOR,
      maxDiffFileSize: userConfig.tools?.general?.maxDiffFileSize ?? DEFAULT_CONFIG.TOOLS.GENERAL.MAX_DIFF_FILE_SIZE,
    },
    groups: {
      base: userConfig.tools?.groups?.base ?? {},
      mcp: userConfig.tools?.groups?.mcp ?? {},
      web: userConfig.tools?.groups?.web ?? {},
      custom: userConfig.tools?.groups?.custom ?? {},
    },
  },
};