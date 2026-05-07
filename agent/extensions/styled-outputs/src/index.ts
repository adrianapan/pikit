import type { ExtensionAPI } from "@mariozechner/pi-coding-agent";
import { AssistantMessageComponent, UserMessageComponent, ToolExecutionComponent, createReadTool, createBashTool, createEditTool, createWriteTool, createLsTool, createGrepTool, createFindTool } from "@mariozechner/pi-coding-agent";
import { Markdown } from "@mariozechner/pi-tui";
import { PATCH_FLAG, setCurrentTheme, currentTheme } from "./utils.js";
import { CONFIG } from "./config.js";
import { createAssistantMessage } from "./components/assistant-message.js";
import { createThinkingMessage } from "./components/thinking-message.js";
import { createUserMessage } from "./components/user-message.js";
import {
  renderReadCall, renderReadResult,
  renderBashCall, renderBashResult,
  renderEditCall, renderEditResult,
  renderWriteCall, renderWriteResult,
  renderLsCall, renderLsResult,
  renderGrepCall, renderGrepResult,
  renderFindCall, renderFindResult,
} from "./components/tool-renderer.js";

export default function styledOutputs(pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    setCurrentTheme(ctx.ui.theme);
  });

  // --- Patch AssistantMessageComponent ---
  const assistantProto = AssistantMessageComponent.prototype as any;
  if (!assistantProto[PATCH_FLAG]) {
    const originalUpdateContent = assistantProto.updateContent;
    assistantProto.updateContent = function patchedUpdateContent(message: any) {
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

    assistantProto[PATCH_FLAG] = true;
  }

  // --- Patch UserMessageComponent ---
  const userProto = UserMessageComponent.prototype as any;
  if (!userProto[PATCH_FLAG]) {
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
        
        if (!CONFIG.userMessage.isThemeBackgroundVisible) {
          contentBox.paddingY = 0;
          contentBox.setBgFn(undefined);
        }
        this._styledReplaced = true;
      }
      return originalUserRender.call(this, width);
    };

    userProto[PATCH_FLAG] = true;
  }

  // --- Patch ToolExecutionComponent (conditionally apply bg) ---
  const toolProto = ToolExecutionComponent.prototype as any;
  if (!toolProto[PATCH_FLAG]) {
    const originalUpdateDisplay = toolProto.updateDisplay;
    toolProto.updateDisplay = function patchedUpdateDisplay() {
      const savedResult = this.result;
      if (this.isPartial) this.result = undefined;
      originalUpdateDisplay.call(this);
      this.result = savedResult;
      if (this.contentBox) {
        if (CONFIG.tools.general.isThemeBackgroundVisible) {
          const t = currentTheme!;
          const bgFn = this.isPartial
            ? (text: string) => t.bg("toolPendingBg", text)
            : this.result?.isError
              ? (text: string) => t.bg("toolErrorBg", text)
              : (text: string) => t.bg("toolSuccessBg", text);
          this.contentBox.setBgFn(bgFn);
        } else {
          this.contentBox.setBgFn(undefined);
        }
      }
    };

    toolProto[PATCH_FLAG] = true;
  }

  // --- Register styled tool renderers ---
  const cwd = process.cwd();

  const readTool = createReadTool(cwd);
  pi.registerTool({
    name: "read",
    label: "read",
    description: readTool.description,
    promptSnippet: "Read file contents",
    promptGuidelines: ["Use read to examine files instead of cat or sed."],
    parameters: readTool.parameters,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return readTool.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, theme, ctx) {
      return renderReadCall(args, theme, ctx);
    },
    renderResult(result, options, theme, ctx) {
      return renderReadResult(result, options, theme, ctx);
    },
  });

  const bashTool = createBashTool(cwd);
  pi.registerTool({
    name: "bash",
    label: "bash",
    description: bashTool.description,
    promptSnippet: "Execute bash commands (ls, grep, find, etc.)",
    parameters: bashTool.parameters,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return bashTool.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, theme, ctx) {
      return renderBashCall(args, theme, ctx);
    },
    renderResult(result, options, theme, ctx) {
      return renderBashResult(result, options, theme, ctx);
    },
  });

  const editTool = createEditTool(cwd);
  pi.registerTool({
    name: "edit",
    label: "edit",
    description: editTool.description,
    promptSnippet: "Make precise file edits with exact text replacement, including multiple disjoint edits in one call",
    renderShell: "default",
    prepareArguments: editTool.prepareArguments,
    parameters: editTool.parameters,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return editTool.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, theme, ctx) {
      return renderEditCall(args, theme, ctx);
    },
    renderResult(result, options, theme, ctx) {
      return renderEditResult(result, options, theme, ctx);
    },
  });

  const writeTool = createWriteTool(cwd);
  pi.registerTool({
    name: "write",
    label: "write",
    description: writeTool.description,
    promptSnippet: "Create or overwrite files",
    promptGuidelines: ["Use write only for new files or complete rewrites."],
    parameters: writeTool.parameters,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return writeTool.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, theme, ctx) {
      return renderWriteCall(args, theme, ctx);
    },
    renderResult(result, options, theme, ctx) {
      return renderWriteResult(result, options, theme, ctx);
    },
  });

  const grepTool = createGrepTool(cwd);
  pi.registerTool({
    name: "grep",
    label: "grep",
    description: grepTool.description,
    promptSnippet: "Search file contents for patterns (respects .gitignore)",
    promptGuidelines: ["Prefer grep/find over bash for file exploration (faster, respects .gitignore)"],
    parameters: grepTool.parameters,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return grepTool.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, theme, ctx) {
      return renderGrepCall(args, theme, ctx);
    },
    renderResult(result, options, theme, ctx) {
      return renderGrepResult(result, options, theme, ctx);
    },
  });

  const findTool = createFindTool(cwd);
  pi.registerTool({
    name: "find",
    label: "find",
    description: findTool.description,
    promptSnippet: "Find files by glob pattern (respects .gitignore)",
    promptGuidelines: ["Prefer grep/find over bash for file exploration (faster, respects .gitignore)"],
    parameters: findTool.parameters,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return findTool.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, theme, ctx) {
      return renderFindCall(args, theme, ctx);
    },
    renderResult(result, options, theme, ctx) {
      return renderFindResult(result, options, theme, ctx);
    },
  });

  const lsTool = createLsTool(cwd);
  pi.registerTool({
    name: "ls",
    label: "ls",
    description: lsTool.description,
    promptSnippet: "List directory contents",
    parameters: lsTool.parameters,
    async execute(toolCallId, params, signal, onUpdate, ctx) {
      return lsTool.execute(toolCallId, params, signal, onUpdate);
    },
    renderCall(args, theme, ctx) {
      return renderLsCall(args, theme, ctx);
    },
    renderResult(result, options, theme, ctx) {
      return renderLsResult(result, options, theme, ctx);
    },
  });
}