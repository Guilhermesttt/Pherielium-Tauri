import type { Game, GameLaunchProfile } from "../types/domain";

const EPIC_LAUNCH_URI_PREFIX = "com.epicgames.launcher://apps/";

const WINDOWS_EXECUTABLE_PATH_REGEX = /^(?:(?:[a-zA-Z]:[\\/]|\\\\).+|[^\\/]+)\.exe$/i;

const safeDecodeURIComponent = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

const hasCompleteEpicLaunchId = (value: string) =>
  safeDecodeURIComponent(value)
    .split(":")
    .filter(Boolean).length >= 3;

const isWindowsExecutablePath = (value: string) =>
  WINDOWS_EXECUTABLE_PATH_REGEX.test(String(value || "").trim());

export const getMonitorableExecutablePath = (game: Game): string | null => {
  const executablePath = String(game.executablePath || "").trim();
  if (!executablePath) return null;
  if (isWindowsExecutablePath(executablePath)) return executablePath;
  // Epic installs can be watched by install folder when no .exe is stored yet.
  if (game.launcherType === "epic" || game.epicCatalogId || game.epicLaunchId) {
    return executablePath;
  }
  return null;
};

export const parseEpicAppName = (
  launchId?: string | null,
  fallbackAppName?: string | null,
): string => {
  const explicit = String(fallbackAppName || "").trim();
  if (explicit && !explicit.includes(":")) return explicit;

  const launch = safeDecodeURIComponent(String(launchId || explicit || "").trim());
  const parts = launch.split(":").filter(Boolean);
  if (parts.length >= 3) return parts[parts.length - 1];
  if (parts.length === 1) return parts[0];
  return explicit || launch;
};

/** Legendary app slug used by `legendary achievements <app>`. */
export const resolveEpicAchievementAppName = (game: Pick<Game, "epicLaunchId" | "epicCatalogId" | "title">): string => {
  const catalogPart = game.epicCatalogId?.includes(":")
    ? game.epicCatalogId.split(":")[1]
    : game.epicCatalogId;
  return parseEpicAppName(game.epicLaunchId, catalogPart || game.title);
};

export const isEpicInstallPath = (value?: string | null): boolean => {
  const trimmed = String(value || "").trim();
  if (!trimmed || trimmed.startsWith("com.epicgames.launcher://")) return false;
  if (isWindowsExecutablePath(trimmed)) return true;
  return /^(?:[a-zA-Z]:[\\/]|\\\\).+$/i.test(trimmed);
};

export interface EpicInstallPathInput {
  title?: string | null;
  epicLaunchId?: string | null;
  epicCatalogId?: string | null;
  appName?: string | null;
  executable?: string | null;
  installLocation?: string | null;
  executablePath?: string | null;
}

/** Resolve install folder/exe from inline fields or local Epic manifests. */
export const resolveEpicInstallPath = async (
  input: EpicInstallPathInput,
): Promise<string | null> => {
  const inlinePath = [
    input.executablePath,
    input.executable,
    input.installLocation,
  ]
    .map((value) => String(value || "").trim())
    .find((value) => isEpicInstallPath(value));
  if (inlinePath) return inlinePath;

  if (!window.electronAPI?.resolveEpicWatchTarget) return null;

  try {
    const appName = parseEpicAppName(input.epicLaunchId, input.appName);
    const result = await window.electronAPI.resolveEpicWatchTarget({
      appName: appName || undefined,
      catalogId: input.epicCatalogId || undefined,
      title: input.title || undefined,
    });
    const watchTarget = String(result?.watchTarget || "").trim();
    return isEpicInstallPath(watchTarget) ? watchTarget : null;
  } catch {
    return null;
  }
};

export const resolveEpicWatchTarget = async (game: Game): Promise<string | null> =>
  resolveEpicInstallPath({
    title: game.title,
    epicLaunchId: game.epicLaunchId,
    epicCatalogId: game.epicCatalogId,
    appName: game.epicLaunchId,
    executablePath: game.executablePath,
  });

/** Resolve o .exe real de um jogo Steam instalado (AppID -> caminho local). */
export const resolveSteamInstalledExecutable = async (
  steamAppId?: string | null,
): Promise<string | null> => {
  const appId = String(steamAppId || "").trim();
  if (!appId || !window.electronAPI?.scanInstalledSteamGames) return null;
  try {
    const localSteam = await window.electronAPI.scanInstalledSteamGames();
    if (!Array.isArray(localSteam)) return null;
    const match = localSteam.find((item) => String(item.appid) === appId && item.executablePath);
    return match?.executablePath?.trim() || null;
  } catch {
    return null;
  }
};

