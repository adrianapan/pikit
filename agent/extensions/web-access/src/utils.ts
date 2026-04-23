export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export function isAbortError(err: unknown): boolean {
  const msg = errorMessage(err).toLowerCase();
  return msg.includes("abort") || msg.includes("cancelled");
}

export function truncate(text: string, maxChars: number): string {
  if (text.length <= maxChars) return text;
  return (
    text.slice(0, maxChars) +
    "\n\n[Content truncated. Use get_search_content with the responseId to retrieve the full content.]"
  );
}

export function isPdfUrl(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith(".pdf");
  } catch {
    return url.toLowerCase().endsWith(".pdf");
  }
}

export function isPdfContentType(contentType: string): boolean {
  return contentType.toLowerCase().includes("application/pdf");
}
