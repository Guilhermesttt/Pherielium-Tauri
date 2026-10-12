
import { PUBLIC_PROFILE_COLUMNS } from "./profileColumns";
import { supabase } from "./supabase";
import type { Game, UserProfile } from "../types/domain";
import { apiFetch, apiUrl, getUsableSession } from "./api";
import { broadcastPresenceStatus, getPresenceAudienceUids } from "./realtimeEventBus";
import { fetchSteamLibrary } from "./steam";
import { presenceDebugLog, shortUid } from "./presenceDebug";
import { getAppVersionCached, peekAppVersion, protocolFields } from "../lib/protocolVersion";
import { parsePresenceUpdatedAt } from "./presenceOrdering";

const friendAudienceForBroadcast = (): string[] | undefined => {
  const uids = getPresenceAudienceUids();
  return uids.length > 0 ? uids : undefined;
};

let cachedAccessToken: string | null = null;

export const getCachedAccessToken = () => cachedAccessToken;

if (supabase?.auth) {
  void getUsableSession().then((session) => {
    cachedAccessToken = session?.access_token ?? null;
  }).catch(() => {});

  supabase.auth.onAuthStateChange((_event, session) => {
    cachedAccessToken = session?.access_token ?? null;
  });
}

export const searchCheckpointFriends = async (query: string, signal?: AbortSignal): Promise<UserProfile[]> => {
  const response = await apiFetch(`/api/friends/search?q=${encodeURIComponent(query)}`, {
    authenticated: true,
    signal,
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    users?: UserProfile[];
  };
  if (!response.ok) {
    throw new Error(payload.error || "Erro ao buscar usuarios.");
  }
  return payload.users ?? [];
};

export const sendCheckpointFriendRequest = async (uid: string) => {
  const response = await apiFetch("/api/friends/request", {
    method: "POST",
    authenticated: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid }),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Erro ao enviar solicitacao.");
  }
};

export const acceptCheckpointFriendRequest = async (uid: string) => {
  const response = await apiFetch("/api/friends/accept", {
    method: "POST",
    authenticated: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid }),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    friend?: UserProfile;
  };
  if (!response.ok) {
    throw new Error(payload.error || "Erro ao aceitar solicitacao.");
  }
  return payload.friend;
};

export const rejectCheckpointFriendRequest = async (uid: string) => {
  const response = await apiFetch("/api/friends/reject", {
    method: "POST",
    authenticated: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid }),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Erro ao rejeitar solicitacao.");
  }
};

export const removeCheckpointFriend = async (uid: string) => {
  const response = await apiFetch("/api/friends/unfriend", {
    method: "POST",
    authenticated: true,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ uid }),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Erro ao remover amigo.");
  }
};

export const updateCheckpointPresence = async (
  status: "online" | "playing" | "streaming" | "in_call" | "idle" | "dnd" | "offline",
  currentGameTitle?: string,
  customDisplayName?: string,
  customPhotoURL?: string | null,
  /** Só para diagnóstico: o que disparou este envio (interval, initial, pref-event). */
  trigger = "unknown",
) => {
  const session = await getUsableSession();
  if (!session?.user) {
    presenceDebugLog("heartbeat_sent", { trigger, status, skipped: "sem sessão" });
    throw new Error("Sessao expirada. Entre novamente.");
  }
  presenceDebugLog("heartbeat_sent", { trigger, status, playing: currentGameTitle ? "yes" : "no" });
  const sentAt = Date.now();

  const displayName =
    customDisplayName ||
    session.user.user_metadata?.displayName ||
    session.user.user_metadata?.display_name ||
    session.user.user_metadata?.full_name ||
    session.user.user_metadata?.name ||
    session.user.user_metadata?.nickname ||
    "Jogador";

  // Fast-path via WebSocket Realtime Broadcast
  void broadcastPresenceStatus({
    uid: session.user.id,
    displayName,
    photoURL: customPhotoURL !== undefined ? customPhotoURL : (session.user.user_metadata?.photoURL || null),
    status,
    playing: currentGameTitle || null,
    updatedAt: Date.now(),
    ...protocolFields(await getAppVersionCached()),
  }, friendAudienceForBroadcast()).catch(() => {});

  let response: Response;
  try {
    response = await apiFetch("/api/presence", {
      method: "POST",
      authenticated: true,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, currentGameTitle }),
    });
  } catch (error) {
    presenceDebugLog("heartbeat_ack", { ok: false, ms: Date.now() - sentAt, error: String(error) });
    throw error;
  }
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  presenceDebugLog("heartbeat_ack", {
    ok: response.ok,
    ms: Date.now() - sentAt,
    httpStatus: response.status,
    ...(response.ok ? {} : { error: payload.error ?? "sem mensagem" }),
  });
  if (!response.ok) {
    throw new Error(payload.error || "Erro ao atualizar presenca.");
  }
};

