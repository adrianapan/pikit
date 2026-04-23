import { getGeminiApiKey } from "./config.js";
import { errorMessage, isAbortError } from "./utils.js";
import type { SearchQueryResult, SearchResult } from "./types.js";

const GEMINI_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GEMINI_MODEL = "gemini-2.5-flash-lite";

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    groundingMetadata?: {
      groundingChunks?: Array<{
        web?: { uri: string; title: string };
      }>;
    };
  }>;
  error?: { message: string; code: number };
}

export async function searchWeb(
  query: string,
  signal?: AbortSignal
): Promise<SearchQueryResult> {
  const key = getGeminiApiKey();

  let response: Response;
  try {
    response = await fetch(
      `${GEMINI_BASE}/models/${GEMINI_MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ role: "user", parts: [{ text: query }] }],
          tools: [{ google_search: {} }],
        }),
        signal,
      }
    );
  } catch (err) {
    if (isAbortError(err)) return { query, answer: "", results: [], error: "Aborted" };
    return { query, answer: "", results: [], error: errorMessage(err) };
  }

  const data = (await response.json()) as GeminiResponse;

  if (!response.ok) {
    const msg = data.error?.message ?? `HTTP ${response.status}`;
    return { query, answer: "", results: [], error: `Gemini API error: ${msg}` };
  }

  const candidate = data.candidates?.[0];
  const answer = candidate?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  const chunks = candidate?.groundingMetadata?.groundingChunks ?? [];

  const results: SearchResult[] = chunks
    .filter((c): c is { web: { uri: string; title: string } } => !!c.web?.uri)
    .map((c) => ({ title: c.web.title || c.web.uri, url: c.web.uri }));

  return { query, answer, results, error: null };
}
