import { supabase } from "./supabase";
import {
  AUTH_TIMEOUT_MS,
  AuthRequiredError,
  apiFetch,
  apiUrl,
  getAuthHeaders,
  getUsableSession,
} from "./api";
import type { Game, SteamOwnedGame } from "../types/domain";
import type { LauncherLanguage } from "../context/PreferencesContext";
import {
  bulkUpsertLibraryGames,
  listLibraryGames,
} from "./localLibrary";

const clean = <T extends Record<string, unknown>>(obj: T) => {
  const newObj = { ...obj };
  Object.keys(newObj).forEach(
    (key) => newObj[key as keyof T] === undefined && delete newObj[key as keyof T],
  );
  return newObj;
};

interface SteamLibraryResponse {
  steamId: string;
  gameCount?: number;
  games: SteamOwnedGame[];
}

type SteamAchievementSummary = Record<
  string,
  { total: number; unlocked: number }
>;

interface SteamAchievementSummaryResult {
  stats: SteamAchievementSummary;
  requested: number;
  resolved: number;
  failedAppIds: string[];
}

export interface SteamCurrentGameResult {
  observable: boolean;
  appId: string | null;
  title: string | null;
  visibilityState: number;
}



type ElectronLinkedAuthResult = {
  ok?: boolean;
  provider?: string;
  requestId?: string;
  url?: string;
  opened?: boolean;
};

const getElectronApi = () =>
  typeof window !== "undefined" ? (window.electronAPI as any) : null;

/**
 * Resolve a URL de OAuth da Steam.
 *
 * No Electron empacotado, a chamada autenticada ao backend acontece no main
 * process via IPC, evitando CORS de `file://` -> Render. Mantemos o retorno da
 * URL por compatibilidade com o fluxo atual de useAccountConnections, que abre
 * a URL usando `openExternalUrl`.
 *
 * No browser comum, fazemos fallback para o backend via apiFetch().
 */
export const getSteamLinkUrl = async (): Promise<string> => {
  const session = await getUsableSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new AuthRequiredError(
      "Sessão expirada. Entre novamente para sincronizar a Steam.",
    );
  }

  const electronApi = getElectronApi();
  if (typeof electronApi?.startLinkedAccountBrowser === "function") {
    const result = (await electronApi.startLinkedAccountBrowser(
      "steam",
      accessToken,
      { openBrowser: false },
    )) as ElectronLinkedAuthResult | null;

    if (!result?.ok || !result.url) {
      throw new Error(
        "O processo principal não retornou a URL de autenticação da Steam.",
      );
    }

    return result.url;
  }

  // Browser/web fallback. apiFetch centraliza sessão, timeout e diagnóstico.
  const response = await apiFetch("/auth/steam/start", {
    method: "POST",
    authenticated: true,
    timeoutMs: AUTH_TIMEOUT_MS,
  });

  const payload = (await response
    .json()
    .catch(() => ({}))) as { url?: string; error?: string };

  if (!response.ok) {
    throw new Error(
      payload.error || "Não foi possível iniciar a conexão com a Steam.",
    );
  }

  if (!payload.url) {
    throw new Error("Backend não retornou a URL de autenticação da Steam.");
  }

  return payload.url;
};

export const disconnectSteamAccount = async () => {
  const response = await apiFetch("/api/steam/disconnect", {
    method: "POST",
    authenticated: true,
    timeoutMs: AUTH_TIMEOUT_MS,
  });

  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => ({}))) as { error?: string };

    throw new Error(payload.error || "Falha ao desconectar Steam.");
  }
};

export const fetchSteamAppSizeGB = async (appId: string) => {
  if (!/^\d+$/.test(appId)) return undefined;
  const response = await fetch(
    apiUrl(`/api/steam/app-size?appId=${encodeURIComponent(appId)}`),
  );
  if (!response.ok) return undefined;
  const payload = (await response.json()) as { sizeGB?: number | null };
  return typeof payload.sizeGB === "number" ? payload.sizeGB : undefined;
};

