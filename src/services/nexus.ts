import { apiUrl } from "./api";

export interface NexusModSummary {
  id: string;
  modId?: string;
  name: string;
  author: string;
  summary: string;
  pictureUrl: string;
  modPageUrl: string;
  version?: string;
  downloads?: number;
  endorsements?: number;
  updatedAt?: number | null;
  feed?: string;
}

export interface NexusAccount {
  userId: number;
  name: string;
  profileUrl: string;
  isPremium: boolean;
  isSupporter: boolean;
  rateLimit: {
    dailyRemaining: number | null;
    hourlyRemaining: number | null;
  };
}

export interface NexusConnection {
  connected: boolean;
  encryptionAvailable: boolean;
  account?: NexusAccount | null;
}

export interface NexusModFile {
  id: string;
  name: string;
  version: string;
  category: string;
  description: string;
  sizeKb: number;
  uploadedAt: number | null;
  primary: boolean;
}

export interface NexusCatalogResult {
  mods: NexusModSummary[];
  scope: "recent-30-days" | "curated-feeds";
  recentCandidateCount: number;
}

export interface NexusDownloadState {
  id?: string;
  status: "resolving" | "downloading" | "installing" | "completed" | "error";
  gameDomain?: string;
  modId?: string;
  fileId?: string;
  mirror?: string;
  receivedBytes?: number;
  totalBytes?: number;
  filename?: string;
  filePath?: string;
  installed?: boolean;
  installedFiles?: number;
  backedUpFiles?: number;
  manifestPath?: string;
  installationError?: string;
  modName?: string;
  modAuthor?: string;
  pictureUrl?: string;
  version?: string;
  error?: string;
  errorCode?: ModErrorCode;
  updatedAt: number;
}

export type ModOperationStatus =
  | "idle"
  | "resolving"
  | "downloading"
  | "downloaded"
  | "installing"
  | "installed"
  | "uninstalling"
  | "error";

export type ModErrorCode =
  | "DESKTOP_BRIDGE_UNAVAILABLE"
  | "NETWORK_FAILURE"
  | "INSTALL_FAILED"
  | "GAME_FOLDER_NOT_SET"
  | "CHECKSUM_MISMATCH"
  | "STORAGE_FULL"
  | "INVALID_PATH"
  | "UNKNOWN";

export interface ModActionableError {
  code: ModErrorCode;
  technicalMessage: string;
  userFriendlyMessage: string;
  actionLabel?: string;
  actionType?: "retry" | "chooseFolder" | "reconnect" | "openFolder";
}

export function parseModOperationError(err: unknown): ModActionableError {
  const raw = err instanceof Error ? err.message : String(err || "");
  const lower = raw.toLowerCase();

  if (lower.includes("windows") || lower.includes("bridge") || lower.includes("electronapi")) {
    return {
      code: "DESKTOP_BRIDGE_UNAVAILABLE",
      technicalMessage: raw,
      userFriendlyMessage: "O gerenciador de mods requer o aplicativo desktop do Pherielium.",
      actionLabel: "Reconectar",
      actionType: "reconnect",
    };
  }

  if (lower.includes("pasta") || lower.includes("folder") || lower.includes("diretório") || lower.includes("caminho")) {
    return {
      code: "GAME_FOLDER_NOT_SET",
      technicalMessage: raw,
      userFriendlyMessage: "A pasta de instalação do jogo não foi localizada ou está inacessível.",
      actionLabel: "Selecionar Pasta",
      actionType: "chooseFolder",
    };
  }

  if (lower.includes("install") || lower.includes("extrair") || lower.includes("unzip") || lower.includes("cópia")) {
    return {
      code: "INSTALL_FAILED",
      technicalMessage: raw,
      userFriendlyMessage: "Falha na extração ou instalação dos arquivos do mod.",
      actionLabel: "Tentar Novamente",
      actionType: "retry",
    };
  }

  if (lower.includes("download") || lower.includes("network") || lower.includes("fetch") || lower.includes("timeout")) {
    return {
      code: "NETWORK_FAILURE",
      technicalMessage: raw,
      userFriendlyMessage: "Não foi possível baixar o mod devido a uma instabilidade de rede.",
      actionLabel: "Repetir Download",
      actionType: "retry",
    };
  }

  return {
    code: "UNKNOWN",
    technicalMessage: raw,
    userFriendlyMessage: raw || "Ocorreu um erro inesperado durante a operação do mod.",
    actionLabel: "Tentar Novamente",
    actionType: "retry",
  };
}

