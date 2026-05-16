export interface SpinnerUserConfig {
  prefixChars?: string[];
  interval?: number;
  color?: string;
}

export interface PrefixUserConfig {
  prefix?: string;
  color?: string;
}

export interface ChairmanDisplayUserConfig {
  icon?: string;
  modelColor?: string;
}

export interface MemberUserConfig {
  labelColor?: string;
  modelColor?: string;
}

export interface StatusUserConfig {
  doneLabel?: string;
  doneColor?: string;
  errorLabel?: string;
  errorColor?: string;
  workingLabel?: string;
  workingColor?: string;
  pendingLabel?: string;
  pendingColor?: string;
  spawningLabel?: string;
  synthesizingLabel?: string;
  waitingLabel?: string;
  elapsedColor?: string;
}

export interface ToolHeaderUserConfig {
  titleColor?: string;
  summaryColor?: string;
}

export interface ExpandHintUserConfig {
  color?: string;
}

export interface QuestionPreviewUserConfig {
  maxLength?: number;
}

export interface SystemPromptsUserConfig {
  member?: string;
  chairman?: string;
}

export interface LlmCouncilUserConfig {
  members?: string[];
  chairman?: string;
  labels?: string[];
  spinner?: SpinnerUserConfig;
  successPrefix?: PrefixUserConfig;
  errorPrefix?: PrefixUserConfig;
  branch?: PrefixUserConfig;
  chairmanDisplay?: ChairmanDisplayUserConfig;
  member?: MemberUserConfig;
  status?: StatusUserConfig;
  toolHeader?: ToolHeaderUserConfig;
  expandHint?: ExpandHintUserConfig;
  questionPreview?: QuestionPreviewUserConfig;
  systemPrompts?: SystemPromptsUserConfig;
}