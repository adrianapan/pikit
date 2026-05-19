import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

import type { SubagentsUserConfig } from "./types.js";

// ── Defaults ───────────────────────────────────────────────────────────────

export const DEFAULT_CONFIG = {
  SHARED: {
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
    STATUS: {
      DONE_LABEL: "Done",
      DONE_COLOR: "success",
      ERROR_LABEL: "Error",
      ERROR_COLOR: "error",
      WORKING_LABEL: "Running...",
      WORKING_COLOR: "dim",
      ELAPSED_COLOR: "muted",
      COUNT_COLOR: "muted",
      SEPARATOR_COLOR: "dim",
      WAITING_ICON: "↪",
      WAITING_ICON_COLOR: "muted",
    },
    HEADER: {
      TITLE_COLOR: "toolTitle",
      AGENT_COLOR: "accent",
      SUMMARY_COLOR: "muted",
    },
    EXPAND_HINT: {
      COLOR: "dim",
    },
    BRANCH: {
      PREFIX: "└─",
      COLOR: "separator",
    },
  },
};

// ── Agent defaults ──────────────────────────────────────────────────────

export const DEFAULT_AGENT_TOOLS = ["read", "grep", "find", "ls", "web_search", "fetch_content", "get_search_content"];
export const DEFAULT_AGENT_EXTENSIONS = ["env-loader", "web-access", "permission-gate", "protected-paths"];
export const DEFAULT_AGENT_SKILLS: string[] = [];

export const MAX_PARALLEL_TASKS = 8;
export const MAX_CONCURRENCY = 4;
export const PER_TASK_OUTPUT_CAP = 50 * 1024; // 50KB
export const TASK_PREVIEW_LENGTH = 40;

// ── Load & merge ──────────────────────────────────────────────────────

const CONFIG_PATH = join(homedir(), ".pi", "agent", "configs", "subagents.json");

function loadUserConfig(): SubagentsUserConfig {
  try {
    const raw = readFileSync(CONFIG_PATH, "utf8");
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

const userConfig = loadUserConfig();

export const CONFIG = {
  shared: {
    spinner: {
      prefixChars: userConfig.shared?.spinner?.prefixChars ?? DEFAULT_CONFIG.SHARED.SPINNER.PREFIX_CHARS,
      interval: userConfig.shared?.spinner?.interval ?? DEFAULT_CONFIG.SHARED.SPINNER.INTERVAL,
      color: userConfig.shared?.spinner?.color ?? DEFAULT_CONFIG.SHARED.SPINNER.COLOR,
    },
    successPrefix: {
      prefix: userConfig.shared?.successPrefix?.prefix ?? DEFAULT_CONFIG.SHARED.SUCCESS_PREFIX.PREFIX,
      color: userConfig.shared?.successPrefix?.color ?? DEFAULT_CONFIG.SHARED.SUCCESS_PREFIX.COLOR,
    },
    errorPrefix: {
      prefix: userConfig.shared?.errorPrefix?.prefix ?? DEFAULT_CONFIG.SHARED.ERROR_PREFIX.PREFIX,
      color: userConfig.shared?.errorPrefix?.color ?? DEFAULT_CONFIG.SHARED.ERROR_PREFIX.COLOR,
    },
    status: {
      doneColor: userConfig.shared?.status?.doneColor ?? DEFAULT_CONFIG.SHARED.STATUS.DONE_COLOR,
      doneLabel: userConfig.shared?.status?.doneLabel ?? DEFAULT_CONFIG.SHARED.STATUS.DONE_LABEL,
      errorColor: userConfig.shared?.status?.errorColor ?? DEFAULT_CONFIG.SHARED.STATUS.ERROR_COLOR,
      errorLabel: userConfig.shared?.status?.errorLabel ?? DEFAULT_CONFIG.SHARED.STATUS.ERROR_LABEL,
      workingColor: userConfig.shared?.status?.workingColor ?? DEFAULT_CONFIG.SHARED.STATUS.WORKING_COLOR,
      workingLabel: userConfig.shared?.status?.workingLabel ?? DEFAULT_CONFIG.SHARED.STATUS.WORKING_LABEL,
      elapsedColor: userConfig.shared?.status?.elapsedColor ?? DEFAULT_CONFIG.SHARED.STATUS.ELAPSED_COLOR,
      countColor: userConfig.shared?.status?.countColor ?? DEFAULT_CONFIG.SHARED.STATUS.COUNT_COLOR,
      separatorColor: userConfig.shared?.status?.separatorColor ?? DEFAULT_CONFIG.SHARED.STATUS.SEPARATOR_COLOR,
      waitingIcon: userConfig.shared?.status?.waitingIcon ?? DEFAULT_CONFIG.SHARED.STATUS.WAITING_ICON,
      waitingIconColor: userConfig.shared?.status?.waitingIconColor ?? DEFAULT_CONFIG.SHARED.STATUS.WAITING_ICON_COLOR,
    },
    header: {
      titleColor: userConfig.shared?.header?.titleColor ?? DEFAULT_CONFIG.SHARED.HEADER.TITLE_COLOR,
      agentColor: userConfig.shared?.header?.agentColor ?? DEFAULT_CONFIG.SHARED.HEADER.AGENT_COLOR,
      summaryColor: userConfig.shared?.header?.summaryColor ?? DEFAULT_CONFIG.SHARED.HEADER.SUMMARY_COLOR,
    },
    expandHint: {
      color: userConfig.shared?.expandHint?.color ?? DEFAULT_CONFIG.SHARED.EXPAND_HINT.COLOR,
    },
    branch: {
      prefix: userConfig.shared?.branch?.prefix ?? DEFAULT_CONFIG.SHARED.BRANCH.PREFIX,
      color: userConfig.shared?.branch?.color ?? DEFAULT_CONFIG.SHARED.BRANCH.COLOR,
    },
  },
};
