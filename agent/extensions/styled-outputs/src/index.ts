import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { AssistantMessageComponent, UserMessageComponent } from "@mariozechner/pi-coding-agent";
import { Markdown } from "@mariozechner/pi-tui";
import { PATCH_FLAG, setCurrentTheme } from "./utils.js";
import { CONFIG } from "./config.js";
import { createAssistantMessage } from "./components/assistant-message.js";
import { createThinkingMessage } from "./components/thinking-message.js";
import { createUserMessage } from "./components/user-message.js";

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
          container.children[i] = createThinkingMessage(text, mdTheme);
        } else {
          container.children[i] = createAssistantMessage(text, mdTheme);
        }
      }
    }
  };

  proto[PATCH_FLAG] = true;

  // --- Patch UserMessageComponent ---
  const userProto = UserMessageComponent.prototype as any;
  if (userProto[PATCH_FLAG]) return;

  const originalUserRender = userProto.render;
  userProto.render = function patchedUserRender(width: number) {
    const contentBox = this.contentBox;
    if (contentBox?.children && !this._styledReplaced) {
      for (let i = 0; i < contentBox.children.length; i++) {
        const child = contentBox.children[i];
        if (child instanceof Markdown) {
          const text = child.text;
          if (text) {
            contentBox.children[i] = createUserMessage(text, child.theme);
          }
        }
      }
      
      contentBox.paddingX = 0;
      
      if (!CONFIG.isThemeBackgroundVisible) {
        contentBox.paddingY = 0;
        contentBox.setBgFn(undefined);
      }
      this._styledReplaced = true;
    }
    return originalUserRender.call(this, width);
  };

  userProto[PATCH_FLAG] = true;
}