export interface SteamAppDetails {
  appId: string;
  title?: string;
  cardImage?: string;
  backgroundImage?: string;
  logoImage?: string;
  description?: string;
  aboutTheGame?: string;
  screenshots?: string[];
  releaseDate?: string;
  developer?: string;
  publisher?: string;
  tags?: string[];
  trailerUrl?: string;
  trailerThumbnail?: string;
  sizeGB?: number | null;
  pcRequirements?: { minimum?: string; recommended?: string } | null;
  supportedLanguages?: string | null;
  metacritic?: { score: number; url: string } | null;
  priceOverview?: { currency: string; initial: number; final: number; discount_percent: number; final_formatted: string } | null;
  dlc?: number[];
}

export interface SteamAchievement {
  apiName: string;
  achieved: boolean;
  unlockTime: number;
  name: string;
  description: string;
  icon: string;
  iconGray: string;
  hidden: boolean;
  percent?: number;
}

export const mapSteamTagsToCategory = (tags?: string[]): string => {
  if (!tags || !tags.length) return "ACTION";
  const str = tags.join(" ").toLowerCase();
  if (str.includes("rpg")) return "RPG";
  if (str.includes("strategy") || str.includes("estratégia")) return "STRATEGY";
  if (str.includes("fps") || str.includes("shooter") || str.includes("tiro")) return "FPS";
  if (str.includes("racing") || str.includes("corrida")) return "RACING";
  if (str.includes("sports") || str.includes("esporte")) return "SPORTS";
  if (str.includes("simulation") || str.includes("simulação")) return "SIMULATION";
  if (str.includes("puzzle") || str.includes("quebra-cabeça")) return "PUZZLE";
  if (str.includes("indie")) return "INDIE";
  if (str.includes("adventure") || str.includes("aventura")) return "ADVENTURE";
  if (str.includes("survival") || str.includes("sobrevivência")) return "SURVIVAL";
  if (str.includes("horror") || str.includes("terror")) return "HORROR";
  return "ACTION";
};

export type SteamAppDetailsFetchResult =
  | { ok: true; data: SteamAppDetails }
  | { ok: false; message: string };

export const fetchSteamAppDetailsResult = async (
  appId: string,
  language: LauncherLanguage = "pt-BR",
): Promise<SteamAppDetailsFetchResult> => {
  if (!/^\d+$/.test(appId)) {
    return { ok: false, message: "App ID deve conter só dígitos." };
  }
  const url = apiUrl(
    `/api/steam/app-details?appId=${encodeURIComponent(appId)}&language=${encodeURIComponent(language)}`,
  );
  try {
    const response = await fetch(url);
    const body = (await response
      .json()
      .catch(() => ({}))) as SteamAppDetails & { error?: string };
    if (!response.ok || body.error) {
      const fromApi = typeof body.error === "string" ? body.error : null;
      const message =
        fromApi ||
        (response.status === 502
          ? "O backend não conseguiu obter dados na Steam (502)."
          : `O backend respondeu com erro HTTP ${response.status}.`);
      return { ok: false, message };
    }
    return { ok: true, data: body as SteamAppDetails };
  } catch (e) {
    const msg = String(e instanceof Error ? e.message : e).toLowerCase();
    const looksLikeNetwork =
      e instanceof TypeError ||
      msg.includes("failed to fetch") ||
      msg.includes("network");
    return {
      ok: false,
      message: looksLikeNetwork
        ? "Backend inacessível (porta 8787). Em outro terminal: npm run server. Ou: npm run dev:full. Teste no browser: http://localhost:8787/health"
        : e instanceof Error
          ? e.message
          : "Falha de rede ao buscar dados da loja Steam.",
    };
  }
};

export const fetchSteamAchievements = async (
  steamId: string,
  appId: string,
) => {
  const url = apiUrl(
    `/api/steam/achievements?steamId=${encodeURIComponent(steamId)}&appId=${encodeURIComponent(appId)}`,
  );
  try {
    const response = await fetch(url, { headers: await getAuthHeaders() });
    if (!response.ok) return { total: 0, unlocked: 0 };
    const data = await response.json();
    return {
      total: data.total || 0,
      unlocked: data.unlocked || 0,
    };
  } catch {
    return { total: 0, unlocked: 0 };
  }
};

const achievementMemoryCache = new Map<
  string,
  {
    achievements: SteamAchievement[];
    total: number;
    unlocked: number;
    timestamp: number;
  }
>();

