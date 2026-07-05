import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { TUI, EditorTheme } from "@earendil-works/pi-tui";
import type { KeybindingsManager } from "@earendil-works/pi-coding-agent";
import { visibleWidth } from "@earendil-works/pi-tui";
import { CONFIG, COMPANION_PADDING, MIN_WIDTH_FOR_COMPANION, DEFAULT_CONFIG } from "./config.js";
import { applyColor, CompanionAnimator } from "./utils.js";

// ─── Helpers ──────────────────────────────────────────────────────────────
const ANSI_RE = /\x1b\[[0-9;]*m|\x1b\[0?m/g;

function plainText(line: string): string {
	return line.replace(ANSI_RE, "");
}

function isPlanModeActive(): boolean {
	const mode = (globalThis as any).__planMode?.mode;
	return mode === "plan" || mode === "execute";
}

function isChatModeActive(): boolean {
	const mode = (globalThis as any).__chatMode?.mode;
	return mode === "chat";
}

// ─── Component ────────────────────────────────────────────────────────────
class ChatInput extends CustomEditor {
	private border: (s: string) => string;
	private accent: (s: string) => string;
	private bashBorder: (s: string) => string;
	private bashAccent: (s: string) => string;
	private planModeBorder: (s: string) => string;
	private planModeAccent: (s: string) => string;
	private chatModeBorder: (s: string) => string;
	private chatModeAccent: (s: string) => string;
	private companionColor: (s: string) => string;
	private animator = new CompanionAnimator();
	private companionTimer: ReturnType<typeof setInterval> | null = null;

	constructor(
		tui: TUI,
		theme: EditorTheme,
		keybindings: KeybindingsManager,
		colorFn: (s: string) => string,
		accentFn: (s: string) => string,
		bashColorFn: (s: string) => string,
		bashAccentFn: (s: string) => string,
		planModeColorFn: (s: string) => string,
		planModeAccentFn: (s: string) => string,
		chatModeColorFn: (s: string) => string,
		chatModeAccentFn: (s: string) => string,
		companionColor: (s: string) => string,
	) {
		super(tui, theme, keybindings, { paddingX: 0 });
		this.border = colorFn;
		this.accent = accentFn;
		this.bashBorder = bashColorFn;
		this.bashAccent = bashAccentFn;
		this.planModeBorder = planModeColorFn;
		this.planModeAccent = planModeAccentFn;
		this.chatModeBorder = chatModeColorFn;
		this.chatModeAccent = chatModeAccentFn;
		this.companionColor = companionColor;

		// Animate companion even when idle — tick drives state machine
		this.companionTimer = setInterval(() => {
			this.animator.tick(Date.now());
			this.tui.requestRender();
		}, 100);
	}

	private isBashMode(): boolean {
		const text = (this as any).getText?.();
		return typeof text === "string" && text.trimStart().startsWith("!");
	}

	render(width: number): string[] {
		const padMultiplier = CONFIG.BOXED_VIEW ? 3 : 1;
		if (width < 5 + CONFIG.BOX_PAD_X * padMultiplier) return super.render(width);

		const contentWidth = CONFIG.BOXED_VIEW
			? width - 3 - CONFIG.BOX_PAD_X * 3
			: width - 2 * CONFIG.BOX_PAD_X - 1;
		const stock = super.render(contentWidth);
		if (stock.length < 2) return super.render(width);

		const isBash = this.isBashMode();
		const isPlan = isPlanModeActive();
		const isChat = isChatModeActive();
		const border = isBash ? this.bashBorder : isPlan ? this.planModeBorder : isChat ? this.chatModeBorder : this.border;
		const accent = isBash ? this.bashAccent : isPlan ? this.planModeAccent : isChat ? this.chatModeAccent : this.accent;
		const prefix = isBash ? CONFIG.PREFIX : isPlan ? CONFIG.PLAN_MODE_PREFIX : isChat ? CONFIG.CHAT_MODE_PREFIX : CONFIG.PREFIX;

		if (CONFIG.BOXED_VIEW) {
			return this.renderBoxed(stock, contentWidth, width, border, accent, prefix);
		}
		return this.renderUnboxed(stock, contentWidth, width, border, accent, prefix);
	}

	private buildCompanionLines(width: number): string[] {
		if (!CONFIG.COMPANION_ENABLED || width < MIN_WIDTH_FOR_COMPANION) return [];

		const state = this.animator.getState();
		const artWidth = Math.max(...state.lines.map(l => visibleWidth(l)), 0);
		const rawPad = width - COMPANION_PADDING - artWidth + state.extraPad;
		// Clamp: never negative, never exceed terminal width
		const pad = Math.max(0, Math.min(rawPad, width - artWidth));
		const spaces = " ".repeat(pad);

		const lines: string[] = [];
		for (const line of state.lines) {
			lines.push(spaces + this.companionColor(line));
		}
		const topPadding = CONFIG.COMPANION_ENABLED ? CONFIG.COMPANION_TOP_PADDING : 0;
		// Reserve topPadding lines so chat bar doesn't jump — art anchored to bottom
		while (lines.length < topPadding) {
			lines.unshift("");
		}
		return lines;
	}

	private renderBoxed(
		stock: string[],
		contentWidth: number,
		width: number,
		border: (s: string) => string,
		accent: (s: string) => string,
		prefix: string,
	): string[] {
		const innerWidth = width - 2;

		// Solid border: after stripping ANSI every char is "─"
		const isSolidBorder = (line: string) => plainText(line).replace(/─/g, "").length === 0;

		// Scroll indicator: starts with "─" and contains ↑/↓ N more
		const getScrollText = (line: string): string | null => {
			const plain = plainText(line);
			if (!plain.startsWith("─")) return null;
			const m = plain.match(/((?:↑|↓)\s*\d+\s*more)/);
			return m ? m[1] : null;
		};

		const isBorderLike = (line: string) => isSolidBorder(line) || getScrollText(line) !== null;

		const firstIdx = stock.findIndex(isBorderLike);
		let lastIdx = -1;
		for (let i = stock.length - 1; i >= 0; i--) {
			if (isBorderLike(stock[i]!)) {
				lastIdx = i;
				break;
			}
		}

		// Build top/bottom box borders, embedding scroll indicator text when present
		const buildTop = (scrollText: string | null): string => {
			if (!scrollText) return border("┌") + border("─".repeat(innerWidth)) + border("┐");
			const mid = `── ${scrollText} `;
			const remaining = Math.max(0, innerWidth - visibleWidth(mid));
			return border("┌") + border(mid) + border("─".repeat(remaining)) + border("┐");
		};

		const buildBottom = (scrollText: string | null): string => {
			if (!scrollText) return border("└") + border("─".repeat(innerWidth)) + border("┘");
			const mid = `── ${scrollText} `;
			const remaining = Math.max(0, innerWidth - visibleWidth(mid));
			return border("└") + border(mid) + border("─".repeat(remaining)) + border("┘");
		};

		const topScrollText = firstIdx !== -1 ? getScrollText(stock[firstIdx]!) : null;
		const bottomScrollText = lastIdx !== -1 && lastIdx !== firstIdx ? getScrollText(stock[lastIdx]!) : null;

		const top = buildTop(topScrollText);
		const bottom = buildBottom(bottomScrollText);

		// ── companion art ──
		const companionLines = this.buildCompanionLines(width);

		const leftPad = " ".repeat(CONFIG.BOX_PAD_X);
		const rightPad = leftPad;

		// ── body lines (between first and last border/indicator) ──
		const body: string[] = [];
		let isFirstBodyLine = true;
		for (let i = 0; i < stock.length; i++) {
			if (i === firstIdx || i === lastIdx) continue;
			if (lastIdx !== -1 && i > lastIdx) continue;

			const vw = visibleWidth(stock[i]!);
			const pad = vw < contentWidth ? " ".repeat(contentWidth - vw) : "";
			const prefixStr = isFirstBodyLine ? accent(prefix) : " ";
			body.push(border("│") + leftPad + prefixStr + leftPad + stock[i]! + pad + rightPad + border("│"));
			isFirstBodyLine = false;
		}

		// ── menu lines (after last border/indicator) ──
		const menu: string[] = [];
		if (lastIdx !== -1) {
			for (let i = lastIdx + 1; i < stock.length; i++) {
				const vw = visibleWidth(stock[i]!);
				const indent = " ".repeat(CONFIG.EXTRA_MENU_INDENT);
				const pad = vw + CONFIG.EXTRA_MENU_INDENT < width ? " ".repeat(width - vw - CONFIG.EXTRA_MENU_INDENT) : "";
				menu.push(indent + stock[i]! + pad);
			}
		}

		const gap = Array.from({ length: CONFIG.MENU_GAP }, () => "");
		return [...companionLines, top, ...body, bottom, ...gap, ...menu];
	}

	private renderUnboxed(
		stock: string[],
		contentWidth: number,
		width: number,
		border: (s: string) => string,
		accent: (s: string) => string,
		prefix: string,
	): string[] {
		// Solid border: after stripping ANSI every char is "─"
		const isSolidBorder = (line: string) => plainText(line).replace(/─/g, "").length === 0;

		// Scroll indicator: starts with "─" and contains ↑/↓ N more
		const getScrollText = (line: string): string | null => {
			const plain = plainText(line);
			if (!plain.startsWith("─")) return null;
			const m = plain.match(/((?:↑|↓)\s*\d+\s*more)/);
			return m ? m[1] : null;
		};

		const isBorderLike = (line: string) => isSolidBorder(line) || getScrollText(line) !== null;

		const firstIdx = stock.findIndex(isBorderLike);
		let lastIdx = -1;
		for (let i = stock.length - 1; i >= 0; i--) {
			if (isBorderLike(stock[i]!)) {
				lastIdx = i;
				break;
			}
		}

		// Build top/bottom horizontal borders only (no corners, no sides)
		const buildTop = (scrollText: string | null): string => {
			if (!scrollText) return border("─".repeat(width));
			const mid = `── ${scrollText} `;
			const remaining = Math.max(0, width - visibleWidth(mid));
			return border(mid) + border("─".repeat(remaining));
		};

		const buildBottom = (scrollText: string | null): string => {
			if (!scrollText) return border("─".repeat(width));
			const mid = `── ${scrollText} `;
			const remaining = Math.max(0, width - visibleWidth(mid));
			return border(mid) + border("─".repeat(remaining));
		};

		const topScrollText = firstIdx !== -1 ? getScrollText(stock[firstIdx]!) : null;
		const bottomScrollText = lastIdx !== -1 && lastIdx !== firstIdx ? getScrollText(stock[lastIdx]!) : null;

		const top = buildTop(topScrollText);
		const bottom = buildBottom(bottomScrollText);

		// ── companion art ──
		const companionLines = this.buildCompanionLines(width);

		const leftPad = " ".repeat(CONFIG.BOX_PAD_X);

		// ── body lines ──
		const body: string[] = [];
		let isFirstBodyLine = true;
		for (let i = 0; i < stock.length; i++) {
			if (i === firstIdx || i === lastIdx) continue;
			if (lastIdx !== -1 && i > lastIdx) continue;

			const vw = visibleWidth(stock[i]!);
			const pad = vw < contentWidth ? " ".repeat(contentWidth - vw) : "";
			const prefixStr = isFirstBodyLine ? accent(prefix) : " ";
			body.push(leftPad + prefixStr + leftPad + stock[i]! + pad);
			isFirstBodyLine = false;
		}

		// ── menu lines ──
		const menu: string[] = [];
		if (lastIdx !== -1) {
			for (let i = lastIdx + 1; i < stock.length; i++) {
				const vw = visibleWidth(stock[i]!);
				const indent = " ".repeat(CONFIG.EXTRA_MENU_INDENT);
				const pad = vw + CONFIG.EXTRA_MENU_INDENT < width ? " ".repeat(width - vw - CONFIG.EXTRA_MENU_INDENT) : "";
				menu.push(indent + stock[i]! + pad);
			}
		}

		const gap = Array.from({ length: CONFIG.MENU_GAP }, () => "");
		return [...companionLines, top, ...body, bottom, ...gap, ...menu];
	}
}

// ─── Extension entry ──────────────────────────────────────────────────────
export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.setEditorComponent((tui: TUI, theme: EditorTheme, kb: KeybindingsManager) => {
			const colorFn = (s: string) => applyColor(ctx.ui.theme, CONFIG.BORDER_COLOR, s);
			const accentFn = (s: string) => applyColor(ctx.ui.theme, CONFIG.PREFIX_COLOR, s);
			const bashColorFn = (s: string) => applyColor(ctx.ui.theme, "bashMode", s);
			const bashAccentFn = (s: string) => applyColor(ctx.ui.theme, "bashMode", s);
			const planModeColorFn = (s: string) => applyColor(ctx.ui.theme, CONFIG.PLAN_MODE_BORDER_COLOR, s);
			const planModeAccentFn = (s: string) => applyColor(ctx.ui.theme, CONFIG.PLAN_MODE_PREFIX_COLOR, s);
			const chatModeColorFn = (s: string) => applyColor(ctx.ui.theme, CONFIG.CHAT_MODE_BORDER_COLOR, s);
			const chatModeAccentFn = (s: string) => applyColor(ctx.ui.theme, CONFIG.CHAT_MODE_PREFIX_COLOR, s);
			const companionColorFn = (s: string) => applyColor(ctx.ui.theme, CONFIG.COMPANION_COLOR, s);
			return new ChatInput(tui, theme, kb, colorFn, accentFn, bashColorFn, bashAccentFn, planModeColorFn, planModeAccentFn, chatModeColorFn, chatModeAccentFn, companionColorFn);
		});
	});
}