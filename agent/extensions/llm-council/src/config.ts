import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { LlmCouncilUserConfig } from "./types.js";

export const DEFAULT_CONFIG = {
  MEMBERS: ["gemma4:31b:cloud", "kimi-k2.6:cloud", "minimax-m2.7:cloud"],
  CHAIRMAN: "glm-5.1:cloud",
  LABELS: ["A", "B", "C", "D", "E", "F", "G", "H"],

  SPINNER: {
    PREFIX_CHARS: ["·", "✢", "✳", "✶", "✻", "✽"],
    INTERVAL: 80,
    COLOR: "muted",
  },

  SUCCESS_PREFIX: {
    PREFIX: "✓",
    COLOR: "success",
  },

  ERROR_PREFIX: {
    PREFIX: "✗",
    COLOR: "error",
  },

  BRANCH: {
    PREFIX: "└─",
    COLOR: "separator",
  },

  CHAIRMAN_DISPLAY: {
    ICON: "👑",
    MODEL_COLOR: "dim",
  },

  MEMBER: {
    LABEL_COLOR: "accent",
    MODEL_COLOR: "dim",
  },

  STATUS: {
    DONE_LABEL: "Done",
    DONE_COLOR: "success",
    ERROR_LABEL: "Error",
    ERROR_COLOR: "error",
    WORKING_LABEL: "Working...",
    WORKING_COLOR: "muted",
    WAITING_ICON: "·",
    WAITING_ICON_COLOR: "muted",
    PENDING_LABEL: "Pending",
    PENDING_COLOR: "muted",
    SPAWNING_LABEL: "Spawning",
    SYNTHESIZING_LABEL: "Synthesizing...",
    WAITING_LABEL: "Waiting for members",
    ELAPSED_COLOR: "dim",
  },

  TOOL_HEADER: {
    TITLE_COLOR: "toolTitle",
    SUMMARY_COLOR: "dim",
  },

  EXPAND_HINT: {
    COLOR: "dim",
  },

  QUESTION_PREVIEW: {
    MAX_LENGTH: 40,
  },

  SYSTEM_PROMPTS: {
    MEMBER:
      "You are a member of an LLM Council. Answer the user's question thoroughly and concisely. Provide your best reasoning.",
    CHAIRMAN:
      "You are the Chairman of an LLM Council. Multiple AI models answered the same question anonymously, labeled A, B, C, etc. " +
      "Synthesize the best answer, drawing on the strongest points from each response. " +
      "Resolve any disagreements. Present a unified, well-reasoned answer. " +
      "Do not mention which model gave which answer — treat them as anonymous perspectives.",
  },
};

const CONFIG_PATH = join(homedir(), ".pi", "agent", "configs", "llm-council.json");

