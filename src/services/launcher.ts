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
  return isWindowsExecutablePath(executablePath) ? executablePath : null;
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
) => {
  await window.electronAPI?.launchExecutable(executablePath, launchProfile, {
    hideLauncher,
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
    );
    return;
  }

  throw new Error("Jogo sem forma de abertura compativel configurada.");
};
