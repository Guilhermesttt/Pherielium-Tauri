// src/services/trophyHistory.ts
// Phase 3.5 — Renderer-side read/write API for the Supabase trophy schema.
//
// All read paths are RLS-bounded to the authenticated user. Writes go through
// the service_role-only `award_xp` SQL function (callable from trusted admin
// code paths or Edge Functions, never from the renderer directly).
//
// The exports are pure functions that accept an injectable `SupabaseClient`
// so unit tests can stand up a fake client without booting PostgREST. The
// `defaultTrophyHistory` object wires the production `supabase` singleton.

import { supabase } from "./supabase";
import type { SupabaseClient } from "@supabase/supabase-js";
import { cachedQuery, invalidate } from "../lib/queryCache";

export type TrophyTier = "platinum" | "gold" | "silver" | "bronze";

export type TrophyCategory =
  | "achievement"
  | "completion"
  | "library"
  | "leveling"
  | "social"
  | "platform"
  | "session";

export interface TrophyDefinition {
  id: string;
  code: string;
  title: string;
  description: string;
  tier: TrophyTier;
  xp_value: number;
  category: TrophyCategory;
  icon_url: string | null;
  is_hidden: boolean;
  is_active: boolean;
}

export interface UserTrophy {
  id: string;
  user_id: string;
  trophy_id: string;
  progress: number;
  unlocked_at: string | null;
  notified_at: string | null;
  metadata: Record<string, unknown>;
  trophy?: Pick<TrophyDefinition, "id" | "code" | "title" | "description" | "tier" | "xp_value" | "category" | "icon_url"> | null;
}

export interface UserTrophyStats {
  user_id: string;
  unlocked_total: number;
  unlocked_platinum: number;
  unlocked_gold: number;
  unlocked_silver: number;
  unlocked_bronze: number;
  unlocked_xp: number;
}

export type XpSourceType = "trophy_unlock" | "level_milestone" | "manual" | "correction";

