import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";
import TurndownService from "turndown";
import { extractPdfBuffer } from "./pdf.js";
import { errorMessage, isAbortError, isPdfUrl, isPdfContentType } from "./utils.js";
import type { ExtractedContent } from "./types.js";

const CONCURRENT_LIMIT = 3;

const td = new TurndownService({
  headingStyle: "atx",
  codeBlockStyle: "fenced",
});

export async function fetchAllContent(
  urls: string[],
  signal?: AbortSignal
): Promise<ExtractedContent[]> {
  const results: ExtractedContent[] = [];
  for (let i = 0; i < urls.length; i += CONCURRENT_LIMIT) {
    if (signal?.aborted) break;
    const batch = urls.slice(i, i + CONCURRENT_LIMIT);
    const batchResults = await Promise.all(batch.map((url) => fetchOne(url, signal)));
    results.push(...batchResults);
  }
  return results;
}

async function fetchOne(url: string, signal?: AbortSignal): Promise<ExtractedContent> {
  try {
    const response = await fetch(url, {
      signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; pi-web-access/1.0)",
        Accept: "text/html,application/xhtml+xml,application/pdf,*/*",
      },
    });

    if (!response.ok) {
      return { url, title: "", content: "", error: `HTTP ${response.status}: ${url}` };
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (isPdfUrl(url) || isPdfContentType(contentType)) {
      const buffer = await response.arrayBuffer();
      const content = await extractPdfBuffer(buffer);
      return { url, title: url, content, error: null };
    }

    const isHtml =
      contentType.includes("text/html") || contentType.includes("application/xhtml");

    const body = await response.text();

    if (!isHtml) {
      // Plain text, markdown, JSON, etc. — return as-is
      return { url, title: "", content: body, error: null };
    }

    const { document } = parseHTML(body);
    let article = null;
    try {
      article = new Readability(document as unknown as Document).parse();
    } catch {
      // Readability failed — fall back to raw turndown
    }

    if (!article?.content) {
      return { url, title: "", content: td.turndown(body), error: null };
    }

    return {
      url,
      title: article.title ?? "",
      content: td.turndown(article.content),
      error: null,
    };
  } catch (err) {
    if (isAbortError(err)) return { url, title: "", content: "", error: "Aborted" };
    return { url, title: "", content: "", error: errorMessage(err) };
  }
}
