import { apiUrl } from "./api";
import type { LauncherLanguage } from "../context/PreferencesContext";
import type { Game, LauncherType } from "../types/domain";
import { createLibraryGame, updateLibraryGame, listLibraryGames, deleteLibraryGame } from "./localLibrary";

export interface EpicAppDetails {
  catalogId: string;
  namespace?: string;
  appName?: string;
  epicLaunchId?: string;
  executablePath?: string;
  title?: string;
  image?: string;
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
  productSlug?: string;
  productUrl?: string;
}

export type EpicAppDetailsFetchResult =
  | { ok: true; data: EpicAppDetails }
  | { ok: false; message: string };

export const searchEpicGames = async (query: string) => {
  if (window.electronAPI?.searchEpicStore) {
    return { items: await window.electronAPI.searchEpicStore(query) };
  }
  const response = await fetch(
    apiUrl(`/api/epic/search?query=${encodeURIComponent(query)}`),
  );
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    throw new Error(payload.error || "Falha ao buscar jogos na Epic Games.");
  }
  return (await response.json()) as { items: any[] };
};

export const fetchEpicAppDetailsResult = async (
  catalogId: string,
  namespaceOverride?: string,
  productSlugOverride?: string,
  language: LauncherLanguage = "pt-BR",
  titleOverride?: string,
  appNameOverride?: string,
): Promise<EpicAppDetailsFetchResult> => {
  const parts = decodeURIComponent(catalogId).split(":");
  const namespace = namespaceOverride || (parts.length >= 2 ? parts[0] : "");
  const itemId = parts.length >= 2 ? parts[1] : catalogId;
  const params = new URLSearchParams({ catalogId: itemId });
  if (namespace) params.set("namespace", namespace);
  const productSlug = String(productSlugOverride || "").trim();
  if (productSlug) params.set("productSlug", productSlug);
  params.set("language", language);

  if (window.electronAPI?.fetchEpicStoreDetails) {
    try {
      const data = await window.electronAPI.fetchEpicStoreDetails({
        catalogId: itemId,
        namespace,
        productSlug: productSlug || undefined,
        title: titleOverride || undefined,
        appName: appNameOverride || undefined,
        language,
      });
      return { ok: true, data };
    } catch {
      // Fallback para API HTTP se desktop store details falhar
    }
  }

  const response = await fetch(apiUrl(`/api/epic/app-details?${params}`));
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { error?: string };
    return { ok: false, message: payload.error || "Falha ao buscar detalhes da Epic Games." };
  }
  return { ok: true, data: (await response.json()) as EpicAppDetails };
};

const requireEpicDesktop = () => {
  if (!window.electronAPI?.getEpicLibrary) {
    throw new Error("Epic Games requer o aplicativo desktop.");
  }
  return window.electronAPI;
};

export const fetchEpicStatus = async () => {
  return requireEpicDesktop().getEpicStatus();
};

export const authenticateEpic = async (code: string) => {
  return requireEpicDesktop().authenticateEpic({ code });
};

export const fetchEpicLibrary = async (): Promise<any[]> => {
  return requireEpicDesktop().getEpicLibrary();
};

export const fetchEpicAchievements = async (sandboxId?: string, appName?: string) => {
  return requireEpicDesktop().getEpicAchievements({ sandboxId, appName });
};

export const unlinkEpicAccount = async (uid: string) => {
  try {
    await requireEpicDesktop().logoutEpic();
  } catch (e) {
    console.error("Erro ao chamar logout da Epic:", e);
  }

  // Exclui todos os jogos da Epic da biblioteca local
  const games = await listLibraryGames(uid);
  const epicGames = games.filter((g) => g.launcherType === "epic");
  for (const game of epicGames) {
    try {
      await deleteLibraryGame(uid, game.id);
    } catch (err) {
      console.error(`Erro ao deletar jogo ${game.title}:`, err);
    }
  }
  return epicGames.length;
};

export type EpicSessionValidation = {
  valid: boolean;
  reason?: "missing" | "expired" | "network";
};

/**
 * Validates the Epic session through the encrypted credential vault. Returns
 * `{ valid: true }` when tokens are fresh (or were refreshed), or a structured
 * reason when re-authentication is required. The modal uses this to surface a
 * re-auth CTA instead of a generic error.
 */