/**
 * Marca o usuário como offline imediatamente e de forma síncrona/keepalive
 * para garantir envio no momento exato em que a janela ou o hub é fechado.
 */
export const markCheckpointOfflineSync = (
  uid: string,
  customDisplayName?: string,
  customPhotoURL?: string | null,
  /** Só para diagnóstico: o evento que pediu o offline (pagehide, beforeunload...). */
  origin = "unknown",
) => {
  presenceDebugLog("offline_trigger", { origin, mode: "sync" });
  try {
    const presencePayload = {
      uid,
      displayName: customDisplayName || "Jogador",
      photoURL: customPhotoURL || null,
      status: "offline" as const,
      playing: null,
      updatedAt: Date.now(),
      ...protocolFields(peekAppVersion()),
    };

    // 1. Notificação instantânea via WebSocket para amigos conectados
    void broadcastPresenceStatus(presencePayload, friendAudienceForBroadcast()).catch(() => {});

    // 2. Persistência HTTP com keepalive para o backend registrar offline mesmo fechando o processo
    const token = cachedAccessToken;
    const tokenQuery = token
      ? `?token=${encodeURIComponent(token)}&status=offline`
      : `?status=offline`;
    const url = apiUrl(`/api/presence${tokenQuery}`);
    const body = JSON.stringify({ status: "offline", currentGameTitle: null, token });

    if (typeof navigator !== "undefined" && navigator.sendBeacon) {
      const blob = new Blob([body], { type: "application/json" });
      const sent = navigator.sendBeacon(url, blob);
      if (!sent && typeof fetch !== "undefined") {
        void fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } else if (typeof fetch !== "undefined") {
      void fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body,
        keepalive: true,
      }).catch(() => {});
    }
  } catch {}
};

/**
 * Versão assíncrona para ser aguardada com precisão no handshake de encerramento
 */
export const markCheckpointOfflineAsync = async (
  uid: string,
  customDisplayName?: string,
  customPhotoURL?: string | null,
  /** Só para diagnóstico: o evento que pediu o offline. */
  origin = "unknown",
) => {
  presenceDebugLog("offline_trigger", { origin, mode: "async" });
  const presencePayload = {
    uid,
    displayName: customDisplayName || "Jogador",
    photoURL: customPhotoURL || null,
    status: "offline" as const,
    playing: null,
    updatedAt: Date.now(),
    ...protocolFields(peekAppVersion()),
  };

  const token = cachedAccessToken;
  const tokenQuery = token ? `?token=${encodeURIComponent(token)}&status=offline` : `?status=offline`;
  const url = apiUrl(`/api/presence${tokenQuery}`);
  const body = JSON.stringify({ status: "offline", currentGameTitle: null, token });

  await Promise.allSettled([
    broadcastPresenceStatus(presencePayload, friendAudienceForBroadcast()),
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body,
      keepalive: true,
    }),
  ]);
};