export interface XpEvent {
  id: string;
  user_id: string;
  source_type: XpSourceType;
  source_id: string | null;
  amount: number;
  level_before: number | null;
  level_after: number | null;
  reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface LevelProgress {
  user_id: string;
  current_level: number;
  current_level_xp: number;
  total_xp: number;
  tier: TrophyTier;
  last_xp_at: string;
  updated_at: string;
}

export interface PageOptions {
  limit?: number;
  /** Cursor returned by the previous page; pass `null` for the first page. */
  before?: string | null;
  /** Optional tier filter (mapped to `trophy.tier` in the join). */
  tier?: TrophyTier | null;
  /** Inclusive start (ISO timestamp). */
  since?: string | null;
  /** Inclusive end (ISO timestamp). */
  until?: string | null;
}

export interface Page<T> {
  rows: T[];
  /** Pass back as `before` to get the next page; `null` when exhausted. */
  nextCursor: string | null;
}

const DEFAULT_PAGE_SIZE = 25;
const MAX_PAGE_SIZE = 100;

const clampLimit = (limit?: number): number => {
  if (!limit || limit < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.floor(limit));
};

const isMissingColumnError = (msg: string | undefined): boolean =>
  !!msg && /column .* does not exist/i.test(msg);

export interface TrophyHistoryClient {
  fetchTrophies: (userId: string, options?: PageOptions) => Promise<Page<UserTrophy>>;
  fetchXpEvents: (userId: string, options?: PageOptions) => Promise<Page<XpEvent>>;
  fetchStats: (userId: string) => Promise<UserTrophyStats | null>;
  fetchLevel: (userId: string) => Promise<LevelProgress | null>;
  /** Service-role-only. Renderer calls will fail RLS. */
  upsertTrophyProgress: (
    userId: string,
    trophyId: string,
    progress: number,
    metadata?: Record<string, unknown>,
  ) => Promise<UserTrophy | null>;
}

const sortUnlockedFirst = (a: UserTrophy, b: UserTrophy): number => {
  const at = a.unlocked_at ? Date.parse(a.unlocked_at) : 0;
  const bt = b.unlocked_at ? Date.parse(b.unlocked_at) : 0;
  return bt - at;
};

export function createTrophyHistory(client: SupabaseClient): TrophyHistoryClient {
  const fetchTrophies: TrophyHistoryClient["fetchTrophies"] = async (userId, options = {}) => {
    const limit = clampLimit(options.limit);
    const cacheKey = `trophies:${userId}:${options.tier ?? ""}:${options.since ?? ""}:${options.until ?? ""}:${options.before ?? ""}:${limit}`;
    return cachedQuery(
      cacheKey,
      async () => {
        let query = client
          .from("user_trophies")
          .select(
            "id,user_id,trophy_id,progress,unlocked_at,notified_at,metadata,trophy:trophy_definitions(id,code,title,description,tier,xp_value,category,icon_url)",
          )
          .eq("user_id", userId)
          .order("unlocked_at", { ascending: false, nullsFirst: false })
          .limit(limit + 1);

        if (options.tier) {
          query = query.eq("trophy.tier", options.tier);
        }
        if (options.since) query = query.gte("unlocked_at", options.since);
        if (options.until) query = query.lte("unlocked_at", options.until);
        if (options.before) query = query.lt("unlocked_at", options.before);

        const { data, error } = await query;
        if (error) {
          if (isMissingColumnError(error.message)) {
            return fetchTrophiesFlat(client, userId, options, limit);
          }
          throw new Error(`fetchTrophies failed: ${error.message}`);
        }
        const rows = ((data ?? []) as unknown as UserTrophy[]).slice();
        rows.sort(sortUnlockedFirst);
        const page = rows.slice(0, limit);
        const nextCursor = rows.length > limit && page.length > 0 ? page[page.length - 1].unlocked_at : null;
        return { rows: page, nextCursor };
      },
      { ttl: 30_000, stale: 60_000 }
    );
  };

  const fetchTrophiesFlat = async (
    c: SupabaseClient,
    userId: string,
    options: PageOptions,
    limit: number,
  ): Promise<Page<UserTrophy>> => {
    let q = c
      .from("user_trophies")
      .select("id,user_id,trophy_id,progress,unlocked_at,notified_at,metadata")
      .eq("user_id", userId)
      .order("unlocked_at", { ascending: false, nullsFirst: false })
      .limit(limit + 1);
    if (options.since) q = q.gte("unlocked_at", options.since);
    if (options.until) q = q.lte("unlocked_at", options.until);
    if (options.before) q = q.lt("unlocked_at", options.before);
    const { data, error } = await q;
    if (error) throw new Error(`fetchTrophies (flat) failed: ${error.message}`);
    const rows = ((data ?? []) as UserTrophy[]).slice();
    rows.sort(sortUnlockedFirst);
    const page = rows.slice(0, limit);
    const nextCursor = rows.length > limit && page.length > 0 ? page[page.length - 1].unlocked_at : null;
    return { rows: page, nextCursor };
  };

  const fetchXpEvents: TrophyHistoryClient["fetchXpEvents"] = async (userId, options = {}) => {
    const limit = clampLimit(options.limit);
    const cacheKey = `xp:${userId}:${options.since ?? ""}:${options.until ?? ""}:${options.before ?? ""}:${limit}`;
    return cachedQuery(
      cacheKey,
      async () => {
        let q = client
          .from("xp_events")
          .select(
            "id,user_id,source_type,source_id,amount,level_before,level_after,reason,metadata,created_at",
          )
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(limit + 1);
        if (options.since) q = q.gte("created_at", options.since);
        if (options.until) q = q.lte("created_at", options.until);
        if (options.before) q = q.lt("created_at", options.before);

        const { data, error } = await q;
        if (error) throw new Error(`fetchXpEvents failed: ${error.message}`);
        const rows = (data ?? []) as XpEvent[];
        const page = rows.slice(0, limit);
        const nextCursor = rows.length > limit && page.length > 0 ? page[page.length - 1].created_at : null;
        return { rows: page, nextCursor };
      },
      { ttl: 30_000, stale: 60_000 }
    );
  };

  const fetchStats: TrophyHistoryClient["fetchStats"] = async (userId) => {
    const cacheKey = `stats:${userId}`;
    return cachedQuery(
      cacheKey,
      async () => {
        const { data, error } = await client
          .from("user_trophy_stats_view")
          .select("user_id,unlocked_total,unlocked_platinum,unlocked_gold,unlocked_silver,unlocked_bronze,unlocked_xp")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw new Error(`fetchStats failed: ${error.message}`);
        return (data as UserTrophyStats | null) ?? null;
      },
      { ttl: 30_000, stale: 60_000 }
    );
  };

  const fetchLevel: TrophyHistoryClient["fetchLevel"] = async (userId) => {
    const cacheKey = `level:${userId}`;
    return cachedQuery(
      cacheKey,
      async () => {
        const { data, error } = await client
          .from("level_progress")
          .select("user_id,current_level,current_level_xp,total_xp,tier,last_xp_at,updated_at")
          .eq("user_id", userId)
          .maybeSingle();
        if (error) throw new Error(`fetchLevel failed: ${error.message}`);
        return (data as LevelProgress | null) ?? null;
      },
      { ttl: 30_000, stale: 60_000 }
    );
  };

  const upsertTrophyProgress: TrophyHistoryClient["upsertTrophyProgress"] = async (
    userId,
    trophyId,
    progress,
    metadata = {},
  ) => {
    if (progress < 0 || progress > 1) {
      throw new Error("progress must be in [0,1]");
    }
    const nowIso = new Date().toISOString();
    const payload = {
      user_id: userId,
      trophy_id: trophyId,
      progress,
      unlocked_at: progress >= 1 ? nowIso : null,
      metadata,
    };
    const { data, error } = await client
      .from("user_trophies")
      .upsert(payload, { onConflict: "user_id,trophy_id" })
      .select("id,user_id,trophy_id,progress,unlocked_at,notified_at,metadata")
      .single();
    if (error) throw new Error(`upsertTrophyProgress failed: ${error.message}`);
    // Invalidate cached reads so next fetch sees the new row without waiting 30s
    invalidate(`trophies:${userId}`);
    invalidate(`stats:${userId}`);
    invalidate(`xp:${userId}`);
    return (data as UserTrophy | null) ?? null;
  };

  return { fetchTrophies, fetchXpEvents, fetchStats, fetchLevel, upsertTrophyProgress };
}

export const defaultTrophyHistory: TrophyHistoryClient = createTrophyHistory(supabase);
