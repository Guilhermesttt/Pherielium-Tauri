/**
 * tauriAPI.ts
 *
 * Bridge layer that mirrors the entire window.electronAPI interface,
 * but implements every method using Tauri's invoke() + listen() primitives.
 *
 * The shim at the bottom injects this as window.electronAPI so that ALL
 * existing frontend code continues to work unchanged.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { getVersion } from "@tauri-apps/api/app";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

// ── Helper ────────────────────────────────────────────────────────────────────

/** Wraps a listen() call and returns a cleanup function */
function makeListen<T>(event: string, cb: (payload: T) => void): () => void {
  let unlisten: UnlistenFn | null = null;
  listen<T>(event, (e) => cb(e.payload)).then((u) => { unlisten = u; });
  return () => unlisten?.();
}

// ── tauriAPI object ───────────────────────────────────────────────────────────

export const tauriAPI = {

  // ─── Launcher ─────────────────────────────────────────────────────────────
  launchExecutable: (path: string, profile?: unknown, opts?: { hideLauncher?: boolean }) =>
    invoke("launcher_open_executable", { path, profile, opts }),

  selectExecutable: () =>
    invoke<string | null>("launcher_select_executable"),

  // ─── Game library ──────────────────────────────────────────────────────────
  scanLocalGames: () =>
    invoke<Array<{ name: string; path: string }>>("game_scan_local"),

  scanInstalledSteamGames: () =>
    invoke<Array<{
      appid: string;
      name: string;
      installdir: string;
      executablePath?: string;
      sizeGb: number;
      lastPlayed: number;
    }>>("steam_scan_installed_games"),

  listLocalGames: (uid: string) =>
    invoke<unknown[]>("library_list", { uid }),

  createLocalGame: (uid: string, game: unknown) => {
    let payload = game;
    if (typeof game === "object" && game !== null) {
      const raw = game as Record<string, any>;
      const minutes = raw.totalPlaytimeMinutes != null
        ? Math.round(Number(raw.totalPlaytimeMinutes) || 0)
        : raw.steamPlaytimeMinutes != null
          ? Math.round(Number(raw.steamPlaytimeMinutes) || 0)
          : raw.hoursPlayed != null
            ? Math.round((Number(raw.hoursPlayed) || 0) * 60)
            : 0;
      const img = raw.imageUrl || raw.cardImage || raw.image || "";
      payload = {
        uid,
        ...raw,
        imageUrl: img || undefined,
        image: img || undefined,
        cardImage: img || undefined,
        totalPlaytimeMinutes: minutes,
        steamPlaytimeMinutes: raw.steamPlaytimeMinutes != null ? Math.round(Number(raw.steamPlaytimeMinutes) || 0) : minutes,
        sortOrder: Math.round(Number(raw.sortOrder) || 0),
      };
    }
    return invoke<unknown>("library_create", { uid, game: payload });
  },

  updateLocalGame: (uid: string, gameId: string, patch: unknown) => {
    let payload = patch;
    if (typeof patch === "object" && patch !== null) {
      const raw = patch as Record<string, any>;
      const minutes = raw.totalPlaytimeMinutes != null
        ? Math.round(Number(raw.totalPlaytimeMinutes) || 0)
        : raw.steamPlaytimeMinutes != null
          ? Math.round(Number(raw.steamPlaytimeMinutes) || 0)
          : raw.hoursPlayed != null
            ? Math.round((Number(raw.hoursPlayed) || 0) * 60)
            : undefined;
      payload = {
        ...raw,
        ...(minutes != null ? { totalPlaytimeMinutes: minutes } : {}),
        ...(raw.sortOrder != null ? { sortOrder: Math.round(Number(raw.sortOrder) || 0) } : {}),
      };
    }
    return invoke<unknown>("library_update", { uid, gameId, patch: payload });
  },

  deleteLocalGame: (uid: string, gameId: string) =>
    invoke<boolean>("library_delete", { uid, gameId }),

  deleteLocalGamesByLauncher: (uid: string, launcherType: string) =>
    invoke<number>("library_delete_by_launcher", { uid, launcherType }),

  recordLocalGameSession: (uid: string, gameId: string, session: unknown) =>
    invoke<string>("library_record_session", { uid, gameId, session }),

  bulkUpsertLocalGames: (uid: string, games: unknown[]) => {
    const payload = Array.isArray(games)
      ? games.map((g) => {
          if (typeof g === "object" && g !== null) {
            const raw = g as Record<string, any>;
            const minutes = raw.totalPlaytimeMinutes != null
              ? Math.round(Number(raw.totalPlaytimeMinutes) || 0)
              : raw.steamPlaytimeMinutes != null
                ? Math.round(Number(raw.steamPlaytimeMinutes) || 0)
                : raw.hoursPlayed != null
                  ? Math.round((Number(raw.hoursPlayed) || 0) * 60)
                  : 0;
            const img = raw.imageUrl || raw.cardImage || raw.image || "";
            return {
              uid,
              ...raw,
              imageUrl: img || undefined,
              image: img || undefined,
              cardImage: img || undefined,
              totalPlaytimeMinutes: minutes,
              steamPlaytimeMinutes: raw.steamPlaytimeMinutes != null ? Math.round(Number(raw.steamPlaytimeMinutes) || 0) : minutes,
              sortOrder: Math.round(Number(raw.sortOrder) || 0),
            };
          }
          return g;
        })
      : games;
    return invoke<unknown[]>("library_bulk_upsert", { uid, games: payload });
  },

  importLegacyGames: (uid: string, games: unknown[]) =>
    invoke<{ imported: number; alreadyImported: boolean }>("library_import_legacy", { uid, games }),

  needsLegacyGameImport: (uid: string) =>
    invoke<boolean>("library_needs_legacy_import", { uid }),

  getLocalLibrarySummary: (uid: string) =>
    invoke<unknown>("library_get_summary", { uid }),

  markLocalLibrarySummarySynced: (uid: string, revision: number) =>
    invoke<void>("library_mark_summary_synced", { uid, revision }),

  clearLocalSteamId: (uid: string) =>
    invoke<void>("library_clear_steam_id", { uid }),

  // ─── Process monitor ────────────────────────────────────────────────────────
  detectRunningGames: (executablePaths: string[]) =>
    invoke<string[]>("process_detect_running", { executablePaths }),

  isExecutableRunning: (executablePath: string) =>
    invoke<boolean>("process_is_running", { executablePath }),

  // ─── Achievements ──────────────────────────────────────────────────────────
  getLocalAchievementDefinitions: (gameId: string) =>
    invoke<Record<string, unknown> | null>("achievement_get_definitions", { gameId }),

  saveLocalAchievementDefinitions: (gameId: string, definitions: unknown[], steamAppId?: string) =>
    invoke<boolean>("achievement_save_definitions", { gameId, definitions, steamAppId }),

  getLocalAchievementProgress: (gameId: string) =>
    invoke<unknown | null>("achievement_get_progress", { gameId }),

  getAchievementProgress: (gameId: string) =>
    invoke<unknown | null>("achievement_get_progress", { gameId }),

  getLocalAchievementState: (appId: string) =>
    invoke<Record<string, { earned: boolean; earnedTime: number }>>("achievement_get_local_state", { appId }),

  unlockAchievement: (gameId: string, achievementId: string) =>
    invoke<{ duplicate: boolean }>("achievement_unlock", { gameId, achievementId }),

  getLocalAchievementLibrarySummary: () =>
    invoke<unknown>("achievement_get_library_summary"),

  getAchievementDiagnostics: () =>
    invoke<unknown>("achievement_get_diagnostics"),

  detectEmulatorForGame: (gameDir?: string, appId?: string) =>
    invoke<unknown>("emulator_detect_for_game", { gameDir: gameDir ?? null, appId: appId ?? "" }),

  // Real-time achievement push (main → renderer via Tauri event)
  onRealtimeAchievementUnlock: (callback: (payload: unknown) => void) =>
    makeListen("achievement:realtime-unlock", callback),

  removeRealtimeAchievementUnlock: (handler: () => void) => {
    handler();
  },

  // ─── Epic Games ────────────────────────────────────────────────────────────
  openEpicLoginWindow: () =>
    invoke<string | null>("epic_open_login_window"),

  getEpicStatus: () =>
    invoke<unknown>("epic_get_status"),

  authenticateEpic: (request: { code: string }) =>
    invoke<{ success: boolean }>("epic_authenticate", { code: request.code }),

  getEpicLibrary: () =>
    invoke<unknown[]>("epic_list_library"),

  getEpicAchievements: (request?: { sandboxId?: string; appName?: string }) =>
    invoke<unknown>("epic_get_achievements", {
      sandboxId: request?.sandboxId,
      appName: request?.appName,
    }),

  logoutEpic: () =>
    invoke<{ success: boolean }>("epic_logout"),

  validateEpicSession: () =>
    invoke<{ valid: boolean; reason?: string }>("epic_validate_session"),

  onEpicProgress: (callback: (progress: unknown) => void) =>
    makeListen("epic:progress", callback),

  searchEpicStore: (query: string) =>
    invoke<unknown[]>("epic_search_store", { query }),

  fetchEpicStoreDetails: (_request: unknown) =>
    Promise.resolve(null), // Phase 4 — requires Epic GraphQL integration

  getEpicLocalAchievements: (_request: unknown) =>
    Promise.resolve({ source: "epic-local", status: "not-installed", installed: false, achievements: [], total: 0, unlocked: 0, readableFileCount: 0, binarySaveDetected: false, scanTruncated: false }),

  // ─── Nexus Mods ────────────────────────────────────────────────────────────
  getNexusStatus: () =>
    invoke<unknown>("nexus_get_status"),

  connectNexusPersonalKey: (apiKey: string) =>
    invoke<unknown>("nexus_connect_personal_key", { apiKey }),

  validateNexusConnection: () =>
    invoke<unknown>("nexus_validate_connection"),

  disconnectNexus: () =>
    invoke<unknown>("nexus_disconnect"),

  getNexusModCatalog: (request: { gameDomain: string }) =>
    invoke<unknown>("nexus_get_mod_catalog", { gameDomain: request.gameDomain }),

  getNexusModDetails: (request: { gameDomain: string; modId: string }) =>
    invoke<unknown>("nexus_get_mod_details", { gameDomain: request.gameDomain, modId: request.modId }),

  getNexusModFiles: (request: { gameDomain: string; modId: string }) =>
    invoke<unknown>("nexus_get_mod_files", { gameDomain: request.gameDomain, modId: request.modId }),

  getNexusDownloadState: () =>
    invoke<unknown | null>("nexus_get_download_state"),

  listNexusDownloadedFiles: (gameDomain: string) =>
    invoke<unknown[]>("nexus_list_downloaded_files", { gameDomain }),

  openNexusDownloadLocation: (gameDomain?: string) =>
    invoke<boolean>("nexus_open_download_location", { gameDomain }),

  selectModGameDirectory: (gameTitle: string) =>
    invoke<string | null>("nexus_select_game_directory", { gameTitle }),

  onNexusDownloadState: (callback: (state: unknown) => void) =>
    makeListen("nexus:download-state", callback),

  // Stubs for Phase 5 (mod installation — requires zip extraction in Rust)
  prepareNexusFreeDownload: (_req: unknown) =>
    Promise.resolve({ prepared: false, autoInstall: false, expiresAt: 0 }),

  installNexusDownloadedMod: (_req: unknown) =>
    Promise.reject(new Error("Not implemented yet — Phase 5")),

  previewNexusMod: (_req: unknown) =>
    Promise.resolve(null),

  adoptNexusInstalledMod: (_req: unknown) =>
    Promise.reject(new Error("Not implemented yet — Phase 5")),

  removeNexusInstalledMod: (_req: unknown) =>
    Promise.reject(new Error("Not implemented yet — Phase 5")),

  // ─── Hardware ──────────────────────────────────────────────────────────────
  getControllerBattery: () =>
    Promise.resolve({
      batteryLevel: null,
      isCharging: false,
      connectionType: "unknown",
      deviceName: null,
    }),

  showBatteryWarning: (_level: number) =>
    invoke<void>("system_show_battery_warning", { level: _level }),

  // ─── System / Shell ────────────────────────────────────────────────────────
  openExternalUrl: (url: string) =>
    invoke<void>("system_open_external", { url }),

  openPath: (path: string) =>
    invoke<string>("system_open_path", { path }),

  copyToClipboard: (value: string) =>
    invoke<{ ok: boolean }>("system_copy_to_clipboard", { value }),

  // ─── Window & App ──────────────────────────────────────────────────────────
  getVersion: () =>
    getVersion(),

  toggleFullScreen: () =>
    invoke<boolean>("window_fullscreen_toggle"),

  setFullScreen: (flag: boolean) =>
    invoke<boolean>("window_fullscreen_set", { flag }),

  isFullScreen: () =>
    invoke<boolean>("window_fullscreen_get"),

  minimizeWindow: () =>
    invoke<void>("window_minimize"),

  maximizeWindow: () =>
    invoke<boolean>("window_maximize_toggle"),

  isMaximized: () =>
    invoke<boolean>("window_is_maximized"),

  closeWindow: () =>
    invoke<void>("window_close"),

  setWindowBehavior: (behavior: { minimizeToTray: boolean; confirmBeforeExit: boolean }) =>
    invoke<unknown>("window_set_behavior", { behavior }),

  requestAppQuit: () =>
    invoke<{ confirmationRequired: boolean }>("system_request_app_quit"),

  confirmAppQuit: () =>
    invoke<void>("system_confirm_app_quit"),

  setOpenAtLogin: (open: boolean) =>
    invoke<{ openAtLogin: boolean; supported: boolean }>("system_set_open_at_login", { open }),

  // ─── Auth ─────────────────────────────────────────────────────────────────
  startGoogleBrowserAuth: () => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    return invoke<{ state: string; pollSecret: string }>("auth_start_google_browser", {
      backendUrl: backendUrl || null,
    });
  },

  pollGoogleBrowserAuth: (state: string, pollSecret: string) => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    return invoke<{
      status: string;
      error?: string;
      accessToken?: string;
      refreshToken?: string;
      email?: string;
      uid?: string;
    }>("auth_poll_google_status", {
      state,
      pollSecret,
      backendUrl: backendUrl || null,
    });
  },

  startLinkedAccountBrowser: (provider: string, accessToken: string, options?: { openBrowser?: boolean }) => {
    const backendUrl = import.meta.env.VITE_BACKEND_URL;
    return invoke<{ ok: boolean; url?: string }>("auth_start_linked_account_browser", {
      provider,
      accessToken,
      openBrowser: options?.openBrowser !== false,
      backendUrl: backendUrl || null,
    });
  },

  getPendingAccountAuthCallback: async () => null,
  ackAccountAuthCallback: async (_callbackId: string) => {},

  onAccountAuthCallback: (callback: (payload: unknown) => void) =>
    makeListen("auth:account-callback", callback),

  // ─── Presence ─────────────────────────────────────────────────────────────
  setPresenceSession: (_session: unknown) =>
    Promise.resolve(true),

  // ─── App lifecycle ─────────────────────────────────────────────────────────
  onAppQuitting: (callback: () => void) =>
    makeListen("app:quitting", callback),

  onExitConfirmationRequested: (callback: () => void) =>
    makeListen("system:exit-confirmation-requested", callback),

  // ─── Overlay ───────────────────────────────────────────────────────────────
  toggleOverlayPanel: () =>
    invoke<{ open: boolean }>("overlay_toggle_panel"),

  showNotificationOverlay: (payload: unknown) =>
    invoke<void>("overlay_show_social", { payload }),

  dismissNotificationOverlay: (payload?: unknown) =>
    invoke<void>("overlay_dismiss_notification", { payload: payload ?? null }),

  showGameStartOverlay: (payload: unknown) =>
    invoke<void>("overlay_show_game_start", { payload }),

  showFriendPlayingOverlay: (payload: unknown) => {
    const data = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    return invoke<void>("overlay_show_social", {
      payload: { ...data, kind: "friend-playing" },
    });
  },

  showFriendRequestOverlay: (payload: unknown) => {
    const data = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    return invoke<void>("overlay_show_social", {
      payload: { ...data, kind: "friend-request" },
    });
  },

  showFriendAcceptedOverlay: (payload: unknown) => {
    const data = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    return invoke<void>("overlay_show_social", {
      payload: { ...data, kind: "friend-accepted" },
    });
  },

  showFriendMessageOverlay: (payload: unknown) => {
    const data = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
    return invoke<void>("overlay_show_social", {
      payload: {
        ...data,
        kind: "message",
        senderName: data.senderName,
        message: data.message || data.messageText,
        avatar: data.avatar || data.avatarUrl,
        friendId: data.friendId,
        contentKind: data.contentKind,
      },
    });
  },

  notifyTrophyUnlock: (payload: {
    trophyTitle?: string;
    trophyDescription?: string;
    title?: string;
    description?: string;
    gameTitle?: string;
    iconUrl?: string;
    icon?: string;
    tier?: "platinum" | "gold" | "silver" | "bronze";
    percent?: number;
    xp?: number;
  }) => {
    const tierPercents = { platinum: 3, gold: 12, silver: 35, bronze: 75 } as const;
    const tier = payload.tier ?? "bronze";
    return invoke<{ shown: boolean }>("overlay_notify_unlock", {
      payload: {
        title: payload.trophyTitle ?? payload.title ?? "Conquista desbloqueada",
        description: payload.trophyDescription ?? payload.description ?? "",
        gameTitle: payload.gameTitle,
        icon: (payload.iconUrl ?? payload.icon)?.trim() || undefined,
        percent: payload.percent ?? tierPercents[tier] ?? 50,
        tier,
        xpGained: payload.xp,
      },
    });
  },

  testOverlayWelcome: () =>
    invoke<void>("overlay_test_welcome"),

  testOverlayAchievement: (tier?: string) =>
    invoke<void>("overlay_test_achievement", { tier: tier ?? null }),

  updateOverlayPanel: (payload: unknown) =>
    invoke<void>("overlay_update_panel", { payload }),

  setAchievementVolume: (volume: number) =>
    Promise.resolve({ volume }),

  setAchievementSoundTheme: (theme: string) =>
    Promise.resolve({ theme }),

  setAchievementNotificationSettings: (settings: unknown) =>
    Promise.resolve(settings),

  onOverlayPanelAction: (callback: (payload: unknown) => void) =>
    makeListen("overlay:panel-action", callback),

  onOverlayHubInputLock: (callback: (payload: { locked: boolean }) => void) =>
    makeListen<{ open?: boolean }>("overlay:panel-toggled", (payload) => {
      callback({ locked: Boolean(payload?.open) });
    }),

  // ─── Captures ─────────────────────────────────────────────────────────────
  listRecentCaptures: (limit?: number) =>
    invoke<Array<{
      id: string;
      name: string;
      path: string;
      url: string;
      createdAt: string;
      gameTitle?: string;
    }>>("list_recent_captures", { limit: limit ?? null }),

  openCapturesFolder: () =>
    invoke<void>("open_captures_folder"),

  getCapturesDir: () =>
    invoke<string>("get_captures_dir"),

  captureScreen: (gameTitle?: string) =>
    invoke<{
      id: string;
      name: string;
      path: string;
      url: string;
      createdAt: string;
      gameTitle?: string;
    }>("capture_screen", { gameTitle: gameTitle ?? null }),

  deleteCapture: (path: string) =>
    invoke<void>("delete_capture", { path }),

  // ─── Push-to-Talk ─────────────────────────────────────────────────────────
  registerPushToTalk: (accelerator: string) =>
    invoke<boolean>("ptt_register", { accelerator }).catch(() => false),

  unregisterPushToTalk: () =>
    invoke<boolean>("ptt_unregister").catch(() => false),

  sendPttRelease: () => {},

  onPttPress: (callback: () => void) =>
    makeListen("ptt:press", callback),

  onPttRelease: (callback: () => void) =>
    makeListen("ptt:release", callback),

  // ─── Game Watch ───────────────────────────────────────────────────────────
  setGameWatchTarget: (executable: string | null) =>
    invoke<void>("game_watch_set_target", { executable: executable ?? null }),

  clearGameWatchTarget: () =>
    invoke<void>("game_watch_stop"),

  onGameWatchStarted: (callback: (payload: { executable?: string | null }) => void) =>
    makeListen("game-watch:started", callback),

  onGameWatchEnded: (callback: (payload: { executable?: string | null }) => void) =>
    makeListen("game-watch:ended", callback),

  hideMainWindow: () =>
    invoke<void>("window_minimize"),

  showMainWindow: () =>
    Promise.resolve(),

  // ─── Displays ─────────────────────────────────────────────────────────────
  getDisplays: () =>
    Promise.resolve([{ id: 0, label: "Primary", primary: true, width: 1920, height: 1080 }]),

  // ─── Platform cleanup stubs ────────────────────────────────────────────────
  purgeLocalPlatformData: (_uid: string, _platform: string) =>
    Promise.resolve({ games: 0, sessions: 0, gameIds: [], steamAppIds: [], epicCatalogIds: [], deletedFiles: [] }),
  getPlatformCleanupState: (_uid: string, _platform: string) =>
    Promise.resolve(null),
  setPlatformCleanupPhase: (_uid: string, _platform: string, _opId: string, _phase: string) =>
    Promise.resolve(),
  completePlatformCleanup: (_uid: string, _platform: string, _opId: string) =>
    Promise.resolve(),

  // ─── Media ─────────────────────────────────────────────────────────────────
  getScreenSources: async () => {
    type ScreenTarget = {
      id: string;
      name: string;
      kind?: string;
      thumbnail?: string;
      appIcon?: string | null;
    };

    const toDataUrl = (raw: string) => {
      const value = String(raw || "").trim();
      if (!value) return "";
      return value.startsWith("data:") ? value : `data:image/jpeg;base64,${value}`;
    };

    try {
      const targets = await invoke<ScreenTarget[]>("screen_share_list_targets");
      const list = Array.isArray(targets) ? targets : [];
      const withThumbs: Array<{
        id: string;
        name: string;
        thumbnail: string;
        appIcon: string | null;
      }> = [];

      const CONCURRENCY = 6;
      for (let i = 0; i < list.length; i += CONCURRENCY) {
        const chunk = list.slice(i, i + CONCURRENCY);
        const thumbs = await Promise.all(
          chunk.map(async (target) => {
            let thumbnail = toDataUrl(target.thumbnail || "");
            if (!thumbnail && target.id) {
              try {
                const jpeg = await invoke<string>("capture_target_jpeg", {
                  targetId: target.id,
                  maxWidth: 320,
                  maxHeight: 180,
                });
                thumbnail = toDataUrl(jpeg);
              } catch {
                thumbnail = "";
              }
            }
            return {
              id: String(target.id || ""),
              name: String(target.name || "Fonte"),
              thumbnail,
              appIcon: target.appIcon ?? null,
            };
          }),
        );
        withThumbs.push(...thumbs.filter((item) => item.id));
      }

      return withThumbs;
    } catch (err) {
      console.warn("[tauriAPI] getScreenSources failed:", err);
      return [];
    }
  },
  getLocalGameScreenshots: (_request: unknown) => Promise.resolve([]),
  importRetroArtwork: (_imageUrl: string) => Promise.reject("Not implemented"),
  searchTheGamesDb: (_request: unknown) => Promise.resolve([]),
  getTheGamesDbScreenshots: (_request: unknown) => Promise.resolve({ screenshots: [] }),

  // ─── Detect conflicts / profiles (Phase 5) ────────────────────────────────
  detectModConflicts: (_manifestRoot: string) => Promise.resolve([]),
  loadModProfiles: (_gameId: string) => Promise.resolve([]),
  saveModProfile: (_request: unknown) => Promise.resolve([]),
  deleteModProfile: (_request: unknown) => Promise.resolve([]),
};

// ── Compatibility shim ────────────────────────────────────────────────────────
// Inject as window.electronAPI so ALL existing code paths continue to work.
(window as unknown as { electronAPI: typeof tauriAPI }).electronAPI = tauriAPI;

export default tauriAPI;
