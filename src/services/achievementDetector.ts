// src/services/achievementDetector.ts
// Phase 2 — Pure, framework-agnostic normalizer + dedup pipeline for trophy
// unlock events arriving from heterogeneous sources (Supabase Realtime
// `user_trophies` rows, the Electron achievement bridge payload, server-side
// level-up milestones, etc.).
//
// Design goals:
//   * Zero React / Electron / Supabase imports so this file is unit-testable
//     in a plain Node environment (see tests/achievementDetector.test.ts).
//   * One output shape (`TrophyUnlock`) regardless of input source.
//   * Time-windowed dedup so the same unlock arriving from two sources
//     (e.g., the achievement bridge AND the realtime channel) does not
//     trigger two toasts / two system pushes within `dedupWindowMs`.
//   * Multiple listeners so the renderer can fan out (toast, telemetry,
//     email gate, etc.) without coupling.
//
// Source -> dedupKey contract:
//   * `realtime` -> `${user_trophy.trophy_id}@${user_trophy.unlocked_at}`
//     (the row's unlock timestamp is part of the key so retries with the
//     same ID but a new unlock time still emit a new toast — defensive
//     against a re-unlock after a manual reset).
//   * `bridge`   -> `${gameId}:${achievementId}` (the bridge already dedups
//     per file, but we still want to swallow duplicates that arrive via
//     both the bridge event AND the realtime row written server-side).
//   * `level`    -> `${kind}:${level}` (e.g., `level-up:10`).

export type TrophyTier = "platinum" | "gold" | "silver" | "bronze";
export type TrophySource = "realtime" | "bridge" | "level" | "manual";

export interface TrophyUnlock {
  /** Stable, source-agnostic identifier (e.g. trophy uuid, or gameId:achievementId). */
  id: string;
  /** Trophy title for the toast + email. */
  trophyTitle: string;
  /** Optional description; may be empty. */
  trophyDescription: string;
  tier: TrophyTier;
  /** XP awarded by the unlock (0 for bridge events that have no xp_value). */
  xp: number;
  /** ISO-8601 timestamp; falls back to the ingest time when missing. */
  unlockedAt: string;
  /** Optional icon URL (hosted trophy art or bridge asset). */
  iconUrl?: string;
  /** Originating channel. */
  source: TrophySource;
  /** Key used by the detector for dedup. Computed by normalize. */
  dedupKey: string;
}

export type DetectorListener = (unlock: TrophyUnlock) => void;

export interface DetectorOptions {
  /** Injected clock. Defaults to `Date.now`. */
  now?: () => number;
  /**
   * Window (ms) during which a re-ingest of the same `dedupKey` is
   * silently dropped. Defaults to 60_000 (1 minute).
   */
  dedupWindowMs?: number;
  /** Optional single-listener convenience. */
  listener?: DetectorListener;
  /** Maximum number of dedup keys retained in memory. Defaults to 1000. */
  maxEntries?: number;
}

const SUPPORTED_TIERS: ReadonlySet<TrophyTier> = new Set([
  "platinum",
  "gold",
  "silver",
  "bronze",
]);

const TIER_FALLBACK: TrophyTier = "bronze";

const sanitize = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const toIso = (input: unknown, fallback: string): string => {
  const raw = sanitize(input);
  if (!raw) return fallback;
  const ms = Date.parse(raw);
  if (Number.isFinite(ms)) return new Date(ms).toISOString();
  return fallback;
};

const coerceTier = (raw: unknown): TrophyTier => {
  const value = sanitize(raw).toLowerCase();
  return SUPPORTED_TIERS.has(value as TrophyTier)
    ? (value as TrophyTier)
    : TIER_FALLBACK;
};

const coerceXp = (raw: unknown): number => {
  if (typeof raw === "number" && Number.isFinite(raw)) return Math.max(0, raw);
  const parsed = Number(raw);
  if (Number.isFinite(parsed)) return Math.max(0, parsed);
  return 0;
};

