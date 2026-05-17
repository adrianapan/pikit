import type { Theme, ThemeColor } from "@earendil-works/pi-coding-agent";
import {
	COMPANION_ARTS,
	BLINK_ART,
	DIP_INTERVAL_MS,
	RISE_INTERVAL_MS,
	EARS_MIN_DURATION_MS,
	EARS_MAX_DURATION_MS,
	FULL_MIN_DURATION_MS,
	FULL_MAX_DURATION_MS,
	NONE_MIN_DURATION_MS,
	NONE_MAX_DURATION_MS,
	FACE_MIN_DURATION_MS,
	FACE_MAX_DURATION_MS,
	EXPR_MIN_DURATION_MS,
	EXPR_MAX_DURATION_MS,
	STARE_MIN_DURATION_MS,
	STARE_MAX_DURATION_MS,
	STARE_CHANCE,
	BLINK_MIN_DURATION_MS,
	BLINK_MAX_DURATION_MS,
	EXPR_BLINK_CHANCE,
	EXPR_DOUBLE_BLINK_CHANCE,
	DOUBLE_BLINK_GAP_MIN_MS,
	DOUBLE_BLINK_GAP_MAX_MS,
	WOBBLE_RANGE,
	WOBBLE_MIN_INTERVAL_MS,
	WOBBLE_MAX_INTERVAL_MS,
	DIR_STEPS_MIN,
	DIR_STEPS_MAX,
	EDGE_BIAS_STRENGTH,
	EDGE_PAUSE_MIN_MS,
	EDGE_PAUSE_MAX_MS,
	FACE_DRIFT_RANGE,
	FACE_DRIFT_MIN_INTERVAL_MS,
	FACE_DRIFT_MAX_INTERVAL_MS,
	EARS_TO_NONE_CHANCE,
	EARS_TO_FULL_CHANCE,
	FULL_TO_EARS_CHANCE,
	FULL_TO_NONE_CHANCE,
	SLOW_TRANSITION_CHANCE,
	SLOW_TRANSITION_MULT_MIN,
	SLOW_TRANSITION_MULT_MAX,
} from "./config.js";

function isHexColor(color: string): boolean {
	return color.startsWith("#");
}

function hexToAnsi(hex: string): string {
	const h = hex.replace("#", "");
	if (!/^[0-9a-fA-F]{6}$/.test(h)) return "";
	const r = parseInt(h.slice(0, 2), 16);
	const g = parseInt(h.slice(2, 4), 16);
	const b = parseInt(h.slice(4, 6), 16);
	return `\x1b[38;2;${r};${g};${b}m`;
}

export function applyColor(theme: Theme, color: string, text: string): string {
	if (isHexColor(color)) {
		return `${hexToAnsi(color)}${text}\x1b[0m`;
	}
	return theme.fg(color as ThemeColor, text);
}

// ─── Companion animator ───────────────────────────────────────────────────

export interface CompanionState {
	lines: string[];
	extraPad: number;
}

type Phase = "face" | "ears" | "full" | "none";

const TICK_MS = 100; // matches setInterval in ChatInput
const R = (min: number, max: number) => min + Math.random() * (max - min);

export class CompanionAnimator {
	private phase: Phase = "face";
	private phaseEntered = 0;
	private phaseDuration = 0;

	private exprIdx = 0;
	private lastExprChange = 0;
	private exprDuration = 0;
	private isBlinking = false;
	private blinkUntil = 0;

	private doubleBlinkPending = false;
	private doubleBlinkGap = false;
	private gapUntil = 0;

	private offset = 0;
	private lastOffsetChange = 0;
	private wobbleInterval = 0;

	private dirDelta = 0;
	private dirSteps = 0;

	private edgePauseUntil = 0;

	private lastFaceDrift = 0;
	private faceDriftInterval = 0;

	private transitionFromLines = 2;
	private transitionRemaining = 0;
	private transitionTotal = 0;

	// ── tick ──────────────────────────────────────────────────────────

	tick(now: number): void {
		if (this.phaseEntered === 0) {
			this.phaseEntered = now;
			this.phaseDuration = R(FACE_MIN_DURATION_MS, FACE_MAX_DURATION_MS);
			this.exprIdx = this.pickNextExpr();
			this.lastExprChange = now;
			this.exprDuration = this.randExprDuration();
			this.lastFaceDrift = now;
			this.faceDriftInterval = R(FACE_DRIFT_MIN_INTERVAL_MS, FACE_DRIFT_MAX_INTERVAL_MS);
			return;
		}

		if (this.transitionRemaining > 0) this.transitionRemaining--;

		const elapsed = now - this.phaseEntered;

		if (this.phase === "face" || this.phase === "full") {
			this.tickExpression(now);
		}

		switch (this.phase) {
			case "face":  this.tickFace(now, elapsed);  break;
			case "ears":  this.tickEars(now, elapsed);  break;
			case "full":  this.tickFull(now, elapsed);  break;
			case "none":  this.tickNone(elapsed);       break;
		}
	}

