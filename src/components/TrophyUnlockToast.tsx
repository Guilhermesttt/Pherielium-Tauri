// src/components/TrophyUnlockToast.tsx
// Phase 2.6 — In-page trophy unlock toast surface.
//
// Listens to the Supabase Realtime stream (via `useTrophyUnlockStream`) and
// surfaces a tier-coloured in-page notification for every accepted unlock.
// The hook already forwards the same payload to the system-push IPC
// (see Phase 4) so the renderer does not need to do it again here.
//
// Visual contract:
//   * Tier-coloured ring matching the trophy tier (Platina / Ouro / Prata / Bronze).
//   * Tier label + trophy title in the toast title.
//   * Optional description below the title.
//   * "+N XP" suffix when the unlock carries an xp value.
//   * Optional icon URL (the renderer uses the host's image element so it
//     works for both http(s) and data URLs).
//
// All state lives in the existing `NotificationCenter`, so this component
// is purely a thin subscription: it does not own any React state.

import { useCallback, useMemo } from "react";
import { useTrophyUnlockStream } from "../hooks/useTrophyUnlockStream";
import { useNotification } from "./NotificationCenter";
import { TROPHY_TIERS, type TrophyTierInfo } from "../utils/trophyTiers";
import type { TrophyUnlock } from "../services/achievementDetector";
import { defaultTrophyHistory } from "../services/trophyHistory";

export interface TrophyUnlockToastProps {
  /** Logged-in user id; when null, the stream is not started. */
  userId: string | null | undefined;
}

const tierInfoFor = (id: TrophyUnlock["tier"]): TrophyTierInfo | undefined =>
  TROPHY_TIERS.find((t) => t.id === id);

/**
 * Mount this component once near the top of the authenticated tree to
 * surface a toast for every trophy unlock streamed from Supabase.
 */
export const TrophyUnlockToast: React.FC<TrophyUnlockToastProps> = ({ userId }) => {
  const { notify } = useNotification();

  const onUnlock = useCallback(
    (unlock: TrophyUnlock) => {
      const tier = tierInfoFor(unlock.tier);
      const tierLabel = tier?.label ?? unlock.tier;
      const xpSuffix = unlock.xp > 0 ? ` (+${unlock.xp} XP)` : "";
      const title = `${tierLabel} · ${unlock.trophyTitle}${xpSuffix}`;
      notify(unlock.trophyDescription || title, "achievement", {
        title,
        imageUrl: unlock.iconUrl,
        duration: tier?.id === "platinum" ? 10000 : 8000,
        metadata: {
          kind: "trophy_unlock",
          tier: unlock.tier,
          xp: unlock.xp,
          source: unlock.source,
        },
      });
    },
    [notify],
  );

  const onError = useCallback(
    (message: string, error?: unknown) => {
      // Keep the user informed but never block: a toast type "error" stays
      // short and quiet so it does not steal focus from gameplay.
      // eslint-disable-next-line no-console
      console.warn("[TrophyUnlockToast]", message, error);
    },
    [],
  );

  const enabled = useMemo(() => Boolean(userId), [userId]);

  useTrophyUnlockStream({
    userId: enabled ? userId ?? null : null,
    onUnlock,
    onError,
    enabled,
    // T3.5 — mirror every accepted realtime unlock to Supabase so the
    // TrophyHistoryTimeline has rows to read even if the unlock was
    // originally written by the achievement bridge or a manual grant.
    historyClient: enabled ? defaultTrophyHistory : undefined,
  });

  return null;
};

export default TrophyUnlockToast;
