import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import type { CouncilMemberUserConfig, LlmCouncilUserConfig } from "./types.js";

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
    BRANCH: {
      PREFIX: "└─",
      COLOR: "separator",
    },
    STATUS: {
      DONE_LABEL: "Done",
      DONE_COLOR: "success",
      ERROR_LABEL: "Error",
      ERROR_COLOR: "error",
      WORKING_LABEL: "Working...",
      WORKING_COLOR: "dim",
      WAITING_ICON: "↪",
      WAITING_ICON_COLOR: "muted",
      SYNTHESIZING_LABEL: "Synthesising...",
      WAITING_LABEL: "Waiting for members...",
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
  },

  MEMBER: {
    /**
     * Council member options:
     * model - string, required
     * label - string, required
     * systemPrompt - string, optional, falls back to DEFAULT_SYSTEM_PROMPT
     */
    COUNCIL: [
      { model: "glm-5.1:cloud", displayName: "GLM 5.1/", label: "Member A"},
      { model: "kimi-k2.6:cloud", displayName: "Kimi K2.6", label: "Member B" },
      { model: "minimax-m2.7:cloud", displayName: "MiniMax M2.7", label: "Member C" },
    ],
    DEFAULT_SYSTEM_PROMPT:
      "You are a member of an LLM Council. Answer the user's question thoroughly and concisely. Provide your best reasoning.",
    DISPLAY: {
      LABEL_COLOR: "accent",
      MODEL_COLOR: "dim",
    },
    TOOLS: ["read", "grep", "find", "ls", "bash", "web_search", "fetch_content", "get_search_content"],
    THINKING: "medium",
    EXTENSIONS: ["env-loader", "web-access", "permission-gate", "protected-paths"],
    SKILLS: ["gh"],
    CONTEXT_FILES: false,
  },

  CHAIRMAN: {
    MODEL: "deepseek-v4-pro:cloud",
    DISPLAY_NAME: "DeepSeek V4 Pro",
    SYSTEM_PROMPT:
      "You are the Chairman of an LLM Council. Multiple AI models answered the same question anonymously, labeled A, B, C, etc. " +
      "Synthesize the best answer, drawing on the strongest points from each response. " +
      "Resolve any disagreements. Present a unified, well-reasoned answer. " +
      "Do not mention which model gave which answer — treat them as anonymous perspectives.",
    EXPOSE_PERSONAS: true,
    DISPLAY: {
      ICON: "",
      LABEL_COLOR: "accent",
      MODEL_COLOR: "dim",
    },
    TOOLS: [],
    THINKING: "medium",
    EXTENSIONS: ["env-loader"],
    SKILLS: [],
    CONTEXT_FILES: false,
  },
};

// ── Load & merge ───────────────────────────────────────────────────────────

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