export const getCachedSteamAchievementDetails = (
  steamId: string,
  appId: string,
  language: LauncherLanguage = "pt-BR",
) => {
  const cacheKey = `${steamId}_${appId}_${language}`;
  const cached = achievementMemoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 1000 * 60 * 30) {
    return cached;
  }
  return null;
};

export const setCachedSteamAchievementDetails = (
  steamId: string,
  appId: string,
  data: { achievements: SteamAchievement[]; total: number; unlocked: number },
  language: LauncherLanguage = "pt-BR",
) => {
  const cacheKey = `${steamId}_${appId}_${language}`;
  achievementMemoryCache.set(cacheKey, {
    ...data,
    timestamp: Date.now(),
  });
};

export const fetchSteamAchievementDetails = async (
  steamId: string,
  appId: string,
  language: LauncherLanguage = "pt-BR",
): Promise<{
  achievements: SteamAchievement[];
  total: number;
  unlocked: number;
}> => {
  const cacheKey = `${steamId}_${appId}_${language}`;
  const cached = achievementMemoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 1000 * 60 * 15) {
    return cached;
  }

  const url = apiUrl(
    `/api/steam/achievements?steamId=${encodeURIComponent(steamId)}&appId=${encodeURIComponent(appId)}&language=${encodeURIComponent(language)}`,
  );

  try {
    const response = await fetch(url, { headers: await getAuthHeaders() });
    if (!response.ok) {
      return cached || { achievements: [], total: 0, unlocked: 0 };
    }

    const data = (await response.json()) as {
      achievements?: SteamAchievement[];
      total?: number;
      unlocked?: number;
    };

    const result = {
      achievements: Array.isArray(data.achievements) ? data.achievements : [],
      total: typeof data.total === "number" ? data.total : 0,
      unlocked: typeof data.unlocked === "number" ? data.unlocked : 0,
    };

    if (result.achievements.length > 0) {
      achievementMemoryCache.set(cacheKey, {
        ...result,
        timestamp: Date.now(),
      });
    }

    return result;
  } catch {
    return cached || { achievements: [], total: 0, unlocked: 0 };
  }
};

export const fetchSteamAchievementSchema = async (
  appId: string,
  language: LauncherLanguage = "pt-BR",
): Promise<{
  achievements: SteamAchievement[];
  total: number;
  unlocked: number;
}> => {
  const cacheKey = `schema_${appId}_${language}`;
  const cached = achievementMemoryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < 1000 * 60 * 30) {
    return cached;
  }

  const url = apiUrl(
    `/api/steam/achievement-schema?appId=${encodeURIComponent(appId)}&language=${encodeURIComponent(language)}`,
  );

  try {
    const response = await fetch(url);
    if (!response.ok) {
      return cached || { achievements: [], total: 0, unlocked: 0 };
    }

    const data = (await response.json()) as {
      achievements?: SteamAchievement[];
      total?: number;
      unlocked?: number;
    };

    const result = {
      achievements: Array.isArray(data.achievements) ? data.achievements : [],
      total: typeof data.total === "number" ? data.total : 0,
      unlocked: typeof data.unlocked === "number" ? data.unlocked : 0,
    };

    if (result.achievements.length > 0) {
      achievementMemoryCache.set(cacheKey, {
        ...result,
        timestamp: Date.now(),
      });
    }

    return result;
  } catch {
    return cached || { achievements: [], total: 0, unlocked: 0 };
  }
};

export const fetchSteamAchievementsSchema = fetchSteamAchievementSchema;

