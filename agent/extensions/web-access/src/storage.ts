import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";
import type { StoredData } from "./types.js";

const CUSTOM_TYPE = "web-access-results";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

export const MAX_CONTENT_CHARS = 30_000;

const store = new Map<string, StoredData>();

/** Evict expired entries to prevent unbounded growth. */
function evictExpired(): void {
  const cutoff = Date.now() - CACHE_TTL_MS;
  for (const [id, data] of store) {
    if (data.timestamp < cutoff) store.delete(id);
  }
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function storeResult(id: string, data: StoredData): void {
  store.set(id, data);
  evictExpired();
}

export function getResult(id: string): StoredData | null {
  return store.get(id) ?? null;
}

export function clearStore(): void {
  store.clear();
}

export function persistResult(pi: ExtensionAPI, data: StoredData): void {
  pi.appendEntry(CUSTOM_TYPE, data);
}

export function restoreFromSession(ctx: ExtensionContext): void {
  store.clear();
  const now = Date.now();
  for (const entry of ctx.sessionManager.getBranch()) {
    if (entry.type === "custom" && entry.customType === CUSTOM_TYPE) {
      const data = entry.data as StoredData;
      if (data?.id && data?.type && now - data.timestamp < CACHE_TTL_MS) {
        store.set(data.id, data);
      }
    }
  }
}
