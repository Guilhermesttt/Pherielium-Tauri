// src/hooks/useTrophyUnlockStream.ts
// Phase 2 — React hook that ties the Supabase Realtime `user_trophies`
// subscription into the renderer. The hook:
//   * starts/stops the stream when `userId` becomes available/disappears,
//   * invokes the supplied `onUnlock` callback so the host component can
//     surface an in-page toast,
//   * always forwards the unlock to the system-push IPC handler added in
//     Phase 4 (`window.checkpoint.notifyTrophyUnlock`).
//   * optionally mirrors each accepted unlock to Supabase via a debounced
//     `trophyHistory.upsertTrophyProgress` call (Phase 3.5, T3.5).
//
// The hook is intentionally a thin wrapper: all the dedup, normalizer, and
// channel lifecycle logic lives in `trophyUnlockStream.ts`, which is unit
// tested in plain Node. We keep this file so small that the only thing
// that needs a real DOM/Electron is the integration smoke.

import { useEffect, useRef } from "react";
import {
  createTrophyUnlockStream,
  type TrophyUnlockStream,
} from "../services/trophyUnlockStream";
import type { TrophyUnlock } from "../services/achievementDetector";
import type { TrophyHistoryClient } from "../services/trophyHistory";

export interface UseTrophyUnlockStreamOptions {
  userId: string | null | undefined;
  onUnlock?: (unlock: TrophyUnlock) => void;
  onError?: (message: string, error?: unknown) => void;
  /** When false, the stream does not start. Defaults to true. */
  enabled?: boolean;
  /**
   * Optional Supabase-backed client. When supplied, every accepted
   * unlock is mirrored to `user_trophies` via a debounced
   * `upsertTrophyProgress(userId, unlock.id, 1, ...)` call so the
   * history service has a row to read back even when the unlock
   * originated outside the realtime channel (bridge, level milestone,
   * manual admin grant). The debounce window collapses bursts of
   * updates for the same trophy into a single write.
   */
  historyClient?: TrophyHistoryClient;
  /**
   * Debounce window (ms) for the history upsert. Defaults to 2000.
   * Per-trophy: each new unlock resets the timer for that trophy only.
   */
  historyDebounceMs?: number;
}

declare global {
  interface Window {
    checkpoint?: {
      notifyTrophyUnlock?: (payload: {
        trophyTitle: string;
        trophyDescription?: string;
        tier: "platinum" | "gold" | "silver" | "bronze";
        xp?: number;
        iconUrl?: string;
      }) => Promise<{ shown: boolean; reason?: string }>;
    };
  }
}

const isElectronContext = (): boolean =>
  typeof window !== "undefined" && Boolean(window.checkpoint?.notifyTrophyUnlock);

const fireSystemPush = (unlock: TrophyUnlock): void => {
  if (!isElectronContext()) return;
  const api = window.checkpoint?.notifyTrophyUnlock;
  if (!api) return;
  // Fire-and-forget; the main process decides whether to show a system
  // notification based on window visibility and the in-page toast.
  Promise.resolve(
    api({
      trophyTitle: unlock.trophyTitle,
      trophyDescription: unlock.trophyDescription,
      tier: unlock.tier,
      xp: unlock.xp,
      iconUrl: unlock.iconUrl,
    }),
  ).catch(() => undefined);
};

const UUID_LIKE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const scheduleHistoryUpsert = (params: {
  userId: string;
  unlock: TrophyUnlock;
  client: TrophyHistoryClient;
  debounceMs: number;
  pending: Map<string, ReturnType<typeof setTimeout>>;
  onError?: (message: string, error?: unknown) => void;
}): void => {
  const { userId, unlock, client, debounceMs, pending, onError } = params;
  // Only persist events whose `id` is a real trophy_id (i.e. a UUID).
  // Bridge events use `gameId:achievementId` and level milestones use
  // `level-up:N`; those flow through `xp_events` instead, via the
  // server-side `award_xp` and Phase 4 notification worker.
  if (!UUID_LIKE.test(unlock.id)) return;

  const existing = pending.get(unlock.id);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(() => {
    pending.delete(unlock.id);
    client
      .upsertTrophyProgress(userId, unlock.id, 1, {
        source: unlock.source,
        unlocked_at: unlock.unlockedAt,
        trophy_title: unlock.trophyTitle,
        tier: unlock.tier,
        xp: unlock.xp,
      })
      .catch((err: unknown) => {
        onError?.(
          `[useTrophyUnlockStream] history upsert failed for ${unlock.id}`,
          err,
        );
      });
  }, Math.max(0, debounceMs));

  pending.set(unlock.id, timer);
};

export function useTrophyUnlockStream(options: UseTrophyUnlockStreamOptions): void {
  const {
    userId,
    onUnlock,
    onError,
    enabled = true,
    historyClient,
    historyDebounceMs = 2000,
  } = options;
  const streamRef = useRef<TrophyUnlockStream | null>(null);
  const onUnlockRef = useRef<typeof onUnlock>(onUnlock);
  const onErrorRef = useRef<typeof onError>(onError);
  const historyClientRef = useRef<TrophyHistoryClient | undefined>(historyClient);
  const pendingUpsertsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  );

  // Keep the latest callbacks in a ref so the stream does not need to
  // restart when only the callback identity changes.
  onUnlockRef.current = onUnlock;
  onErrorRef.current = onError;
  historyClientRef.current = historyClient;

  useEffect(() => {
    if (!enabled || !userId) {
      // Nothing to start; the previous effect's cleanup (if any) already
      // stopped its stream and nulled the ref, so there is no further
      // teardown work to do here.
      return undefined;
    }

    const stream = createTrophyUnlockStream({
      userId,
      onUnlock: (unlock) => {
        // Always fire the system push; the main process dedups against
        // the in-page toast via window visibility.
        fireSystemPush(unlock);
        const client = historyClientRef.current;
        if (client) {
          scheduleHistoryUpsert({
            userId,
            unlock,
            client,
            debounceMs: historyDebounceMs,
            pending: pendingUpsertsRef.current,
            onError: onErrorRef.current,
          });
        }
        const cb = onUnlockRef.current;
        if (cb) {
          try {
            cb(unlock);
          } catch (err) {
            onErrorRef.current?.("[useTrophyUnlockStream] onUnlock threw", err);
          }
        }
      },
      onError: (msg, err) => onErrorRef.current?.(msg, err),
    });
    streamRef.current = stream;
    void stream.start();
    return () => {
      streamRef.current = null;
      void stream.stop();
      // Flush any in-flight debounced upserts so a tear-down does not
      // strand pending writes; we still let the timer fire, but cancel
      // the queued callbacks.
      const pending = pendingUpsertsRef.current;
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, [enabled, userId, historyDebounceMs]);
}
