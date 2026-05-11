import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

export const DEFAULT_CONFIG = {
	BOX_PAD_X: 1,
	MENU_GAP: 0,
	EXTRA_MENU_INDENT: 1,
	BORDER_COLOR: "border" as const,
	PREFIX_COLOR: "accent" as const,
	PLAN_MODE_BORDER_COLOR: "customMessageLabel" as const,
	PLAN_MODE_PREFIX_COLOR: "customMessageLabel" as const,
	PLAN_MODE_PREFIX: "\u23F8",
	PREFIX: "\u276F",
	BOXED_VIEW: true,
};

interface ChatInputUserConfig {
	boxedView?: boolean;
	boxPadX?: number;
	menuGap?: number;
	extraMenuIndent?: number;
	borderColor?: string;
	prefixColor?: string;
	planModeBorderColor?: string;
	planModePrefixColor?: string;
	planModePrefix?: string;
	prefix?: string;
}

const CONFIG_PATH = join(homedir(), ".pi", "agent", "configs", "chat-input.json");

function loadUserConfig(): ChatInputUserConfig {
	try {
		const raw = readFileSync(CONFIG_PATH, "utf8");
		return JSON.parse(raw);
	} catch {
		return {};
	}
}

const userConfig = loadUserConfig();

export const CONFIG = {
	BOX_PAD_X: userConfig.boxPadX ?? DEFAULT_CONFIG.BOX_PAD_X,
	MENU_GAP: userConfig.menuGap ?? DEFAULT_CONFIG.MENU_GAP,
	EXTRA_MENU_INDENT: userConfig.extraMenuIndent ?? DEFAULT_CONFIG.EXTRA_MENU_INDENT,
	BORDER_COLOR: (userConfig.borderColor ?? DEFAULT_CONFIG.BORDER_COLOR) as string,
	PREFIX_COLOR: (userConfig.prefixColor ?? DEFAULT_CONFIG.PREFIX_COLOR) as string,
	PLAN_MODE_BORDER_COLOR: (userConfig.planModeBorderColor ?? DEFAULT_CONFIG.PLAN_MODE_BORDER_COLOR) as string,
	PLAN_MODE_PREFIX_COLOR: (userConfig.planModePrefixColor ?? DEFAULT_CONFIG.PLAN_MODE_PREFIX_COLOR) as string,
	PLAN_MODE_PREFIX: userConfig.planModePrefix ?? DEFAULT_CONFIG.PLAN_MODE_PREFIX,
	PREFIX: userConfig.prefix ?? DEFAULT_CONFIG.PREFIX,
	BOXED_VIEW: userConfig.boxedView ?? DEFAULT_CONFIG.BOXED_VIEW,
};