import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { pickVerb } from "./verbs.js";

const CYCLE_INTERVAL_MS = 2500;
const TYPEWRITER_MS = 42;

export default function slopSpinners(pi: ExtensionAPI) {
  let cycleTimer: ReturnType<typeof setInterval> | null = null;
  let typeTimer: ReturnType<typeof setInterval> | null = null;
  let current = "";

  function stopAll() {
    if (cycleTimer !== null) { clearInterval(cycleTimer); cycleTimer = null; }
    if (typeTimer !== null) { clearInterval(typeTimer); typeTimer = null; }
  }

  function typeVerb(ctx: any, verb: string) {
    if (typeTimer !== null) { clearInterval(typeTimer); typeTimer = null; }
    const full = verb + "...";
    let i = 1;
    ctx.ui.setWorkingMessage(full.slice(0, 1));
    typeTimer = setInterval(() => {
      i++;
      ctx.ui.setWorkingMessage(full.slice(0, i));
      if (i >= full.length) {
        clearInterval(typeTimer!);
        typeTimer = null;
      }
    }, TYPEWRITER_MS);
  }

  function startCycling(ctx: any) {
    current = pickVerb();
    ctx.ui.setWorkingMessage(current + "...");

    cycleTimer = setInterval(() => {
      let next = pickVerb();
      while (next === current) next = pickVerb();
      current = next;
      typeVerb(ctx, current);
    }, CYCLE_INTERVAL_MS);
  }

  pi.on("turn_start", async (_event: any, ctx: any) => {
    if (!ctx.hasUI) return;
    stopAll();
    startCycling(ctx);
  });

  pi.on("message_update", async (event: any, _ctx: any) => {
    if (event?.delta?.type === "text") stopAll();
  });

  pi.on("turn_end", async (_event: any, _ctx: any) => {
    stopAll();
  });
}
