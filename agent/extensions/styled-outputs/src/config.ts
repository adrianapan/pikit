import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

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
      LABEL_COLOR: "success",                        // color for the success label (DONE on the 2nd line, the status line)
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
      TITLE_COLOR: "toolTitle",                      // color for tool titles (bash, ls, read, write, etc.)
      SUMMARY_COLOR: "dim",                          // color for tool summary (1st line, right after the title)
      COUNT_COLOR: "muted",                          // color for tool counts (e.g., "Tool 1 of 3")
      EXPAND_HINT_COLOR: "dim",                      // color for hints about expanding tool outputs
      OUTPUT_COLOR: "dim",                           // color for tool outputs
      IS_THEME_BACKGROUND_VISIBLE: false,           // whether to apply theme background color to tool outputs
    },
  },
};

// --- User config types (camelCase, partial) ---

interface StyledOutputsUserConfig {
  assistantMessage?: {
    prefix?: string;
    color?: string;
  };
  userMessage?: {
    prefix?: string;
    color?: string;
    isThemeBackgroundVisible?: boolean;
  };
  thinkingMessage?: {
    prefix?: string;
    prefixColor?: string;
    label?: string;
    labelColor?: string;
    isLabelVisible?: boolean;
    messageColor?: string;
  };
  tools?: {
    toolSpinnerPrefix?: {
      prefixChars?: string[];
      color?: string;
    };
    toolSuccess?: {
      prefix?: string;
      prefixColor?: string;
      labelColor?: string;
    };
    toolError?: {
      prefix?: string;
      prefixColor?: string;
      labelColor?: string;
    };
    toolBranch?: {
      prefix?: string;
      color?: string;
    };
    general?: {
      titleColor?: string;
      summaryColor?: string;
      countColor?: string;
      expandHintColor?: string;
      outputColor?: string;
      isThemeBackgroundVisible?: boolean;
    };
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
      isThemeBackgroundVisible: userConfig.tools?.general?.isThemeBackgroundVisible ?? DEFAULT_CONFIG.TOOLS.GENERAL.IS_THEME_BACKGROUND_VISIBLE,
    },
  },
};