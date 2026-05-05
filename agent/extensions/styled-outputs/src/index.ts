import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { AssistantMessageComponent } from "@mariozechner/pi-coding-agent";
import { Markdown } from "@mariozechner/pi-tui";
import { PATCH_FLAG, setCurrentTheme } from "./utils.js";
import { AssistantMessage } from "./components/assistant-message.js";
import { ThinkingMessage } from "./components/thinking-message.js";

export default function styledOutputs(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    setCurrentTheme(ctx.ui.theme);
  });

  const proto = AssistantMessageComponent.prototype as any;
  if (proto[PATCH_FLAG]) return;

  const originalUpdateContent = proto.updateContent;
  proto.updateContent = function patchedUpdateContent(message: any) {
    if (!message?.content || !Array.isArray(message.content)) {
      return originalUpdateContent.call(this, message);
    }

    originalUpdateContent.call(this, message);

    const container = this.contentContainer;
    if (!container?.children) return;

    const mdTheme = this.markdownTheme;
    for (let i = container.children.length - 1; i >= 0; i--) {
      const child = container.children[i];
      if (child instanceof Markdown) {
        const text = child.text;
        if (!text) continue;

        const isThinking = !!child.defaultTextStyle?.italic;
        if (isThinking) {
          container.children[i] = new ThinkingMessage(text, mdTheme);
        } else {
          container.children[i] = new AssistantMessage(text, mdTheme);
        }
      }
    }
  };

  proto[PATCH_FLAG] = true;
}
