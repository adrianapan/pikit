import { readFile, writeFile, mkdir } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type {
  ExtensionAPI,
  ExtensionContext,
  BeforeAgentStartEvent,
  BeforeAgentStartEventResult,
} from "@earendil-works/pi-coding-agent";

export type CavemanMode = "lite" | "full" | "ultra";
type CavemanLevel = CavemanMode | "off";

export interface CavemanState {
  enabled: boolean;
  mode: CavemanMode;
}

// ─── Persistence ────────────────────────────────────────────────────────────

interface CavemanConfig {
  defaultLevel: CavemanLevel;
}

const CONFIG_PATH = join(homedir(), ".pi", "agent", "configs", "caveman.json");
const DEFAULT_CONFIG: CavemanConfig = { defaultLevel: "off" };
const VALID_LEVELS = new Set<CavemanLevel>(["off", "lite", "full", "ultra"]);

async function loadConfig(): Promise<CavemanConfig> {
  try {
    const raw = await readFile(CONFIG_PATH, "utf8");
    const parsed = JSON.parse(raw);
    return VALID_LEVELS.has(parsed.defaultLevel)
      ? { defaultLevel: parsed.defaultLevel as CavemanLevel }
      : { ...DEFAULT_CONFIG };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

let saveInProgress = false;
let pendingSave: CavemanConfig | null = null;

function saveConfig(config: CavemanConfig): void {
  if (saveInProgress) {
    pendingSave = config;
    return;
  }
  pendingSave = null;
  saveInProgress = true;

  const snapshot = JSON.stringify(config, null, 2) + "\n";

  (async () => {
    try {
      await mkdir(join(homedir(), ".pi", "agent", "configs"), { recursive: true });
      await writeFile(CONFIG_PATH, snapshot, "utf8");
    } finally {
      saveInProgress = false;
      if (pendingSave) saveConfig(pendingSave);
    }
  })();
}

// ─── Prompts ─────────────────────────────────────────────────────────────────

// Shared base rules applied to all modes
const BASE = `\
IMPORTANT: You are in CAVEMAN MODE. Respond terse like smart caveman. \
All technical substance stay. Only fluff die.

Rules:
- Drop articles (a/an/the), filler (just/really/basically/actually/simply), \
pleasantries, hedging
- Fragments OK. Short synonyms preferred. Technical terms exact
- Code blocks unchanged. Errors quoted exact
- Pattern: [thing] [action] [reason]. [next step].

Bad: "Sure! I'd be happy to help you with that. The issue you're experiencing is likely caused by..."
Good: "Bug in auth middleware. Token expiry check use \`<\` not \`<=\`. Fix:"`;

// Per-level intensity calibration (appended after BASE)
const INTENSITY: Record<CavemanMode, string> = {
  lite: `\
No filler/hedging. Keep articles + full sentences. Professional but tight.
Example: "Your component re-renders because you create a new object reference each render. Wrap it in \`useMemo\`."`,

  full: `\
Drop articles, fragments OK, short synonyms.
Example: "New object ref each render. Inline object prop = new ref = re-render. Wrap in \`useMemo\`."`,

  ultra: `\
Abbreviate (DB/auth/config/req/res/fn/impl), strip conjunctions, arrows for causality (X → Y), one word when one word enough
Example: "Inline obj prop → new ref → re-render. \`useMemo\`."`,
};

// Safety clause — shared across all modes
const SAFETY = `\
Auto-clarity: drop caveman for security warnings, irreversible action confirmations, or when user is confused. Resume after.
Boundaries: write normal code. Only compress explanations. "stop caveman" or "normal mode" reverts.`;

function buildSystemPrompt(mode: CavemanMode, base: string): string {
  return `${base}\n\n${BASE}\n\n${INTENSITY[mode]}\n\n${SAFETY}`;
}

// ─── State ───────────────────────────────────────────────────────────────────

const MODE_LABELS: Record<CavemanMode, string> = {
  lite: "lite",
  full: "full",
  ultra: "ultra",
};

// Module-level state — shared via globalThis for footer segment reads
const state: CavemanState = { enabled: false, mode: "full" };
(globalThis as Record<string, unknown>).__caveman = state;

function setState(enabled: boolean, mode: CavemanMode): void {
  state.enabled = enabled;
  state.mode = mode;
  (globalThis as Record<string, unknown>).__caveman = { ...state };
  const requestRender = (globalThis as Record<string, unknown>).__footerRequestRender;
  if (typeof requestRender === "function") requestRender();
}

function notifyModeChange(ctx: ExtensionContext): void {
  if (!state.enabled) {
    ctx.ui.notify("Caveman off", "info");
    return;
  }
  const label = MODE_LABELS[state.mode];
  const descriptions: Record<CavemanMode, string> = {
    lite: "Professional, no fluff",
    full: "Classic caveman (default)",
    ultra: "Maximum compression",
  };
  ctx.ui.notify(`Caveman on — ${label}: ${descriptions[state.mode]}`, "success");
}

// ─── Extension ───────────────────────────────────────────────────────────────

export default function caveman(pi: ExtensionAPI) {
  // Restore state on session start — session entry wins over config default
  pi.on("session_start", async (_event, ctx) => {
    let sessionLevel: CavemanLevel | null = null;
    const entries = ctx.sessionManager?.getEntries?.() ?? [];
    for (let i = entries.length - 1; i >= 0; i--) {
      const entry = entries[i];
      if (entry.type === "custom" && entry.customType === "caveman-level") {
        sessionLevel = (entry.data as { level: CavemanLevel })?.level ?? null;
        break;
      }
    }

    if (sessionLevel !== null) {
      // Resuming a forked/switched session — restore exact state
      setState(sessionLevel !== "off", sessionLevel === "off" ? state.mode : sessionLevel);
    } else {
      // New session — apply config default
      const config = await loadConfig();
      if (config.defaultLevel !== "off") {
        setState(true, config.defaultLevel);
        pi.appendEntry("caveman-level", { level: config.defaultLevel });
      }
    }
  });

  // Inject caveman instructions into every system prompt when active
  pi.on(
    "before_agent_start",
    (event: BeforeAgentStartEvent): BeforeAgentStartEventResult => {
      if (!state.enabled) return {};
      return { systemPrompt: buildSystemPrompt(state.mode, event.systemPrompt) };
    },
  );

  // /caveman [lite|full|ultra]
  // No args: toggle on/off (defaults to full)
  pi.registerCommand("caveman", {
    description:
      "Toggle caveman speak mode. Subcommands: lite · full · ultra. No args: toggle on/off.",
    handler: async (args: string | undefined, ctx: ExtensionContext) => {
      if (!ctx.hasUI) return;

      const sub = (args ?? "").trim().toLowerCase();

      if (sub === "") {
        setState(!state.enabled, state.mode);
      } else if (sub === "lite" || sub === "full" || sub === "ultra") {
        setState(true, sub);
      } else {
        ctx.ui.notify(
          [
            "Usage: /caveman [subcommand]",
            "",
            "  /caveman          Toggle on (full as default) / off",
            "  /caveman lite     Professional, no fluff",
            "  /caveman full     Classic caveman (default)",
            "  /caveman ultra    Maximum compression",
          ].join("\n"),
          "info",
        );
        return;
      }

      pi.appendEntry("caveman-level", { level: state.enabled ? state.mode : "off" });
      saveConfig({ defaultLevel: state.enabled ? state.mode : "off" });
      notifyModeChange(ctx);
    },
  });
}
