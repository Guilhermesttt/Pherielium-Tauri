// Egress monitor — estimates Supabase REST bytes saved via queryCache hits.
// Free Plan: 5 GB egress / billing cycle. Every cached hit avoids a full payload.

let hits = 0;
let misses = 0;
let bytesSaved = 0;

// Rough estimate: average row sizes (measured from prod payloads)
const AVG_ROW_SIZES: Record<string, number> = {
  "games:list": 2_500,   // ~2.5 KB per game row (data JSONB)
  "trophies": 800,       // ~0.8 KB per trophy row + join
  "xp": 400,
  "stats": 300,
  "level": 200,
};

function estimateBytes(key: string, rowCount: number): number {
  const prefix = key.split(":")[0];
  const perRow = AVG_ROW_SIZES[prefix] ?? AVG_ROW_SIZES[key.split(":")[0]] ?? 500;
  // Also check full prefix like "games"
  const fullPrefix = key.includes("games:list") ? "games:list" : prefix;
  const size = AVG_ROW_SIZES[fullPrefix] ?? perRow;
  return size * Math.max(1, rowCount);
}

export function recordHit(key: string, rowCount = 1): void {
  hits++;
  const saved = estimateBytes(key, rowCount);
  bytesSaved += saved;
  if (typeof console !== "undefined" && (import.meta as any)?.env?.DEV) {
    // Cheap dev log, silent in prod
    console.debug(`[egress] cache hit ${key} → ~${(saved/1024).toFixed(1)} KB saved (total ${(bytesSaved/1024/1024).toFixed(2)} MB)`);
  }
}

export function recordMiss(key: string): void { misses++; }

export function egressStats() {
  const total = hits + misses;
  return {
    hits, misses,
    hitRate: total ? hits / total : 0,
    bytesSaved,
    mbSaved: bytesSaved / 1024 / 1024,
    // Free quota: 5 GB = 5120 MB
    quotaSavedPct: (bytesSaved / 1024 / 1024 / 5120) * 100,
  };
}

// Expose for dev console: window.__egressStats()
if (typeof window !== "undefined") {
  (window as any).__egressStats = egressStats;
}