/** Melhor caminho monitoravel disponivel agora (biblioteca + scan Steam). */
export const resolveMonitorableExecutablePath = async (game: Game): Promise<string | null> => {
  const direct = getMonitorableExecutablePath(game);
  if (direct) return direct;
  if (game.launcherType === "epic" || game.epicCatalogId || game.epicLaunchId) {
    const epicTarget = await resolveEpicWatchTarget(game);
    if (epicTarget) return epicTarget;
  }
  if (game.steamAppId) {
    const steamExe = await resolveSteamInstalledExecutable(game.steamAppId);
    if (steamExe) return steamExe;
  }
  const fallback = String(game.executablePath || "").trim();
  return fallback || null;
};

const buildEpicLaunchUri = (game: Game): string | null => {
  const explicitLaunchId = String(game.epicLaunchId || "").trim();
  const rawLaunchId = isWindowsExecutablePath(game.executablePath || "")
    ? ""
    : String(game.executablePath || "").trim();
  const catalogId = String(game.epicCatalogId || "").trim();
  const launchId = explicitLaunchId || rawLaunchId || catalogId;

  if (!launchId) {
    return null;
  }

  if (launchId.startsWith(EPIC_LAUNCH_URI_PREFIX)) {
    return launchId;
  }

  if (!hasCompleteEpicLaunchId(launchId)) {
    return null;
  }

  const decodedLaunchId = safeDecodeURIComponent(launchId);
  const decodedCatalogId = catalogId ? safeDecodeURIComponent(catalogId) : "";

  const epicAppId =
    decodedLaunchId.includes(":") || decodedLaunchId === decodedCatalogId
      ? encodeURIComponent(decodedLaunchId)
      : launchId;

  return `${EPIC_LAUNCH_URI_PREFIX}${epicAppId}?action=launch&silent=true`;
};

const launchLocalExecutable = async (
  executablePath: string,
  launchProfile?: GameLaunchProfile,
  hideLauncher = true,
  gameId?: string,
  steamAppId?: string,
) => {
  await window.electronAPI?.launchExecutable(executablePath, launchProfile, {
    hideLauncher,
    gameId,
    steamAppId,
  });
};

interface LaunchGameOptions {
  hideLauncher?: boolean;
}

export const launchGame = async (
  game: Game,
  options: LaunchGameOptions = {},
): Promise<void> => {
  const hideLauncher = options.hideLauncher ?? true;

  if (!game.executablePath && !game.epicCatalogId && !game.epicLaunchId && !game.epicStoreUrl) {
    throw new Error("Jogo sem caminho de execucao ou link da loja configurado.");
  }

  if (game.launcherType === "epic" || game.epicCatalogId) {
    if (
      window.electronAPI?.launchExecutable &&
      getMonitorableExecutablePath(game)
    ) {
      await launchLocalExecutable(
        String(game.executablePath).trim(),
        game.launchProfile,
        hideLauncher,
      );
      return;
    }

    const epicLaunchUri = buildEpicLaunchUri(game);
    if (epicLaunchUri) {
      if (window.electronAPI?.openExternalUrl) {
        await window.electronAPI.openExternalUrl(epicLaunchUri);
      } else {
        window.location.assign(epicLaunchUri);
      }
      return;
    }

    if (game.epicStoreUrl) {
      if (window.electronAPI?.openExternalUrl) {
        await window.electronAPI.openExternalUrl(game.epicStoreUrl);
      } else {
        window.open(game.epicStoreUrl, "_blank", "noopener,noreferrer");
      }
      return;
    }

    throw new Error(
      "ID da Epic Games nao encontrado. Adicione o jogo pela busca da Epic para criar um atalho de launcher.",
    );
  }

  if (game.launcherType === "local") {
    if (
      window.electronAPI?.launchExecutable &&
      getMonitorableExecutablePath(game)
    ) {
      await launchLocalExecutable(
        String(game.executablePath).trim(),
        game.launchProfile,
        hideLauncher,
        game.id,
        game.steamAppId,
      );
      return;
    }

    if (window.electronAPI?.launchExecutable && game.executablePath) {
      throw new Error(
        "O caminho salvo para este jogo e invalido. Edite o jogo e selecione novamente o arquivo .exe.",
      );
    }

    throw new Error(
      "Execucao local requer runtime desktop. No modo web, Steam e Epic sao suportados via URLs do launcher.",
    );
  }

  if (game.launcherType === "steam" || /^\d+$/.test(game.executablePath || "")) {
    const steamId = game.steamAppId || game.executablePath;
    if (!steamId) throw new Error("Steam App ID nao encontrado para esse jogo.");
    const steamLaunchUri = `steam://run/${steamId}`;
    if (window.electronAPI?.openExternalUrl) {
      await window.electronAPI.openExternalUrl(steamLaunchUri);
    } else {
      window.location.assign(steamLaunchUri);
    }
    return;
  }

  if (
    window.electronAPI?.launchExecutable &&
    getMonitorableExecutablePath(game)
  ) {
    await launchLocalExecutable(
      String(game.executablePath).trim(),
      game.launchProfile,
      hideLauncher,
      game.id,
      game.steamAppId,
    );
    return;
  }

  throw new Error("Jogo sem forma de abertura compativel configurada.");
};