export interface NexusDownloadedFile {
  id: string;
  gameDomain: string;
  modId: string;
  filename: string;
  filePath: string;
  bytes: number;
  downloadedAt: number;
}

const requireNexusDesktopBridge = () => {
  if (!window.electronAPI?.getNexusStatus) {
    throw new Error("A conexão Nexus está disponível apenas no aplicativo para Windows.");
  }
  return window.electronAPI;
};

export const getNexusConnection = async (): Promise<NexusConnection> =>
  requireNexusDesktopBridge().getNexusStatus();

export const connectNexusPersonalKey = async (
  apiKey: string,
): Promise<NexusConnection> =>
  requireNexusDesktopBridge().connectNexusPersonalKey(apiKey);

export const validateNexusConnection = async (): Promise<NexusConnection> =>
  requireNexusDesktopBridge().validateNexusConnection();

export const disconnectNexus = async (): Promise<NexusConnection> =>
  requireNexusDesktopBridge().disconnectNexus();

export const fetchNexusModFiles = async (
  gameDomain: string,
  modId: string,
): Promise<{ files: NexusModFile[]; rateLimit: NexusAccount["rateLimit"] }> =>
  requireNexusDesktopBridge().getNexusModFiles({ gameDomain, modId });

export const fetchNexusModDetails = async (
  gameDomain: string,
  modId: string,
): Promise<NexusModSummary> => {
  const result = await requireNexusDesktopBridge().getNexusModDetails({
    gameDomain,
    modId,
  });
  return result.mod;
};

export const getNexusDownloadState = async (): Promise<NexusDownloadState | null> =>
  requireNexusDesktopBridge().getNexusDownloadState();

export const listNexusDownloadedFiles = async (
  gameDomain: string,
): Promise<NexusDownloadedFile[]> =>
  requireNexusDesktopBridge().listNexusDownloadedFiles(gameDomain);

export const prepareNexusFreeDownload = async (request: {
  gameDomain: string;
  modId: string;
  fileId: string;
  gameFolder: string;
  modName: string;
  modAuthor: string;
  pictureUrl: string;
  version: string;
}): Promise<{ prepared: boolean; autoInstall: boolean; expiresAt: number }> =>
  requireNexusDesktopBridge().prepareNexusFreeDownload(request);

export const installNexusDownloadedMod = async (request: {
  gameDomain: string;
  modId: string;
  fileId?: string;
  filePath: string;
  gameFolder: string;
  modName: string;
}): Promise<NexusDownloadState> =>
  requireNexusDesktopBridge().installNexusDownloadedMod(request);

export const adoptNexusInstalledMod = async (request: {
  gameDomain: string;
  modId: string;
  fileId?: string;
  filePath: string;
  gameFolder: string;
  modName: string;
}): Promise<{ installedFiles: number; backedUpFiles: number; manifestPath: string }> =>
  requireNexusDesktopBridge().adoptNexusInstalledMod(request);

export const removeNexusInstalledMod = async (request: {
  manifestPath?: string;
  filePath?: string;
  removeArchive: boolean;
}): Promise<{ removedFromGame: boolean; archiveRemoved: boolean }> =>
  requireNexusDesktopBridge().removeNexusInstalledMod(request);

export const openNexusDownloadLocation = async (gameDomain?: string): Promise<boolean> =>
  requireNexusDesktopBridge().openNexusDownloadLocation(gameDomain);

export const onNexusDownloadState = (
  callback: (state: NexusDownloadState) => void,
): (() => void) => requireNexusDesktopBridge().onNexusDownloadState(callback);

export const fetchAuthenticatedNexusCatalog = async (
  gameDomain: string,
): Promise<NexusCatalogResult> => {
  const result = await requireNexusDesktopBridge().getNexusModCatalog({
    gameDomain,
  });
  return {
    mods: result.mods,
    scope: result.scope,
    recentCandidateCount: result.recentCandidateCount,
  };
};

export const fetchNexusTrendingMods = async (
  gameDomain: string,
): Promise<NexusModSummary[]> => {
  const domain = gameDomain.trim().toLowerCase();
  if (!/^[a-z0-9-]{2,80}$/.test(domain)) return [];

  const response = await fetch(
    apiUrl(`/api/nexus/games/${encodeURIComponent(domain)}/trending-mods`),
  );
  const payload = await response.json().catch(() => ({})) as {
    mods?: NexusModSummary[];
    error?: string;
  };
  if (!response.ok) {
    throw new Error(payload.error || "Não foi possível carregar os mods da Nexus.");
  }
  return Array.isArray(payload.mods) ? payload.mods : [];
};
