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
	COMPANION_ENABLED: false,
	COMPANION_COLOR: "accent" as const,
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
	companion?: {
		enabled?: boolean;
		color?: string;
	};
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
	COMPANION_ENABLED: userConfig.companion?.enabled ?? DEFAULT_CONFIG.COMPANION_ENABLED,
	COMPANION_COLOR: (userConfig.companion?.color ?? DEFAULT_CONFIG.COMPANION_COLOR) as string,
};

// Non-user-configurable constants
export const COMPANION_PADDING = 3;
export const MIN_WIDTH_FOR_COMPANION = 40;

// ── animation timing (all in ms) ────────────────────────────────────
export const DIP_INTERVAL_MS = 10000;
export const RISE_INTERVAL_MS = 30000;
export const EARS_MIN_DURATION_MS = 2000;
export const EARS_MAX_DURATION_MS = 4000;
export const FULL_MIN_DURATION_MS = 3000;
export const FULL_MAX_DURATION_MS = 23000;
export const NONE_MIN_DURATION_MS = 800;
export const NONE_MAX_DURATION_MS = 2000;
export const FACE_MIN_DURATION_MS = 6000;
export const FACE_MAX_DURATION_MS = 36000;

// expression cycling
export const EXPR_MIN_DURATION_MS = 2000;
export const EXPR_MAX_DURATION_MS = 5500;
export const STARE_MIN_DURATION_MS = 8000;
export const STARE_MAX_DURATION_MS = 13000;
export const STARE_CHANCE = 0.15;
export const BLINK_MIN_DURATION_MS = 80;
export const BLINK_MAX_DURATION_MS = 330;

// expression transition: blink vs instant vs double-blink
export const EXPR_BLINK_CHANCE = 0.50;
export const EXPR_DOUBLE_BLINK_CHANCE = 0.15;   // remainder = instant
export const DOUBLE_BLINK_GAP_MIN_MS = 80;
export const DOUBLE_BLINK_GAP_MAX_MS = 160;

// wobble (ears phase)
export const WOBBLE_RANGE = 8;
export const WOBBLE_MIN_INTERVAL_MS = 200;
export const WOBBLE_MAX_INTERVAL_MS = 600;
export const DIR_STEPS_MIN = 2;
export const DIR_STEPS_MAX = 5;
export const EDGE_BIAS_STRENGTH = 0.45;
export const EDGE_PAUSE_MIN_MS = 300;
export const EDGE_PAUSE_MAX_MS = 800;

// face micro-drift
export const FACE_DRIFT_RANGE = 3;
export const FACE_DRIFT_MIN_INTERVAL_MS = 2000;
export const FACE_DRIFT_MAX_INTERVAL_MS = 5000;

// phase transitions
export const EARS_TO_NONE_CHANCE = 0.15;
export const EARS_TO_FULL_CHANCE = 0.425;       // remainder = face
export const FULL_TO_EARS_CHANCE = 0.15;
export const FULL_TO_NONE_CHANCE = 0.10;         // remainder = face

// transition frames
export const SLOW_TRANSITION_CHANCE = 0.2;
export const SLOW_TRANSITION_MULT_MIN = 2;
export const SLOW_TRANSITION_MULT_MAX = 3;

export const BLINK_ART: [string, string, string] = [" /\\_/\\ ", "( -.- )", " |   | "];

export const COMPANION_ARTS: [string, string, string][] = [
	[" /\\_/\\ ", "( ⌒.⌒ )", " |   | "],  // happy
	[" /\\_/\\ ", "( o.o )", " |   | "],  // original
	[" /\\_/\\ ", "( ^.^ )", " |   | "],  // happy
	[" /\\_/\\ ", "( O.O )", " |   | "],  // awake
	[" /\\_/\\ ", "( o.- )", " |   | "],  // winking
	[" /\\_/\\ ", "( >.< )", " |   | "],  // closed
	[" /\\_/\\ ", "( o.O )", " |   | "],  // curious
	[" /\\_/\\ ", "( *.* )", " |   | "],  // sparkle
	[" /\\_/\\ ", "( ᴗ.ᴗ )", " |   | "],  // unimpressed
	[" /\\_/\\ ", "( ω.ω )", " |   | "],  // joyful
];