// src/services/trophyUnlockStream.ts
// Phase 2 — High-level facade that wires the Supabase Realtime subscription
// for `user_trophies` to the achievement detector and a renderer-supplied
// callback (typically the in-page toast + a call to the system-push IPC).
//
// Kept framework-agnostic so it can be unit-tested in plain Node. The
// React layer (`useTrophyUnlockStream`) just binds the start/stop to a
// useEffect on userId.

import { supabase as defaultSupabase } from "./supabase";
import {
  createTrophyUnlockDetector,
  type TrophyUnlock,
  type TrophyUnlockDetector,
} from "./achievementDetector";
import {
  createTrophyRealtimeSubscription,
  type ChannelFactory,
  type TrophyRealtimeSubscription,
} from "./trophyRealtime";

export interface TrophyUnlockStreamOptions {
  userId: string;
  /** Optional override for tests. Defaults to the shared supabase client. */
  supabase?: typeof defaultSupabase;
  /** Called for every accepted unlock. May be called more than once for the
   * same key across reloads; the detector's dedup window collapses them. */
  onUnlock: (unlock: TrophyUnlock) => void;
  /** Optional non-fatal error sink. */
  onError?: (message: string, error?: unknown) => void;
  /** Detached test seam. Defaults to a fresh detector. */
  detector?: TrophyUnlockDetector;
  /**
   * Detached test seam. Receives the stream's `detector` and `userId` so
   * the subscription shares the same dedup state as the stream.
   */
  createSubscription?: (deps: {
    userId: string;
    detector: TrophyUnlockDetector;
    onError?: (message: string, error?: unknown) => void;
  }) => TrophyRealtimeSubscription;
  /** Injectable clock for tests. */
  now?: () => number;
  /** Dedup window in ms. */
  dedupWindowMs?: number;
}

export interface TrophyUnlockStream {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isActive: () => boolean;
  /** Direct access to the detector (for tests or advanced wiring). */
  detector: TrophyUnlockDetector;
}

const buildDefaultCreateSubscription =
  (supabase: typeof defaultSupabase) =>
  ({ userId, detector, onError }: {
    userId: string;
    detector: TrophyUnlockDetector;
    onError?: (message: string, error?: unknown) => void;
  }): TrophyRealtimeSubscription => {
    const createChannel: ChannelFactory = () => {
      const channelName = `trophies_user_${userId}`;
      const existing = supabase.getChannels().find(
        (c) => c.topic === `realtime:${channelName}` || c.topic === channelName,
      );
      if (existing) {
        supabase.removeChannel(existing);
      }
      return supabase.channel(channelName) as unknown as ReturnType<ChannelFactory>;
    };
    return createTrophyRealtimeSubscription({
      userId,
      createChannel,
      detector,
      logger: onError,
    });
  };

export function createTrophyUnlockStream(
  options: TrophyUnlockStreamOptions,
): TrophyUnlockStream {
  const detector =
    options.detector ??
    createTrophyUnlockDetector({
      now: options.now,
      dedupWindowMs: options.dedupWindowMs,
    });

  const createSubscription =
    options.createSubscription ??
    buildDefaultCreateSubscription(options.supabase ?? defaultSupabase);

  let sub: TrophyRealtimeSubscription | null = null;
  let active = false;
  let detach: (() => void) | null = null;

  return {
    detector,
    async start() {
      if (active) return;
      try {
        sub = createSubscription({
          userId: options.userId,
          detector,
          onError: options.onError,
        });
        detach = detector.subscribe((unlock) => {
          try {
            options.onUnlock(unlock);
          } catch (err) {
            options.onError?.("[trophyUnlockStream] onUnlock threw", err);
          }
        });
        await sub.start();
        active = true;
      } catch (err) {
        options.onError?.("[trophyUnlockStream] start failed", err);
        active = false;
        sub = null;
        if (detach) {
          detach();
          detach = null;
        }
      }
    },
    async stop() {
      if (!active) return;
      active = false;
      if (sub) {
        try {
          await sub.stop();
        } catch (err) {
          options.onError?.("[trophyUnlockStream] stop failed", err);
        }
        sub = null;
      }
      if (detach) {
        detach();
        detach = null;
      }
    },
    isActive() {
      return active;
    },
  };
}
