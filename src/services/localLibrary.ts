import { supabase } from "./supabase";
import type { Game, UserProfile } from "../types/domain";
import { cachedQuery, invalidate } from "../lib/queryCache";
import { getUsableSession } from "./api";

const CLOUD_PAGE_SIZE = 100;
const CLOUD_GAME_LIMIT = 500;
const PUBLIC_LIBRARY_SYNC_VERSION = 2;

/**
 * Payload enxuto para user_games.data.
 * Nunca incluir aboutTheGame (HTML), screenshots, description longa,
 * executablePath, launchProfile ou outros blobs — são a principal fonte de egress.
 */
const toSlimCloudGameData = (game: Game, hoursPlayed: number) => ({
  id: game.id,
  title: game.title,
  launcherType: game.launcherType || "local",
  hoursPlayed,
  steamAppId: game.steamAppId || undefined,
  epicCatalogId: game.epicCatalogId || undefined,
  isFavorite: Boolean(game.isFavorite),
  cardImage: game.cardImage || game.image || "",
  image: game.image || game.cardImage || "",
  lastPlayedAt: game.lastPlayedAt || undefined,
  steamLastPlayedAt: game.steamLastPlayedAt || undefined,
  totalAchievements: Number(game.totalAchievements) || 0,
  completedAchievements: Number(game.completedAchievements) || 0,
  achievementsUpdatedAt: game.achievementsUpdatedAt || undefined,
  source: game.source || undefined,
  developer: game.developer || undefined,
  publisher: game.publisher || undefined,
  releaseDate: game.releaseDate || undefined,
  // tags curtas no máximo; evita arrays enormes
  tags: Array.isArray(game.tags) ? game.tags.slice(0, 12) : undefined,
});

const hashCloudGameRow = (row: {
  id: string;
  title: string;
  launcher_type: string;
  hours_played: number;
  steam_app_id: string | null;
  epic_catalog_id: string | null;
  is_favorite: boolean;
  data: ReturnType<typeof toSlimCloudGameData>;
}): string => {
  // Hash estável e barato para diff de sync (não criptográfico).
  const payload = JSON.stringify({
    id: row.id,
    title: row.title,
    launcher_type: row.launcher_type,
    hours_played: row.hours_played,
    steam_app_id: row.steam_app_id,
    epic_catalog_id: row.epic_catalog_id,
    is_favorite: row.is_favorite,
    data: row.data,
  });
  let hash = 2166136261;
  for (let i = 0; i < payload.length; i += 1) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
};

const sorted = (games: Game[]) =>
  [...games].sort((a, b) => a.title.localeCompare(b.title));

const chunked = <T,>(items: T[], size = CLOUD_PAGE_SIZE): T[][] => {
  const chunks: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }
  return chunks;
};

/** Detecta o erro 42P10 (ON CONFLICT sem constraint unica correspondente). */
const isMissingConstraintError = (error: unknown): boolean => {
  const code = (error as { code?: string } | null)?.code;
  const message = error instanceof Error
    ? error.message
    : String((error as { message?: string } | null)?.message || "");
  return code === "42P10"
    || message.includes("no unique or exclusion constraint matching the ON CONFLICT");
};

// Evita inundar o console: o sync roda a cada mudanca na biblioteca.
let missingConstraintWarned = false;
const warnMissingConstraintOnce = (context: string, error: unknown) => {
  if (missingConstraintWarned) return;
  missingConstraintWarned = true;
  console.warn(
    `[LocalLibrary] ${context}: banco sem UNIQUE(user_id,id) — aplique as migrations (supabase db push). Usando fallback linha a linha.`,
    error,
  );
};

/**
 * Upsert resiliente de linhas de user_games.
 * 1) Tenta o caminho rapido: upsert em lote com onConflict "user_id,id".
 * 2) Se o banco nao tiver a constraint (erro 42P10), cai para upsert por "id"
 *    e, em ultimo caso, insert por linha com update em caso de conflito 23505.
 * Nunca faz upsert de array vazio (o PostgREST responde 400 nesses casos).
 * Remove _contentHash antes de enviar (campo apenas local).
 */
