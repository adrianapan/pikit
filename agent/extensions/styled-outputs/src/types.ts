export interface AssistantMessageUserConfig {
  prefix?: string;
  color?: string;
}

export interface UserMessageUserConfig {
  prefix?: string;
  color?: string;
  bodyColor?: string;
  isThemeBackgroundVisible?: boolean;
}

export interface SkillsUserConfig {
  prefix?: string;
  prefixColor?: string;
  titleColor?: string;
  nameColor?: string;
  labelColor?: string;
  expandHintColor?: string;
  outputColor?: string;
}

export interface ThinkingMessageUserConfig {
  prefix?: string;
  prefixColor?: string;
  label?: string;
  labelColor?: string;
  isLabelVisible?: boolean;
  messageColor?: string;
}

export interface ToolSpinnerPrefixUserConfig {
  prefixChars?: string[];
  color?: string;
}

export interface ToolSuccessUserConfig {
  prefix?: string;
  prefixColor?: string;
  labelColor?: string;
}

export interface ToolErrorUserConfig {
  prefix?: string;
  prefixColor?: string;
  labelColor?: string;
}

export interface ToolBranchUserConfig {
  prefix?: string;
  color?: string;
}

export type TrimStrategy = "head" | "tail" | "head-tail";

export interface ToolGeneralUserConfig {
  titleColor?: string;
  summaryColor?: string;
  countColor?: string;
  expandHintColor?: string;
  outputColor?: string;
  isThemeBackgroundVisible?: boolean;
  maxExpandedLines?: number;
  moreColor?: string;
  moreBgColor?: string;
  diffAddedColor?: string;
  diffRemovedColor?: string;
  diffContextColor?: string;
  maxDiffFileSize?: string | number;
}

export interface ToolGroupsUserConfig {
  base?: ToolGeneralUserConfig;
  mcp?: ToolGeneralUserConfig;
  web?: ToolGeneralUserConfig;
  custom?: ToolGeneralUserConfig;
}

export interface ToolsUserConfig {
  toolSpinnerPrefix?: ToolSpinnerPrefixUserConfig;
  toolSuccess?: ToolSuccessUserConfig;
  toolError?: ToolErrorUserConfig;
  toolBranch?: ToolBranchUserConfig;
  general?: ToolGeneralUserConfig;
  groups?: ToolGroupsUserConfig;
}

export interface CustomMessagesUserConfig {
  prefix?: string;
  prefixColor?: string;
  titleColor?: string;
  nameColor?: string;
  labelColor?: string;
  expandHintColor?: string;
  outputColor?: string;
}

export interface StyledOutputsUserConfig {
  assistantMessage?: AssistantMessageUserConfig;
  userMessage?: UserMessageUserConfig;
  skills?: SkillsUserConfig;
  thinkingMessage?: ThinkingMessageUserConfig;
  customMessages?: CustomMessagesUserConfig;
  tools?: ToolsUserConfig;
}