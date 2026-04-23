export interface SearchResult {
  title: string;
  url: string;
}

export interface SearchQueryResult {
  query: string;
  answer: string;
  results: SearchResult[];
  error: string | null;
}

export interface ExtractedContent {
  url: string;
  title: string;
  content: string;
  error: string | null;
}

export interface StoredData {
  id: string;
  type: "search" | "fetch";
  timestamp: number;
  queries?: SearchQueryResult[];
  urls?: ExtractedContent[];
}