const upsertGameRowsResilient = async (
  rows: Array<ReturnType<typeof toCloudGameRow>>,
) => {
  if (rows.length === 0) return;

  const stripHash = (row: ReturnType<typeof toCloudGameRow>) => {
    const { _contentHash: _ignored, ...rest } = row;
    return rest;
  };

  for (const chunk of chunked(rows)) {
    if (chunk.length === 0) continue;
    const payload = chunk.map(stripHash);
    const { error: batchError } = await supabase
      .from("user_games")
      .upsert(payload, { onConflict: "user_id,id" });

    if (!batchError) continue;

    // Banco sem a constraint composta: tenta o caminho alternativo.
    if (isMissingConstraintError(batchError)) {
      warnMissingConstraintOnce("Constraint ausente em user_games", batchError);

      const { error: idConflictError } = await supabase
        .from("user_games")
        .upsert(payload, { onConflict: "id" });

      if (!idConflictError) continue;
      if (!isMissingConstraintError(idConflictError)) {
        console.error("[LocalLibrary] Erro ao upsert jogos:", idConflictError);
        throw idConflictError;
      }
      warnMissingConstraintOnce("Constraint ausente (fallback id)", idConflictError);
    } else {
      console.error("[LocalLibrary] Erro ao upsert jogos:", batchError);
      throw batchError;
    }

    // Ultimo recurso: linha a linha (insert -> update em 23505).
    for (const row of payload) {
      const { error: insertError } = await supabase
        .from("user_games")
        .insert(row);
      if (!insertError) continue;
      const insertCode = (insertError as { code?: string }).code;
      if (insertCode === "23505") {
        const { error: updateError } = await supabase
          .from("user_games")
          .update(row)
          .eq("user_id", row.user_id)
          .eq("id", row.id);
        if (updateError) {
          console.error("[LocalLibrary] Erro ao atualizar jogo:", updateError);
          throw updateError;
        }
      } else if (isMissingConstraintError(insertError)) {
        // Sem constraint alguma utilizavel: propaga como warn, nao como throw fatal.
        warnMissingConstraintOnce("Insert sem constraint", insertError);
      } else {
        console.error("[LocalLibrary] Erro ao inserir jogo:", insertError);
        throw insertError;
      }
    }
  }
};

const toCloudGameRow = (uid: string, game: Game) => {
  const calculatedMinutes = Math.max(
    0,
    Number(game.steamPlaytimeMinutes) || 0,
    Number(game.locallyTrackedMinutes) || 0,
    Math.round((Number(game.hoursPlayed) || 0) * 60),
  );
  const hoursPlayed = calculatedMinutes > 0
    ? Number((calculatedMinutes / 60).toFixed(1))
    : (Number(game.hoursPlayed) || 0);

  const data = toSlimCloudGameData(game, hoursPlayed);

  return {
    id: game.id,
    user_id: uid,
    title: game.title,
    launcher_type: game.launcherType || "local",
    hours_played: hoursPlayed,
    steam_app_id: game.steamAppId || null,
    epic_catalog_id: game.epicCatalogId || null,
    is_favorite: Boolean(game.isFavorite),
    data,
    updated_at: new Date().toISOString(),
    _contentHash: hashCloudGameRow({
      id: game.id,
      title: game.title,
      launcher_type: game.launcherType || "local",
      hours_played: hoursPlayed,
      steam_app_id: game.steamAppId || null,
      epic_catalog_id: game.epicCatalogId || null,
      is_favorite: Boolean(game.isFavorite),
      data,
    }),
  };
};

const fromCloudGameRow = (row: Record<string, any>): Game => ({
  ...(row.data || {}),
  id: String(row.id),
  title: String(row.data?.title || row.title || "Jogo"),
  launcherType: row.data?.launcherType || row.launcher_type || "local",
  hoursPlayed: Number(row.data?.hoursPlayed ?? row.hours_played ?? 0),
  steamAppId: row.data?.steamAppId || row.steam_app_id || undefined,
  epicCatalogId: row.data?.epicCatalogId || row.epic_catalog_id || undefined,
  isFavorite: Boolean(row.data?.isFavorite ?? row.is_favorite),
});

