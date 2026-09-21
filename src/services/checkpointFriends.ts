
import { supabase } from "./supabase";
import type { Game, UserProfile } from "../types/domain";
import { apiUrl, getUsableSession } from "./api";
import { broadcastPresenceStatus, getPresenceAudienceUids } from "./realtimeEventBus";
import { fetchSteamLibrary } from "./steam";

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

const getAuthHeaders = async () => {
  const session = await getUsableSession();
  if (session?.access_token) {
    cachedAccessToken = session.access_token;
  }
  if (!session?.access_token) throw new Error("Sessao expirada. Entre novamente.");
  return {
    Authorization: `Bearer ${session.access_token}`,
    "Content-Type": "application/json",
  };
};

export const searchCheckpointFriends = async (query: string, signal?: AbortSignal): Promise<UserProfile[]> => {
  const response = await fetch(apiUrl(`/api/friends/search?q=${encodeURIComponent(query)}`), {
    headers: await getAuthHeaders(),
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
  const response = await fetch(apiUrl("/api/friends/request"), {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ uid }),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Erro ao enviar solicitacao.");
  }
};

export const acceptCheckpointFriendRequest = async (uid: string) => {
  const response = await fetch(apiUrl("/api/friends/accept"), {
    method: "POST",
    headers: await getAuthHeaders(),
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
  const response = await fetch(apiUrl("/api/friends/reject"), {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ uid }),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Erro ao rejeitar solicitacao.");
  }
};

export const removeCheckpointFriend = async (uid: string) => {
  const response = await fetch(apiUrl("/api/friends/unfriend"), {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ uid }),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
  if (!response.ok) {
    throw new Error(payload.error || "Erro ao remover amigo.");
  }
};

export const updateCheckpointPresence = async (
  status: "online" | "playing" | "offline",
  currentGameTitle?: string,
  customDisplayName?: string,
  customPhotoURL?: string | null,
) => {
  const session = await getUsableSession();
  if (!session?.user) {
    throw new Error("Sessao expirada. Entre novamente.");
  }

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
  }, friendAudienceForBroadcast()).catch(() => {});

  const response = await fetch(apiUrl("/api/presence"), {
    method: "POST",
    headers: await getAuthHeaders(),
    body: JSON.stringify({ status, currentGameTitle }),
  });
  const payload = (await response.json().catch(() => ({}))) as { error?: string };
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
) => {
  try {
    const presencePayload = {
      uid,
      displayName: customDisplayName || "Jogador",
      photoURL: customPhotoURL || null,
      status: "offline" as const,
      playing: null,
      updatedAt: Date.now(),
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
) => {
  const presencePayload = {
    uid,
    displayName: customDisplayName || "Jogador",
    photoURL: customPhotoURL || null,
    status: "offline" as const,
    playing: null,
    updatedAt: Date.now(),
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
  const response = await fetch(apiUrl("/api/friends/status"), {
    headers: await getAuthHeaders(),
  });
  const payload = (await response.json().catch(() => ({}))) as {
    error?: string;
    friends?: UserProfile[];
  };
  if (!response.ok) {
    throw new Error(payload.error || "Erro ao consultar presenca dos amigos.");
  }
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

export const getCheckpointFriendProfile = async (
  uid: string,
): Promise<{ profile: UserProfile; games: Game[] }> => {
  let profile: UserProfile | null = null;
  let games: Game[] = [];

  try {
    const response = await fetch(apiUrl(`/api/friends/${encodeURIComponent(uid)}/profile`), {
      headers: await getAuthHeaders(),
    });
    if (response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        profile?: UserProfile;
        games?: Game[];
      };
      if (payload.profile) {
        profile = payload.profile;
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
      .select("*")
      .eq("uid", uid)
      .maybeSingle();

    if (profileRow) {
      profile = {
        uid,
        email: profileRow.email ?? null,
        displayName: profileRow.displayName ?? profileRow.display_name ?? null,
        photoURL: profileRow.photoURL ?? profileRow.photo_url ?? null,
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
