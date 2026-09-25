import { supabase } from "./supabase";
import { disconnectSteamAccount } from "./steam";
import { syncPublicLibrarySummary, deleteLibraryGamesByLauncher } from "./localLibrary";
import { invalidate } from "../lib/queryCache";
import type { Platform, PlatformDisconnectingPhase } from "../types/platformOperations";
import type { UserProfile } from "../types/domain";

export interface DisconnectPlatformInput {
  uid: string;
  platform: Platform;
  operationId: string;
  profile?: UserProfile | null;
  onPhaseChange?: (phase: PlatformDisconnectingPhase) => void;
}

export interface PlatformCleanupResult {
  platform: Platform;
  complete: boolean;
  local: {
    games: number;
    sessions: number;
    gameIds: string[];
    steamAppIds: string[];
    epicCatalogIds: string[];
    deletedFiles: string[];
  };
  cloud: any;
}

const requireDesktopLifecycleApi = () => {
  if (
    !window.electronAPI?.purgeLocalPlatformData ||
    !window.electronAPI?.setPlatformCleanupPhase ||
    !window.electronAPI?.completePlatformCleanup
  ) {
    throw new Error("Operacoes de plataforma requerem o aplicativo desktop.");
  }
  return window.electronAPI;
};

export const clearPlatformCacheKeys = (uid: string, platform: Platform) => {
  try {
    localStorage.removeItem(`checkpoint_public_profile_fingerprint_${uid}`);
    if (platform === "steam") {
      localStorage.removeItem(`steam_auth_${uid}`);
      localStorage.removeItem(`steam_status_${uid}`);
    } else if (platform === "epic") {
      localStorage.removeItem(`epic_auth_${uid}`);
      localStorage.removeItem(`epic_status_${uid}`);
    }
  } catch {}
};

export const disconnectPlatform = async (
  input: DisconnectPlatformInput,
): Promise<PlatformCleanupResult> => {
  const api = requireDesktopLifecycleApi();
  const { uid, platform, operationId, profile, onPhaseChange } = input;

  // Phase 1: Revoking account
  onPhaseChange?.("revoking-account");
  await api.setPlatformCleanupPhase(uid, platform, operationId, "revoking-account");
  if (platform === "epic") {
    if (api.logoutEpic) {
      await api.logoutEpic().catch(() => {});
    }
    try {
      localStorage.removeItem("checkpoint_epic_linked_uid");
      localStorage.removeItem(`checkpoint_epic_user_${uid}`);
    } catch {}
  } else {
    await disconnectSteamAccount().catch(() => {});
  }

  // Phase 2: Removing local data
  onPhaseChange?.("removing-local-data");
  await api.setPlatformCleanupPhase(uid, platform, operationId, "removing-local-data");
  await deleteLibraryGamesByLauncher(uid, platform).catch(() => {});
  const local = await api.purgeLocalPlatformData(uid, platform);

  // Phase 3: Removing cloud data
  onPhaseChange?.("removing-cloud-data");
  await api.setPlatformCleanupPhase(uid, platform, operationId, "removing-cloud-data");
  let cloudData: any = null;
  try {
    const { data, error } = await supabase.rpc("purge_my_platform_data", {
      platform_name: platform,
    });
    if (error) {
      console.warn(`[platformLifecycle] RPC purge_my_platform_data retornou erro, prosseguindo com limpeza local:`, error.message || error);
    } else {
      cloudData = data;
    }
  } catch (err) {
    console.warn(`[platformLifecycle] Falha ao contatar nuvem para purge, prosseguindo:`, err);
  }

  // Deleta diretamente de user_games no Supabase para garantir que nenhuma linha da plataforma persista
  try {
    await supabase
      .from("user_games")
      .delete()
      .eq("user_id", uid)
      .eq("launcher_type", platform);
  } catch (err) {
    console.warn(`[platformLifecycle] Falha ao deletar jogos da nuvem para ${platform}:`, err);
  }

  // Phase 4: Refreshing profile & summary
  onPhaseChange?.("refreshing-profile");
  await api.setPlatformCleanupPhase(uid, platform, operationId, "refreshing-profile");
  clearPlatformCacheKeys(uid, platform);
  invalidate(`games:list:${uid}`);
  await syncPublicLibrarySummary(uid, profile).catch(() => {});

  // Always complete cleanup journal to prevent infinite retry loop
  await api.completePlatformCleanup(uid, platform, operationId).catch(() => {});

  return {
    platform,
    complete: true,
    local,
    cloud: cloudData,
  };
};

export const resumePendingPlatformCleanup = async ({
  uid,
  profile,
}: {
  uid: string;
  profile?: UserProfile | null;
}): Promise<Platform[]> => {
  if (!window.electronAPI?.getPlatformCleanupState) return [];

  const resumed: Platform[] = [];
  const platforms: Platform[] = ["steam", "epic"];

  for (const platform of platforms) {
    let operationId: string | undefined;
    try {
      const state = await window.electronAPI.getPlatformCleanupState(uid, platform);
      if (state && state.operationId) {
        operationId = state.operationId;
        await disconnectPlatform({
          uid,
          platform,
          operationId: state.operationId,
          profile,
        });
        resumed.push(platform);
      }
    } catch (err) {
      console.warn(`[platform-lifecycle] Falha ao retomar limpeza de ${platform}:`, err);
      if (operationId && window.electronAPI?.completePlatformCleanup) {
        try {
          await window.electronAPI.completePlatformCleanup(uid, platform, operationId);
        } catch {}
      }
    }
  }

  return resumed;
};