const syncLocalGamesToCloud = async (uid: string) => {
  if (!window.electronAPI?.listLocalGames) return;

  // Verificar se temos uma sessão válida antes de tentar sincronizar
  const session = await getUsableSession();
  if (!session) {
    console.warn("[LocalLibrary] Sessão expirada ou inválida, pulando sync de biblioteca");
    throw new Error("Sessão expirada. Por favor, faça login novamente.");
  }

  const localGames = await window.electronAPI.listLocalGames(uid);
  const normalizedGames = Array.isArray(localGames)
    ? localGames.slice(0, CLOUD_GAME_LIMIT)
    : [];
  const rows = normalizedGames.map((game) => toCloudGameRow(uid, game));

  // Diff: só envia linhas cujo hash mudou vs o que já está na nuvem (payload slim).
  const existingById = new Map<string, string>();
  {
    let from = 0;
    while (from < CLOUD_GAME_LIMIT) {
      const { data: existingPage, error: existingPageError } = await supabase
        .from("user_games")
        .select("id,title,launcher_type,hours_played,steam_app_id,epic_catalog_id,is_favorite,data")
        .eq("user_id", uid)
        .range(from, from + CLOUD_PAGE_SIZE - 1);
      if (existingPageError) {
        console.warn("[LocalLibrary] Diff de sync indisponível; fazendo upsert completo:", existingPageError.message);
        existingById.clear();
        break;
      }
      if (!existingPage || existingPage.length === 0) break;
      for (const row of existingPage) {
        const slimData = toSlimCloudGameData(
          {
            id: String(row.id),
            title: String(row.title || ""),
            launcherType: row.launcher_type || "local",
            hoursPlayed: Number(row.hours_played) || 0,
            steamAppId: row.steam_app_id || undefined,
            epicCatalogId: row.epic_catalog_id || undefined,
            isFavorite: Boolean(row.is_favorite),
            ...(row.data && typeof row.data === "object" ? row.data : {}),
          } as Game,
          Number(row.hours_played) || 0,
        );
        existingById.set(
          String(row.id),
          hashCloudGameRow({
            id: String(row.id),
            title: String(row.title || slimData.title || ""),
            launcher_type: String(row.launcher_type || slimData.launcherType || "local"),
            hours_played: Number(row.hours_played) || 0,
            steam_app_id: row.steam_app_id || null,
            epic_catalog_id: row.epic_catalog_id || null,
            is_favorite: Boolean(row.is_favorite),
            data: slimData,
          }),
        );
      }
      if (existingPage.length < CLOUD_PAGE_SIZE) break;
      from += CLOUD_PAGE_SIZE;
    }
  }

  const dirtyRows = existingById.size === 0
    ? rows
    : rows.filter((row) => existingById.get(String(row.id)) !== row._contentHash);

  if (dirtyRows.length > 0) {
    await upsertGameRowsResilient(dirtyRows);
  }

  // Remove da cópia pública jogos que já não existem na biblioteca local.
  // Isso evita perfis exibindo jogos antigos após exclusões/desconexões.
  const { data: existingRows, error: existingError } = await supabase
    .from("user_games")
    .select("id")
    .eq("user_id", uid);

  if (existingError) {
    console.error("[LocalLibrary] Erro ao buscar jogos existentes:", existingError);
    throw existingError;
  }

  const desiredIds = new Set(rows.map((row) => String(row.id)));
  const staleIds = (existingRows || [])
    .map((row) => String(row.id))
    .filter((id) => !desiredIds.has(id));

  for (const staleChunk of chunked(staleIds)) {
    const { error: deleteError } = await supabase
      .from("user_games")
      .delete()
      .eq("user_id", uid)
      .in("id", staleChunk);

    if (deleteError) {
      console.error("[LocalLibrary] Erro ao deletar jogos antigos:", deleteError);
      throw deleteError;
    }
  }
};

export const listLibraryGames = async (uid: string): Promise<Game[]> => {
  if (window.electronAPI?.listLocalGames) {
    return sorted(await window.electronAPI.listLocalGames(uid));
  }
  const cacheKey = `games:list:${uid}`;
  return cachedQuery(
    cacheKey,
    async () => {
      // Paginate to avoid huge single egress burst (100 rows per page)
      let allRows: Record<string, any>[] = [];
      let from = 0;
      while (true) {
        const { data, error } = await supabase
          .from("user_games")
          .select("id,title,launcher_type,hours_played,steam_app_id,epic_catalog_id,is_favorite,data,updated_at")
          .eq("user_id", uid)
          .order("title", { ascending: true })
          .range(from, from + CLOUD_PAGE_SIZE - 1);
        if (error || !data) break;
        allRows.push(...(data as Record<string, any>[]));
        if (data.length < CLOUD_PAGE_SIZE) break;
        from += CLOUD_PAGE_SIZE;
        // Safety: cap at 500 games (5 pages) to avoid runaway egress
        if (from >= CLOUD_GAME_LIMIT) break;
      }
      if (allRows.length === 0) return [] as Game[];
      return sorted(allRows.map((row) => fromCloudGameRow(row)));
    },
    { ttl: 30_000, stale: 60_000 },
  );
};