	// ── expression cycling ────────────────────────────────────────────

	private tickExpression(now: number): void {
		if (this.doubleBlinkGap && now >= this.gapUntil) {
			this.doubleBlinkGap = false;
			this.isBlinking = true;
			this.blinkUntil = now + R(BLINK_MIN_DURATION_MS, BLINK_MAX_DURATION_MS);
			return;
		}

		if (this.isBlinking && now >= this.blinkUntil) {
			this.isBlinking = false;
			if (this.doubleBlinkPending) {
				this.doubleBlinkPending = false;
				this.doubleBlinkGap = true;
				this.gapUntil = now + R(DOUBLE_BLINK_GAP_MIN_MS, DOUBLE_BLINK_GAP_MAX_MS);
			} else {
				this.exprIdx = this.pickNextExpr();
				this.exprDuration = this.randExprDuration();
				this.lastExprChange = now;
			}
			return;
		}

		if (!this.isBlinking && !this.doubleBlinkGap && now - this.lastExprChange >= this.exprDuration) {
			const roll = Math.random();
			this.lastExprChange = now;
			if (roll < EXPR_BLINK_CHANCE) {
				this.isBlinking = true;
				this.blinkUntil = now + R(BLINK_MIN_DURATION_MS, BLINK_MAX_DURATION_MS);
			} else if (roll < EXPR_BLINK_CHANCE + EXPR_DOUBLE_BLINK_CHANCE) {
				this.isBlinking = true;
				this.blinkUntil = now + R(BLINK_MIN_DURATION_MS, BLINK_MAX_DURATION_MS);
				this.doubleBlinkPending = true;
			} else {
				this.exprIdx = this.pickNextExpr();
				this.exprDuration = this.randExprDuration();
			}
		}
	}

	// ── face ──────────────────────────────────────────────────────────

	private tickFace(now: number, elapsed: number): void {
		if (now - this.lastFaceDrift >= this.faceDriftInterval) {
			const delta = Math.random() < 0.5 ? -1 : 1;
			this.offset = Math.max(-FACE_DRIFT_RANGE, Math.min(FACE_DRIFT_RANGE, this.offset + delta));
			this.lastFaceDrift = now;
			this.faceDriftInterval = R(FACE_DRIFT_MIN_INTERVAL_MS, FACE_DRIFT_MAX_INTERVAL_MS);
		}

		if (elapsed < this.phaseDuration) return;
		const dipProb = TICK_MS / DIP_INTERVAL_MS;
		const riseProb = TICK_MS / RISE_INTERVAL_MS;
		const roll = Math.random();

		if (roll < dipProb) {
			this.enterEars(now);
		} else if (roll < dipProb + riseProb) {
			this.enterFull(now);
		}
	}

	// ── ears ──────────────────────────────────────────────────────────

	private tickEars(now: number, elapsed: number): void {
		if (now < this.edgePauseUntil) {
			if (elapsed >= this.phaseDuration) this.finishEars(now);
			return;
		}

		if (now - this.lastOffsetChange >= this.wobbleInterval) {
			if (this.dirSteps <= 0) this.startRun();

			const next = this.offset + this.dirDelta;
			if (next > WOBBLE_RANGE || next < -WOBBLE_RANGE) {
				this.offset = this.dirDelta > 0 ? WOBBLE_RANGE : -WOBBLE_RANGE;
				this.edgePauseUntil = now + R(EDGE_PAUSE_MIN_MS, EDGE_PAUSE_MAX_MS);
				this.dirSteps = 0;
			} else {
				this.offset = next;
				this.dirSteps--;
			}
			this.lastOffsetChange = now;
			this.wobbleInterval = R(WOBBLE_MIN_INTERVAL_MS, WOBBLE_MAX_INTERVAL_MS);
		}

		if (elapsed >= this.phaseDuration) this.finishEars(now);
	}

	private startRun(): void {
		if (this.offset >= WOBBLE_RANGE) {
			this.dirDelta = -1;
		} else if (this.offset <= -WOBBLE_RANGE) {
			this.dirDelta = 1;
		} else {
			const edgeRatio = Math.abs(this.offset) / WOBBLE_RANGE;
			const awayChance = 0.5 + edgeRatio * EDGE_BIAS_STRENGTH;
			if (Math.random() < awayChance) {
				this.dirDelta = this.offset > 0 ? -1 : 1;
			} else {
				this.dirDelta = this.offset > 0 ? 1 : -1;
			}
		}
		this.dirSteps = DIR_STEPS_MIN + Math.floor(Math.random() * (DIR_STEPS_MAX - DIR_STEPS_MIN + 1));
	}