function loadUserConfig(): LlmCouncilUserConfig {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const userConfig = loadUserConfig();

export const CONFIG = {
  members: userConfig.members ?? DEFAULT_CONFIG.MEMBERS,
  chairman: userConfig.chairman ?? DEFAULT_CONFIG.CHAIRMAN,
  labels: userConfig.labels ?? DEFAULT_CONFIG.LABELS,
  spinner: {
    prefixChars: userConfig.spinner?.prefixChars ?? DEFAULT_CONFIG.SPINNER.PREFIX_CHARS,
    interval: userConfig.spinner?.interval ?? DEFAULT_CONFIG.SPINNER.INTERVAL,
    color: userConfig.spinner?.color ?? DEFAULT_CONFIG.SPINNER.COLOR,
  },
  successPrefix: {
    prefix: userConfig.successPrefix?.prefix ?? DEFAULT_CONFIG.SUCCESS_PREFIX.PREFIX,
    color: userConfig.successPrefix?.color ?? DEFAULT_CONFIG.SUCCESS_PREFIX.COLOR,
  },
  errorPrefix: {
    prefix: userConfig.errorPrefix?.prefix ?? DEFAULT_CONFIG.ERROR_PREFIX.PREFIX,
    color: userConfig.errorPrefix?.color ?? DEFAULT_CONFIG.ERROR_PREFIX.COLOR,
  },
  branch: {
    prefix: userConfig.branch?.prefix ?? DEFAULT_CONFIG.BRANCH.PREFIX,
    color: userConfig.branch?.color ?? DEFAULT_CONFIG.BRANCH.COLOR,
  },
  chairmanDisplay: {
    icon: userConfig.chairmanDisplay?.icon ?? DEFAULT_CONFIG.CHAIRMAN_DISPLAY.ICON,
    modelColor: userConfig.chairmanDisplay?.modelColor ?? DEFAULT_CONFIG.CHAIRMAN_DISPLAY.MODEL_COLOR,
  },
  member: {
    labelColor: userConfig.member?.labelColor ?? DEFAULT_CONFIG.MEMBER.LABEL_COLOR,
    modelColor: userConfig.member?.modelColor ?? DEFAULT_CONFIG.MEMBER.MODEL_COLOR,
  },
  status: {
    doneColor: userConfig.status?.doneColor ?? DEFAULT_CONFIG.STATUS.DONE_COLOR,
    doneLabel: userConfig.status?.doneLabel ?? DEFAULT_CONFIG.STATUS.DONE_LABEL,
    errorColor: userConfig.status?.errorColor ?? DEFAULT_CONFIG.STATUS.ERROR_COLOR,
    errorLabel: userConfig.status?.errorLabel ?? DEFAULT_CONFIG.STATUS.ERROR_LABEL,
    workingColor: userConfig.status?.workingColor ?? DEFAULT_CONFIG.STATUS.WORKING_COLOR,
    workingLabel: userConfig.status?.workingLabel ?? DEFAULT_CONFIG.STATUS.WORKING_LABEL,
    waitingIcon: userConfig.status?.waitingIcon ?? DEFAULT_CONFIG.STATUS.WAITING_ICON,
    waitingIconColor: userConfig.status?.waitingIconColor ?? DEFAULT_CONFIG.STATUS.WAITING_ICON_COLOR,
    pendingLabel: userConfig.status?.pendingLabel ?? DEFAULT_CONFIG.STATUS.PENDING_LABEL,
    pendingColor: userConfig.status?.pendingColor ?? DEFAULT_CONFIG.STATUS.PENDING_COLOR,
    spawningLabel: userConfig.status?.spawningLabel ?? DEFAULT_CONFIG.STATUS.SPAWNING_LABEL,
    synthesizingLabel: userConfig.status?.synthesizingLabel ?? DEFAULT_CONFIG.STATUS.SYNTHESIZING_LABEL,
    waitingLabel: userConfig.status?.waitingLabel ?? DEFAULT_CONFIG.STATUS.WAITING_LABEL,
    elapsedColor: userConfig.status?.elapsedColor ?? DEFAULT_CONFIG.STATUS.ELAPSED_COLOR,
  },
  toolHeader: {
    titleColor: userConfig.toolHeader?.titleColor ?? DEFAULT_CONFIG.TOOL_HEADER.TITLE_COLOR,
    summaryColor: userConfig.toolHeader?.summaryColor ?? DEFAULT_CONFIG.TOOL_HEADER.SUMMARY_COLOR,
  },
  expandHint: {
    color: userConfig.expandHint?.color ?? DEFAULT_CONFIG.EXPAND_HINT.COLOR,
  },
  questionPreview: {
    maxLength: userConfig.questionPreview?.maxLength ?? DEFAULT_CONFIG.QUESTION_PREVIEW.MAX_LENGTH,
  },
  systemPrompts: {
    member: userConfig.systemPrompts?.member ?? DEFAULT_CONFIG.SYSTEM_PROMPTS.MEMBER,
    chairman: userConfig.systemPrompts?.chairman ?? DEFAULT_CONFIG.SYSTEM_PROMPTS.CHAIRMAN,
  },
};