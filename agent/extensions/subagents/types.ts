// ── Agent config ─────────────────────────────────────────────────────────

export interface AgentConfig {
  name: string;
  description: string;
  tools: string[];
  model?: string;
  thinking?: string;
  extensions: string[];
  skills: string[];
  systemPrompt: string;
  source: "user" | "project";
  filePath: string;
}

// ── Discovery ────────────────────────────────────────────────────────────

export interface AgentDiscoveryResult {
  agents: Map<string, AgentConfig>;
}

// ── Execution result ────────────────────────────────────────────────────

export interface SingleResult {
  agent: string;
  task: string;
  exitCode: number;
  text: string;
  error?: string;
  startedAt: number;
  doneAt: number;
  step?: number;
  status?: "pending" | "working" | "done" | "error";
}

// ── Subagent details (for renderResult) ─────────────────────────────────

export interface SubagentDetails {
  mode: "single" | "parallel" | "chain";
  results: SingleResult[];
}

// ── Task item (shared by chain and parallel params) ─────────────────────

export interface TaskItem {
  agent: string;
  task: string;
  cwd?: string;
}

// ── Shared UI config (mirrors LLM Council's SharedUserConfig) ───────────

export interface SpinnerUserConfig {
  prefixChars?: string[];
  interval?: number;
  color?: string;
}

export interface PrefixUserConfig {
  prefix?: string;
  color?: string;
}

export interface StatusUserConfig {
  doneLabel?: string;
  doneColor?: string;
  errorLabel?: string;
  errorColor?: string;
  workingLabel?: string;
  workingColor?: string;
  elapsedColor?: string;
  countColor?: string;
  separatorColor?: string;
  waitingIcon?: string;
  waitingIconColor?: string;
}

export interface HeaderUserConfig {
  titleColor?: string;
  agentColor?: string;
  summaryColor?: string;
}

export interface ExpandHintUserConfig {
  color?: string;
}

export interface BranchUserConfig {
  prefix?: string;
  color?: string;
}

export interface SharedUserConfig {
  spinner?: SpinnerUserConfig;
  successPrefix?: PrefixUserConfig;
  errorPrefix?: PrefixUserConfig;
  status?: StatusUserConfig;
  header?: HeaderUserConfig;
  expandHint?: ExpandHintUserConfig;
  branch?: BranchUserConfig;
}

export interface SubagentsUserConfig {
  shared?: SharedUserConfig;
}
