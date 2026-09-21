// src/services/trophyRealtime.ts
// Phase 2 — Subscribes to Supabase Realtime `user_trophies` changes and
// forwards fully-unlocked rows to the shared achievement detector.
//
// Designed to be testable without a real Supabase connection: callers
// inject a `createChannel` factory (in production this is the supabase-js
// `supabase.channel(...)`; in tests it is a fake). The detector is also
// injected so we can verify the wiring without touching the real one.

import type { TrophyUnlockDetector } from "./achievementDetector";

export interface TrophyRealtimeRow {
  user_id?: string;
  trophy_id?: string;
  progress?: number | null;
  unlocked_at?: string | null;
  notified_at?: string | null;
  trophy_definitions?: {
    code?: string;
    title?: string;
    description?: string;
    tier?: string;
    xp_value?: number;
    icon_url?: string;
  } | null;
}

export interface TrophyRealtimeEvent {
  eventType?: "INSERT" | "UPDATE" | "DELETE" | string;
  table?: string;
  new?: TrophyRealtimeRow | null;
  old?: TrophyRealtimeRow | null;
}

export type ChannelLike = {
  on: (...args: unknown[]) => ChannelLike;
  subscribe: (cb?: (status: string) => void) => Promise<unknown>;
  unsubscribe: () => Promise<unknown>;
};

export type ChannelFactory = () => ChannelLike;

export interface TrophyRealtimeOptions {
  userId: string;
  createChannel: ChannelFactory;
  detector: TrophyUnlockDetector;
  /** Table name to subscribe to. Defaults to `user_trophies`. */
  table?: string;
  /** Logger for non-fatal errors. */
  logger?: (message: string, error?: unknown) => void;
}

export interface TrophyRealtimeSubscription {
  start: () => Promise<void>;
  stop: () => Promise<void>;
  isActive: () => boolean;
}

const isFullyUnlocked = (row: TrophyRealtimeRow | null | undefined): boolean => {
  if (!row) return false;
  if (typeof row.progress === "number" && row.progress >= 1) return true;
  // Defensive fallback: some Realtime payloads may omit progress; if
  // unlocked_at is set we treat it as completed.
  return Boolean(row.unlocked_at);
};

export function createTrophyRealtimeSubscription(
  options: TrophyRealtimeOptions,
): TrophyRealtimeSubscription {
  const table = options.table || "user_trophies";
  let active = false;
  let channel: ChannelLike | null = null;

  const noopLog = () => undefined;
  const log = options.logger ?? noopLog;

  const handle = (payload: TrophyRealtimeEvent): void => {
    if (!active) return;
    if (payload.table && payload.table !== table) return;
    if (payload.eventType && payload.eventType !== "INSERT" && payload.eventType !== "UPDATE") {
      return;
    }
    const next = payload.new;
    if (!next) return;
    if (next.user_id && next.user_id !== options.userId) return;
    if (!isFullyUnlocked(next)) return;
    try {
      options.detector.ingest({
        // Pass the whole row; the detector's realtime normalizer
        // expects the same shape we send to Supabase.
        trophy_id: next.trophy_id,
        progress: next.progress,
        unlocked_at: next.unlocked_at,
        trophy_definitions: next.trophy_definitions,
      });
    } catch (error) {
      log("[trophyRealtime] detector.ingest threw", error);
    }
  };

  return {
    async start() {
      if (active) return;
      const ch = options.createChannel();
      // supabase-js v2 channel signature: `channel.on(type, options, handler)`.
      // We register two listeners (INSERT + UPDATE) and dispatch both into
      // the same `handle` to keep the dedup logic in one place.
      const on = ch.on as unknown as (...args: unknown[]) => ChannelLike;
      on.call(ch, "postgres_changes", {
        event: "INSERT",
        schema: "public",
        table,
        filter: `user_id=eq.${options.userId}`,
      }, handle);
      on.call(ch, "postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table,
        filter: `user_id=eq.${options.userId}`,
      }, handle);
      await ch.subscribe((status: string) => {
        if (status !== "SUBSCRIBED") {
          log(`[trophyRealtime] channel status: ${status}`);
        }
      });
      channel = ch;
      active = true;
    },
    async stop() {
      if (!active) return;
      active = false;
      if (channel) {
        try {
          await channel.unsubscribe();
        } catch (error) {
          log("[trophyRealtime] unsubscribe failed", error);
        }
        channel = null;
      }
    },
    isActive() {
      return active;
    },
  };
}