export const createLibraryGame = async (
  uid: string,
  game: Omit<Game, "id"> & { id?: string },
): Promise<Game> => {
  if (window.electronAPI?.createLocalGame) {
    return window.electronAPI.createLocalGame(uid, game);
  }
  const id = game.id || crypto.randomUUID();
  const newGame = { ...game, id } as Game;
  const { error } = await supabase.from("user_games").insert(toCloudGameRow(uid, newGame));
  if (error) throw error;
  invalidate(`games:list:${uid}`);
  return newGame;
};

export const updateLibraryGame = async (
  uid: string,
  gameId: string,
  patch: Partial<Game>,
): Promise<Game | null> => {
  if (window.electronAPI?.updateLocalGame) {
    return window.electronAPI.updateLocalGame(uid, gameId, patch);
  }
  const { data: current, error: readError } = await supabase
    .from("user_games")
    .select("*")
    .eq("id", gameId)
    .eq("user_id", uid)
    .maybeSingle();
  if (readError) throw readError;
  if (!current) return null;
  const updated = { ...fromCloudGameRow(current), ...patch, id: gameId };
  const { error } = await supabase
    .from("user_games")
    .update(toCloudGameRow(uid, updated))
    .eq("id", gameId)
    .eq("user_id", uid);
  if (error) throw error;
  invalidate(`games:list:${uid}`);
  return updated;
};

export const deleteLibraryGame = async (uid: string, gameId: string) => {
  if (window.electronAPI?.deleteLocalGame) {
    return window.electronAPI.deleteLocalGame(uid, gameId);
  }
  const { error } = await supabase
    .from("user_games")
    .delete()
    .eq("id", gameId)
    .eq("user_id", uid);
  if (error) throw error;
  invalidate(`games:list:${uid}`);
  return true;
};

export const deleteLibraryGamesByLauncher = async (
  uid: string,
  launcherType: "steam" | "epic" | "local",
) => {
  if (window.electronAPI?.deleteLocalGamesByLauncher) {
    return window.electronAPI.deleteLocalGamesByLauncher(uid, launcherType);
  }
  const { data, error } = await supabase
    .from("user_games")
    .delete()
    .eq("user_id", uid)
    .eq("launcher_type", launcherType)
    .select("id");
  if (error) throw error;
  invalidate(`games:list:${uid}`);
  return data?.length || 0;
};

export const recordLibrarySession = async (
  uid: string,
  gameId: string,
  session: { startedAt: string; endedAt: string; durationMinutes: number },
) => {
  if (!window.electronAPI?.recordLocalGameSession) return null;
  return window.electronAPI.recordLocalGameSession(uid, gameId, session);
};

export const bulkUpsertLibraryGames = async (uid: string, games: Game[]) => {
  if (window.electronAPI?.bulkUpsertLocalGames) {
    return window.electronAPI.bulkUpsertLocalGames(uid, games);
  }
  const items = games.map((game) => toCloudGameRow(uid, game));
  if (items.length === 0) return games;
  await upsertGameRowsResilient(items);
  invalidate(`games:list:${uid}`);
  return games;
};

export const importFirestoreLibraryIntoLocal = async (uid: string) => {
  if (!window.electronAPI?.importLegacyGames) {
    return { imported: 0, alreadyImported: true };
  }
  if (
    window.electronAPI.needsLegacyGameImport
    && !await window.electronAPI.needsLegacyGameImport(uid)
  ) {
    return { imported: 0, alreadyImported: true };
  }
  const { data, error } = await supabase
    .from("user_games")
    .select("*")
    .eq("user_id", uid);
  if (error) throw error;
  const games = (data || []).map((row) =>
    fromCloudGameRow(row as Record<string, any>),
  );
  return window.electronAPI.importLegacyGames(uid, games);
};

