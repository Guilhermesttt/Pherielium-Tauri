import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthProvider";
import { useNotification } from "../components/NotificationCenter";
import {
  buildInviteMessage,
  discordIdOf,
  groupDiscordFriends,
  type DiscordFriendGroups,
  type DiscordMatch,
} from "../components/friends/discordFriendGroups";
import { sendCheckpointFriendRequest } from "../services/checkpointFriends";
import { matchDiscordFriends } from "../services/discordFriendMatch";
import { sendFastFriendRequestNotification } from "../services/realtimeEventBus";
import type { SocialFriend } from "../types/domain";

export interface DiscordFriendActions extends DiscordFriendGroups {
  /** a consulta ao servidor ainda está em andamento */
  loading: boolean;
  addFriend: (friend: SocialFriend) => Promise<void>;
  copyInvite: (friend: SocialFriend) => Promise<void>;
}

/**
 * Cruza os amigos do Discord com contas do Pherielium (RPC `match_discord_friends`) e expõe as
 * ações "Adicionar" e "Convidar". Se o RPC falhar (ex.: migration ainda não aplicada), todos
 * caem em "Convidar" e o resto da lista de amigos segue funcionando.
 */
export function useDiscordFriendMatches(friends: SocialFriend[]): DiscordFriendActions {
  const { user, userProfile, refreshProfile } = useAuth();
  const { notify } = useNotification();
  const [matches, setMatches] = useState<DiscordMatch[]>([]);
  const [loading, setLoading] = useState(false);

  const discordFriends = useMemo(() => friends.filter((f) => f.source === "discord_friend"), [friends]);
  const idsKey = useMemo(
    () => discordFriends.map(discordIdOf).filter(Boolean).sort().join(","),
    [discordFriends],
  );

  useEffect(() => {
    if (!idsKey) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setMatches([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    matchDiscordFriends(idsKey.split(","))
      .then((found) => {
        if (!cancelled) setMatches(found);
      })
      .catch((error: unknown) => {
        console.warn("[discord-friends] Não foi possível buscar contas do Pherielium:", error);
        if (!cancelled) setMatches([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [idsKey]);

  const friendUidsKey = (userProfile?.checkpointFriends ?? []).map((f) => f.uid).join(",");
  const outgoingKey = (userProfile?.checkpointFriendRequestsOutgoing ?? []).map((r) => r.uid).join(",");
  const incomingKey = (userProfile?.checkpointFriendRequestsIncoming ?? []).map((r) => r.uid).join(",");

  const groups = useMemo(
    () =>
      groupDiscordFriends(discordFriends, matches, {
        friendUids: new Set(friendUidsKey.split(",").filter(Boolean)),
        outgoingUids: new Set(outgoingKey.split(",").filter(Boolean)),
        incomingUids: new Set(incomingKey.split(",").filter(Boolean)),
      }),
    [discordFriends, matches, friendUidsKey, outgoingKey, incomingKey],
  );

  const addFriend = useCallback(
    async (friend: SocialFriend) => {
      const state = groups.stateById[friend.id];
      if (!user?.uid || state?.kind !== "addable") return;
      try {
        await sendCheckpointFriendRequest(state.uid);
        void sendFastFriendRequestNotification(state.uid, {
          uid: user.uid,
          displayName: userProfile?.displayName || user.displayName || user.email?.split("@")[0] || "Jogador",
          photoURL: userProfile?.photoURL || user.photoURL || null,
        });
        notify(`Pedido de amizade enviado para ${friend.name}.`, "success");
        await refreshProfile();
      } catch (error) {
        notify(error instanceof Error ? error.message : "Não foi possível enviar o pedido.", "error");
      }
    },
    [groups.stateById, notify, refreshProfile, user, userProfile?.displayName, userProfile?.photoURL],
  );

  const copyInvite = useCallback(
    async (friend: SocialFriend) => {
      const message = buildInviteMessage(userProfile?.displayName);
      try {
        await navigator.clipboard.writeText(message);
        notify(`Convite copiado. Cole no Discord para ${friend.name}.`, "success");
      } catch {
        notify("Não foi possível copiar o convite.", "error");
      }
    },
    [notify, userProfile?.displayName],
  );

  return { ...groups, loading, addFriend, copyInvite };
}