const memberCouncil = userConfig.member?.council ?? DEFAULT_CONFIG.MEMBER.COUNCIL;
const memberDefaultSystemPrompt = userConfig.member?.defaultSystemPrompt ?? DEFAULT_CONFIG.MEMBER.DEFAULT_SYSTEM_PROMPT;

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
    branch: {
      prefix: userConfig.shared?.branch?.prefix ?? DEFAULT_CONFIG.SHARED.BRANCH.PREFIX,
      color: userConfig.shared?.branch?.color ?? DEFAULT_CONFIG.SHARED.BRANCH.COLOR,
    },
    status: {
      doneColor: userConfig.shared?.status?.doneColor ?? DEFAULT_CONFIG.SHARED.STATUS.DONE_COLOR,
      doneLabel: userConfig.shared?.status?.doneLabel ?? DEFAULT_CONFIG.SHARED.STATUS.DONE_LABEL,
      errorColor: userConfig.shared?.status?.errorColor ?? DEFAULT_CONFIG.SHARED.STATUS.ERROR_COLOR,
      errorLabel: userConfig.shared?.status?.errorLabel ?? DEFAULT_CONFIG.SHARED.STATUS.ERROR_LABEL,
      workingColor: userConfig.shared?.status?.workingColor ?? DEFAULT_CONFIG.SHARED.STATUS.WORKING_COLOR,
      workingLabel: userConfig.shared?.status?.workingLabel ?? DEFAULT_CONFIG.SHARED.STATUS.WORKING_LABEL,
      waitingIcon: userConfig.shared?.status?.waitingIcon ?? DEFAULT_CONFIG.SHARED.STATUS.WAITING_ICON,
      waitingIconColor: userConfig.shared?.status?.waitingIconColor ?? DEFAULT_CONFIG.SHARED.STATUS.WAITING_ICON_COLOR,
      synthesizingLabel: userConfig.shared?.status?.synthesizingLabel ?? DEFAULT_CONFIG.SHARED.STATUS.SYNTHESIZING_LABEL,
      waitingLabel: userConfig.shared?.status?.waitingLabel ?? DEFAULT_CONFIG.SHARED.STATUS.WAITING_LABEL,
      elapsedColor: userConfig.shared?.status?.elapsedColor ?? DEFAULT_CONFIG.SHARED.STATUS.ELAPSED_COLOR,
    },
    toolHeader: {
      titleColor: userConfig.shared?.toolHeader?.titleColor ?? DEFAULT_CONFIG.SHARED.TOOL_HEADER.TITLE_COLOR,
      summaryColor: userConfig.shared?.toolHeader?.summaryColor ?? DEFAULT_CONFIG.SHARED.TOOL_HEADER.SUMMARY_COLOR,
    },
    expandHint: {
      color: userConfig.shared?.expandHint?.color ?? DEFAULT_CONFIG.SHARED.EXPAND_HINT.COLOR,
    },
    questionPreview: {
      maxLength: userConfig.shared?.questionPreview?.maxLength ?? DEFAULT_CONFIG.SHARED.QUESTION_PREVIEW.MAX_LENGTH,
    },
  },

  member: {
    council: memberCouncil.map((m: CouncilMemberUserConfig, i: number) => ({
      model: m.model,
      displayName: m.displayName,
      label: m.label ?? String(i + 1),
      systemPrompt: m.systemPrompt ?? memberDefaultSystemPrompt,
    })),
    defaultSystemPrompt: memberDefaultSystemPrompt,
    display: {
      labelColor: userConfig.member?.display?.labelColor ?? DEFAULT_CONFIG.MEMBER.DISPLAY.LABEL_COLOR,
      modelColor: userConfig.member?.display?.modelColor ?? DEFAULT_CONFIG.MEMBER.DISPLAY.MODEL_COLOR,
    },
    tools: userConfig.member?.tools ?? DEFAULT_CONFIG.MEMBER.TOOLS,
    thinking: userConfig.member?.thinking ?? DEFAULT_CONFIG.MEMBER.THINKING,
    extensions: userConfig.member?.extensions ?? DEFAULT_CONFIG.MEMBER.EXTENSIONS,
    skills: userConfig.member?.skills ?? DEFAULT_CONFIG.MEMBER.SKILLS,
    contextFiles: userConfig.member?.contextFiles ?? DEFAULT_CONFIG.MEMBER.CONTEXT_FILES,
  },

  chairman: {
    model: userConfig.chairman?.model ?? DEFAULT_CONFIG.CHAIRMAN.MODEL,
    displayName: userConfig.chairman?.displayName ?? DEFAULT_CONFIG.CHAIRMAN.DISPLAY_NAME,
    systemPrompt: userConfig.chairman?.systemPrompt ?? DEFAULT_CONFIG.CHAIRMAN.SYSTEM_PROMPT,
    exposePersonas: userConfig.chairman?.exposePersonas ?? DEFAULT_CONFIG.CHAIRMAN.EXPOSE_PERSONAS,
    display: {
      icon: userConfig.chairman?.display?.icon ?? DEFAULT_CONFIG.CHAIRMAN.DISPLAY.ICON,
      labelColor: userConfig.chairman?.display?.labelColor ?? DEFAULT_CONFIG.CHAIRMAN.DISPLAY.LABEL_COLOR,
      modelColor: userConfig.chairman?.display?.modelColor ?? DEFAULT_CONFIG.CHAIRMAN.DISPLAY.MODEL_COLOR,
    },
    tools: userConfig.chairman?.tools ?? DEFAULT_CONFIG.CHAIRMAN.TOOLS,
    thinking: userConfig.chairman?.thinking ?? DEFAULT_CONFIG.CHAIRMAN.THINKING,
    extensions: userConfig.chairman?.extensions ?? DEFAULT_CONFIG.CHAIRMAN.EXTENSIONS,
    skills: userConfig.chairman?.skills ?? DEFAULT_CONFIG.CHAIRMAN.SKILLS,
    contextFiles: userConfig.chairman?.contextFiles ?? DEFAULT_CONFIG.CHAIRMAN.CONTEXT_FILES,
  },
};