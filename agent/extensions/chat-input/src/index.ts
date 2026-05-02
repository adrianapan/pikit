import { CustomEditor, type ExtensionAPI } from "@mariozechner/pi-coding-agent";
import type { TUI, EditorTheme } from "@mariozechner/pi-tui";
import type { KeybindingsManager } from "@mariozechner/pi-coding-agent";
import { visibleWidth } from "@mariozechner/pi-tui";

// ─── Config ───────────────────────────────────────────────────────────────
const BOX_PAD_X = 1;          // spaces between │ and text inside the box
const MENU_GAP = 0;           // blank lines between box bottom and menu
const EXTRA_MENU_INDENT = 1;  // extra spaces before menu lines below box
const BORDER_TOKEN = "border" as const; // border colour from theme
const ACCENT_TOKEN = "accent" as const; // accent colour for prefix
const PREFIX = "\u276F";      // ❯ unicode prefix character (can also use "\u203A" for a lighter version)

// ─── Helpers ──────────────────────────────────────────────────────────────
const ANSI_RE = /\x1b\[[0-9;]*m|\x1b\[0?m/g;

function plainText(line: string): string {
	return line.replace(ANSI_RE, "");
}

// ─── Component ────────────────────────────────────────────────────────────
class ChatInput extends CustomEditor {
	private border: (s: string) => string;
	private accent: (s: string) => string;
	private bashBorder: (s: string) => string;
	private bashAccent: (s: string) => string;

	constructor(
		tui: TUI,
		theme: EditorTheme,
		keybindings: KeybindingsManager,
		colorFn: (s: string) => string,
		accentFn: (s: string) => string,
		bashColorFn: (s: string) => string,
		bashAccentFn: (s: string) => string,
	) {
		super(tui, theme, keybindings, { paddingX: 0 });
		this.border = colorFn;
		this.accent = accentFn;
		this.bashBorder = bashColorFn;
		this.bashAccent = bashAccentFn;
	}

	private isBashMode(): boolean {
		const text = (this as any).getText?.();
		return typeof text === "string" && text.trimStart().startsWith("!");
	}

	render(width: number): string[] {
		if (width < 5 + BOX_PAD_X * 3) return super.render(width);

		const contentWidth = width - 3 - BOX_PAD_X * 3;
		const stock = super.render(contentWidth);
		if (stock.length < 2) return super.render(width);

		const isBash = this.isBashMode();
		const border = isBash ? this.bashBorder : this.border;
		const accent = isBash ? this.bashAccent : this.accent;
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
		const leftPad = " ".repeat(BOX_PAD_X);
		const rightPad = leftPad;

		// ── body lines (between first and last border/indicator) ──
		const body: string[] = [];
		let isFirstBodyLine = true;
		for (let i = 0; i < stock.length; i++) {
			if (i === firstIdx || i === lastIdx) continue;
			if (lastIdx !== -1 && i > lastIdx) continue;

			const vw = visibleWidth(stock[i]!);
			const pad = vw < contentWidth ? " ".repeat(contentWidth - vw) : "";
			const prefixStr = isFirstBodyLine ? accent(PREFIX) : " ";
			body.push(border("│") + leftPad + prefixStr + leftPad + stock[i]! + pad + rightPad + border("│"));
			isFirstBodyLine = false;
		}

		// ── menu lines (after last border/indicator) ──
		const menu: string[] = [];
		if (lastIdx !== -1) {
			for (let i = lastIdx + 1; i < stock.length; i++) {
				const vw = visibleWidth(stock[i]!);
				const indent = " ".repeat(EXTRA_MENU_INDENT);
				const pad = vw + EXTRA_MENU_INDENT < width ? " ".repeat(width - vw - EXTRA_MENU_INDENT) : "";
				menu.push(indent + stock[i]! + pad);
			}
		}

		const gap = Array.from({ length: MENU_GAP }, () => "");
		return [top, ...body, bottom, ...gap, ...menu];
	}
}

// ─── Extension entry ──────────────────────────────────────────────────────
export default function (pi: ExtensionAPI) {
	pi.on("session_start", async (_event, ctx) => {
		ctx.ui.setEditorComponent((tui: TUI, theme: EditorTheme, kb: KeybindingsManager) => {
			const colorFn = (s: string) => ctx.ui.theme.fg(BORDER_TOKEN, s);
			const accentFn = (s: string) => ctx.ui.theme.fg(ACCENT_TOKEN, s);
			const bashColorFn = (s: string) => ctx.ui.theme.fg("bashMode", s);
			const bashAccentFn = (s: string) => ctx.ui.theme.fg("bashMode", s);
			return new ChatInput(tui, theme, kb, colorFn, accentFn, bashColorFn, bashAccentFn);
		});
	});
}