export const searchSteamGames = async (query: string): Promise<any[]> => {
  const q = String(query || "").trim();
  if (q.length < 2) return [];

  // 1. Rust Tauri invoke nativo (sem problemas de CORS, rápido e seguro)
  if (typeof window !== "undefined" && window.electronAPI?.searchSteamStore) {
    try {
      const items = await window.electronAPI.searchSteamStore(q);
      if (Array.isArray(items) && items.length > 0) {
        return items.map((it: any) => ({
          id: String(it.id || it.appid),
          appid: String(it.appid || it.id),
          name: it.name || it.title || "",
          title: it.title || it.name || "",
          tiny_image: it.tiny_image || it.logo || it.icon || "",
          type: "app",
        }));
      }
    } catch (e) {
      console.warn("[searchSteamGames] searchSteamStore error:", e);
    }
  }

  // 2. Tentar endpoint do backend Pherielium
  try {
    const response = await fetch(
      apiUrl(`/api/steam/search?query=${encodeURIComponent(q)}`),
    );
    if (response.ok) {
      const payload = (await response.json()) as { items?: Array<any> };
      if (Array.isArray(payload.items) && payload.items.length > 0) {
        return payload.items.map((it) => ({
          id: String(it.id || it.appid),
          appid: String(it.appid || it.id),
          name: it.name || it.title || "",
          title: it.title || it.name || "",
          tiny_image: it.tiny_image || it.logo || it.icon || "",
          type: "app",
        }));
      }
    }
  } catch (err) {
    console.warn("[searchSteamGames] backend search error:", err);
  }

  // 3. Fallback direto da Steam Community (SearchApps)
  try {
    const cleanQ = q.replace(/[^\w\s]/gi, "").trim();
    if (cleanQ) {
      const res = await fetch(
        `https://steamcommunity.com/actions/SearchApps/${encodeURIComponent(cleanQ)}`,
      );
      if (res.ok) {
        const items = (await res.json()) as any[];
        if (Array.isArray(items) && items.length > 0) {
          return items.slice(0, 15).map((it: any) => ({
            id: String(it.appid),
            appid: String(it.appid),
            name: it.name,
            title: it.name,
            tiny_image:
              it.logo ||
              it.icon ||
              `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${it.appid}/capsule_231x87.jpg`,
            type: "app",
          }));
        }
      }
    }
  } catch (err) {
    console.warn("[searchSteamGames] direct steamcommunity search error:", err);
  }

  return [];
};

export const fetchSteamAppDetails = async (
  appId: string,
  language: LauncherLanguage = "pt-BR",
): Promise<SteamAppDetails | null> => {
  const r = await fetchSteamAppDetailsResult(appId, language);
  return r.ok ? r.data : null;
};

export const fetchSteamLibrary = async (
  steamId: string,
): Promise<SteamLibraryResponse> => {
  const response = await fetch(
    apiUrl(`/api/steam/library?steamId=${encodeURIComponent(steamId)}`),
    { headers: await getAuthHeaders() },
  );
  if (!response.ok) {
    let message = "Falha ao buscar biblioteca da Steam.";
    try {
      const body = (await response.json()) as { error?: string };
      if (body.error) message = body.error;
    } catch {
      // Preserve fallback message when the backend does not return JSON.
    }
    throw new Error(message);
  }
  return (await response.json()) as SteamLibraryResponse;
};

export const fetchSteamCurrentGame = async (): Promise<SteamCurrentGameResult> => {
  const response = await fetch(apiUrl("/api/steam/current-game"), {
    headers: await getAuthHeaders(),
  });
  if (!response.ok) {
    throw new Error("Não foi possível verificar o jogo atual na Steam.");
  }
  const payload = (await response.json()) as Partial<SteamCurrentGameResult>;
  return {
    observable: Boolean(payload.observable),
    appId: /^\d+$/.test(String(payload.appId || "")) ? String(payload.appId) : null,
    title: payload.title ? String(payload.title) : null,
    visibilityState: Math.max(0, Number(payload.visibilityState || 0)),
  };
};

export const fetchSteamAchievementSummary = async (
  appIds: string[],
): Promise<SteamAchievementSummaryResult> => {
  const normalizedAppIds = Array.from(new Set(
    appIds.map((appId) => String(appId).trim()).filter((appId) => /^\d+$/.test(appId)),
  ));
  if (normalizedAppIds.length === 0) {
    return { stats: {}, requested: 0, resolved: 0, failedAppIds: [] };
  }

  const stats: SteamAchievementSummary = {};
  const failedAppIds = new Set<string>();
  const authHeaders = await getAuthHeaders().catch(() => null);
  if (!authHeaders) {
    return {
      stats,
      requested: normalizedAppIds.length,
      resolved: 0,
      failedAppIds: normalizedAppIds,
    };
  }

  const CHUNK_SIZE = 50;
  for (let index = 0; index < normalizedAppIds.length; index += CHUNK_SIZE) {
    const chunk = normalizedAppIds.slice(index, index + CHUNK_SIZE);
    try {
      const response = await fetch(apiUrl("/api/steam/achievement-summary"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders,
        },
        body: JSON.stringify({ appIds: chunk }),
      });
      if (!response.ok) {
        chunk.forEach((appId) => failedAppIds.add(appId));
        continue;
      }

      const payload = (await response.json()) as Partial<SteamAchievementSummaryResult>;
      const chunkStats = payload.stats && typeof payload.stats === "object" ? payload.stats : {};
      chunk.forEach((appId) => {
        const entry = chunkStats[appId];
        if (!entry) {
          failedAppIds.add(appId);
          return;
        }
        stats[appId] = {
          total: Math.max(0, Number(entry.total || 0)),
          unlocked: Math.max(0, Number(entry.unlocked || 0)),
        };
      });
    } catch {
      chunk.forEach((appId) => failedAppIds.add(appId));
    }
  }

  return {
    stats,
    requested: normalizedAppIds.length,
    resolved: Object.keys(stats).length,
    failedAppIds: Array.from(failedAppIds),
  };
};