export const validateEpicSession = async (): Promise<EpicSessionValidation> => {
  if (!window.electronAPI?.validateEpicSession) {
    return { valid: false, reason: "missing" };
  }
  try {
    return await window.electronAPI.validateEpicSession();
  } catch (err) {
    console.warn("Falha ao validar sessão Epic:", err);
    return { valid: false, reason: "network" };
  }
};

export const syncEpicLibraryToLocal = async (
  uid: string,
  language: LauncherLanguage = "pt-BR",
) => {
  const status = await fetchEpicStatus();
  if (!status.authenticated) {
    throw new Error("Conta Epic Games não está autenticada.");
  }

  const games = await fetchEpicLibrary();
  const allExistingGames = await listLibraryGames(uid);
  const existingEpicGames = allExistingGames.filter(
    (game) => game.launcherType === "epic" || game.source === "epic",
  );

  const existingByLaunchId = new Map<string, Game>();
  const existingByCatalogId = new Map<string, Game>();
  const existingByTitle = new Map<string, Game>();
  const existingById = new Map<string, Game>();

  const seenKeys = new Set<string>();
  const duplicateIdsToDelete = new Set<string>();

  existingEpicGames.forEach((game) => {
    existingById.set(game.id, game);

    const launchKey = (game.epicLaunchId || "").toLowerCase().trim();
    const catalogKey = (game.epicCatalogId || "").toLowerCase().trim();
    const titleKey = (game.title || "").toLowerCase().trim();

    const primaryKey = launchKey || catalogKey || titleKey;
    if (primaryKey) {
      if (seenKeys.has(primaryKey)) {
        duplicateIdsToDelete.add(game.id);
      } else {
        seenKeys.add(primaryKey);
      }
    }

    if (launchKey && !existingByLaunchId.has(launchKey)) {
      existingByLaunchId.set(launchKey, game);
    }
    if (catalogKey && !existingByCatalogId.has(catalogKey)) {
      existingByCatalogId.set(catalogKey, game);
    }
    if (titleKey && !existingByTitle.has(titleKey)) {
      existingByTitle.set(titleKey, game);
    }
  });

  // Limpa registros duplicados remanescentes da biblioteca local em paralelo
  if (duplicateIdsToDelete.size > 0) {
    await Promise.all(
      Array.from(duplicateIdsToDelete).map((dupId) =>
        deleteLibraryGame(uid, dupId).catch(() => {}),
      ),
    );
  }

  let syncedCount = 0;
  const BATCH_SIZE = 10;

  for (let i = 0; i < games.length; i += BATCH_SIZE) {
    const batch = games.slice(i, i + BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(async (owned) => {
        const catalogId = owned.catalogId
          || owned.metadata?.id
          || owned.asset_infos?.Windows?.catalog_item_id
          || owned.asset_info?.catalog_item_id;
        const namespace = owned.namespace
          || owned.metadata?.namespace
          || owned.asset_infos?.Windows?.namespace
          || owned.asset_info?.namespace;
        const appName = owned.appName || owned.app_name || owned.asset_infos?.Windows?.app_name;
        if (!catalogId && !appName) return false;

        const productSlug = owned.productSlug
          || owned.metadata?.productSlug
          || owned.metadata?.product_slug
          || owned.product_slug;
        const embeddedAchievements = owned.achievements;
        const gameTitle = owned.title || owned.metadata?.title || owned.app_title || owned.app_name || "";

        const epicKey = (appName || catalogId || gameTitle)
          .toLowerCase()
          .trim()
          .replace(/[^a-z0-9_]/g, "_");
        const deterministicDocId = `${uid}_epic_${epicKey}`;

        const existing =
          (appName ? existingByLaunchId.get(appName.toLowerCase().trim()) : null) ||
          (catalogId ? existingByCatalogId.get(catalogId.toLowerCase().trim()) : null) ||
          (gameTitle ? existingByTitle.get(gameTitle.toLowerCase().trim()) : null) ||
          existingById.get(deterministicDocId);

        // Se o jogo já possui metadados completos em cache local, evita requisição de loja redundante
        const needsStoreDetails = !existing || !existing.cardImage || !existing.description;

        const [detailsResult, achievements] = await Promise.all([
          needsStoreDetails
            ? fetchEpicAppDetailsResult(
                catalogId || appName,
                namespace,
                productSlug,
                language,
                gameTitle,
                appName,
              ).catch(() => null)
            : Promise.resolve(null),
          appName && !embeddedAchievements?.total_achievements
            ? fetchEpicAchievements(namespace, appName).catch(() => ({
              total: 0,
              completed: 0,
              list: [],
            }))
            : Promise.resolve({
              total: Number(embeddedAchievements?.total_achievements || 0),
              completed: Number(embeddedAchievements?.user_unlocked || 0),
              list: [],
            }),
        ]);
        const rawDetails = detailsResult?.ok ? detailsResult.data : null;
        let validDetails = rawDetails;
        if (validDetails && gameTitle && validDetails.title) {
          const normGame = gameTitle.toLowerCase().replace(/[^a-z0-9]/g, "");
          const normStore = validDetails.title.toLowerCase().replace(/[^a-z0-9]/g, "");
          const isMatch = normGame === normStore ||
            (normGame.length >= 4 && normStore.length >= 4 && (normGame.startsWith(normStore) || normStore.startsWith(normGame) || (normGame.includes(normStore) && normStore.length / normGame.length > 0.65))) ||
            Boolean(catalogId && validDetails.catalogId && catalogId.toLowerCase() === validDetails.catalogId.toLowerCase());
          if (!isMatch) {
            validDetails = null;
          }
        }

        const keyImages: any[] = owned.keyImages || owned.metadata?.keyImages || [];
        const tallImage = keyImages.find(
          (image) => image.type === "DieselGameBoxTall" || image.type === "OfferImageTall",
        )?.url;
        const wideImage = keyImages.find(
          (image) => image.type === "DieselGameBox" || image.type === "OfferImageWide",
        )?.url;
        const rawLogoImage = keyImages.find(
          (image) => image.type === "DieselGameBoxLogo" || image.type === "ProductLogo",
        )?.url;

        const docId = existing?.id || deterministicDocId;
        const resolvedCover = validDetails?.cardImage || tallImage || wideImage || existing?.cardImage || existing?.image || "";
        const resolvedBackground = validDetails?.backgroundImage || wideImage || tallImage || existing?.backgroundImage || "";
        const resolvedLogo = validDetails?.logoImage || rawLogoImage || existing?.logoImage || "";
        const resolvedScreenshots = validDetails?.screenshots?.length
          ? validDetails.screenshots
          : (wideImage ? [wideImage] : (existing?.screenshots || []));

        const gameData: Game = {
          id: docId,
          title: validDetails?.title || gameTitle || existing?.title || "Jogo Epic",
          image: resolvedCover,
          cardImage: resolvedCover,
          backgroundImage: resolvedBackground,
          logoImage: resolvedLogo,
          description: validDetails?.description || owned.description || owned.metadata?.description || existing?.description || "",
          aboutTheGame: validDetails?.aboutTheGame
            || validDetails?.description
            || owned.metadata?.description
            || existing?.aboutTheGame
            || existing?.description
            || "",
          category: existing?.category || "ACTION",
          isFavorite: existing?.isFavorite ?? false,
          hoursPlayed: existing?.hoursPlayed ?? 0,
          lastPlayedAt: existing?.lastPlayedAt,
          executablePath: existing?.executablePath || "",
          launcherType: "epic" as LauncherType,
          epicCatalogId: catalogId,
          epicLaunchId: appName,
          epicNamespace: namespace || "",
          productSlug: productSlug || validDetails?.productSlug || existing?.productSlug || "",
          totalAchievements: achievements.total || existing?.totalAchievements || 0,
          completedAchievements: achievements.completed || existing?.completedAchievements || 0,
          trailerUrl: validDetails?.trailerUrl || existing?.trailerUrl || "",
          trailerThumbnail: validDetails?.trailerThumbnail || existing?.trailerThumbnail || "",
          screenshots: resolvedScreenshots,
          releaseDate: validDetails?.releaseDate || owned.metadata?.creationDate || existing?.releaseDate || "",
          developer: validDetails?.developer || owned.metadata?.developer || existing?.developer || "",
          publisher: validDetails?.publisher || existing?.publisher || "",
          tags: validDetails?.tags?.length
            ? validDetails.tags
            : (owned.metadata?.categories?.map((category: any) => category.path)
              || existing?.tags
              || []),
          source: "epic",
          lastSyncedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (existing) {
          await updateLibraryGame(uid, docId, gameData);
        } else {
          await createLibraryGame(uid, gameData);
        }
        return true;
      }),
    );

    syncedCount += results.filter(
      (result) => result.status === "fulfilled" && result.value,
    ).length;
  }

  return syncedCount;
};
