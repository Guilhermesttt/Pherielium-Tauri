/**
 * Persists the per-viewer volume map in localStorage under a versioned key.
 *
 * Tolerates a missing/blocked storage, corrupted JSON and a full quota: loading never
 * throws, saving reports a typed failure instead of throwing. Values are stored as the
 * user left them (clamped to the slider range only), so a future boost feature does not
 * invalidate saved data. Mute is intentionally NOT persisted.
 */
import type { VolumeMap } from "./volumeKeys";

export const VOLUME_STORAGE_KEY = "pherielium:volumes:v1";
const MAX_STORED_PERCENT = 200;
const VALID_KEY = /^(voice|screen):/;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type SaveResult = { ok: true } | { ok: false; reason: "unavailable" | "quota" };

function defaultStorage(): StorageLike | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch (error) {
    // Accessing localStorage itself can throw (blocked site data).
    console.warn("[volumeStore] localStorage unavailable:", error);
    return null;
  }
}

/** Keeps only well-formed entries; anything else is dropped rather than trusted. */
function sanitize(raw: unknown): VolumeMap {
  const out: VolumeMap = {};
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return out;
  for (const [key, value] of Object.entries(raw)) {
    if (!VALID_KEY.test(key) || typeof value !== "number" || !Number.isFinite(value)) continue;
    out[key] = Math.max(0, Math.min(MAX_STORED_PERCENT, Math.round(value)));
  }
  return out;
}

export function loadVolumes(storage: StorageLike | null = defaultStorage()): VolumeMap {
  if (!storage) return {};
  try {
    const text = storage.getItem(VOLUME_STORAGE_KEY);
    return text ? sanitize(JSON.parse(text)) : {};
  } catch (error) {
    console.warn("[volumeStore] ignoring unreadable saved volumes:", error);
    return {};
  }
}

export function saveVolumes(volumes: VolumeMap, storage: StorageLike | null = defaultStorage()): SaveResult {
  if (!storage) return { ok: false, reason: "unavailable" };
  try {
    storage.setItem(VOLUME_STORAGE_KEY, JSON.stringify(sanitize(volumes)));
    return { ok: true };
  } catch (error) {
    console.warn("[volumeStore] could not save volumes:", error);
    return { ok: false, reason: "quota" };
  }
}