export const syncSteamLibraryToLocal = async (
  uid: string,
  steamId: string,
  language: LauncherLanguage = "pt-BR",
) => {
  // 1. Try to fetch remote library from backend
  let remoteGames: SteamOwnedGame[] = [];
  let remoteFetchError: Error | null = null;
  if (steamId) {
    try {
      const payload = await fetchSteamLibrary(steamId);
      if (payload?.games && Array.isArray(payload.games)) {
        remoteGames = payload.games;
      }
    } catch (err: any) {
      remoteFetchError = err;
      console.warn("[SteamSync] Falha ao consultar biblioteca remota da Steam:", err);
    }
  }

  // 2. Scan locally installed Steam games via Tauri
  let localInstalled: Array<{
    appid: string;
    name: string;
    installdir: string;
    executablePath?: string;
    sizeGb: number;
    lastPlayed: number;
  }> = [];

  try {
    if (window.electronAPI?.scanInstalledSteamGames) {
      localInstalled = await window.electronAPI.scanInstalledSteamGames();
    }
  } catch (err) {
    console.warn("[SteamSync] Falha ao escanear jogos locais da Steam:", err);
  }

  // 3. Fallback check: if neither source returned games, throw appropriate error
  if (remoteGames.length === 0 && localInstalled.length === 0) {
    if (remoteFetchError) {
      throw remoteFetchError;
    }
    throw new Error(
      "Nenhum jogo encontrado na Steam. Verifique se o perfil da Steam é público ou se há jogos instalados no PC.",
    );
  }

  // 4. Merge remote and local games
  type UnifiedGame = {
    appid: number;
    name?: string;
    playtime_forever?: number;
    rtime_last_played?: number;
    executablePath?: string;
    sizeGB?: number;
  };
  const unifiedMap = new Map<string, UnifiedGame>();

  for (const rg of remoteGames) {
    unifiedMap.set(String(rg.appid), {
      appid: rg.appid,
      name: rg.name,
      playtime_forever: rg.playtime_forever,
      rtime_last_played: rg.rtime_last_played,
    });
  }

  for (const lg of localInstalled) {
    const existing = unifiedMap.get(lg.appid);
    if (existing) {
      if (lg.executablePath) existing.executablePath = lg.executablePath;
      if (lg.sizeGb > 0 && !existing.sizeGB) existing.sizeGB = lg.sizeGb;
      if (lg.lastPlayed > 0 && (!existing.rtime_last_played || lg.lastPlayed > existing.rtime_last_played)) {
        existing.rtime_last_played = lg.lastPlayed;
      }
    } else {
      unifiedMap.set(lg.appid, {
        appid: Number(lg.appid) || 0,
        name: lg.name,
        playtime_forever: 0,
        rtime_last_played: lg.lastPlayed,
        executablePath: lg.executablePath,
        sizeGB: lg.sizeGb,
      });
    }
  }

  const allMergedGames = Array.from(unifiedMap.values());

  const existingGames = (await listLibraryGames(uid))
    .filter((game) => Boolean(game.steamAppId));

  const appIdToDocId = new Map<string, string>();
  const existingByAppId = new Map<string, Game>();
  existingGames.forEach((data) => {
    if (data.steamAppId) {
      appIdToDocId.set(String(data.steamAppId), data.id);
      existingByAppId.set(String(data.steamAppId), data);
    }
  });

  const detailsCache = new Map<string, SteamAppDetails | null>();

  const gamesToSync = allMergedGames;
  const gamesToEnrich = allMergedGames.slice(0, 80);
  const achievementSummaryPromise = fetchSteamAchievementSummary(
    gamesToSync.map((game) => String(game.appid)),
  );
  const CHUNK_SIZE = 10;

  for (let i = 0; i < gamesToEnrich.length; i += CHUNK_SIZE) {
    const chunk = gamesToEnrich.slice(i, i + CHUNK_SIZE);
    await Promise.all(
      chunk.map(async (owned) => {
        const appId = String(owned.appid);
        const details = await fetchSteamAppDetails(appId, language).catch(() => null);
        detailsCache.set(appId, details);
      }),
    );
  }

  const achievementSummaryResult = await achievementSummaryPromise;
  const achievementSummary = achievementSummaryResult.stats;

  const writes = allMergedGames.map((owned) => {
    const appIdStr = String(owned.appid);
    const existingDocId = appIdToDocId.get(appIdStr);
    const id = existingDocId || `${uid}_steam_${owned.appid}`;

    const buildSteamAssets = (appid: number) => ({
      image: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/library_hero.jpg`,
      cardImage: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appid}/library_600x900_2x.jpg`,
    });

    const assets = buildSteamAssets(owned.appid);
    const details = detailsCache.get(appIdStr);
    const coverImage = details?.cardImage || assets.cardImage;
    const backgroundImage = details?.backgroundImage || assets.image;
    const locallyTrackedMinutes = Math.max(
      Number(existingByAppId.get(appIdStr)?.locallyTrackedMinutes) || 0,
      owned.playtime_forever ?? 0,
    );
    const normalizedHours = Math.round((locallyTrackedMinutes / 60) * 10) / 10;
    const steamLastPlayedAt =
      owned.rtime_last_played && owned.rtime_last_played > 0
        ? new Date(owned.rtime_last_played * 1000).toISOString()
        : "";
    const resolvedDescription =
      details?.description ??
      `Importado da Steam. Dados da conta conectada. AppID ${owned.appid}.`;
    const existing = existingByAppId.get(appIdStr);
    const achievementStats = achievementSummary[appIdStr];

    const mapped: Omit<Game, "id"> = {
      title: details?.title || owned.name || `Steam App ${owned.appid}`,
      image: coverImage,
      backgroundImage,
      cardImage: coverImage,
      logoImage: details?.logoImage || "",
      category: mapSteamTagsToCategory(details?.tags) || "ACTION",
      description: resolvedDescription,
      aboutTheGame: details?.aboutTheGame || details?.description || "",
      executablePath: owned.executablePath || appIdStr,
      launcherType: "steam",
      steamAppId: appIdStr,
      steamPlaytimeMinutes: owned.playtime_forever ?? 0,
      locallyTrackedMinutes,
      steamLastPlayedAt,
      hoursPlayed: normalizedHours,
      sizeGB: Math.max(0, Math.round(details?.sizeGB ?? owned.sizeGB ?? 0)),
      totalAchievements: achievementStats?.total ?? existing?.totalAchievements ?? 0,
      completedAchievements: achievementStats?.unlocked ?? existing?.completedAchievements ?? 0,
      trailerUrl: details?.trailerUrl || "",
      trailerThumbnail: details?.trailerThumbnail || "",
      screenshots: details?.screenshots || [],
      releaseDate: details?.releaseDate || "",
      developer: details?.developer || "",
      publisher: details?.publisher || "",
      tags: details?.tags || [],
      source: "steam",
      lastSyncedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    return clean({ id, ...mapped }) as Game;
  });

  await bulkUpsertLibraryGames(uid, writes);

  try {
    await supabase
      .from("profiles")
      .update({
        ...(steamId ? { steam_id: steamId } : {}),
        last_steam_sync_at: new Date().toISOString(),
      })
      .eq("uid", uid);
  } catch (profileError) {
    console.warn("Erro ao atualizar last_steam_sync_at no perfil:", profileError);
  }

  return allMergedGames.length;
};

/** @deprecated Use syncSteamLibraryToLocal. */
export const syncSteamLibraryToFirestore = syncSteamLibraryToLocal;
