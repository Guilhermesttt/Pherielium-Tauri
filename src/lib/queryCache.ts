// Simple in-memory query cache with TTL + stale-while-revalidate
// Designed to reduce Supabase egress (5GB Free limit). Cache hits avoid
// re-fetching the same payload within the window.
import { recordHit, recordMiss } from "./egressMonitor";

type CacheEntry<T> = {
  data: T;
  expiresAt: number;   // fresh until
  staleUntil: number;  // stale but usable while revalidating
  promise?: Promise<T>; // in-flight revalidation
};

const store = new Map<string, CacheEntry<any>>();
const DEFAULT_TTL = 30_000;       // 30s fresh
const DEFAULT_STALE = 60_000;     // +60s stale-while-revalidate

function now() { return Date.now(); }

function makeKey(parts: (string|number|boolean|null|undefined)[]): string {
  return parts.map(p => String(p ?? "")).join(":");
}

export function getCached<T>(key: string): T | null {
  const e = store.get(key);
  if (!e) return null;
  if (now() > e.staleUntil) { store.delete(key); return null; }
  return e.data as T;
}

export function isFresh(key: string): boolean {
  const e = store.get(key);
  return !!e && now() <= e.expiresAt;
}

export function setCache<T>(key: string, data: T, ttl = DEFAULT_TTL, stale = DEFAULT_STALE): void {
  store.set(key, { data, expiresAt: now() + ttl, staleUntil: now() + ttl + stale });
}

export function invalidate(prefix: string): void {
  for (const k of store.keys()) if (k.startsWith(prefix)) store.delete(k);
}

export function clearCache(): void { store.clear(); }

/**
 * Cached wrapper: returns cached data if fresh, otherwise executes fetcher.
 * When stale but not expired, returns stale data immediately and
 * revalidates in background (fire-and-forget), updating the cache.
 */
export async function cachedQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  opts: { ttl?: number; stale?: number } = {}
): Promise<T> {
  // Bypass cache in tests to avoid cross-test pollution (global store)
  if (typeof globalThis !== "undefined" && (globalThis as any).process?.env?.VITEST) {
    return fetcher();
  }
  const ttl = opts.ttl ?? DEFAULT_TTL;
  const stale = opts.stale ?? DEFAULT_STALE;
  const entry = store.get(key);

  if (entry) {
    if (now() <= entry.expiresAt) {
      try { recordHit(key, Array.isArray(entry.data) ? (entry.data as any[]).length : 1); } catch {}
      return entry.data as T;
    }
    if (now() <= entry.staleUntil) {
      try { recordHit(key, Array.isArray(entry.data) ? (entry.data as any[]).length : 1); } catch {}
      // stale-while-revalidate: return stale, refresh in background
      if (!entry.promise) {
        entry.promise = fetcher().then(data => {
          setCache(key, data, ttl, stale);
          return data;
        }).catch(() => entry.data as T)
          .finally(() => { const e = store.get(key); if (e) delete (e as any).promise; });
      }
      return entry.data as T;
    }
    store.delete(key);
  }

  try { recordMiss(key); } catch {}
  const data = await fetcher();
  setCache(key, data, ttl, stale);
  return data;
}

// For debugging / metrics
export function cacheStats() {
  return { size: store.size, keys: [...store.keys()] };
}