interface RealtimeRow {
  trophy_id?: unknown;
  unlocked_at?: unknown;
  trophy_definitions?: {
    title?: unknown;
    description?: unknown;
    tier?: unknown;
    xp_value?: unknown;
    icon_url?: unknown;
  } | null;
}

interface BridgePayload {
  gameId?: unknown;
  achievementId?: unknown;
  achievement?: {
    id?: unknown;
    name?: unknown;
    description?: unknown;
    icon?: unknown;
  } | null;
  unlockedAt?: unknown;
}

interface LevelPayload {
  kind?: unknown;
  level?: unknown;
  totalXp?: unknown;
  unlockedAt?: unknown;
}

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const normalizeFromRealtime = (
  raw: RealtimeRow,
  unlockedAt: string,
): TrophyUnlock | null => {
  const def = raw.trophy_definitions;
  if (!def) return null;
  const title = sanitize(def.title) || sanitize(def.description);
  if (!title) return null;
  const id = sanitize(raw.trophy_id) || `realtime:${title}`;
  return {
    id,
    trophyTitle: title,
    trophyDescription: sanitize(def.description),
    tier: coerceTier(def.tier),
    xp: coerceXp(def.xp_value),
    unlockedAt: toIso(raw.unlocked_at, unlockedAt),
    iconUrl: sanitize(def.icon_url) || undefined,
    source: "realtime",
    dedupKey: `realtime:${id}:${toIso(raw.unlocked_at, unlockedAt)}`,
  };
};

const normalizeFromBridge = (
  raw: BridgePayload,
  unlockedAt: string,
): TrophyUnlock | null => {
  const gameId = sanitize(raw.gameId);
  const achId = sanitize(raw.achievementId) || sanitize(raw.achievement?.id);
  if (!gameId || !achId) return null;
  const ach = raw.achievement;
  const title = sanitize(ach?.name) || achId;
  return {
    id: `${gameId}:${achId}`,
    trophyTitle: title,
    trophyDescription: sanitize(ach?.description),
    tier: TIER_FALLBACK, // Bridge events do not yet carry a tier; renderer
                        // can re-classify via the trophy_definitions view.
    xp: 0,
    unlockedAt: toIso(raw.unlockedAt, unlockedAt),
    iconUrl: sanitize(ach?.icon) || undefined,
    source: "bridge",
    dedupKey: `bridge:${gameId}:${achId}`,
  };
};

const tierForLevel = (level: number): TrophyTier => {
  if (level >= 100) return "platinum";
  if (level >= 50) return "gold";
  if (level >= 10) return "silver";
  return "bronze";
};

const normalizeFromLevel = (
  raw: LevelPayload,
  unlockedAt: string,
): TrophyUnlock | null => {
  const kind = sanitize(raw.kind) || "level-up";
  const level = Number(raw.level);
  if (!Number.isFinite(level) || level <= 0) return null;
  return {
    id: `${kind}:${level}`,
    trophyTitle: `Nível ${level} alcançado`,
    trophyDescription:
      "Continue acumulando XP para subir de nível e desbloquear novas recompensas.",
    tier: tierForLevel(level),
    xp: 0,
    unlockedAt: toIso(raw.unlockedAt, unlockedAt),
    source: "level",
    dedupKey: `level:${kind}:${level}`,
  };
};

/**
 * Normalize any incoming payload into the canonical `TrophyUnlock` shape.
 * Returns `null` if the payload does not contain enough information.
 */