export const syncPublicLibrarySummary = async (
  uid: string,
  profile?: UserProfile | null,
) => {
  if (!window.electronAPI?.getLocalLibrarySummary) return false;

  // Verificar se temos uma sessão válida antes de tentar sincronizar
  const session = await getUsableSession();
  if (!session) {
    console.warn("[LocalLibrary] Sessão expirada ou inválida, pulando sync de perfil público");
    return false;
  }

  try {
    const summary = await window.electronAPI.getLocalLibrarySummary(uid);
    const photoURL = profile?.photoURL
      || profile?.discordAvatar
      || profile?.steamAvatar
      || "";
    const profileVisibility = profile?.profileVisibility === "private" ? "private" : "public";

    // v2 força uma ressincronização única para quem ficou preso no fluxo antigo,
    // que marcava o resumo como sincronizado antes de user_games terminar.
    const profileFingerprint = JSON.stringify([
      PUBLIC_LIBRARY_SYNC_VERSION,
      profile?.displayName || "Jogador",
      photoURL,
      profile?.bio || "",
      profile?.website || "",
      profile?.favoriteGenres || [],
      profileVisibility,
    ]);
    const fingerprintKey = `checkpoint_public_profile_fingerprint_v${PUBLIC_LIBRARY_SYNC_VERSION}_${uid}`;

    if (
      !summary.dirty
      && localStorage.getItem(fingerprintKey) === profileFingerprint
    ) return false;

    // 1) Primeiro garante que a biblioteca pública real esteja coerente.
    // Se isso falhar por erro de schema (42P10), ainda tentamos publicar o
    // resumo — ele vem do SQLite local e nao depende de user_games terminar.
    // Outras falhas continuam bloqueando a marcacao de "sincronizado".
    let gamesSyncOk = true;
    try {
      await syncLocalGamesToCloud(uid);
    } catch (gamesError) {
      if (isMissingConstraintError(gamesError)) {
        warnMissingConstraintOnce("syncLocalGamesToCloud", gamesError);
        gamesSyncOk = false;
      } else {
        throw gamesError;
      }
    }

    // 2) Depois publica apenas as colunas que realmente existem em public_profiles.
    // Steam/Discord continuam vindo de profiles; não duplicamos isso em "platforms".
    const profileRow = {
      uid,
      display_name: profile?.displayName || "Jogador",
      photo_url: photoURL,
      bio: profile?.bio || "",
      website: profile?.website || "",
      favorite_genres: profile?.favoriteGenres || [],
      stats: summary.stats,
      achievements: summary.achievements,
      top_games: summary.topGames,
      favorite_games: summary.favoriteGames,
      profile_visibility: profileVisibility,
      revision: summary.revision,
      updated_at: new Date().toISOString(),
    };
    const { error: publicProfileError } = await supabase
      .from("public_profiles")
      .upsert(profileRow, { onConflict: "uid" });

    if (publicProfileError) {
      // Banco sem PK em public_profiles(uid): fallback insert -> update.
      if (isMissingConstraintError(publicProfileError)) {
        warnMissingConstraintOnce("Constraint ausente em public_profiles", publicProfileError);
        const { error: insertError } = await supabase
          .from("public_profiles")
          .insert(profileRow);
        if (insertError && (insertError as { code?: string }).code === "23505") {
          const { error: updateError } = await supabase
            .from("public_profiles")
            .update(profileRow)
            .eq("uid", uid);
          if (updateError) {
            console.error("[LocalLibrary] Erro ao atualizar perfil público:", updateError);
            throw updateError;
          }
        } else if (insertError) {
          console.error("[LocalLibrary] Erro ao inserir perfil público:", insertError);
          throw insertError;
        }
      } else {
        console.error("[LocalLibrary] Erro ao upsert perfil público:", publicProfileError);
        throw publicProfileError;
      }
    }

    // 3) Só marcamos a revisão como sincronizada quando AMBOS os lados foram.
    // Com fallback de schema, o resumo foi publicado mas user_games pode estar
    // pendente — mantem dirty para tentar de novo sem spammar erro.
    if (!gamesSyncOk) return false;
    await window.electronAPI.markLocalLibrarySummarySynced(
      uid,
      summary.revision,
    );
    localStorage.setItem(fingerprintKey, profileFingerprint);
    invalidate(`games:list:${uid}`);

    return true;
  } catch (error) {
    console.error("[LocalLibrary] Erro em syncPublicLibrarySummary:", error);
    // Se o erro for relacionado a autenticação, não marcar como sincronizado
    const errorMessage = error instanceof Error ? error.message : String(error);
    if (errorMessage.includes("Sessão expirada") || errorMessage.includes("JWT")) {
      console.warn("[LocalLibrary] Erro de autenticação, requer re-login");
      return false;
    }
    throw error;
  }
};
