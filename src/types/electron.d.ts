export {};

declare global {
  interface Window {
    electronAPI?: {
      launchExecutable: (
        executablePath: string,
        launchProfile?: import("./domain").GameLaunchProfile,
        launchOptions?: { hideLauncher?: boolean },
      ) => Promise<void>;
      selectExecutable: () => Promise<string | null>;
      minimizeWindow?: () => Promise<void>;
      maximizeWindow?: () => Promise<boolean>;
      isMaximized?: () => Promise<boolean>;
      closeWindow?: () => Promise<void>;
      importRetroArtwork: (imageUrl: string) => Promise<string>;
      searchTheGamesDb: (request: { name: string }) => Promise<Array<{
        id: number;
        title: string;
        releaseDate?: string;
        year?: number;
        description: string;
        publisher: string;
        developer: string;
        platform: string;
        frontImage?: string;
        backImage?: string;
        images: string[];
      }>>;
      getTheGamesDbScreenshots: (request: { gameId: number }) => Promise<{ screenshots: string[] }>;
      getScreenSources?: () => Promise<Array<{
        id: string;
        name: string;
        thumbnail: string;
        appIcon: string | null;
      }>>;
      getLocalGameScreenshots?: (request: { title?: string; launcherType?: string; steamAppId?: string | number }) => Promise<string[]>;
      openEpicLoginWindow?: () => Promise<string | null>;
      getEpicStatus: () => Promise<EpicAccountStatus>;
      authenticateEpic: (request: { code: string }) => Promise<{ success: boolean }>;
      getEpicLibrary: () => Promise<EpicLibraryGame[]>;
      getEpicAchievements: (request?: { sandboxId?: string; appName?: string }) => Promise<EpicAchievementsResult>;
      logoutEpic: () => Promise<{ success: boolean }>;
      validateEpicSession: () => Promise<{ valid: boolean; reason?: "missing" | "expired" | "network" }>;
      onEpicProgress: (callback: (progress: EpicProgressEvent) => void) => () => void;
      selectModGameDirectory: (gameTitle: string) => Promise<string | null>;
      detectModConflicts?: (manifestRoot: string) => Promise<Array<{ relativePath: string; mods: Array<{ installId: string; modId: string; name: string }> }>>;
      loadModProfiles?: (gameId: string) => Promise<Array<{ id: string; name: string; gameId: string; activeInstallIds: string[]; createdAt: string; updatedAt: string }>>;
      saveModProfile?: (request: { gameId: string; profileName: string; activeInstallIds: string[] }) => Promise<Array<{ id: string; name: string; gameId: string; activeInstallIds: string[]; createdAt: string; updatedAt: string }>>;
      deleteModProfile?: (request: { gameId: string; profileId: string }) => Promise<Array<{ id: string; name: string; gameId: string; activeInstallIds: string[]; createdAt: string; updatedAt: string }>>;
      getNexusStatus: () => Promise<{
        connected: boolean;
        encryptionAvailable: boolean;
      }>;
      connectNexusPersonalKey: (apiKey: string) => Promise<{
        connected: boolean;
        encryptionAvailable: boolean;
        account: {
          userId: number;
          name: string;
          profileUrl: string;
          isPremium: boolean;
          isSupporter: boolean;
          rateLimit: {
            dailyRemaining: number | null;
            hourlyRemaining: number | null;
          };
        };
      }>;
      validateNexusConnection: () => Promise<{
        connected: boolean;
        encryptionAvailable: boolean;
        account: {
          userId: number;
          name: string;
          profileUrl: string;
          isPremium: boolean;
          isSupporter: boolean;
          rateLimit: {
            dailyRemaining: number | null;
            hourlyRemaining: number | null;
          };
        } | null;
      }>;
      disconnectNexus: () => Promise<{
        connected: boolean;
        encryptionAvailable: boolean;
      }>;
      getNexusModCatalog: (request: {
        gameDomain: string;
      }) => Promise<{
        mods: Array<{
          id: string;
          modId: string;
          name: string;
          author: string;
          summary: string;
          pictureUrl: string;
          modPageUrl: string;
          version: string;
          downloads: number;
          endorsements: number;
          updatedAt: number | null;
          feed: string;
        }>;
        scope: "recent-30-days" | "curated-feeds";
        recentCandidateCount: number;
        rateLimit: {
          dailyRemaining: number | null;
          hourlyRemaining: number | null;
        };
      }>;
      getNexusModDetails: (request: {
        gameDomain: string;
        modId: string;
      }) => Promise<{
        mod: {
          id: string;
          modId: string;
          name: string;
          author: string;
          summary: string;
          pictureUrl: string;
          modPageUrl: string;
          version: string;
          downloads: number;
          endorsements: number;
          updatedAt: number | null;
          feed: string;
        };
        rateLimit: {
          dailyRemaining: number | null;
          hourlyRemaining: number | null;
        };
      }>;
      getNexusModFiles: (request: {
        gameDomain: string;
        modId: string;
      }) => Promise<{
        files: Array<{
          id: string;
          name: string;
          version: string;
          category: string;
          description: string;
          sizeKb: number;
          uploadedAt: number | null;
          primary: boolean;
        }>;
        rateLimit: {
          dailyRemaining: number | null;
          hourlyRemaining: number | null;
        };
      }>;
      getNexusDownloadState: () => Promise<{
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
        updatedAt: number;
      } | null>;
      listNexusDownloadedFiles: (gameDomain: string) => Promise<Array<{
        id: string;
        gameDomain: string;
        modId: string;
        filename: string;
        filePath: string;
        bytes: number;
        downloadedAt: number;
      }>>;
      prepareNexusFreeDownload: (request: {
        gameDomain: string;
        modId: string;
        fileId: string;
        gameFolder: string;
        modName: string;
        modAuthor: string;
        pictureUrl: string;
        version: string;
      }) => Promise<{ prepared: boolean; autoInstall: boolean; expiresAt: number }>;
      installNexusDownloadedMod: (request: {
        gameDomain: string;
        modId: string;
        fileId?: string;
        filePath: string;
        gameFolder: string;
        modName: string;
      }) => Promise<{
        id?: string;
        status: "resolving" | "downloading" | "installing" | "completed" | "error";
        gameDomain?: string;
        modId?: string;
        fileId?: string;
        filename?: string;
        filePath?: string;
        installed?: boolean;
        installedFiles?: number;
        backedUpFiles?: number;
        manifestPath?: string;
        installationError?: string;
        modName?: string;
        error?: string;
        updatedAt: number;
      }>;
      adoptNexusInstalledMod: (request: {
        gameDomain: string;
        modId: string;
        fileId?: string;
        filePath: string;
        gameFolder: string;
        modName: string;
      }) => Promise<{
        adopted: boolean;
        installedFiles: number;
        backedUpFiles: number;
        manifestPath: string;
      }>;
      removeNexusInstalledMod: (request: {
        manifestPath?: string;
        filePath?: string;
        removeArchive: boolean;
      }) => Promise<{ removedFromGame: boolean; archiveRemoved: boolean }>;
      openNexusDownloadLocation: (gameDomain?: string) => Promise<boolean>;
      onNexusDownloadState: (callback: (state: {
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
        updatedAt: number;
      }) => void) => () => void;
      searchEpicStore: (query: string) => Promise<Array<{
        id: string;
        catalogId: string;
        namespace: string;
        name: string;
        title: string;
        appName: string;
        epicLaunchId: string;
        executablePath: string;
        image: string;
        tiny_image: string;
        cardImage: string;
        backgroundImage: string;
        productSlug: string;
        productUrl: string;
        source: "epic-store";
        installed: boolean;
      }>>;
      searchSteamStore?: (query: string) => Promise<Array<{
        id: string;
        appid: string;
        name: string;
        title: string;
        tiny_image: string;
        type?: string;
      }>>;
      fetchEpicStoreDetails: (request: {
        catalogId?: string;
        namespace?: string;
        productSlug?: string;
        title?: string;
        appName?: string;
        language?: import("../context/PreferencesContext").LauncherLanguage;
      }) => Promise<{
        catalogId: string;
        namespace: string;
        appName: string;
        title: string;
        image: string;
        cardImage: string;
        backgroundImage: string;
        logoImage: string;
        description: string;
        aboutTheGame: string;
        screenshots: string[];
        releaseDate: string;
        developer: string;
        publisher: string;
        tags: string[];
        trailerUrl: string;
        productSlug: string;
        productUrl: string;
        epicLaunchId: string;
        executablePath: string;
        source: "epic-store";
      }>;
      getDisplays: () => Promise<Array<{
        id: number;
        label: string;
        primary: boolean;
        width: number;
        height: number;
      }>>;
      isExecutableRunning: (executablePath: string) => Promise<boolean>;
      detectRunningGames: (executablePaths: string[]) => Promise<string[]>;
      startGoogleBrowserAuth: () => Promise<{ state: string; pollSecret: string }>;
      pollGoogleBrowserAuth?: (state: string, pollSecret: string) => Promise<{
        status: string;
        error?: string;
        accessToken?: string;
        refreshToken?: string;
        email?: string;
        uid?: string;
      }>;
      onAccountAuthCallback: (
        callback: (payload: { steamStatus?: string; discordStatus?: string }) => void,
      ) => () => void;
      openExternalUrl: (url: string) => Promise<void>;
      openPath?: (path: string) => Promise<string>;
      copyToClipboard: (value: string) => Promise<{ ok: boolean }>;
      scanLocalGames: () => Promise<Array<{ name: string; path: string }>>;
      listLocalGames: (uid: string) => Promise<import("./domain").Game[]>;
      createLocalGame: (
        uid: string,
        game: Omit<import("./domain").Game, "id"> & { id?: string },
      ) => Promise<import("./domain").Game>;
      updateLocalGame: (
        uid: string,
        gameId: string,
        patch: Partial<import("./domain").Game>,
      ) => Promise<import("./domain").Game>;
      deleteLocalGame: (uid: string, gameId: string) => Promise<boolean>;
      deleteLocalGamesByLauncher: (
        uid: string,
        launcherType: import("./domain").LauncherType,
      ) => Promise<number>;
      recordLocalGameSession: (
        uid: string,
        gameId: string,
        session: {
          startedAt: string;
          endedAt: string;
          durationMinutes: number;
        },
      ) => Promise<string>;
      bulkUpsertLocalGames: (
        uid: string,
        games: import("./domain").Game[],
      ) => Promise<import("./domain").Game[]>;
      importLegacyGames: (
        uid: string,
        games: import("./domain").Game[],
      ) => Promise<{ imported: number; alreadyImported: boolean }>;
      needsLegacyGameImport: (uid: string) => Promise<boolean>;
      getLocalLibrarySummary: (uid: string) => Promise<{
        schemaVersion: number;
        stats: { games: number; minutesPlayed: number; favorites: number };
        platforms: {
          steamGameCount: number;
          epicGameCount: number;
          localGameCount: number;
        };
        achievements: { unlocked: number; total: number };
        topGames: Array<{
          id: string;
          title: string;
          minutesPlayed: number;
          imageUrl: string;
        }>;
        favoriteGames: Array<{
          id: string;
          title: string;
          minutesPlayed: number;
          imageUrl: string;
        }>;
        revision: number;
        deviceId: string;
        dirty: boolean;
      }>;
      markLocalLibrarySummarySynced: (uid: string, revision: number) => Promise<void>;
      testOverlayWelcome: () => Promise<void>;
      testOverlayAchievement: (tier?: "bronze" | "silver" | "gold" | "platinum") => Promise<void>;
      setAchievementVolume: (volume: number) => Promise<{ volume: number }>;
      setAchievementSoundTheme: (
        theme: import("../context/PreferencesContext").SoundTheme,
      ) => Promise<{ theme: import("../context/PreferencesContext").SoundTheme }>;
      setAchievementNotificationSettings: (settings: {
        enabled: boolean;
        custom: boolean;
        position: import("../context/PreferencesContext").AchievementNotificationPosition;
      }) => Promise<{
        enabled: boolean;
        custom: boolean;
        position: import("../context/PreferencesContext").AchievementNotificationPosition;
      }>;
      getVersion: () => Promise<string>;
      getUpdateState: () => Promise<{
        status: "idle" | "checking" | "available" | "not-available" | "downloading" | "downloaded" | "error";
        info: { version?: string } | null;
        progress: { percent?: number } | null;
        error: string;
      }>;
      checkForUpdates: () => Promise<unknown>;
      downloadUpdate: () => Promise<unknown>;
      quitAndInstallUpdate: () => Promise<void>;
      onUpdateMessage: (
        callback: (message: string, data?: { version?: string } | string) => void,
      ) => () => void;
      onDownloadProgress: (
        callback: (progress: { percent?: number }) => void,
      ) => () => void;
      toggleOverlayPanel: () => Promise<{ open: boolean }>;
      showNotificationOverlay: (payload: {
        message: string;
        type?: string;
        title?: string;
        imageUrl?: string;
        friendId?: string;
        duration?: number;
        sound?: boolean;
        action?: { label: string; actionId: string };
        metadata?: Record<string, any>;
      }) => Promise<void>;
      dismissNotificationOverlay: (payload?: { id?: string; dismissAll?: boolean }) => Promise<void>;
      showGameStartOverlay: (payload: { gameTitle: string }) => Promise<void>;
      showFriendPlayingOverlay: (payload: {
        playerName: string;
        gameTitle: string;
        avatarUrl?: string | null;
      }) => Promise<void>;
      showFriendRequestOverlay: (payload: {
        playerName: string;
        avatarUrl?: string | null;
        friendId?: string;
      }) => Promise<void>;
      showFriendAcceptedOverlay: (payload: {
        playerName: string;
        avatarUrl?: string | null;
      }) => Promise<void>;

      // Local achievements
      getLocalAchievementDefinitions: (
        gameId: string,
      ) => Promise<Record<string, unknown> | null>;
      getLocalAchievementProgress: (
        gameId: string,
      ) => Promise<{
        gameId: string;
        unlockedAchievements: Record<
          string,
          { id: string; name: string; description: string; icon: string; unlockedAt: string }
        >;
        updatedAt: string;
      } | null>;
      getLocalAchievementState: (
        appId: string
      ) => Promise<{ [id: string]: { earned: boolean; earnedTime: number } }>;
      setOpenAtLogin?: (open: boolean) => Promise<{
        openAtLogin: boolean;
        supported: boolean;
      }>;
      setWindowBehavior?: (behavior: {
        minimizeToTray: boolean;
        confirmBeforeExit: boolean;
      }) => Promise<{
        minimizeToTray: boolean;
        confirmBeforeExit: boolean;
      }>;
      requestAppQuit?: () => Promise<{ confirmationRequired: boolean }>;
      confirmAppQuit?: () => Promise<void>;
      onExitConfirmationRequested?: (callback: () => void) => () => void;
      getEpicLocalAchievements: (request: {
        gameId: string;
        title: string;
        epicCatalogId?: string;
        epicLaunchId?: string;
        executablePath?: string;
      }) => Promise<{
        source: "epic-local";
        status: "ok" | "not-installed" | "binary-save" | "no-readable-files";
        installed: boolean;
        installLocation: string;
        achievements: Array<{
          apiName: string;
          achieved: boolean;
          unlockTime: number;
          name: string;
          description: string;
          icon: string;
          iconGray: string;
          hidden: boolean;
        }>;
        total: number;
        unlocked: number;
        readableFileCount: number;
        binarySaveDetected: boolean;
        scanTruncated: boolean;
      }>;
      getLocalAchievementLibrarySummary: () => Promise<{
        byGameId: Record<string, { total: number; unlocked: number }>;
        bySteamAppId: Record<string, { total: number; unlocked: number }>;
        updatedAt: string;
      }>;
      getAchievementDiagnostics: () => Promise<{
        bridgePort: number;
        watcherKeys: string[];
        monitoredGameKeys: string[];
        pendingRescanKeys: string[];
        overlayReady: boolean;
        overlayDisplayId: number | null;
        overlayVisible: boolean;
      }>;
      saveLocalAchievementDefinitions: (
        gameId: string,
        definitions: Array<{ id: string; name: string; description: string; icon?: string }>,
        steamAppId?: string
      ) => Promise<boolean>;
      unlockAchievement: (
        gameId: string,
        achievementId: string
      ) => Promise<{ duplicate: boolean }>;
      notifyTrophyUnlock: (payload: {
        trophyTitle: string;
        trophyDescription?: string;
        tier: "platinum" | "gold" | "silver" | "bronze";
        xp?: number;
        iconUrl?: string;
      }) => Promise<{ shown: boolean; reason?: string }>;
      showFriendMessageOverlay: (payload: {
        senderName: string;
        messageText: string;
        avatarUrl?: string;
        friendId?: string;
        contentKind?: "text" | "image";
      }) => Promise<void>;
      updateOverlayPanel: (payload: {
        language?: import("../context/PreferencesContext").LauncherLanguage;
        userDisplay?: string;
        userAvatar?: string;
        gameTitle?: string;
        playingGame?: unknown;
        friends: Array<{ id: string; name: string; status: string; playing?: string; avatar?: string; unread?: number; canChat?: boolean }>;
        achievements: {
          unlocked: number;
          available: number;
          loading?: boolean;
          items?: Array<{ id: string; name: string; description?: string; icon?: string; achieved: boolean; unlockedAt?: string }>;
        };
        currentGame?: {
          id: string;
          title: string;
          image?: string;
          platform?: string;
          category?: string;
          developer?: string;
          releaseDate?: string;
          executableName?: string;
          totalPlaytimeMinutes?: number;
          sessionStartedAt?: string;
          windowMode?: string;
          resolution?: string;
          monitoring?: "verified" | "unverified";
        } | null;
        chat?: {
          friendId: string;
          friendName: string;
          friendAvatar?: string;
          typing?: boolean;
          sending?: boolean;
          error?: string;
          messages: Array<{
            id: string;
            text: string;
            attachmentUrl?: string;
            attachmentName?: string;
            createdAt: string;
            mine: boolean;
            pending?: boolean;
          }>;
        } | null;
        profile?: {
          name: string;
          avatar?: string;
          discordConnected?: boolean;
          discordUsername?: string;
          achievements?: number;
        };
        gamepad?: {
          connected: boolean;
          family: string;
          batteryLevel: number | null;
          isCharging: boolean;
          connectionType: string;
        } | null;
        voiceCall?: {
          inCall: boolean;
          channelName: string;
          isMuted?: boolean;
          isDeafened?: boolean;
          participantsCount?: number;
          speakingUserNames?: string[];
        } | null;
        playerLevel?: {
          level: number;
          xp: number;
          progress: number;
          tierName: string;
          rankColor?: string;
        } | null;
      }) => Promise<void>;
      onOverlayPanelAction: (callback: (payload:
        | { kind: "select-chat"; friendId: string }
        | { kind: "close-chat" }
        | { kind: "send-message"; text: string }
        | { kind: "send-image"; name: string; type: string; data: Uint8Array }
        | { kind: "set-typing"; typing: boolean }
        | { kind: "open-launcher-chat"; friendId: string }
        | { kind: "open-launcher-friends" }
        | { kind: "voice-call"; friendId?: string; friendUid?: string; friendName?: string; friendAvatar?: string }
        | { kind: "voice-accept" }
        | { kind: "voice-reject" }
        | { kind: "voice-hangup" }
        | { kind: "voice-mute" }
        | { kind: "voice-deafen" }
      ) => void) => () => void;

      /**
       * Listener emitido pelo processo principal sempre que o painel do overlay
       * in-game abre ou fecha. Use para bloquear/desbloquear inputs do controle
       * no hub enquanto o overlay estiver visível.
       */
      onOverlayHubInputLock: (callback: (payload: { locked: boolean }) => void) => () => void;

      // ─ Real-time achievement push events (main → renderer) ─────────────────
      /**
       * Registers a listener that fires every time the main process detects a
       * newly unlocked achievement from the local emulator's save file.
       * Returns the internal handler reference — keep it to call
       * `removeRealtimeAchievementUnlock` later and avoid memory leaks.
       */
      onRealtimeAchievementUnlock: (
        callback: (payload: RealtimeAchievementPayload) => void
      ) => RealtimeAchievementHandler;
      /** Removes a previously registered real-time achievement listener. */
      removeRealtimeAchievementUnlock: (
        handler: RealtimeAchievementHandler
      ) => void;
      // ─ Push-to-Talk ─────────────────────────────────────────────────────────
      registerPushToTalk?: (accelerator: string) => Promise<boolean>;
      unregisterPushToTalk?: () => Promise<boolean>;
      sendPttRelease?: () => void;
      onPttPress?: (callback: () => void) => () => void;
      onPttRelease?: (callback: () => void) => () => void;
      // ─ Fullscreen ────────────────────────────────────────────────────────────
      toggleFullScreen?: () => Promise<boolean>;
      setFullScreen?: (flag: boolean) => Promise<boolean>;
      isFullScreen?: () => Promise<boolean>;
      // ─ Battery / Controller warnings ─────────────────────────────────────────
      /**
       * Exibe uma notificação de aviso de bateria baixa do controle.
       * @param level Nível da bateria em % (0-100).
       */
      showBatteryWarning?: (level: number) => Promise<void>;
      getControllerBattery?: () => Promise<{
        batteryLevel: number | null;
        isCharging: boolean;
        connectionType: "bluetooth" | "usb" | "unknown";
        deviceName: string | null;
      }>;
      onAppQuitting?: (callback: () => void) => () => void;
      confirmAppQuit?: () => Promise<void>;
      setPresenceSession?: (session: { uid: string; displayName?: string; token?: string | null; apiUrl?: string }) => Promise<boolean>;
      scanInstalledSteamGames?: () => Promise<Array<{
        appid: string;
        name: string;
        installdir: string;
        executablePath?: string;
        sizeGb: number;
        lastPlayed: number;
      }>>;
      listLocalGames?: (uid: string) => Promise<any[]>;
      createLocalGame?: (uid: string, game: any) => Promise<any>;
      updateLocalGame?: (uid: string, gameId: string, patch: any) => Promise<void>;
      deleteLocalGame?: (uid: string, gameId: string) => Promise<boolean>;
      deleteLocalGamesByLauncher?: (uid: string, launcherType: string) => Promise<number>;
      recordLocalGameSession?: (uid: string, gameId: string, session: any) => Promise<string>;
      bulkUpsertLocalGames?: (uid: string, games: any[]) => Promise<any[]>;
      importLegacyGames?: (uid: string, games: any[]) => Promise<any>;
      needsLegacyGameImport?: (uid: string) => Promise<boolean>;
      getLocalLibrarySummary?: (uid: string) => Promise<any>;
      markLocalLibrarySummarySynced?: (uid: string, revision: number) => Promise<void>;
      clearLocalSteamId?: (uid: string) => Promise<void>;
      purgeLocalPlatformData: (uid: string, platform: import("./platformOperations").Platform) => Promise<{
        games: number;
        sessions: number;
        gameIds: string[];
        steamAppIds: string[];
        epicCatalogIds: string[];
        deletedFiles: string[];
      }>;
      getPlatformCleanupState: (uid: string, platform: import("./platformOperations").Platform) => Promise<{
        operationId: string;
        phase: string;
        updatedAt: number;
      } | null>;
      setPlatformCleanupPhase: (
        uid: string,
        platform: import("./platformOperations").Platform,
        operationId: string,
        phase: string
      ) => Promise<void>;
      completePlatformCleanup: (
        uid: string,
        platform: import("./platformOperations").Platform,
        operationId: string
      ) => Promise<void>;
    };
  }

  /** Payload pushed by the main process when an achievement is detected as newly unlocked. */
  interface RealtimeAchievementPayload {
    /** Watcher key used internally (e.g. "steam_3764200"). */
    gameId: string;
    /** Raw achievement ID as stored by the emulator (e.g. "ACH_WIN_GAME"). */
    achievementId: string;
    /** Unix timestamp in seconds from the emulator (0 if unknown). */
    earnedTime: number;
    /** ISO 8601 date string derived from earnedTime (or Date.now() as fallback). */
    unlockedAt: string;
    achievement?: {
      id?: string;
      name?: string;
      description?: string;
      icon?: string;
    };
  }

  /** Opaque handle returned by onRealtimeAchievementUnlock — used for cleanup. */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  type RealtimeAchievementHandler = (...args: any[]) => void;

  interface EpicAccountStatus {
    authenticated: boolean;
    accountId?: string;
    displayName?: string;
  }

  interface EpicLibraryGame {
    appName: string;
    title: string;
    catalogId: string;
    namespace: string;
    description: string;
    keyImages: Array<{
      type: string;
      url: string;
      md5?: string;
      width?: number;
      height?: number;
    }>;
  }

  interface EpicAchievementItem {
    apiName: string;
    name: string;
    description: string;
    achieved: boolean;
    unlockTime: number;
    icon: string;
    iconGray: string;
    hidden: boolean;
  }

  interface EpicAchievementsResult {
    total: number;
    completed: number;
    list: EpicAchievementItem[];
  }

  interface EpicProgressEvent {
    phase: "authenticating" | "reading-library" | "reading-achievements" | "enriching-games" | "saving-games" | "refreshing-profile";
    completed?: number;
    total?: number;
  }
}
