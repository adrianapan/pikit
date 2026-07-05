# web-access

Web search and content extraction for pi. Search the web via Gemini AI, fetch and read web pages, and extract text from PDFs — all from within the agent.

## Install

```bash
pi install npm:pikit-web-access
```

Or grab the whole [pikit](https://github.com/adrianapan/pikit) setup — this extension ships with it and loads automatically.


## Features

- **Web search**: Queries Gemini AI with Google Search grounding — returns a synthesized answer with source citations. Uses `gemini-2.5-flash-lite` (hardcoded in `src/search.ts`), the cheapest model in the 2.5 family that supports the `google_search` grounding tool.
- **Page fetching**: Fetches any URL and extracts clean readable markdown via Readability + Turndown
- **PDF extraction**: Detects PDFs by URL or content-type and extracts their text — no API key required
- **Multi-URL support**: Fetch several URLs in parallel in a single call
- **Result storage**: Large responses are stored and retrievable in full via `get_search_content`
- **Session persistence**: Stored results survive `/reload` and are restored on session start

## Structure

```
web-access/
├── package.json
├── README.md
└── src/
    ├── index.ts     — tool registration and session_start restore
    ├── types.ts     — shared interfaces (SearchResult, ExtractedContent, StoredData)
    ├── config.ts    — reads GEMINI_API_KEY from process.env, clear error if missing
    ├── storage.ts   — in-memory result store with session persistence via appendEntry
    ├── search.ts    — web_search via Gemini API with google_search grounding (model: gemini-2.5-flash-lite)
    ├── extract.ts   — fetch pipeline: Readability → Turndown, PDF detection and routing
    ├── pdf.ts       — PDF text extraction via unpdf
    └── utils.ts     — shared helpers (truncate, errorMessage, abort check, PDF detection)
```

## Configuration

`web_search` requires a Gemini API key. `fetch_content` (including PDF) works without one.

### Option 1 — reuse your existing pi Gemini key

If you already have `GEMINI_API_KEY` set in your environment for Gemini models, the extension picks it up automatically — no extra config needed.

### Option 2 — add to your shell profile (e.g. `~/.zshrc`)

```
export GEMINI_API_KEY="AIza...your-key-here"
```

> **Security note:** the key will be in the shell environment, visible by the `bash` tool. Avoid running `env` or commands that print the full environment when a model is watching.

Get a free key at: https://aistudio.google.com/apikey

If `GEMINI_API_KEY` is not set and `web_search` is called, the tool returns a clear error message with setup instructions.

## Tools

### web_search

Search the web via Gemini AI with Google Search grounding. Returns a synthesized answer with source citations.

```
web_search({ query: "TypeScript 5.5 new features" })
web_search({ queries: ["React 19 changes", "Next.js 15 release notes"] })
```

| Parameter | Description |
|-----------|-------------|
| `query` | Single search query |
| `queries` | Multiple queries run in parallel |

### fetch_content

Fetch one or more URLs and extract readable content as markdown. Automatically handles PDFs.

```
fetch_content({ url: "https://example.com/article" })
fetch_content({ urls: ["https://url1.com", "https://url2.com"] })
fetch_content({ url: "https://example.com/doc.pdf" })
```

| Parameter | Description |
|-----------|-------------|
| `url` | Single URL to fetch |
| `urls` | Multiple URLs fetched in parallel (3 at a time) |

### get_search_content

Retrieve full stored content from a previous `web_search` or `fetch_content` call. Use when the original response was truncated.

```
get_search_content({ responseId: "abc123" })
get_search_content({ responseId: "abc123", queryIndex: 1 })
get_search_content({ responseId: "abc123", url: "https://example.com" })
get_search_content({ responseId: "abc123", urlIndex: 2 })
```

| Parameter | Description |
|-----------|-------------|
| `responseId` | The `responseId` from a previous `web_search` or `fetch_content` call |
| `queryIndex` | Query to retrieve by index (web_search, default: 0) |
| `urlIndex` | URL to retrieve by index (fetch_content, default: 0) |
| `url` | Retrieve content for a specific URL (fetch_content) |

Stored results expire after 1 hour or when a new session starts.