	private finishEars(now: number): void {
		const roll = Math.random();
		if (roll < EARS_TO_NONE_CHANCE) {
			this.enterNone(now);
		} else if (roll < EARS_TO_NONE_CHANCE + EARS_TO_FULL_CHANCE) {
			this.enterFull(now);
		} else {
			this.enterFace(now);
		}
	}

	// ── full ──────────────────────────────────────────────────────────

	private tickFull(now: number, elapsed: number): void {
		if (elapsed < this.phaseDuration) return;
		const roll = Math.random();
		if (roll < FULL_TO_EARS_CHANCE) {
			this.enterEars(now);
		} else if (roll < FULL_TO_EARS_CHANCE + FULL_TO_NONE_CHANCE) {
			this.enterNone(now);
		} else {
			this.enterFace(now);
		}
	}

	// ── none (hidden) ─────────────────────────────────────────────────

	private tickNone(elapsed: number): void {
		if (elapsed >= this.phaseDuration) this.enterFace(Date.now());
	}

	// ── transitions ───────────────────────────────────────────────────

	private enterEars(now: number): void {
		this.switchPhase("ears", now);
		this.phaseDuration = R(EARS_MIN_DURATION_MS, EARS_MAX_DURATION_MS);
		this.lastOffsetChange = now;
		this.wobbleInterval = R(WOBBLE_MIN_INTERVAL_MS, WOBBLE_MAX_INTERVAL_MS);
		this.dirSteps = 0;
		this.edgePauseUntil = 0;
	}

	private enterFull(now: number): void {
		this.switchPhase("full", now);
		this.phaseDuration = R(FULL_MIN_DURATION_MS, FULL_MAX_DURATION_MS);
	}

	private enterFace(now: number): void {
		this.switchPhase("face", now);
		this.phaseDuration = R(FACE_MIN_DURATION_MS, FACE_MAX_DURATION_MS);
		this.lastFaceDrift = now;
		this.faceDriftInterval = R(FACE_DRIFT_MIN_INTERVAL_MS, FACE_DRIFT_MAX_INTERVAL_MS);
	}

	private enterNone(now: number): void {
		this.switchPhase("none", now);
		this.phaseDuration = R(NONE_MIN_DURATION_MS, NONE_MAX_DURATION_MS);
	}

	private switchPhase(newPhase: Phase, now: number): void {
		this.transitionFromLines = this.visibleLineCount();
		this.phase = newPhase;
		this.phaseEntered = now;
		const toLines = this.visibleLineCount();
		const lineDiff = Math.abs(toLines - this.transitionFromLines);
		const slow = lineDiff > 0 && Math.random() < SLOW_TRANSITION_CHANCE;
		const mult = slow
			? SLOW_TRANSITION_MULT_MIN + Math.floor(Math.random() * (SLOW_TRANSITION_MULT_MAX - SLOW_TRANSITION_MULT_MIN + 1))
			: 1;
		this.transitionRemaining = lineDiff * mult;
		this.transitionTotal = this.transitionRemaining;
	}

	private visibleLineCount(): number {
		switch (this.phase) {
			case "none": return 0;
			case "ears": return 1;
			case "face": return 2;
			case "full": return 3;
		}
	}

	// ── randomisers ───────────────────────────────────────────────────

	private pickNextExpr(): number {
		if (COMPANION_ARTS.length <= 1) return 0;
		let next: number;
		do {
			next = Math.floor(Math.random() * COMPANION_ARTS.length);
		} while (next === this.exprIdx);
		return next;
	}

	private randExprDuration(): number {
		if (Math.random() < STARE_CHANCE) {
			return R(STARE_MIN_DURATION_MS, STARE_MAX_DURATION_MS);
		}
		return R(EXPR_MIN_DURATION_MS, EXPR_MAX_DURATION_MS);
	}

	// ── render state ──────────────────────────────────────────────────

	getState(): CompanionState {
		const art = COMPANION_ARTS[this.exprIdx]!;
		const targetLines = this.visibleLineCount();

		let lineCount: number;
		if (this.transitionRemaining > 0 && this.transitionTotal > 0) {
			const progress = 1 - this.transitionRemaining / this.transitionTotal;
			lineCount = Math.round(this.transitionFromLines + progress * (targetLines - this.transitionFromLines));
		} else {
			lineCount = targetLines;
		}

		const blink = this.isBlinking && !this.doubleBlinkGap
			&& (this.phase === "face" || this.phase === "full");
		const lines: string[] = [];
		if (lineCount >= 1) lines.push(art[0]);
		if (lineCount >= 2) lines.push(blink ? BLINK_ART[1] : art[1]);
		if (lineCount >= 3) lines.push(blink ? BLINK_ART[2] : art[2]);

		return { lines, extraPad: this.offset };
	}
}
