export const PATCH_FLAG = Symbol.for("styled-outputs:patched");

export function stripAnsi(text: string): string {
  return text.replace(/\x1b\[[0-9;]*m/g, "");
}

export function hasVisibleContent(line: string): boolean {
  return stripAnsi(line).trim().length > 0;
}

export function getVisibleWidth(text: string): number {
  return text.replace(/\x1b\[[0-9;]*m/g, "").length;
}