export const getCheckpointFriendStatuses = async (): Promise<UserProfile[]> => {
  const response = await apiFetch("/api/friends/status", {
    authenticated: true,
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    friends?: UserProfile[];
  };
  if (!response.ok) {
    throw new Error(payload.error || "Erro ao consultar presenca dos amigos.");
  }
  presenceDebugLog("friend_poll", {
    count: payload.friends?.length ?? 0,
    // idade do dado segundo o servidor: se passar de ~90 s o amigo aparece como offline
    friends: (payload.friends ?? []).slice(0, 20).map((f) => ({
      uid: shortUid(f.uid),
      status: f.status,
      ageSec:
        typeof f.updatedAt === "number" || typeof f.updatedAt === "string"
          ? Math.round((Date.now() - parsePresenceUpdatedAt(f.updatedAt)) / 1000)
          : null,
    })),
  });
  return payload.friends ?? [];
};

export const fetchUserGamesForProfile = async (
  uid: string,
  userProfile?: UserProfile | null,
): Promise<Game[]> => {
  // 1. Se for o usuário da sessão desktop local, tenta primeiro a base SQLite
  if (window.electronAPI?.listLocalGames) {
    try {
      const session = await getUsableSession();
      if (session?.user?.id === uid || uid === "local") {
        const local = await window.electronAPI.listLocalGames(uid);
        if (Array.isArray(local) && local.length > 0) {
          return local as Game[];
        }
      }
    } catch {}
  }

  // 2. Tenta buscar da tabela user_games no Supabase
  try {
    const { data: userGamesRows, error } = await supabase
      .from("user_games")
      .select("id, title, launcher_type, hours_played, steam_app_id, epic_catalog_id, is_favorite, data, updated_at")
      .eq("user_id", uid)
      .order("hours_played", { ascending: false });

    if (!error && Array.isArray(userGamesRows) && userGamesRows.length > 0) {
      const mapped = userGamesRows.map((row) => {
        const d = (row.data && typeof row.data === "object") ? row.data : {};
        const img = d.image || d.cardImage || "";
        const played = Number(d.hoursPlayed ?? row.hours_played ?? 0);
        return {
          ...d,
          id: String(row.id),
          title: String(d.title || row.title || "Jogo"),
          image: img,
          cardImage: d.cardImage || img,
          backgroundImage: d.backgroundImage || img,
          launcherType: d.launcherType || row.launcher_type || "local",
          hoursPlayed: played,
          steamAppId: d.steamAppId || row.steam_app_id || undefined,
          epicCatalogId: d.epicCatalogId || row.epic_catalog_id || undefined,
          isFavorite: Boolean(d.isFavorite ?? row.is_favorite),
          totalAchievements: d.totalAchievements ?? 0,
          completedAchievements: d.completedAchievements ?? 0,
        } as Game;
      });
      return mapped;
    }
  } catch (err) {
    console.warn("[fetchUserGamesForProfile] Erro ao buscar jogos da nuvem:", err);
  }

  // 3. Se a conta tiver steamId vinculada, busca jogos públicos da Steam
  const targetSteamId = userProfile?.steamId;
  if (targetSteamId && /^\d{10,20}$/.test(String(targetSteamId).trim())) {
    const cleanSteamId = String(targetSteamId).trim();
    let rawGames: any[] = [];

    // Tenta primeiro via Tauri command nativo (sem restrições de CORS nem conflito de sessão)
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const data: any = await invoke("steam_fetch_public_library", { steamId: cleanSteamId });
      if (data?.response?.games && Array.isArray(data.response.games)) {
        rawGames = data.response.games;
      }
    } catch (e) {
      console.warn("[fetchUserGamesForProfile] Falha ao invocar steam_fetch_public_library:", e);
    }

    // Fallback: tenta fetchSteamLibrary
    if (rawGames.length === 0) {
      try {
        const steamLib = await fetchSteamLibrary(cleanSteamId);
        if (steamLib?.games && Array.isArray(steamLib.games)) {
          rawGames = steamLib.games;
        }
      } catch {
        // Ignora silenciosamente se o perfil não tiver biblioteca pública
      }
    }

    if (rawGames.length > 0) {
      const steamGames: Game[] = rawGames.map((owned: any) => {
        const appId = String(owned.appid);
        const coverImage = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900_2x.jpg`;
        const heroImage = `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appId}/library_hero.jpg`;
        const playtimeMinutes = Number(owned.playtime_forever || 0);
        const playedHours = Math.round((playtimeMinutes / 60) * 10) / 10;
        return {
          id: `${uid}_steam_${appId}`,
          title: owned.name || `Steam App ${appId}`,
          image: coverImage,
          cardImage: coverImage,
          backgroundImage: heroImage,
          launcherType: "steam",
          steamAppId: appId,
          hoursPlayed: playedHours,
          steamPlaytimeMinutes: playtimeMinutes,
          totalPlaytimeMinutes: playtimeMinutes,
          steamLastPlayedAt: owned.rtime_last_played ? new Date(owned.rtime_last_played * 1000).toISOString() : "",
          isFavorite: false,
          totalAchievements: 0,
          completedAchievements: 0,
          sortOrder: 0,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        } as Game;
      });
      steamGames.sort((a, b) => (b.hoursPlayed || 0) - (a.hoursPlayed || 0));

      // Busca conquistas da Steam em lote para os jogos com tempo jogado
      const playedGamesWithAppId = steamGames
        .filter((g) => (g.steamPlaytimeMinutes || 0) > 0 && g.steamAppId)
        .slice(0, 30);

      if (playedGamesWithAppId.length > 0) {
        const appIds = playedGamesWithAppId.map((g) => String(g.steamAppId));
        try {
          const { invoke } = await import("@tauri-apps/api/core");
          const achievementsMap = await invoke<Record<string, { total: number; unlocked: number }>>(
            "steam_fetch_player_achievements_batch",
            { steamId: cleanSteamId, appIds }
          );

          if (achievementsMap && typeof achievementsMap === "object") {
            for (const game of steamGames) {
              if (game.steamAppId && achievementsMap[game.steamAppId]) {
                const ach = achievementsMap[game.steamAppId];
                game.totalAchievements = Number(ach.total) || 0;
                game.completedAchievements = Number(ach.unlocked) || 0;
              }
            }
          }
        } catch (err) {
          console.warn("[fetchUserGamesForProfile] Falha ao carregar conquistas em lote via Tauri:", err);
        }

        // Calcula totais consolidados para exibir no card de conquistas do perfil
        const totalUnlocked = steamGames.reduce((acc, g) => acc + (g.completedAchievements || 0), 0);
        const totalAvailable = steamGames.reduce((acc, g) => acc + (g.totalAchievements || 0), 0);
        const gamesWithAchs = steamGames.filter((g) => (g.totalAchievements || 0) > 0).length;

        if (userProfile && (!userProfile.achievementSummary || !userProfile.achievementSummary.available)) {
          userProfile.achievementSummary = {
            unlocked: totalUnlocked,
            available: totalAvailable,
            gamesWithAchievements: gamesWithAchs,
          };
        }
      }

      return steamGames;
    }
  }

  return [];
};

/**
 * O backend do Render e o Supabase não concordam no formato dos campos: um
 * devolve `banner_url`, o outro `bannerURL`. Só o caminho do Supabase mapeava,
 * então o banner (e qualquer campo só-snake) sumia no perfil de outra pessoa.
 */
const normalizeProfileCasing = (input: UserProfile): UserProfile => {
  const row = input as unknown as Record<string, unknown>;
  const pick = (...keys: string[]) => {
    for (const key of keys) {
      const value = row[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
    return undefined;
  };
  return {
    ...input,
    displayName: (pick("displayName", "display_name") as string) ?? null,
    photoURL: (pick("photoURL", "photo_url") as string) ?? null,
    bannerURL: (pick("bannerURL", "banner_url") as string) ?? null,
    profileVisibility: (pick("profileVisibility", "profile_visibility") as UserProfile["profileVisibility"]) ?? "public",
    favoriteGenres: pick("favoriteGenres", "favorite_genres") as UserProfile["favoriteGenres"],
    steamUsername: pick("steamUsername", "steam_username") as string | undefined,
    steamAvatar: pick("steamAvatar", "steam_avatar") as string | undefined,
    discordUsername: pick("discordUsername", "discord_username") as string | undefined,
    discordAvatar: pick("discordAvatar", "discord_avatar") as string | undefined,
    achievementSummary: pick("achievementSummary", "achievement_summary") as UserProfile["achievementSummary"],
    librarySummary: pick("librarySummary", "library_summary") as UserProfile["librarySummary"],
  };
};

export const getCheckpointFriendProfile = async (
  uid: string,
): Promise<{ profile: UserProfile; games: Game[] }> => {
  let profile: UserProfile | null = null;
  let games: Game[] = [];

  try {
    const response = await apiFetch(`/api/friends/${encodeURIComponent(uid)}/profile`, {
      authenticated: true,
    });
    if (response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        profile?: UserProfile;
        games?: Game[];
      };
      if (payload.profile) {
        profile = normalizeProfileCasing(payload.profile);
        if (Array.isArray(payload.games) && payload.games.length > 0) {
          games = payload.games;
        }
      }
    }
  } catch {}

  // Fallback: consulta tabela de profiles no Supabase
  if (!profile) {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select(PUBLIC_PROFILE_COLUMNS)
      .eq("uid", uid)
      .maybeSingle<Record<string, any>>();

    if (profileRow) {
      profile = {
        uid,
        email: profileRow.email ?? null,
        displayName: profileRow.displayName ?? profileRow.display_name ?? null,
        photoURL: profileRow.photoURL ?? profileRow.photo_url ?? null,
        bannerURL: profileRow.bannerURL ?? profileRow.banner_url ?? null,
        profileVisibility: profileRow.profileVisibility ?? profileRow.profile_visibility ?? "public",
        bio: profileRow.bio,
        location: profileRow.location,
        pronouns: profileRow.pronouns,
        website: profileRow.website,
        favoriteGenres: profileRow.favoriteGenres ?? profileRow.favorite_genres,
        steamId: profileRow.steamId ?? profileRow.steam_id,
        steamAvatar: profileRow.steamAvatar ?? profileRow.steam_avatar,
        steamUsername: profileRow.steamUsername ?? profileRow.steam_username,
        discordId: profileRow.discordId ?? profileRow.discord_id,
        discordUsername: profileRow.discordUsername ?? profileRow.discord_username,
        discordAvatar: profileRow.discordAvatar ?? profileRow.discord_avatar,
        retroAchievementsUlid: profileRow.retroAchievementsUlid ?? profileRow.retroachievements_ulid,
        retroAchievementsUsername: profileRow.retroAchievementsUsername ?? profileRow.retroachievements_username,
        status: profileRow.status,
        playing: profileRow.playing,
        achievementSummary: profileRow.achievementSummary ?? profileRow.achievement_summary,
        librarySummary: profileRow.librarySummary ?? profileRow.library_summary,
      };
    }
  }

  // Consulta também public_profiles para enriquecer estatísticas, conquistas e jogos favoritos
  let publicProfileRow: any = null;
  try {
    const { data } = await supabase
      .from("public_profiles")
      .select("*")
      .eq("uid", uid)
      .maybeSingle();
    publicProfileRow = data;
    if (publicProfileRow && profile) {
      if (
        publicProfileRow.achievements &&
        (publicProfileRow.achievements.unlocked != null || publicProfileRow.achievements.total != null)
      ) {
        profile.achievementSummary = {
          unlocked: Number(publicProfileRow.achievements.unlocked) || 0,
          available: Number(publicProfileRow.achievements.total || publicProfileRow.achievements.available) || 0,
          gamesWithAchievements: Number(publicProfileRow.achievements.gamesWithAchievements) || 0,
        };
      }
      if (publicProfileRow.stats && Object.keys(publicProfileRow.stats).length > 0) {
        profile.librarySummary = {
          ...profile.librarySummary,
          ...publicProfileRow.stats,
        };
      }
      // A API do Render é um serviço à parte e não conhece as colunas de mídia
      // (banner_url entrou na migration 20261008000000_profile_media). Como
      // profile.ts grava o banner nas duas tabelas, public_profiles fecha a
      // lacuna sem mais nenhuma consulta.
      if (!profile.bannerURL && publicProfileRow.banner_url) {
        profile.bannerURL = String(publicProfileRow.banner_url);
      }
      if (!profile.photoURL && publicProfileRow.photo_url) {
        profile.photoURL = String(publicProfileRow.photo_url);
      }
    }
  } catch (e) {
    console.warn("[getCheckpointFriendProfile] Erro ao consultar public_profiles:", e);
  }

  if (!profile) {
    throw new Error("Perfil do amigo nao encontrado.");
  }

  // Se ainda não temos os jogos, busca do Supabase / Steam / Local
  if (games.length === 0) {
    games = await fetchUserGamesForProfile(uid, profile);
  }

  // Marca os jogos favoritos caso o usuário possua lista no perfil público
  if (
    publicProfileRow &&
    Array.isArray(publicProfileRow.favorite_games) &&
    publicProfileRow.favorite_games.length > 0
  ) {
    const favSet = new Set(
      publicProfileRow.favorite_games.map((f: any) =>
        String(f.id || f.steamAppId || f.title || "").toLowerCase()
      )
    );
    for (const g of games) {
      if (
        favSet.has(String(g.id).toLowerCase()) ||
        (g.steamAppId && favSet.has(String(g.steamAppId).toLowerCase())) ||
        favSet.has(String(g.title).toLowerCase())
      ) {
        g.isFavorite = true;
      }
    }
  }

  return {
    profile,
    games,
  };
};