export function normalizeTrophyUnlock(
  raw: unknown,
  options: { source: TrophySource; now?: () => number },
): TrophyUnlock | null {
  if (!isObject(raw)) return null;
  const now = options.now ?? (() => Date.now());
  const fallback = new Date(now()).toISOString();
  switch (options.source) {
    case "realtime":
      return normalizeFromRealtime(raw as RealtimeRow, fallback);
    case "bridge":
      return normalizeFromBridge(raw as BridgePayload, fallback);
    case "level":
      return normalizeFromLevel(raw as LevelPayload, fallback);
    case "manual": {
      // Manual: must already look like a TrophyUnlock (id + trophyTitle).
      const candidate = raw as Partial<TrophyUnlock>;
      const id = sanitize(candidate.id);
      const title = sanitize(candidate.trophyTitle);
      if (!id || !title) return null;
      return {
        id,
        trophyTitle: title,
        trophyDescription: sanitize(candidate.trophyDescription),
        tier: coerceTier(candidate.tier),
        xp: coerceXp(candidate.xp),
        unlockedAt: toIso(candidate.unlockedAt, fallback),
        iconUrl: sanitize(candidate.iconUrl) || undefined,
        source: "manual",
        dedupKey: `manual:${id}:${toIso(candidate.unlockedAt, fallback)}`,
      };
    }
    default:
      return null;
  }
}

export interface TrophyUnlockDetector {
  /** Ingest a raw payload; returns true if it was normalized and emitted. */
  ingest(raw: unknown): boolean;
  /** Subscribe to emitted unlocks. Returns an unsubscribe function. */
  subscribe(listener: DetectorListener): () => void;
  /** Number of dedup keys currently tracked. */
  size(): number;
  /** Clear listeners and dedup state. */
  dispose(): void;
}

const DEFAULT_DEDUP_WINDOW_MS = 60_000;
const DEFAULT_MAX_ENTRIES = 1000;

/**
 * Create a detector instance. Each call returns an independent detector
 * (no shared state) so it is safe to use both in the renderer and in tests.
 */
export function createTrophyUnlockDetector(
  options: DetectorOptions = {},
): TrophyUnlockDetector {
  const now = options.now ?? (() => Date.now());
  const dedupWindowMs = Math.max(0, options.dedupWindowMs ?? DEFAULT_DEDUP_WINDOW_MS);
  const maxEntries = Math.max(1, options.maxEntries ?? DEFAULT_MAX_ENTRIES);

  const listeners = new Set<DetectorListener>();
  if (options.listener) listeners.add(options.listener);

  // Map<dedupKey, expiresAt> for O(1) lookups. We prune lazily on each
  // ingest so the detector does not need a setInterval timer.
  const dedupState = new Map<string, number>();

  const emit = (unlock: TrophyUnlock): void => {
    for (const listener of listeners) {
      try {
        listener(unlock);
      } catch {
        // A misbehaving listener must not break the others.
      }
    }
  };

  const prune = (nowMs: number): void => {
    for (const [key, expiresAt] of dedupState) {
      if (expiresAt <= nowMs) dedupState.delete(key);
    }
  };

  const trimToCap = (): void => {
    while (dedupState.size > maxEntries) {
      const oldestKey = dedupState.keys().next().value;
      if (oldestKey === undefined) break;
      dedupState.delete(oldestKey);
    }
  };

  return {
    ingest(raw) {
      const nowMs = now();
      const unlock = normalizeTrophyUnlock(raw, {
        source: inferSource(raw),
        now,
      });
      if (!unlock) return false;
      prune(nowMs);
      const expiresAt = nowMs + dedupWindowMs;
      const previousExpiresAt = dedupState.get(unlock.dedupKey);
      if (previousExpiresAt && previousExpiresAt > nowMs) {
        return false; // already emitted within the window
      }
      dedupState.set(unlock.dedupKey, expiresAt);
      trimToCap();
      emit(unlock);
      return true;
    },
    subscribe(listener) {
      if (typeof listener !== "function") return () => undefined;
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    size() {
      return dedupState.size;
    },
    dispose() {
      listeners.clear();
      dedupState.clear();
    },
  };
}

const inferSource = (raw: unknown): TrophySource => {
  if (!isObject(raw)) return "manual";
  if (sanitize((raw as { kind?: unknown }).kind).length > 0) return "level";
  if ("trophy_definitions" in raw || "trophy_id" in raw) return "realtime";
  if ("gameId" in raw || "achievementId" in raw) return "bridge";
  return "manual";
};
