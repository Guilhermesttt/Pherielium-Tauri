import { Squircle } from "../components/ui/Squircle";
import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import {
  Plus,
  RefreshCw,
  Search,
  Star,
  Gamepad2,
  X,
  Filter,
  Trophy,
  Clock,
  Compass,
  ChevronDown,
} from "lucide-react";
import { SfGamepadIcon, SfComputerIcon } from "../design-system/sf-symbols";
import { PlatformSelectorModal } from "../components/home/PlatformSelectorModal";
import {
  PlatformAllIcon,
  PlatformSteamIcon,
  PlatformEpicIcon,
  PlatformEaIcon,
  PlatformUbisoftIcon,
  PlatformGogIcon,
  PlatformXboxIcon,
  PlatformRiotIcon,
  PlatformBattlenetIcon,
  PlatformRockstarIcon,
  PlatformLocalIcon,
} from "../components/home/PlatformIcons";
import { TopBarClock } from "../components/home/TopBarClock";
import { ConsoleLibraryTabs } from "../components/home/ConsoleLibraryTabs";
import { SteamDeckControllerFooter } from "../components/home/SteamDeckControllerFooter";
import { ControllerButtonGlyph } from "../components/ui/ControllerButtonGlyph";

import DynamicBackground from "../components/DynamicBackground";
import { GameEnvironment } from "../components/home/GameEnvironment";
import { HeroGame } from "../components/home/HeroGame";
import { HomeTopNav } from "../components/home/HomeTopNav";
import { PlatformShortcutHint } from "../components/home/PlatformShortcutHint";
import { EpicConnectModal } from "../components/settings/EpicConnectModal";
import { PlatformLibrarySkeleton } from "../components/PlatformLibrarySkeleton";
import { fetchEpicStatus } from "../services/epic";
import GameRow from "../components/GameRow";
import LoadingSkeleton from "../components/LoadingSkeleton";
import LoadingState from "../components/ui/loading-state";
import { LinearProgress } from "../components/ui/LinearProgress";
import { HomeOverviewPanels } from "../components/HomeOverviewPanels";
import DashboardContinuePlaying from "../components/DashboardContinuePlaying";
import type { LibraryFilters } from "../components/LibraryFilterModal";
import { HomeOnboardingQuests } from "../components/home/HomeOnboardingQuests";
import { getAllQuestsWithStatus, shouldShowOnboardingQuests, areAllQuestsCompleted } from "../services/userQuests";

import { PHERIELIUM_LOGO_PATH } from "../constants/assets";
import {
  ConfirmationModal,
  EmptyLibraryOnboarding,
  EmptyState,
} from "../components/home/HomePanels";
import { useNotification } from "../components/NotificationCenter";
import ModalShell from "../components/ui/ModalShell";
import FriendProfileModal from "../components/friends/FriendProfileModal";
import { ProfileDropdown } from "../components/ui/ProfileDropdown";
import { ShinyButton } from "../components/ui/shiny-button";
import { ThinkingOrbLoader } from "../components/ThinkingOrbLoader";
import { UpdateAvailableBanner } from "../components/UpdateAvailableBanner";
import { DigitPopIn } from "../components/ui/DigitPopIn";
import { useAuth } from "../auth/AuthProvider";
import { supabase } from "../services/supabase";
// Correção 1: Importando Game, UserProfile e SocialFriend no mesmo lugar
import type { ChatMessage, Game, SocialFriend, UserProfile, LauncherType } from "../types/domain";
import { getMonitorableExecutablePath, resolveMonitorableExecutablePath } from "../services/launcher";
import { resolveGameFromPresence } from "../utils/presenceGameMatch";
import { useImagePreloader } from "../hooks/useImagePreloader";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { useGameColor } from "../hooks/useGameColor";
import Sidebar, {
  CATEGORIES,
  SteamBrandIcon,
  DiscordBrandIcon,
  EpicBrandIcon,
  EaBrandIcon,
  UbisoftBrandIcon,
  GogBrandIcon,
  XboxBrandIcon,
  RiotBrandIcon,
  BattlenetBrandIcon,
  RockstarBrandIcon,
} from '../components/Sidebar';
import { useGamepadFocusNavigation } from '../hooks/useGamepadFocusNavigation';
import { useGamePresence } from '../hooks/useGamePresence';
import { useAchievementLibrarySync } from '../hooks/useAchievementLibrarySync';
import { useAccountConnections } from '../hooks/useAccountConnections';
import { buildLocalFriendProfile, useFriendsSystem } from '../hooks/useFriendsSystem';
import { useVoiceCallContext } from '../context/VoiceCallContext';
import { useGamepadNavigation } from "../hooks/useGamepadNavigation";
import {
  usePreferences,
  type LauncherLanguage,
  type SoundTheme,
  type VisualTheme,
} from "../context/PreferencesContext";
import { useGameLibraryView } from "../hooks/useGameLibraryView";
import {
  closeChatConnection,
  establishChatConnection,
  markMessagesAsRead,
  sendChatImage,
  sendChatMessage,
  setChatTyping,
  compareChatMessages,
  subscribeToChatMessages,
  subscribeToFriendTyping,
} from "../services/chat";
import { isManualDnd, PRESENCE_PREF_EVENT } from "../services/presenceStatus";
import type { SteamAchievement } from "../services/steam";
import {
  invalidateSteamAchievementCache,
  achievementUnlockBelongsToGame,
  loadOverlayAchievementsForGame,
  patchOverlayAchievementUnlock,
} from "../services/overlayAchievements";

import {
  getCheckpointFriendProfile,
  fetchUserGamesForProfile,
  updateCheckpointPresence,
  markCheckpointOfflineSync,
  markCheckpointOfflineAsync,
  getCachedAccessToken,
} from "../services/checkpointFriends";
import { apiUrl } from "../services/api";
import {
  getAdjacentSidebarCategory,
  readLastNavigation,
  writeLastCategory,
  writeLastSettingsTab,
  consumeSettingsConnectionsRequest,
  type SettingsTab,
} from "../services/launcherNavigation";

import {
  deleteLibraryGame,
  importFirestoreLibraryIntoLocal,
  listLibraryGames,
  syncPublicLibrarySummary,
  updateLibraryGame,
} from "../services/localLibrary";
import { useGamepadButton, useGamepad, playHapticPattern } from "../context/GamepadContext";
import { activateElementWithController } from "../utils/controllerTextInput";
import { calculateAchievementTotals } from "../utils/achievementTotals";
import { formatPlayedHours, getGamePlayedHours } from "../utils/playtime";
import { calculatePlayerLevel, aggregateTrophyCounts } from "../utils/trophyTiers";
import { getHubAggregateCounts, getUserUnifiedLevel } from "../utils/hubTrophies";
import { progressionEventBus } from "../services/progressionEvents";
import { completeUserQuest } from "../services/userQuests";
import { resolveLibraryLoadingState } from "../utils/libraryLoading";

const AddGameModal = React.lazy(() => import("../components/AddGameModal"));
const GameDetailPanel = React.lazy(() => import("../components/GameDetailPanel"));
const UserProfilePage = React.lazy(() => import("../components/UserProfilePage"));
const GamingRadarPage = React.lazy(() => import("../components/GamingRadarPage"));
const ModsPage = React.lazy(() => import("./ModsPage"));
const TrophiesPage = React.lazy(() => import("../components/TrophiesPage"));
const SettingsPageV2 = React.lazy(() =>
  import("../pages/SettingsPage").then((m) => ({ default: m.SettingsPageV2 }))
);
const FriendsPage = React.lazy(() =>
  import("../pages/FriendsPage").then((m) => ({ default: m.FriendsPage }))
);
const AddFriendModal = React.lazy(() =>
  import("../pages/FriendsPage").then((m) => ({ default: m.AddFriendModal }))
);
const ChatModal = React.lazy(() =>
  import("../components/home/ChatModal").then((m) => ({ default: m.ChatModal }))
);
const LibraryFilterModal = React.lazy(() => import("../components/LibraryFilterModal"));
const CommandPalette = React.lazy(() => import("../components/CommandPalette"));
const WelcomeModal = React.lazy(() => import("../components/WelcomeModal"));

const steamDiscKey = (uid: string) => `checkpoint_steam_disconnected_${uid}`;
const LANGUAGE_OPTIONS: Array<{ id: LauncherLanguage; label: string; hint: string }> = [
  { id: "pt-BR", label: "Português", hint: "Brasil" },
  { id: "en-US", label: "English", hint: "United States" },
  { id: "es-ES", label: "Español", hint: "España" },
  { id: "fr-FR", label: "Français", hint: "France" },
  { id: "de-DE", label: "Deutsch", hint: "Deutschland" },
  { id: "it-IT", label: "Italiano", hint: "Italia" },
];

const APP_THEME_OPTIONS: Array<{
  id: "default" | "ps5" | "playstation" | "ps4" | "psp" | "gamecube" | "xbox360" | "cyberpunk";
  label: string;
  hint: string;
  swatch: string;
  soundTheme: SoundTheme;
  visualTheme: VisualTheme;
}> = [
    {
      id: "default",
      label: "Phelierium Default",
      hint: "Preto carvão + branco neutro, superfícies foscas",
      swatch: "rgb(255 255 255)",
      soundTheme: "default",
      visualTheme: "phelierium",
    },
    {
      id: "ps5",
      label: "PlayStation 5",
      hint: "Branco porcelana + azul elétrico pontual",
      swatch: "rgb(244 244 246)",
      soundTheme: "ps5",
      visualTheme: "ps5",
    },
    {
      id: "ps4",
      label: "PlayStation 4",
      hint: "Azul médio intenso com gradientes amplos",
      swatch: "rgb(0 112 209)",
      soundTheme: "ps4",
      visualTheme: "ps4",
    },
    {
      id: "psp",
      label: "PSP",
      hint: "Grafite + prata com ondas e champagne discreto",
      swatch: "rgb(203 213 225)",
      soundTheme: "psp",
      visualTheme: "psp",
    },
    {
      id: "playstation",
      label: "PlayStation 2",
      hint: "Azul profundo com ciano pontual",
      swatch: "rgb(29 78 216)",
      soundTheme: "ps2",
      visualTheme: "playstation",
    },
    {
      id: "gamecube",
      label: "GameCube",
      hint: "Roxo Nintendo + sons GameCube",
      swatch: "rgb(124 58 237)",
      soundTheme: "gamecube",
      visualTheme: "gamecube",
    },
    {
      id: "cyberpunk",
      label: "Cyberpunk 2077",
      hint: "Amarelo Neon + sons Cyberpunk 2077",
      swatch: "rgb(255 238 0)",
      soundTheme: "cyberpunk",
      visualTheme: "cyberpunk",
    },
    {
      id: "xbox360",
      label: "Xbox 360",
      hint: "Verde Xbox + sons Metro UI",
      swatch: "rgb(132 204 22)",
      soundTheme: "xbox360",
      visualTheme: "xbox360",
    },
  ];


const Home: React.FC = () => {
  const { user, userProfile, signOutUser, refreshProfile } = useAuth();
  const { notify } = useNotification();
  const gamepad = useGamepad();
  const gamepadFamily = gamepad?.gamepadFamily || "xbox";
  const isGamepadConnected = Boolean(gamepad?.isGamepadConnected);
  const voiceCallContext = useVoiceCallContext();
  const voiceCall = voiceCallContext;
  const lastPresenceActivityRef = useRef(Date.now());
  const [games, setGames] = useState<Game[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeCategory, setActiveCategory] = useState("ALL");
  const isPlatformOrFavoritesPage = useMemo(() => {
    return (
      activeCategory.startsWith("custom_") ||
      [
        "ALL",
        "INSTALLED",
        "FAVORITES",
        "RECENT",
        "STEAM",
        "EPIC",
        "EA",
        "UBISOFT",
        "GOG",
        "XBOX",
        "RIOT",
        "BATTLENET",
        "ROCKSTAR",
        "LOCAL",
      ].includes(activeCategory)
    );
  }, [activeCategory]);
  const [isLoading, setIsLoading] = useState(true);
  const loadedLibraryOwnerRef = useRef<string | null>(null);
  const [localLibraryReady, setLocalLibraryReady] = useState(false);
  const [selectedGame, setSelectedGame] = useState<Game | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);

  // Sincronizar selectedGame com a lista atualizada após refreshLibrary
  React.useEffect(() => {
    if (!selectedGame || !isDetailOpen) return;
    const updated = games.find((g) => g.id === selectedGame.id);
    if (updated && updated !== selectedGame) {
      setSelectedGame(updated);
    }
  }, [games, selectedGame, isDetailOpen]);

  const [xpRevision, setXpRevision] = useState(0);
  useEffect(() => {
    const onXp = () => setXpRevision((r) => r + 1);
    const unsub = progressionEventBus.onXpGained(onXp);
    window.addEventListener("checkpoint:xp-gained", onXp);
    return () => {
      unsub();
      window.removeEventListener("checkpoint:xp-gained", onXp);
    };
  }, []);

  // Nível seguro e canônico: calculado unificadamente pelo Hub
  const playerLevel = useMemo(() => {
    if (user?.uid) {
      return getUserUnifiedLevel(user.uid, games);
    }
    const agg = aggregateTrophyCounts(games);
    return calculatePlayerLevel(0, 0, 0, agg);
  }, [games, user?.uid, xpRevision]);

  // refs para level-up (efeito real fica após playSound para evitar TDZ)
  const prevLevelRef = React.useRef<number>(0);
  const levelUpTimerRef = React.useRef<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [signOutModalOpen, setSignOutModalOpen] = useState(false);
  const [quitAppModalOpen, setQuitAppModalOpen] = useState(false);
  const [disconnectSteamModalOpen, setDisconnectSteamModalOpen] =
    useState(false);
  const [disconnectDiscordModalOpen, setDisconnectDiscordModalOpen] =
    useState(false);
  const [disconnectEpicModalOpen, setDisconnectEpicModalOpen] =
    useState(false);
  const [steamDisconnecting, setSteamDisconnecting] = useState(false);
  const [discordDisconnecting, setDiscordDisconnecting] = useState(false);
  const [epicDisconnecting, setEpicDisconnecting] = useState(false);
  const [epicConnectModalOpen, setEpicConnectModalOpen] = useState(false);
  const [epicAuthConnected, setEpicAuthConnected] = useState<boolean>(() => {
    // Pre-initialize from localStorage so the state starts as `true` when the user
    // was already linked. This prevents the false→true transition on every hub
    // open from triggering the "new connection" auto-sync effect.
    try {
      const linkedUid = localStorage.getItem("checkpoint_epic_linked_uid");
      return Boolean(linkedUid);
    } catch {
      return false;
    }
  });
  const [epicDisplayName, setEpicDisplayName] = useState("");
  const [isExitingSession, setIsExitingSession] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTab>("general");
  const [filterModalOpen, setFilterModalOpen] = useState(false);
  const [isPlatformModalOpen, setIsPlatformModalOpen] = useState(false);
  const [openedViaShortcut, setOpenedViaShortcut] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isQuestsModalOpen, setIsQuestsModalOpen] = useState(false);

  const [questsRevision, setQuestsRevision] = useState(0);

  // Escutar atualizações de missões em tempo real
  useEffect(() => {
    const handleUpdate = () => setQuestsRevision((r) => r + 1);
    const unsub = progressionEventBus.onXpGained(handleUpdate);
    window.addEventListener("checkpoint:xp-gained", handleUpdate);
    window.addEventListener("checkpoint:quest-completed", handleUpdate);
    return () => {
      unsub();
      window.removeEventListener("checkpoint:xp-gained", handleUpdate);
      window.removeEventListener("checkpoint:quest-completed", handleUpdate);
    };
  }, []);

  const isQuestsEligible = useMemo(() => {
    if (!user?.uid) return false;
    void questsRevision;
    const quests = getAllQuestsWithStatus(user.uid);
    if (quests.length > 0 && quests.every((q) => q.completed)) return false;
    if (areAllQuestsCompleted(user.uid)) return false;

    return shouldShowOnboardingQuests(user.uid, userProfile, {
      totalGames: games.length,
      level: playerLevel.level,
    });
  }, [user?.uid, userProfile, games.length, playerLevel.level, questsRevision]);

  const questsStatus = useMemo(() => {
    if (!user?.uid || !isQuestsEligible) return { completed: 0, total: 0 };
    void questsRevision;
    const list = getAllQuestsWithStatus(user.uid);
    return {
      completed: list.filter((q) => q.completed).length,
      total: list.length,
    };
  }, [user?.uid, isQuestsEligible, questsRevision]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "k" || e.key === "K")) {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (e.ctrlKey && e.code === "Space") {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);
  const [libraryFilters, setLibraryFilters] = useState<LibraryFilters>(() => {
    try {
      const stored = localStorage.getItem("checkpoint_library_filters");
      if (stored) {
        return {
          launchers: [],
          categories: [],
          favoritesOnly: false,
          withAchievements: false,
          minHours: 0,
          maxHours: 0,
          sortBy: "title",
          sortDir: "asc",
          ...JSON.parse(stored),
        };
      }
    } catch {
      // ignore
    }
    return {
      launchers: [],
      categories: [],
      favoritesOnly: false,
      withAchievements: false,
      minHours: 0,
      maxHours: 0,
      sortBy: "title",
      sortDir: "asc",
    };
  });

  useEffect(() => {
    try {
      localStorage.setItem("checkpoint_library_filters", JSON.stringify(libraryFilters));
    } catch {
      // ignore
    }
  }, [libraryFilters]);

  const [friendProfileModal, setFriendProfileModal] = useState<{
    profile: UserProfile;
    games: Game[];
  } | null>(null);
  const [pendingFriendRemoval, setPendingFriendRemoval] = useState<SocialFriend | null>(null);
  const [pendingDeleteGame, setPendingDeleteGame] = useState<Game | null>(null);
  const [friendProfileLoadingId, setFriendProfileLoadingId] = useState<string | null>(null);
  const [localSocialStateLoaded, setLocalSocialStateLoaded] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    game: Game;
  } | null>(null);

  const activeInputType = gamepad.activeInputType;

  const [editingGame, setEditingGame] = useState<Game | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addModalInitialLauncherType, setAddModalInitialLauncherType] = useState<LauncherType | undefined>(undefined);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [isAddFriendModalOpen, setIsAddFriendModalOpen] = useState(false);
  const [isSidebarExpanded, setIsSidebarExpanded] = useState<boolean>(() => {
    try {
      const stored = localStorage.getItem("checkpoint_sidebar_expanded");
      return stored !== null ? stored === "true" : true;
    } catch {
      return true;
    }
  });

  useEffect(() => {
    const handleToggle = (e: CustomEvent<{ expanded: boolean }>) => {
      setIsSidebarExpanded(e.detail.expanded);
    };
    window.addEventListener("checkpoint:sidebar-toggle" as any, handleToggle);
    return () => {
      window.removeEventListener("checkpoint:sidebar-toggle" as any, handleToggle);
    };
  }, []);

  const [isWelcomeModalOpen, setIsWelcomeModalOpen] = useState(false);

  useEffect(() => {
    if (!user?.uid) return;
    const seenKey = `phelierium_welcome_modal_seen_${user.uid}`;
    try {
      const seen = localStorage.getItem(seenKey);
      if (!seen) {
        setIsWelcomeModalOpen(true);
      }
    } catch {}
  }, [user?.uid]);

  useEffect(() => {
    const handleOpenTour = () => setIsWelcomeModalOpen(true);
    window.addEventListener("phelierium:open-welcome-modal", handleOpenTour);
    return () => window.removeEventListener("phelierium:open-welcome-modal", handleOpenTour);
  }, []);

  const handleCloseWelcomeModal = useCallback(() => {
    setIsWelcomeModalOpen(false);
    if (user?.uid) {
      try {
        localStorage.setItem(`phelierium_welcome_modal_seen_${user.uid}`, "true");
      } catch {}
    }
  }, [user?.uid]);

  const gameRailWheelTimeRef = useRef(0);
  const previousSteamIdRef = useRef<string | undefined>(undefined);
  const previousDiscordIdRef = useRef<string | undefined>(undefined);
  // useRef does NOT support lazy initializers — read localStorage directly at declaration time.
  const previousEpicAuthRef = useRef<boolean>(
    (() => { try { return Boolean(localStorage.getItem("checkpoint_epic_linked_uid")); } catch { return false; } })()
  );
  const didInitConnectionRefs = useRef(false);
  const lastOverlayWelcomeGameRef = useRef<string | null>(null);
  const lastOverlayWelcomeAtRef = useRef(0);
  const lastGameLaunchSoundRef = useRef<{ title: string; time: number }>({ title: "", time: 0 });

  const {
    language: launcherLanguage,
    effectsVolume,
    achievementVolume,
    notificationVolume,
    musicVolume,
    soundTheme,
    visualTheme,
    setLanguage: setLauncherLanguage,
    setEffectsVolume,
    setAchievementVolume,
    setNotificationVolume,
    setMusicVolume,
    setSoundTheme,
    setVisualTheme,
    minimizeToTrayOnClose,
    confirmBeforeExit,
    restoreLastScreen,
    callOverlayEnabled,
    preferencesHydrated,
    t,
  } = usePreferences();

  const restoredNavigationUidRef = useRef<string | null>(null);
  const currentUserUid = user?.uid;

  const selectCategory = useCallback((category: string) => {
    setActiveCategory(category);
    if (currentUserUid) writeLastCategory(currentUserUid, category);
  }, [currentUserUid]);

  const handleSettingsTabChange = useCallback((tab: SettingsTab) => {
    setSettingsTab(tab);
    if (currentUserUid) writeLastSettingsTab(currentUserUid, tab);
  }, [currentUserUid]);

  useEffect(() => {
    if (!currentUserUid || !preferencesHydrated || restoredNavigationUidRef.current === currentUserUid) return;
    restoredNavigationUidRef.current = currentUserUid;
    const lastNavigation = readLastNavigation(currentUserUid);
    const openConnections = consumeSettingsConnectionsRequest(currentUserUid);
    const timer = window.setTimeout(() => {
      setSettingsTab(lastNavigation.settingsTab);
      if (openConnections || restoreLastScreen) setActiveCategory(lastNavigation.category);
    }, 0);
    return () => window.clearTimeout(timer);
  }, [currentUserUid, preferencesHydrated, restoreLastScreen]);

  useEffect(() => {
    if (!preferencesHydrated) return;
    void window.electronAPI?.setWindowBehavior?.({
      minimizeToTray: minimizeToTrayOnClose,
      confirmBeforeExit,
    }).catch(console.error);
  }, [minimizeToTrayOnClose, confirmBeforeExit, preferencesHydrated]);

  useEffect(() => window.electronAPI?.onExitConfirmationRequested?.(() => {
    setQuitAppModalOpen(true);
  }), []);
  const { playSound } = useSoundEffects(
    effectsVolume / 100,
    soundTheme,
    notificationVolume / 100,
  );

  // Alt + Scroll to quickly open and spin the platform selector drawer
  useEffect(() => {
    const handleAltWheelTrigger = (e: WheelEvent) => {
      if (e.altKey) {
        e.preventDefault();
        if (!isPlatformModalOpen) {
          setIsPlatformModalOpen(true);
          setOpenedViaShortcut(true);
          playSound("showModal");
        }
      }
    };

    window.addEventListener("wheel", handleAltWheelTrigger, { capture: true, passive: false });
    return () => window.removeEventListener("wheel", handleAltWheelTrigger, { capture: true });
  }, [isPlatformModalOpen, playSound]);
  const userDisplay =
    userProfile?.displayName || user?.email?.split("@")[0] || "Jogador";
  const legacySteamId = (userProfile as unknown as { steam_id?: string })?.steam_id;
  const resolvedSteamId = useMemo(
    () => userProfile?.steamId || legacySteamId || undefined,
    [userProfile?.steamId, legacySteamId],
  );
  const resolvedDiscordId = useMemo(
    () => userProfile?.discordId || undefined,
    [userProfile?.discordId],
  );

  // Level up detection — após playSound para evitar TDZ, persistido por usuário, ignora dips
  useEffect(() => {
    if (!user?.uid || isLoading || games.length === 0) return;
    const storageKey = `checkpoint_last_level_${user.uid}`;
    const storedRaw = localStorage.getItem(storageKey);
    const storedLevel = storedRaw ? Number(storedRaw) : 0;
    if (storedLevel === 0) {
      localStorage.setItem(storageKey, String(playerLevel.level));
      prevLevelRef.current = playerLevel.level;
      return;
    }
    if (prevLevelRef.current === 0) prevLevelRef.current = storedLevel;
    if (playerLevel.level > storedLevel && playerLevel.level > prevLevelRef.current) {
      const tierInfo = playerLevel.tierInfo;
      setLevelUpData({
        level: playerLevel.level,
        rank: playerLevel.rank,
        rankColor: playerLevel.rankColor,
        tierInfo,
        prevLevel: prevLevelRef.current,
        xp: playerLevel.xp,
        progress: playerLevel.progress,
      } as any);
      setShowLevelUp(true);
      if (levelUpTimerRef.current) window.clearTimeout(levelUpTimerRef.current);
      levelUpTimerRef.current = window.setTimeout(() => setShowLevelUp(false), 6000) as unknown as number;
      playSound("select");
      localStorage.setItem(storageKey, String(playerLevel.level));
    } else if (playerLevel.level > storedLevel) {
      localStorage.setItem(storageKey, String(playerLevel.level));
    }
    prevLevelRef.current = playerLevel.level;
  }, [playerLevel.level, playerLevel.rank, playerLevel.rankColor, playerLevel.xp, playerLevel.progress, user?.uid, isLoading, games.length, playSound]);

  const refreshLibrary = useCallback(async () => {
    if (!user?.uid) {
      setGames([]);
      setIsLoading(false);
      loadedLibraryOwnerRef.current = null;
      return;
    }
    const loadingState = resolveLibraryLoadingState(
      loadedLibraryOwnerRef.current === user.uid,
    );
    if (loadingState.showSkeleton) setIsLoading(true);
    try {
      setGames(await listLibraryGames(user.uid));
      loadedLibraryOwnerRef.current = user.uid;
    } finally {
      if (loadingState.showSkeleton) setIsLoading(false);
    }
  }, [user?.uid]);

  useAchievementLibrarySync(
    user?.uid,
    resolvedSteamId,
    games,
    !isLoading,
    refreshLibrary,
  );

  // Correção 2: Desestruturando as funções faltantes
  const {
    currentPresenceGame,
    currentPresenceExecutablePath,
    sessionStartedAt: overlaySessionStartedAt,
    presenceVerification,
    prepareLaunchPresence,
    syncDetectedRunningGame,
  } = useGamePresence({
    userUid: user?.uid,
    userProfile,
    games,
    onLibraryChanged: refreshLibrary,
  });

  const {
    steamConnecting,
    setSteamConnecting,
    discordConnecting,
    setDiscordConnecting,
    epicConnecting,
    setEpicConnecting,
    steamSyncing,
    connectSteam,
    cancelSteamConnect,
    connectDiscord,
    cancelDiscordConnect,
    handleDisconnectSteam,
    handleDisconnectDiscord,
    handleDisconnectEpic,
    handleSyncSteam,
    epicSyncing,
    handleSyncEpic,
    platformOperations,
    platformOps,
  } = useAccountConnections({
    userUid: user?.uid,
    profile: userProfile,
    resolvedSteamId,
    playSound,
    notify,
    refreshProfile,
    setSelectedIndex,
    onLibraryChanged: refreshLibrary,
    language: launcherLanguage,
  });

  // Verifica se o usuário já está autenticado na Epic via Desktop IPC.
  // Não derruba o UI para "desconectado" em falha transitória do Legendary:
  // o flag local só some no logout explícito (e os jogos Epic saem junto).
  const checkEpicStatus = useCallback(async () => {
    if (!user?.uid) {
      setEpicAuthConnected(false);
      return;
    }

    let linkedLocally = false;
    try {
      linkedLocally = localStorage.getItem("checkpoint_epic_linked_uid") === user.uid;
    } catch { /* ignore */ }
    if (linkedLocally) {
      setEpicAuthConnected(true);
    }

    try {
      const data = await fetchEpicStatus();
      if (data.authenticated === true) {
        setEpicAuthConnected(true);
        previousEpicAuthRef.current = true;
        try {
          localStorage.setItem("checkpoint_epic_linked_uid", user.uid);
        } catch { /* ignore */ }
        if (data.displayName) setEpicDisplayName(data.displayName);
        return;
      }

      // Legendary disse "não autenticado". Só aceita se não houver vínculo local
      // (logout real limpa o flag; falha transitória mantém o pill conectado).
      if (!linkedLocally) {
        setEpicAuthConnected(false);
      }
    } catch (err) {
      console.warn("[Home] checkEpicStatus falhou; mantendo estado visual:", err);
    }
  }, [user?.uid]);

  useEffect(() => {
    if (!user?.uid) return;
    try {
      if (localStorage.getItem("checkpoint_epic_linked_uid") === user.uid) {
        setEpicAuthConnected(true);
      }
    } catch { /* ignore */ }
    void checkEpicStatus();
  }, [checkEpicStatus, user?.uid]);

  const isAnySyncing = steamSyncing || epicSyncing;

  // Sincroniza as contas ja conectadas; sem nenhuma conectada, leva a Configuracoes > Conexoes.
  const handleSyncLibraries = useCallback(() => {
    const steamConnected = Boolean(resolvedSteamId);
    if (!steamConnected && !epicAuthConnected) {
      notify("Conecte sua conta Steam ou Epic para sincronizar os jogos.", "info");
      setSettingsTab("connections");
      selectCategory("SETTINGS");
      return;
    }
    if (steamConnected) void handleSyncSteam();
    if (epicAuthConnected) void handleSyncEpic();
    notify(
      steamConnected && epicAuthConnected
        ? "Sincronizando Steam e Epic Games..."
        : steamConnected
          ? "Sincronizando Steam... (Epic não conectada: veja Configurações > Conexões)"
          : "Sincronizando Epic Games... (Steam não conectada: veja Configurações > Conexões)",
      "info",
    );
  }, [resolvedSteamId, epicAuthConnected, notify, selectCategory, handleSyncSteam, handleSyncEpic]);

  const {
    socialFriends,
    unreadMessagesByFriend,
    incomingFriendRequests,
    activeChatFriend,
    setActiveChatFriend,
    removeFriend,
    handleAddCheckpointFriend,
    acceptFriendRequest,
    rejectFriendRequest,
  } = useFriendsSystem({
    user,
    userProfile,
    playSound,
    notify,
    refreshProfile,
    localSocialStateLoaded,
    setLocalSocialStateLoaded,
    setIsAddFriendModalOpen,
  });

  const { startCall, startTestCall } = voiceCallContext;

  const [overlayAchievements, setOverlayAchievements] = useState<{
    loading: boolean;
    items: SteamAchievement[];
    unlocked: number;
    available: number;
  }>({ loading: false, items: [], unlocked: 0, available: 0 });
  const [overlayAchievementRevision, setOverlayAchievementRevision] = useState(0);
  const [overlayChatFriendId, setOverlayChatFriendId] = useState<string | null>(null);
  const [overlayChatMessages, setOverlayChatMessages] = useState<ChatMessage[]>([]);
  const [overlayChatTyping, setOverlayChatTyping] = useState(false);
  const [overlayChatSending, setOverlayChatSending] = useState(false);
  const [overlayChatError, setOverlayChatError] = useState<string | null>(null);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpData, setLevelUpData] = useState<{ level: number; rank: string; rankColor: string; tierInfo?: any; prevLevel?: number; xp?: number; progress?: number } | null>(null);

  const overlayCurrentGame = useMemo(() => {
    if (!currentPresenceGame && !currentPresenceExecutablePath) return null;
    return resolveGameFromPresence(games, currentPresenceGame, currentPresenceExecutablePath);
  }, [currentPresenceGame, currentPresenceExecutablePath, games]);
  const overlayCurrentGameRef = useRef(overlayCurrentGame);
  overlayCurrentGameRef.current = overlayCurrentGame;
  const overlayPanelTimerRef = useRef<number | null>(null);
  const overlayPanelPayloadRef = useRef<Record<string, unknown> | null>(null);

  const overlayChatFriend = useMemo(
    () => socialFriends.find((friend) => friend.id === overlayChatFriendId) || null,
    [overlayChatFriendId, socialFriends],
  );


  useEffect(() => {
    if (!didInitConnectionRefs.current) {
      previousSteamIdRef.current = resolvedSteamId;
      previousDiscordIdRef.current = resolvedDiscordId;
      previousEpicAuthRef.current = epicAuthConnected;
      didInitConnectionRefs.current = true;
      return;
    }

    if (!previousSteamIdRef.current && resolvedSteamId) {
      notify("Conta Steam conectada com sucesso.", "success");
      setSteamConnecting(false);
    }

    if (!previousDiscordIdRef.current && resolvedDiscordId) {
      notify("Conta Discord conectada com sucesso.", "success");
      setDiscordConnecting(false);
    }

    previousSteamIdRef.current = resolvedSteamId;
    previousDiscordIdRef.current = resolvedDiscordId;
  }, [notify, resolvedDiscordId, resolvedSteamId, setDiscordConnecting, setSteamConnecting]);

  useEffect(() => {
    const openSettings = () => {
      setSettingsTab("general");
      selectCategory("SETTINGS");
    };
    window.addEventListener("phelierium:open-settings-tab", openSettings);
    return () => window.removeEventListener("phelierium:open-settings-tab", openSettings);
  }, [selectCategory]);

  // ── Auto-Updater Global Listener ──────────────────────────────────────────
  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onUpdateMessage) return;

    const showUpdateNotification = (status: string, data?: { version?: string } | string) => {
      const version = typeof data === "object" ? data?.version : undefined;
      if (status === "update-available") {
        notify(
          `Nova atualização pendente${version ? ` (v${version})` : ""}. Abra as Configurações para baixar e atualizar.`,
          "warning",
          { id: "checkpoint-app-update", title: "Atualização do Pherielium", duration: 0 },
        );
      } else if (status === "update-downloaded") {
        notify(
          `A versão${version ? ` v${version}` : " nova"} está pronta. Vá em Configurações para instalar.`,
          "success",
          { id: "checkpoint-app-update", title: "Atualização pronta", duration: 0 },
        );
      }
    };

    void api.getUpdateState?.().then((state) => {
      if (state.status === "available" || state.status === "downloading") {
        showUpdateNotification("update-available", state.info || undefined);
      } else if (state.status === "downloaded") {
        showUpdateNotification("update-downloaded", state.info || undefined);
      }
    }).catch(() => undefined);

    const unsubscribe = api.onUpdateMessage((msg, data) => {
      if (msg === "update-available") {
        showUpdateNotification(msg, data);
      } else if (msg === "update-downloaded") {
        showUpdateNotification(msg, data);
      }
    });

    // Check GitHub even if Settings is never opened
    const bootCheck = window.setTimeout(() => {
      void api.checkForUpdates?.().catch(() => undefined);
    }, 5000);
    const interval = window.setInterval(() => {
      void api.checkForUpdates?.().catch(() => undefined);
    }, 6 * 60 * 60 * 1000);

    return () => {
      unsubscribe?.();
      window.clearTimeout(bootCheck);
      window.clearInterval(interval);
    };
  }, [notify]);

  useEffect(() => {
    if (!user?.uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGames([]);

      setIsLoading(false);
      setLocalLibraryReady(false);
      return;
    }

    if (!window.electronAPI?.importLegacyGames || !userProfile?.gamesMigratedAt) {
      setLocalLibraryReady(true);
    }
    void refreshLibrary();
  }, [refreshLibrary, user?.uid, userProfile?.gamesMigratedAt]);

  useEffect(() => {
    if (
      !user?.uid
      || !userProfile?.gamesMigratedAt
      || !window.electronAPI?.importLegacyGames
    ) return;
    const migrateLocalLibrary = async () => {
      try {
        const result = await importFirestoreLibraryIntoLocal(user.uid);
        if (result.imported > 0) await refreshLibrary();
        setLocalLibraryReady(true);
      } catch (error) {
        console.error("Falha ao importar a biblioteca do Firestore para SQLite:", error);
      }
    };
    void migrateLocalLibrary();
  }, [refreshLibrary, user?.uid, userProfile?.gamesMigratedAt]);

  // Throttle do sync publico: evita POSTs em rajada a cada tecla/render.
  // O syncPublicLibrarySummary ja e no-op quando nada mudou (dirty=false +
  // fingerprint igual), mas o efeito abaixo dispara a cada mudanca de `games`.
  // Guardamos ultimo disparo + backoff apos falha para nao spammar o console.
  const publicSyncInFlightRef = useRef(false);
  const publicSyncLastAttemptRef = useRef(0);
  const publicSyncBackoffUntilRef = useRef(0);
  useEffect(() => {
    if (!user?.uid || isLoading || !localLibraryReady) return;
    const timer = window.setTimeout(() => {
      const now = Date.now();
      if (publicSyncInFlightRef.current) return;
      if (now < publicSyncBackoffUntilRef.current) return;
      // Debounce: ignora disparos com menos de 10s desde a ultima tentativa.
      if (now - publicSyncLastAttemptRef.current < 10_000) return;
      publicSyncInFlightRef.current = true;
      publicSyncLastAttemptRef.current = now;
      void syncPublicLibrarySummary(user.uid, userProfile)
        .catch((error) => {
          // Backoff de 60s apos falha + warn (nao error) para nao poluir o console.
          publicSyncBackoffUntilRef.current = Date.now() + 60_000;
          const msg = error instanceof Error ? error.message : String(error);
          if (msg.includes("42P10") || msg.includes("ON CONFLICT")) {
            console.warn(
              "Resumo público pendente: banco sem constraint única (rode `supabase db push`). Tentando de novo em 60s.",
            );
          } else {
            console.warn("Falha ao sincronizar resumo publico da biblioteca:", error);
          }
        })
        .finally(() => {
          publicSyncInFlightRef.current = false;
        });
    }, 2_000);
    return () => window.clearTimeout(timer);
  }, [games, isLoading, localLibraryReady, user?.uid, userProfile]);

  useEffect(() => {
    if (!user?.uid) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setOnboardingCompleted(false);
      return;
    }

    setOnboardingCompleted(
      localStorage.getItem(`checkpoint_onboarding_${user.uid}`) === "1" ||
      Boolean(userProfile?.onboardingCompletedAt),
    );
  }, [user?.uid, userProfile?.onboardingCompletedAt]);

  useEffect(() => {
    if (!user?.uid) {
      closeChatConnection();
      return;
    }
    void establishChatConnection();
    return () => {
      closeChatConnection();
    };
  }, [user?.uid]);

  useEffect(() => {
    const mark = () => {
      lastPresenceActivityRef.current = Date.now();
    };
    window.addEventListener("pointerdown", mark);
    window.addEventListener("keydown", mark);
    return () => {
      window.removeEventListener("pointerdown", mark);
      window.removeEventListener("keydown", mark);
    };
  }, []);

  useEffect(() => {
    if (!user?.uid) return;

    const heartbeat = () => {
      const inCall = Boolean(voiceCall?.callState && voiceCall.callState !== "idle");
      const sharing = Boolean(voiceCall?.isSharingScreen);
      const idle = Date.now() - lastPresenceActivityRef.current > 5 * 60 * 1000;
      const status = currentPresenceGame
        ? "playing"
        : sharing
          ? "streaming"
          : inCall
            ? "in_call"
            : isManualDnd()
              ? "dnd"
              : idle
                ? "idle"
                : "online";
      updateCheckpointPresence(
        status,
        currentPresenceGame || undefined,
        userProfile?.displayName || undefined,
        userProfile?.photoURL,
      ).catch(() => undefined);
    };

    heartbeat();
    const interval = window.setInterval(heartbeat, 60_000);
    window.addEventListener(PRESENCE_PREF_EVENT, heartbeat);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener(PRESENCE_PREF_EVENT, heartbeat);
    };
  }, [currentPresenceGame, user?.uid, userProfile?.displayName, userProfile?.photoURL, voiceCall?.callState, voiceCall?.isSharingScreen]);

  useEffect(() => {
    const handleGameLaunch = (event: Event) => {
      const detail = (event as CustomEvent<{
        title?: string;
        gameId?: string;
        executablePath?: string | null;
        game?: Game;
      }>).detail;
      const title = detail?.title?.trim();
      if (!title) return;

      const matchedGame = detail?.game
        || (detail?.gameId ? games.find((g) => g.id === detail.gameId) : null)
        || resolveGameFromPresence(games, title, detail?.executablePath)
        || null;

      const effectiveTitle = matchedGame?.title || title;

      const soundAlreadyPlayed = Boolean((detail as any)?.soundPlayed);
      const now = Date.now();
      if (
        !soundAlreadyPlayed &&
        (lastGameLaunchSoundRef.current.title !== effectiveTitle ||
          now - lastGameLaunchSoundRef.current.time > 4000)
      ) {
        lastGameLaunchSoundRef.current = { title: effectiveTitle, time: now };
        playSound("play");
      } else if (soundAlreadyPlayed) {
        lastGameLaunchSoundRef.current = { title: effectiveTitle, time: now };
      }
      const nowWelcome = Date.now();
      const welcomeAlreadyShown = lastOverlayWelcomeGameRef.current === effectiveTitle
        && nowWelcome - lastOverlayWelcomeAtRef.current < 20_000;
      if (!welcomeAlreadyShown) {
        lastOverlayWelcomeGameRef.current = effectiveTitle;
        lastOverlayWelcomeAtRef.current = nowWelcome;
        void window.electronAPI?.showGameStartOverlay({ gameTitle: effectiveTitle });
      }

      void (async () => {
        const monitorablePath = detail?.executablePath
          || (matchedGame ? await resolveMonitorableExecutablePath(matchedGame) : null)
          || (matchedGame ? getMonitorableExecutablePath(matchedGame) : null);

        if (monitorablePath && window.electronAPI?.setGameWatchTarget) {
          void window.electronAPI.setGameWatchTarget(monitorablePath).catch(() => undefined);
        }

        // Presença fica pendente até o processo ser confirmado pelo watcher/monitor.
        prepareLaunchPresence(effectiveTitle, monitorablePath);
      })();

      if (user?.uid) {
        completeUserQuest(user.uid, "launch_game", {
          playSound,
          onNotify: (msg, type) => notify(msg, type),
        });
      }
    };

    window.addEventListener("checkpoint:game-launch", handleGameLaunch);
    return () => window.removeEventListener("checkpoint:game-launch", handleGameLaunch);
  }, [games, prepareLaunchPresence, playSound, user?.uid, notify]);

  // Detecta jogos já abertos quando o hub inicia ou quando a lista de jogos
  // é carregada pela primeira vez (caso o usuário tenha aberto o hub com um jogo já rodando).
  const didInitialGameScanRef = React.useRef(false);
  useEffect(() => {
    if (!user?.uid || games.length === 0 || didInitialGameScanRef.current) return;
    didInitialGameScanRef.current = true;
    if (!currentPresenceGame) {
      void syncDetectedRunningGame();
    }
  }, [user?.uid, games.length, currentPresenceGame, syncDetectedRunningGame]);

  useEffect(() => {
    if (!currentPresenceGame) return;
    const nowWelcome = Date.now();
    if (
      lastOverlayWelcomeGameRef.current === currentPresenceGame
      && nowWelcome - lastOverlayWelcomeAtRef.current < 20_000
    ) {
      return;
    }
    lastOverlayWelcomeGameRef.current = currentPresenceGame;
    lastOverlayWelcomeAtRef.current = nowWelcome;
    void window.electronAPI?.showGameStartOverlay({
      gameTitle: currentPresenceGame,
    });
  }, [currentPresenceGame]);

  useEffect(() => {
    if (!user?.uid) return;

    // Sincroniza sessão de presença com o processo principal Node.js do Electron
    if (window.electronAPI?.setPresenceSession) {
      void window.electronAPI.setPresenceSession({
        uid: user.uid,
        displayName: userProfile?.displayName || undefined,
        token: getCachedAccessToken(),
        apiUrl: apiUrl(""),
      });
    }

    const markOffline = () => {
      markCheckpointOfflineSync(
        user.uid,
        userProfile?.displayName || undefined,
        userProfile?.photoURL,
      );
    };

    window.addEventListener("beforeunload", markOffline);
    window.addEventListener("pagehide", markOffline);

    const unsubQuitting = window.electronAPI?.onAppQuitting?.(async () => {
      if (user?.uid) {
        try {
          await markCheckpointOfflineAsync(
            user.uid,
            userProfile?.displayName || undefined,
            userProfile?.photoURL,
          );
        } catch (error) {
          console.warn("[home] Failed to sync offline presence before quit", error);
        }
      }
      void window.electronAPI?.confirmAppQuit?.();
    });

    return () => {
      window.removeEventListener("beforeunload", markOffline);
      window.removeEventListener("pagehide", markOffline);
      unsubQuitting?.();
    };
  }, [user?.uid, userProfile?.displayName, userProfile?.photoURL]);

  useEffect(() => {
    if (!user?.uid) return;

    if (!didInitConnectionRefs.current) {
      previousSteamIdRef.current = resolvedSteamId;
      previousDiscordIdRef.current = resolvedDiscordId;
      previousEpicAuthRef.current = epicAuthConnected;
      didInitConnectionRefs.current = true;
      return;
    }

    if (!previousSteamIdRef.current && resolvedSteamId) {
      previousSteamIdRef.current = resolvedSteamId;
      notify("Conta Steam vinculada com sucesso!", "success");
      playSound("select");
      void handleSyncSteam();
      // Se a Epic já estiver autenticada, sincroniza também automaticamente
      if (epicAuthConnected) {
        void handleSyncEpic();
      }
    } else {
      previousSteamIdRef.current = resolvedSteamId;
    }

    if (!previousDiscordIdRef.current && resolvedDiscordId) {
      previousDiscordIdRef.current = resolvedDiscordId;
      notify("Conta Discord vinculada com sucesso!", "success");
      playSound("select");
    } else {
      previousDiscordIdRef.current = resolvedDiscordId;
    }

    if (!previousEpicAuthRef.current && epicAuthConnected) {
      previousEpicAuthRef.current = epicAuthConnected;
      notify("Conta Epic Games vinculada com sucesso!", "success");
      playSound("select");
      void handleSyncEpic();
    } else {
      previousEpicAuthRef.current = epicAuthConnected;
    }
  }, [resolvedSteamId, resolvedDiscordId, epicAuthConnected, user?.uid, notify, playSound, handleSyncSteam, handleSyncEpic]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const steamStatus = params.get("steamStatus");
    const discordStatus = params.get("discordStatus");
    if ((!steamStatus && !discordStatus) || !user?.uid) return;

    if (steamStatus === "ok") {
      localStorage.removeItem(steamDiscKey(user.uid));
      notify("Conta Steam conectada com sucesso.", "success");
      void refreshProfile();
    } else if (steamStatus) {
      const labels: Record<string, string> = {
        invalid_state: "Estado inválido.",
        invalid: "Falha na validação OpenID.",
        missing_id: "Steam ID não retornado.",
        server_not_configured: "Backend Supabase Admin não configurado.",
        error: "Erro inesperado.",
      };
      notify(
        labels[steamStatus] ?? "Não foi possível conectar com a Steam.",
        "error",
      );
    }

    if (discordStatus === "ok") {
      notify("Conta Discord conectada com sucesso.", "success");
      void refreshProfile();
    } else if (discordStatus) {
      const labels: Record<string, string> = {
        invalid_state: "Estado inválido.",
        denied: "Autorização do Discord cancelada.",
        missing_code: "Código de retorno do Discord não recebido.",
        missing_id: "Conta Discord não retornou identificador.",
        client_not_configured: "Credenciais do Discord não configuradas no backend.",
        server_not_configured: "Backend Supabase Admin não configurado.",
        token_error: "O Discord recusou a troca do código de autenticação.",
        error: "Erro inesperado.",
      };
      notify(
        labels[discordStatus] ?? "Não foi possível conectar com o Discord.",
        "error",
      );
    }

    window.history.replaceState({}, document.title, window.location.pathname);
  }, [notify, refreshProfile, user?.uid]);

  useEffect(() => {
    const unsubscribe = window.electronAPI?.onAccountAuthCallback?.((payload) => {
      if (payload.steamStatus) {
        setSteamConnecting(false);
        if (payload.steamStatus === "ok") {
          void refreshProfile();
        } else {
          notify(`Não foi possível conectar com a Steam (${payload.steamStatus}).`, "error");
        }
      }

      if (payload.discordStatus) {
        setDiscordConnecting(false);
        if (payload.discordStatus === "ok") {
          void refreshProfile();
        } else {
          notify(`Não foi possível conectar com o Discord (${payload.discordStatus}).`, "error");
        }
      }
    });

    return () => unsubscribe?.();
  }, [
    notify,
    refreshProfile,
    setDiscordConnecting,
    setSteamConnecting,
  ]);

  const {
    displayGames,
    continuePlayingGames,
    favoriteShowcaseGames,
    friendsPlayingNow,
    recentOverviewActivity,
  } = useGameLibraryView({
    games,
    activeCategory,
    searchTerm,
    socialFriends,
    libraryFilters,
    t,
  });

  const canonicalIndex =
    displayGames.length > 0
      ? Math.min(Math.max(selectedIndex, 0), displayGames.length - 1)
      : 0;
  const currentGame = displayGames[canonicalIndex];

  // Passar rápido pelos cards não pode redesenhar o ambiente (blur grande + cor + trailer) a cada passo:
  // o fundo só troca quando a seleção assenta.
  const settledGame = useDebouncedValue(currentGame, 170);
  const settledTrailer = useDebouncedValue(currentGame?.trailerUrl, 450);
  const dominantColor = useGameColor(
    settledGame?.cardImage || settledGame?.image,
  );

  const activePlatformConfig = useMemo(() => {
    switch (activeCategory) {
      case "STEAM":
        return { label: "Steam", icon: <PlatformSteamIcon className="w-3.5 h-3.5" /> };
      case "EPIC":
        return { label: "Epic Games", icon: <PlatformEpicIcon className="w-3.5 h-3.5" /> };
      case "EA":
        return { label: "EA App", icon: <PlatformEaIcon className="w-3.5 h-3.5" /> };
      case "UBISOFT":
        return { label: "Ubisoft", icon: <PlatformUbisoftIcon className="w-3.5 h-3.5" /> };
      case "GOG":
        return { label: "GOG Galaxy", icon: <PlatformGogIcon className="w-3.5 h-3.5" /> };
      case "XBOX":
        return { label: "Xbox", icon: <PlatformXboxIcon className="w-3.5 h-3.5" /> };
      case "RIOT":
        return { label: "Riot Games", icon: <PlatformRiotIcon className="w-3.5 h-3.5" /> };
      case "BATTLENET":
        return { label: "Battle.net", icon: <PlatformBattlenetIcon className="w-3.5 h-3.5" /> };
      case "ROCKSTAR":
        return { label: "Rockstar", icon: <PlatformRockstarIcon className="w-3.5 h-3.5" /> };
      case "LOCAL":
        return { label: "Jogos Locais", icon: <PlatformLocalIcon className="w-3.5 h-3.5" /> };
      case "FAVORITES":
        return { label: "Favoritos", icon: <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" /> };
      case "INSTALLED":
        return { label: "Instalados", icon: <PlatformAllIcon className="w-3.5 h-3.5" /> };
      case "RECENT":
        return { label: "Recentes", icon: <Clock className="w-3.5 h-3.5" /> };
      default:
        return { label: "Todas as Plataformas", icon: <PlatformAllIcon className="w-3.5 h-3.5" /> };
    }
  }, [activeCategory]);

  const isAnyModalOpen =
    isPlatformModalOpen ||
    isAddModalOpen ||
    isDetailOpen ||
    Boolean(contextMenu) ||
    Boolean(activeChatFriend) ||
    Boolean(friendProfileModal) ||
    Boolean(pendingFriendRemoval) ||
    Boolean(pendingDeleteGame) ||
    isAddFriendModalOpen ||
    signOutModalOpen ||
    quitAppModalOpen ||
    disconnectSteamModalOpen ||
    disconnectDiscordModalOpen ||
    epicConnectModalOpen;

  useImagePreloader(
    useMemo(
      () =>
        displayGames
          .slice(0, 6)
          .flatMap((g) => [g.image, g.cardImage].filter(Boolean) as string[]),
      [displayGames],
    ),
  );
  const initialRecentSyncedRef = useRef(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (activeCategory === "ALL" && continuePlayingGames.length > 0) {
      const firstRecent = continuePlayingGames[0];
      const matchIdx = displayGames.findIndex((g) => g.id === firstRecent.id);
      if (matchIdx !== -1) {
        setSelectedIndex(matchIdx);
        return;
      }
    }
    setSelectedIndex(0);
  }, [activeCategory]);

  useEffect(() => {
    if (
      !initialRecentSyncedRef.current &&
      activeCategory === "ALL" &&
      continuePlayingGames.length > 0 &&
      displayGames.length > 0
    ) {
      initialRecentSyncedRef.current = true;
      const firstRecent = continuePlayingGames[0];
      const matchIdx = displayGames.findIndex((g) => g.id === firstRecent.id);
      if (matchIdx !== -1) {
        setSelectedIndex(matchIdx);
      }
    }
  }, [activeCategory, continuePlayingGames, displayGames]);

  useEffect(() => {
    if (displayGames.length === 0 && selectedIndex !== 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSelectedIndex(0);
    } else if (displayGames.length > 0 && selectedIndex > displayGames.length - 1) {

      setSelectedIndex(displayGames.length - 1);
    }
  }, [displayGames.length, selectedIndex]);

  useEffect(() => {
    const cards = document.querySelectorAll<HTMLElement>("[data-game-card]");
    if (cards[selectedIndex]) {
      cards[selectedIndex].focus();
    }
  }, [selectedIndex]);

  const openDetails = useCallback(
    (game: Game) => {
      setSelectedGame(game);
      setIsDetailOpen(true);
      setContextMenu(null);
      playSound("detailOpen");
    },
    [playSound],
  );

  const isSystemCategory = ["FRIENDS", "FEED", "MODS", "SETTINGS", "PROFILE", "DEALS", "TROPHIES", "RADAR"].includes(activeCategory);

  const { moveSystemFocus, adjustFocusedRange } = useGamepadFocusNavigation({
    playSound,
    activeCategory,
    isSystemCategory,
  });

  const closeTopGamepadSurface = useCallback(() => {
    if (isPlatformModalOpen) {
      setIsPlatformModalOpen(false);
      playSound("back");
      return;
    }
    if (friendProfileModal) {
      setFriendProfileModal(null);
      playSound("back");
      return;
    }
    if (activeChatFriend) {
      setActiveChatFriend(null);
      playSound("back");
      return;
    }
    if (pendingFriendRemoval) {
      setPendingFriendRemoval(null);
      playSound("back");
      return;
    }
    if (pendingDeleteGame) {
      setPendingDeleteGame(null);
      playSound("back");
      return;
    }
    if (signOutModalOpen) {
      setSignOutModalOpen(false);
      playSound("back");
      return;
    }
    if (quitAppModalOpen) {
      setQuitAppModalOpen(false);
      playSound("back");
      return;
    }
    if (disconnectSteamModalOpen) {
      setDisconnectSteamModalOpen(false);
      playSound("back");
      return;
    }
    if (disconnectDiscordModalOpen) {
      setDisconnectDiscordModalOpen(false);
      playSound("back");
      return;
    }
    if (disconnectEpicModalOpen) {
      setDisconnectEpicModalOpen(false);
      playSound("back");
      return;
    }
    if (epicConnectModalOpen) {
      setEpicConnectModalOpen(false);
      playSound("back");
      return;
    }
    if (isAddFriendModalOpen) {
      setIsAddFriendModalOpen(false);
      playSound("back");
      return;
    }
    if (contextMenu) {
      setContextMenu(null);
      playSound("back");
      return;
    }
    if (searchOpen) {
      setSearchOpen(false);
      setSearchTerm("");
      playSound("back");
      return;
    }
    if (activeCategory !== "ALL") {
      playSound("back");
      selectCategory("ALL");
      return;
    }
  }, [
    activeCategory,
    activeChatFriend,
    contextMenu,
    disconnectDiscordModalOpen,
    disconnectSteamModalOpen,
    disconnectEpicModalOpen,
    epicConnectModalOpen,
    friendProfileModal,
    isAddFriendModalOpen,
    isPlatformModalOpen,
    pendingDeleteGame,
    pendingFriendRemoval,
    playSound,
    searchOpen,
    selectCategory,
    setActiveChatFriend,
    signOutModalOpen,
    quitAppModalOpen,
  ]);

  useGamepadNavigation({
    disableX: true,
    disableO: false,
    onClose: closeTopGamepadSurface,
  });

  useGamepadButton("X", () => {
    if (searchOpen) {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) activateElementWithController(activeElement);
      return;
    }
    if (isAnyModalOpen) return;
    if (isSystemCategory) {
      const activeElement = document.activeElement;
      if (activeElement instanceof HTMLElement) {
        activateElementWithController(activeElement);
        return;
      }
      moveSystemFocus("down");
      return;
    }

    const game = displayGames[selectedIndex];
    if (game) {
      openDetails(game);
    }
  });

  useGamepadButton("DPAD_LEFT", () => {
    if (isAnyModalOpen || searchOpen) return;
    if (isSystemCategory) {
      if (!adjustFocusedRange(-1)) moveSystemFocus("left");
      return;
    }
    if (displayGames.length === 0) return;

    setSelectedIndex((p) => {
      const prev = Math.max(p - 1, 0);
      if (prev !== p) {
        playSound("navigate");
        playHapticPattern("nav");
      }
      return prev;
    });
  });

  useGamepadButton("DPAD_RIGHT", () => {
    if (isAnyModalOpen || searchOpen) return;
    if (isSystemCategory) {
      if (!adjustFocusedRange(1)) moveSystemFocus("right");
      return;
    }
    if (displayGames.length === 0) return;

    setSelectedIndex((p) => {
      const next = Math.min(p + 1, displayGames.length - 1);
      if (next !== p) {
        playSound("navigate");
        playHapticPattern("nav");
      }
      return next;
    });
  });

  useGamepadButton("DPAD_UP", () => {
    if (isAnyModalOpen || searchOpen) return;
    if (isSystemCategory) {
      moveSystemFocus("up");
      return;
    }
    // No hub (biblioteca): DPAD_UP foca a pesquisa se existir
    if (!["SETTINGS", "FRIENDS", "MODS", "RADAR", "PROFILE"].includes(activeCategory)) {
      searchInputRef.current?.focus();
      searchInputRef.current?.select();
      playSound("search");
    }
  });

  useGamepadButton("DPAD_DOWN", () => {
    if (isAnyModalOpen || searchOpen) return;
    if (isSystemCategory) {
      moveSystemFocus("down");
      return;
    }
    // Se a pesquisa estiver focada, DPAD_DOWN volta ao carrossel
    if (document.activeElement === searchInputRef.current) {
      searchInputRef.current?.blur();
      const cards = document.querySelectorAll<HTMLElement>("[data-game-card]");
      cards[selectedIndex]?.focus();
      playSound("navigate");
    }
  });

  const toggleFavoriteGame = useCallback(
    async (game: Game) => {
      if (!user?.uid || !game) return;
      playSound(game.isFavorite ? "favoriteOff" : "favoriteOn");
      try {
        await updateLibraryGame(user.uid, game.id, {
          isFavorite: !game.isFavorite,
        });
        await refreshLibrary();
      } catch (err) {
        console.error("Error toggling favorite", err);
      }
    },
    [user?.uid, playSound, refreshLibrary],
  );

  const cycleLibraryTab = useCallback(
    (direction: -1 | 1) => {
      let customIds: string[] = [];
      try {
        const stored = localStorage.getItem("checkpoint_custom_library_filters");
        if (stored) {
          const parsed = JSON.parse(stored);
          if (Array.isArray(parsed)) {
            customIds = parsed.map((f: any) => f.id);
          }
        }
      } catch {
        // ignore
      }
      const tabs = ["ALL", "FAVORITES", ...customIds];
      const currentIdx = tabs.indexOf(activeCategory);
      let nextIdx: number;
      if (currentIdx === -1) {
        nextIdx = direction === 1 ? 0 : tabs.length - 1;
      } else {
        nextIdx = (currentIdx + direction + tabs.length) % tabs.length;
      }
      selectCategory(tabs[nextIdx]);
      playSound("navigate");
    },
    [activeCategory, selectCategory, playSound],
  );

  useGamepadButton("L1", () => {
    if (isAnyModalOpen || searchOpen) return;
    cycleLibraryTab(-1);
    playHapticPattern("nav");
  });

  useGamepadButton("R1", () => {
    if (isAnyModalOpen || searchOpen) return;
    cycleLibraryTab(1);
    playHapticPattern("nav");
  });

  // SQUARE (PS) / X (Xbox): Open Game Context Menu (Options)
  useGamepadButton("SQUARE", async () => {
    if (isAnyModalOpen || searchOpen) return;
    // FRIENDS: open chat with focused friend
    if (activeCategory === "FRIENDS") {
      const focused = document.querySelector<HTMLElement>("[data-gamepad-focused='true']");
      const card = focused?.closest<HTMLElement>("[data-friend-id]");
      const friendId = card?.dataset.friendId || focused?.dataset.friendId;
      if (friendId) {
        const friend = socialFriends.find((f) => f.id === friendId);
        if (friend) {
          playSound("select");
          setActiveChatFriend(friend);
        }
      }
      return;
    }
    if (isSystemCategory) return;
    const triggerBtn = document.querySelector<HTMLButtonElement>("[data-context-menu-trigger='true']");
    if (triggerBtn) {
      triggerBtn.click();
      playSound("select");
      playHapticPattern("action");
    } else if (currentGame) {
      handleMenuAction("edit", currentGame);
    }
  });

  // TRIANGLE (PS) / Y (Xbox): Toggle Favorite for focused game directly
  useGamepadButton("TRIANGLE", async () => {
    if (isAnyModalOpen || searchOpen) return;
    // FRIENDS: start call with focused friend
    if (activeCategory === "FRIENDS") {
      const focused = document.querySelector<HTMLElement>("[data-gamepad-focused='true']");
      const card = focused?.closest<HTMLElement>("[data-friend-id]");
      const friendId = card?.dataset.friendId || focused?.dataset.friendId;
      if (friendId) {
        const friend = socialFriends.find((f) => f.id === friendId);
        if (friend) {
          playSound("select");
          void startCall(friend, false);
        }
      }
      return;
    }
    if (isSystemCategory) return;
    if (currentGame) {
      await toggleFavoriteGame(currentGame);
      playHapticPattern("action");
    }
  });

  // L2 (PS) / LT (Xbox): Platform Wheel Selector Modal
  useGamepadButton("L2", () => {
    if (isAnyModalOpen || searchOpen) return;
    if (isSystemCategory) return;
    setIsPlatformModalOpen(true);
    playSound("showModal");
    playHapticPattern("action");
  });

  // R2 (PS) / RT (Xbox): Library Filter Modal
  useGamepadButton("R2", () => {
    if (isAnyModalOpen || searchOpen) return;
    if (isSystemCategory) return;
    setFilterModalOpen(true);
    playSound("showModal");
    playHapticPattern("action");
  });

  const categoryToLauncherType = useCallback((cat: string): LauncherType | undefined => {
    switch (cat) {
      case "STEAM": return "steam";
      case "EPIC": return "epic";
      case "EA": return "ea";
      case "UBISOFT": return "ubisoft";
      case "GOG": return "gog";
      case "XBOX": return "xbox";
      case "RIOT": return "riot";
      case "BATTLENET": return "battlenet";
      case "ROCKSTAR": return "rockstar";
      case "LOCAL": return "local";
      default: return undefined;
    }
  }, []);

  const openAddGameModal = useCallback(
    (gameOrLauncherType?: Game | LauncherType | null) => {
      playSound("select");
      if (gameOrLauncherType && typeof gameOrLauncherType === "object") {
        setEditingGame(gameOrLauncherType);
        setAddModalInitialLauncherType(gameOrLauncherType.launcherType);
      } else {
        setEditingGame(null);
        setAddModalInitialLauncherType(
          typeof gameOrLauncherType === "string"
            ? gameOrLauncherType
            : categoryToLauncherType(activeCategory),
        );
      }
      setIsAddModalOpen(true);
    },
    [activeCategory, categoryToLauncherType, playSound],
  );

  const closeAddModal = useCallback((silent = false) => {
    if (!silent) playSound("back");
    setIsAddModalOpen(false);
    setEditingGame(null);
    setAddModalInitialLauncherType(undefined);
  }, [playSound]);

  useEffect(() => {
    const handleAddGameShortcut = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && (e.key === "n" || e.key === "N")) {
        const activeTag = document.activeElement?.tagName.toLowerCase();
        if (activeTag === "input" || activeTag === "textarea") return;
        e.preventDefault();
        openAddGameModal();
      }
    };
    window.addEventListener("keydown", handleAddGameShortcut);
    return () => window.removeEventListener("keydown", handleAddGameShortcut);
  }, [openAddGameModal]);


  // OPTIONS (PS) / MENU (Xbox): Toggle Sidebar open/close
  useGamepadButton("OPTIONS", () => {
    if (isAnyModalOpen) return;
    window.dispatchEvent(
      new CustomEvent("checkpoint:sidebar-toggle", {
        detail: { expanded: !isSidebarExpanded },
      }),
    );
    playSound("navigate");
    playHapticPattern("action");
  });

  // SHARE (PS) / VIEW (Xbox): Quick Game Search
  useGamepadButton("SHARE", () => {
    if (isAnyModalOpen) return;
    setSearchOpen(true);
    playSound("select");
    playHapticPattern("action");
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 60);
  });

  useEffect(() => {
    if (isAnyModalOpen || displayGames.length === 0) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (["INPUT", "TEXTAREA"].includes(document.activeElement?.tagName || ""))
        return;

      if (e.key === "ArrowRight") {
        e.preventDefault();
        setSelectedIndex((p) => {
          const next = Math.min(p + 1, displayGames.length - 1);
          if (next !== p) playSound("navigate");
          return next;
        });
      } else if (e.key === "Escape") {
        if (searchTerm || document.activeElement === searchInputRef.current) {
          setSearchTerm("");
          searchInputRef.current?.blur();
          playSound("back");
        }
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        setSelectedIndex((p) => {
          const prev = Math.max(p - 1, 0);
          if (prev !== p) playSound("navigate");
          return prev;
        });
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (displayGames[selectedIndex])
          openDetails(displayGames[selectedIndex]);
      } else if (e.key.toLowerCase() === "s") {
        if (!isAnyModalOpen && !["SETTINGS", "FRIENDS", "MODS", "RADAR", "PROFILE"].includes(activeCategory)) {
          e.preventDefault();
          searchInputRef.current?.focus();
          searchInputRef.current?.select();
          playSound("search");
        }
      } else if (e.key.toLowerCase() === "q") {
        if (!isAnyModalOpen && isPlatformOrFavoritesPage) {
          e.preventDefault();
          cycleLibraryTab(-1);
        }
      } else if (e.key.toLowerCase() === "e") {
        if (!isAnyModalOpen && isPlatformOrFavoritesPage) {
          e.preventDefault();
          cycleLibraryTab(1);
        }
      } else if (e.key.toLowerCase() === "p" || e.key.toLowerCase() === "x") {
        if (!isAnyModalOpen && isPlatformOrFavoritesPage) {
          e.preventDefault();
          setIsPlatformModalOpen(true);
          playSound("showModal");
        }
      } else if (e.key.toLowerCase() === "f") {
        if (!isAnyModalOpen && displayGames[selectedIndex]) {
          e.preventDefault();
          void toggleFavoriteGame(displayGames[selectedIndex]);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isAnyModalOpen, displayGames, selectedIndex, openDetails, playSound, searchOpen, isPlatformOrFavoritesPage, cycleLibraryTab, toggleFavoriteGame]);

  const handleGameRailWheel = useCallback((event: React.WheelEvent<HTMLDivElement>) => {
    if (isAnyModalOpen || searchOpen || displayGames.length === 0) return;

    const delta = Math.abs(event.deltaY) >= Math.abs(event.deltaX)
      ? event.deltaY
      : event.deltaX;
    if (Math.abs(delta) <= 15) return;

    const now = performance.now();
    if (now - gameRailWheelTimeRef.current < 120) return;
    gameRailWheelTimeRef.current = now;

    setSelectedIndex((current) => {
      const next = delta > 0
        ? Math.min(current + 1, displayGames.length - 1)
        : Math.max(current - 1, 0);
      if (next !== current) playSound("navigate");
      return next;
    });
  }, [displayGames.length, isAnyModalOpen, playSound, searchOpen]);

  // Construção do perfil com busca resiliente de jogos da conta e favoritos
  const handleViewFriendProfile = async (friend: SocialFriend) => {
    const friendUid = friend.id.startsWith("cp-friend:")
      ? friend.id.split(":")[1]
      : friend.id;

    setFriendProfileLoadingId(friend.id);
    try {
      const payload = await getCheckpointFriendProfile(friendUid);
      setFriendProfileModal(payload);
      playSound("detailOpen");
    } catch {
      const fallback = buildLocalFriendProfile(friend);
      try {
        const games = await fetchUserGamesForProfile(friendUid, fallback.profile);
        setFriendProfileModal({ profile: fallback.profile, games });
      } catch {
        setFriendProfileModal(fallback);
      }
      playSound("detailOpen");
    } finally {
      setFriendProfileLoadingId(null);
    }
  };

  const handleViewSearchedProfile = async (profile: UserProfile) => {
    setFriendProfileLoadingId(`cp-profile:${profile.uid}`);
    try {
      const payload = await getCheckpointFriendProfile(profile.uid);
      setFriendProfileModal(payload);
      playSound("detailOpen");
    } catch (error) {
      try {
        const games = await fetchUserGamesForProfile(profile.uid, profile);
        setFriendProfileModal({ profile, games });
        playSound("detailOpen");
      } catch {
        notify(
          error instanceof Error ? error.message : "Não foi possível abrir este perfil.",
          "error",
        );
      }
    } finally {
      setFriendProfileLoadingId(null);
    }
  };

  const openFriendChatFromOverview = useCallback(
    (friendId: string) => {
      const friend = socialFriends.find((item) => item.id === friendId);
      if (!friend) return;
      selectCategory("FRIENDS");
      setActiveChatFriend(friend);
      playSound("select");
    },
    [playSound, selectCategory, setActiveChatFriend, socialFriends],
  );

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onRealtimeAchievementUnlock) return;
    const handler = api.onRealtimeAchievementUnlock((payload) => {
      const game = overlayCurrentGameRef.current;
      if (!game) return;

      if (!achievementUnlockBelongsToGame(game, payload)) return;

      const payloadSteamAppId = String(payload.gameId || "").match(/^steam_(\d+)$/i)?.[1];

      if (payloadSteamAppId && userProfile?.steamId) {
        invalidateSteamAchievementCache(userProfile.steamId, payloadSteamAppId, launcherLanguage);
      }

      setOverlayAchievements((current) => patchOverlayAchievementUnlock(current, {
        achievementId: payload.achievementId,
        earnedTime: payload.earnedTime,
        unlockedAt: payload.unlockedAt,
      }));
      setOverlayAchievementRevision((current) => current + 1);
    });
    return () => api.removeRealtimeAchievementUnlock(handler);
  }, [launcherLanguage, userProfile?.steamId]);

  const overlayAchievementFailStreakRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const loadAchievements = async (options?: { silent?: boolean; forceRefresh?: boolean }) => {
      const game = overlayCurrentGame;
      if (!game) {
        setOverlayAchievements({ loading: false, items: [], unlocked: 0, available: 0 });
        return;
      }

      if (!options?.silent) {
        setOverlayAchievements((current) => (
          current.items.length > 0 ? current : { ...current, loading: true }
        ));
      }

      try {
        const snapshot = await loadOverlayAchievementsForGame(game, {
          steamId: userProfile?.steamId,
          language: launcherLanguage,
          bypassSteamCache: Boolean(options?.forceRefresh),
        });
        if (cancelled) return;

        const hasData = snapshot.items.length > 0 || snapshot.available > 0;
        if (hasData) {
          overlayAchievementFailStreakRef.current = 0;
          setOverlayAchievements(snapshot);
          return;
        }

        overlayAchievementFailStreakRef.current += 1;
        setOverlayAchievements((current) => ({
          loading: false,
          items: current.items.length > 0 ? current.items : snapshot.items,
          unlocked: current.unlocked || snapshot.unlocked || game.completedAchievements || 0,
          available: current.available || snapshot.available || game.totalAchievements || 0,
        }));
      } catch {
        if (cancelled) return;
        overlayAchievementFailStreakRef.current += 1;
        setOverlayAchievements((current) => ({
          loading: false,
          items: current.items,
          unlocked: current.unlocked || game.completedAchievements || 0,
          available: current.available || game.totalAchievements || 0,
        }));
      }
    };

    void loadAchievements({ forceRefresh: overlayAchievementRevision > 0 });
    const intervalId = overlayCurrentGame
      ? window.setInterval(() => { void loadAchievements({ silent: true }); }, 60_000)
      : null;
    return () => {
      cancelled = true;
      if (intervalId) window.clearInterval(intervalId);
    };
  }, [
    overlayAchievementRevision,
    overlayCurrentGame,
    userProfile?.steamId,
    launcherLanguage,
  ]);

  const overlayChatFriendUid = overlayChatFriend?.id.startsWith("cp-friend:")
    ? overlayChatFriend.id.split(":")[1]
    : null;

  useEffect(() => {
    if (!overlayChatFriendUid) {
      return;
    }
    void markMessagesAsRead(overlayChatFriendUid);
    const unsubscribeMessages = subscribeToChatMessages(overlayChatFriendUid, setOverlayChatMessages);
    const unsubscribeTyping = subscribeToFriendTyping(overlayChatFriendUid, setOverlayChatTyping);
    return () => {
      unsubscribeMessages();
      unsubscribeTyping();
    };
  }, [overlayChatFriendUid]);

  const mapOverlayAchievementsPayload = useCallback(() => ({
    unlocked: overlayAchievements.unlocked,
    available: overlayAchievements.available,
    loading: overlayAchievements.loading,
    items: overlayAchievements.items.map((achievement) => ({
      id: achievement.apiName,
      name: achievement.name,
      description: achievement.description,
      icon: achievement.icon || achievement.iconGray,
      achieved: achievement.achieved,
      unlockedAt: achievement.unlockTime > 0
        ? new Date(achievement.unlockTime * 1000).toISOString()
        : "",
    })),
  }), [overlayAchievements]);

  useEffect(() => {
    if (!window.electronAPI?.updateOverlayPanel) return;
    void window.electronAPI.updateOverlayPanel({
      achievements: mapOverlayAchievementsPayload(),
    }).catch(() => undefined);
  }, [mapOverlayAchievementsPayload]);

  useEffect(() => {
    if (!window.electronAPI?.updateOverlayPanel) return;

    const flushOverlayPanel = (immediate = false) => {
      const payload = overlayPanelPayloadRef.current;
      if (!payload) return;
      if (overlayPanelTimerRef.current) {
        window.clearTimeout(overlayPanelTimerRef.current);
        overlayPanelTimerRef.current = null;
      }
      const send = () => {
        overlayPanelTimerRef.current = null;
        void window.electronAPI?.updateOverlayPanel(payload as any).catch(() => undefined);
      };
      if (immediate) {
        send();
        return;
      }
      overlayPanelTimerRef.current = window.setTimeout(send, 350);
    };

    const localCustomDisplayName = user?.uid ? localStorage.getItem(`phelierium_custom_display_name_${user.uid}`) : null;
    const localCustomAvatar = user?.uid ? localStorage.getItem(`phelierium_custom_avatar_${user.uid}`) : null;
    const effectiveDisplayName = localCustomDisplayName || userProfile?.displayName || userProfile?.steamUsername || userDisplay;
    const effectiveAvatar = localCustomAvatar || userProfile?.photoURL || userProfile?.discordAvatar || userProfile?.steamAvatar || "";

    const hasActiveSessionClock = Boolean(overlaySessionStartedAt);
    const effectiveCurrentGame = (overlayCurrentGame || currentPresenceGame) ? {
      id: overlayCurrentGame?.id || "active-game",
      title: overlayCurrentGame?.title || currentPresenceGame || "",
      image: overlayCurrentGame?.backgroundImage || overlayCurrentGame?.cardImage || overlayCurrentGame?.image || "",
      platform: overlayCurrentGame?.launcherType === "steam"
        ? "Steam"
        : overlayCurrentGame?.launcherType === "epic" ? "Epic Games" : "Jogo local",
      category: overlayCurrentGame?.category || "",
      developer: overlayCurrentGame?.developer || "",
      releaseDate: overlayCurrentGame?.releaseDate || "",
      executableName: String(overlayCurrentGame?.executablePath || currentPresenceExecutablePath || "").split(/[\\/]/).pop() || "",
      totalPlaytimeMinutes: overlayCurrentGame?.steamPlaytimeMinutes
        ?? Math.round(Math.max(0, Number(overlayCurrentGame?.hoursPlayed || 0)) * 60),
      sessionStartedAt: overlaySessionStartedAt || "",
      presenceStatus: hasActiveSessionClock ? "playing" : "waiting",
      windowMode: overlayCurrentGame?.launchProfile?.windowMode || "default",
      resolution: overlayCurrentGame?.launchProfile?.resolutionWidth && overlayCurrentGame?.launchProfile?.resolutionHeight
        ? `${overlayCurrentGame.launchProfile.resolutionWidth} × ${overlayCurrentGame.launchProfile.resolutionHeight}`
        : "Automática",
      monitoring: (hasActiveSessionClock ? "verified" : "unverified") as "verified" | "unverified",
    } : null;

    overlayPanelPayloadRef.current = {
      language: launcherLanguage,
      userDisplay: effectiveDisplayName,
      userAvatar: effectiveAvatar,
      gameTitle: effectiveCurrentGame?.title || "",
      presenceStatus: effectiveCurrentGame?.presenceStatus || "idle",
      playingGame: effectiveCurrentGame,
      currentGame: effectiveCurrentGame,
      friends: socialFriends.map((friend) => ({
        id: friend.id,
        name: friend.name,
        status: friend.status,
        playing: friend.playing,
        avatar: friend.avatar,
        unread: friend.id.startsWith("cp-friend:")
          ? unreadMessagesByFriend[friend.id.split(":")[1]] || 0
          : 0,
        canChat: friend.id.startsWith("cp-friend:"),
      })),
      chat: overlayChatFriend && overlayChatFriendUid ? {
        friendId: overlayChatFriend.id,
        friendName: overlayChatFriend.name,
        friendAvatar: overlayChatFriend.avatar,
        typing: overlayChatTyping,
        sending: overlayChatSending,
        error: overlayChatError || "",
        messages: overlayChatMessages.map((message) => ({
          id: message.id || `${message.senderId}:${message.createdAt}`,
          text: message.text,
          attachmentUrl: message.attachmentUrl,
          attachmentName: message.attachmentName,
          createdAt: message.createdAt,
          mine: message.senderId === user?.uid || message.senderId === "me",
          pending: String(message.id || "").startsWith("overlay-pending-") && !(message as any).failed,
          failed: Boolean((message as any).failed),
        })),
      } : null,
      profile: {
        name: effectiveDisplayName,
        avatar: effectiveAvatar,
        discordConnected: Boolean(userProfile?.discordId),
        discordUsername: userProfile?.discordUsername || "",
        achievements: calculateAchievementTotals(games).unlocked,
      },
      gamepad: {
        connected: gamepad.isGamepadConnected,
        family: gamepad.gamepadFamily,
        batteryLevel: gamepad.batteryLevel,
        isCharging: gamepad.batteryCharging,
        connectionType: gamepad.connectionType,
      },
      voiceCall: voiceCall?.session ? {
        inCall: true,
        channelName: voiceCall.session.friendName || "Chamada de Voz",
        isMuted: voiceCall.isMuted,
        isDeafened: voiceCall.isDeafened,
        participantsCount: (voiceCall.session.participants?.length || 0) + 1,
        speakingUserNames: voiceCall.isSpeakingLocal ? ["Você"] : [],
      } : null,
      activeCall:
        callOverlayEnabled && voiceCall?.session && voiceCall.callState !== "idle"
          ? {
              active: true,
              friendId: voiceCall.session.friendUid,
              friendName: voiceCall.session.friendName,
              friendAvatar: voiceCall.session.friendAvatar,
              muted: voiceCall.isMuted,
              deafened: voiceCall.isDeafened,
              cameraOn: voiceCall.isCameraOn,
              screenSharing: voiceCall.isSharingScreen,
              speaking: voiceCall.isSpeakingLocal,
              connectionState: voiceCall.callState === "active" ? "connected" : "calling",
            }
          : null,
      settings: {
        callOverlayEnabled,
        effectsVolume: effectsVolume / 100,
      },
      playerLevel: playerLevel ? {
        level: playerLevel.level,
        xp: playerLevel.xp,
        progress: playerLevel.progress,
        tierName: playerLevel.tierName,
        rankColor: playerLevel.rankColor,
      } : null,
    };

    flushOverlayPanel(!currentPresenceGame && !overlayCurrentGame);
    return () => {
      if (overlayPanelTimerRef.current) {
        window.clearTimeout(overlayPanelTimerRef.current);
        overlayPanelTimerRef.current = null;
      }
    };
  }, [
    overlayChatError,
    overlayChatFriend,
    overlayChatFriendUid,
    overlayChatMessages,
    overlayChatSending,
    overlayChatTyping,
    overlayCurrentGame,
    currentPresenceGame,
    overlaySessionStartedAt,
    launcherLanguage,
    currentPresenceExecutablePath,
    presenceVerification,
    games,
    socialFriends,
    unreadMessagesByFriend,
    user?.uid,
    userDisplay,
    userProfile?.displayName,
    userProfile?.discordAvatar,
    userProfile?.discordId,
    userProfile?.discordUsername,
    userProfile?.photoURL,
    userProfile?.steamAvatar,
    userProfile?.steamUsername,
    gamepad.isGamepadConnected,
    gamepad.gamepadFamily,
    gamepad.batteryLevel,
    gamepad.batteryCharging,
    gamepad.connectionType,
    voiceCall?.session,
    voiceCall?.isMuted,
    voiceCall?.isDeafened,
    voiceCall?.isCameraOn,
    voiceCall?.isSharingScreen,
    voiceCall?.isSpeakingLocal,
    voiceCall?.callState,
    playerLevel,
    callOverlayEnabled,
    effectsVolume,
  ]);

  // Última ação de voz vinda do overlay (defesa contra entrega duplicada).
  const lastOverlayVoiceActionRef = useRef<{ kind: string; at: number }>({ kind: "", at: 0 });

  useEffect(() => {
    if (!window.electronAPI?.onOverlayPanelAction) return;
    return window.electronAPI.onOverlayPanelAction((action) => {
      // Mutar/silenciar/desligar repetidos em <300ms são a MESMA ação entregue duas
      // vezes (listener duplicado); um humano não alterna mute 2x em 300ms.
      if (action.kind === "voice-mute" || action.kind === "voice-deafen" || action.kind === "voice-hangup") {
        const now = performance.now();
        const last = lastOverlayVoiceActionRef.current;
        if (last.kind === action.kind && now - last.at < 300) return;
        lastOverlayVoiceActionRef.current = { kind: action.kind, at: now };
      }
      if (action.kind === "open-launcher-chat" || action.kind === "open-launcher-friends") {
        selectCategory("FRIENDS");
        setIsDetailOpen(false);
        if (action.kind === "open-launcher-chat" && action.friendId) {
          const friend = socialFriends.find((candidate) => candidate.id === action.friendId);
          if (friend?.id.startsWith("cp-friend:")) {
            setActiveChatFriend(friend);
          }
        }
        return;
      }
      if (action.kind === "select-chat") {
        const friend = socialFriends.find((candidate) => candidate.id === action.friendId);
        if (friend?.id.startsWith("cp-friend:")) {
          setOverlayChatMessages([]);
          setOverlayChatTyping(false);
          setOverlayChatError(null);
          setOverlayChatFriendId(friend.id);
        }
        return;
      }
      if (action.kind === "close-chat") {
        if (overlayChatFriendUid) void setChatTyping(overlayChatFriendUid, false);
        setOverlayChatMessages([]);
        setOverlayChatTyping(false);
        setOverlayChatError(null);
        setOverlayChatFriendId(null);
        return;
      }
      if (action.kind === "set-typing") {
        if (overlayChatFriendUid) void setChatTyping(overlayChatFriendUid, action.typing);
        return;
      }
      if (action.kind === "send-image") {
        if (!overlayChatFriendUid || overlayChatSending) return;
        const bytes = action.data instanceof Uint8Array
          ? action.data
          : new Uint8Array(action.data);
        const imageBuffer = new ArrayBuffer(bytes.byteLength);
        new Uint8Array(imageBuffer).set(bytes);
        const file = new File([imageBuffer], action.name, { type: action.type });
        setOverlayChatSending(true);
        setOverlayChatError(null);
        void sendChatImage(overlayChatFriendUid, file).then((message) => {
          setOverlayChatMessages((current) => current.some((item) => item.id === message.id)
            ? current
            : [...current, message].sort(compareChatMessages));
        }).catch((error) => {
          setOverlayChatError(error instanceof Error ? error.message : "Nao foi possivel enviar a imagem.");
        }).finally(() => setOverlayChatSending(false));
        return;
      }
      if (action.kind === "voice-call") {
        const found = socialFriends.find((candidate) => candidate.id === action.friendId || candidate.id === `cp-friend:${action.friendId}`);
        const friendUid = action.friendUid || (action.friendId?.startsWith("cp-friend:") ? action.friendId.replace("cp-friend:", "") : action.friendId) || "";
        const targetFriend: SocialFriend = found || {
          id: `cp-friend:${friendUid}`,
          name: action.friendName || "Amigo",
          avatar: action.friendAvatar,
          status: "online",
          source: "checkpoint",
        };
        if (targetFriend.id && voiceCallContext) {
          void voiceCallContext.startCall(targetFriend);
        }
        return;
      }
      if (action.kind === "voice-accept") {
        if (voiceCallContext) {
          void voiceCallContext.answerCall();
        }
        return;
      }
      if (action.kind === "voice-reject") {
        if (voiceCallContext) {
          void voiceCallContext.rejectCall();
        }
        return;
      }
      if (action.kind === "voice-hangup") {
        if (voiceCallContext) {
          void voiceCallContext.hangUp();
        }
        return;
      }
      if (action.kind === "voice-mute") {
        voiceCallContext?.toggleMute();
        return;
      }
      if (action.kind === "voice-deafen") {
        voiceCallContext?.toggleDeafen();
        return;
      }
      if (action.kind === "voice-camera") {
        void voiceCallContext?.toggleCamera();
        return;
      }
      if (action.kind === "voice-screen") {
        if (!voiceCallContext) return;
        if (voiceCallContext.isSharingScreen) {
          void voiceCallContext.stopScreenShare();
        } else {
          void (window.electronAPI as any)?.showMainWindow?.();
          voiceCallContext.setIsScreenPickerOpen(true);
        }
        return;
      }
      if (action.kind === "voice-open-hub") {
        void (window.electronAPI as any)?.showMainWindow?.();
        return;
      }
      if (action.kind === "retry-message" && (action as any).text && overlayChatFriendUid) {
        const text = (action as any).text.trim();
        const oldId = (action as any).messageId;
        if (oldId) {
          setOverlayChatMessages((current) => current.filter((item) => item.id !== oldId));
        }
        if (!text || overlayChatSending) return;
        const pendingId = `overlay-pending-${Date.now()}`;
        setOverlayChatSending(true);
        setOverlayChatError(null);
        void setChatTyping(overlayChatFriendUid, false);
        setOverlayChatMessages((current) => [...current, {
          id: pendingId,
          chatId: overlayChatFriendUid,
          senderId: user?.uid || "me",
          receiverId: overlayChatFriendUid,
          text,
          createdAt: new Date().toISOString(),
          read: true,
        }]);
        void sendChatMessage(overlayChatFriendUid, text).then((message) => {
          setOverlayChatMessages((current) => [
            ...current.filter((item) => item.id !== pendingId && item.id !== message.id),
            message,
          ].sort(compareChatMessages));
        }).catch((error) => {
          setOverlayChatMessages((current) => current.map((item) => item.id === pendingId ? { ...item, failed: true } : item));
          setOverlayChatError(error instanceof Error ? error.message : "Não foi possível enviar a mensagem.");
        }).finally(() => setOverlayChatSending(false));
        return;
      }
      if (action.kind !== "send-message" || !overlayChatFriendUid || overlayChatSending) return;
      const text = action.text.trim();
      if (!text) return;
      const pendingId = `overlay-pending-${Date.now()}`;
      setOverlayChatSending(true);
      setOverlayChatError(null);
      void setChatTyping(overlayChatFriendUid, false);
      setOverlayChatMessages((current) => [...current, {
        id: pendingId,
        chatId: overlayChatFriendUid,
        senderId: user?.uid || "me",
        receiverId: overlayChatFriendUid,
        text,
        createdAt: new Date().toISOString(),
        read: true,
      }]);
      void sendChatMessage(overlayChatFriendUid, text).then((message) => {
        setOverlayChatMessages((current) => [
          ...current.filter((item) => item.id !== pendingId && item.id !== message.id),
          message,
        ].sort(compareChatMessages));
      }).catch((error) => {
        setOverlayChatMessages((current) => current.map((item) => item.id === pendingId ? { ...item, failed: true } : item));
        setOverlayChatError(error instanceof Error ? error.message : "Não foi possível enviar a mensagem.");
      }).finally(() => setOverlayChatSending(false));
    });
  }, [notify, overlayChatFriendUid, overlayChatSending, selectCategory, setActiveChatFriend, socialFriends, user?.uid, voiceCallContext]);

  const onSelectHandler = useCallback(
    (index: number, openGame?: Game) => {
      if (openGame) {
        openDetails(openGame);
        return;
      }
      setSelectedIndex(index);
      playSound("navigate");
    },
    [openDetails, playSound],
  );


  const closeCtx = (silent = false) => {
    setContextMenu(null);
    if (!silent) playSound("back");
  };

  const handleMenuAction = useCallback(async (action: string, game: Game) => {
    if (action === "delete") {
      setPendingDeleteGame(game);
      closeCtx(true);
      return;
    } else if (action === "favorite" && user?.uid) {
      await updateLibraryGame(user.uid, game.id, {
        isFavorite: !game.isFavorite,
      });
      await refreshLibrary();
    } else if (action === "edit") {
      openAddGameModal(game);
      closeCtx(true);
      return;
    }
    closeCtx(true);
  }, [user?.uid, refreshLibrary]);

  const handleSignOut = async () => {
    playSound("back");
    setIsExitingSession(true);
    if (user?.uid) {
      await markCheckpointOfflineAsync(
        user.uid,
        userProfile?.displayName || undefined,
        userProfile?.photoURL,
      ).catch(() => { });
    }
    await new Promise((r) => window.setTimeout(r, 450));
    await signOutUser();
  };


  // Correção 4: Adição das listas de IDs calculadas para o AddFriendModal
  const checkpointFriendIds = useMemo(() => {
    return socialFriends
      .filter((f) => f.id.startsWith("cp-friend:"))
      .map((f) => f.id.split(":")[1]);
  }, [socialFriends]);

  const incomingFriendRequestIds = useMemo(() => {
    return incomingFriendRequests.map((req) => req.uid);
  }, [incomingFriendRequests]);

  const outgoingFriendRequestIds = useMemo(() => {
    return (userProfile?.checkpointFriendRequestsOutgoing ?? []).map(
      (request) => request.uid,
    );
  }, [userProfile?.checkpointFriendRequestsOutgoing]);

  const friendIdSet = useMemo(() => new Set(checkpointFriendIds), [checkpointFriendIds]);
  const outgoingRequestIdSet = useMemo(() => new Set(outgoingFriendRequestIds), [outgoingFriendRequestIds]);
  const incomingRequestIdSet = useMemo(() => new Set(incomingFriendRequestIds), [incomingFriendRequestIds]);

  const handleGameHydrated = React.useCallback((hydrated: Game) => {
    setSelectedGame((prev) => {
      if (!prev || prev.id !== hydrated.id) return hydrated;
      if (
        prev.totalAchievements === hydrated.totalAchievements &&
        prev.completedAchievements === hydrated.completedAchievements &&
        prev.image === hydrated.image &&
        prev.cardImage === hydrated.cardImage &&
        prev.backgroundImage === hydrated.backgroundImage
      ) {
        return prev;
      }
      return { ...prev, ...hydrated };
    });
    setGames((prev) => {
      const idx = prev.findIndex((g) => g.id === hydrated.id);
      if (idx === -1) return prev;
      const current = prev[idx];
      if (
        current.totalAchievements === hydrated.totalAchievements &&
        current.completedAchievements === hydrated.completedAchievements &&
        current.image === hydrated.image &&
        current.cardImage === hydrated.cardImage &&
        current.backgroundImage === hydrated.backgroundImage
      ) {
        return prev;
      }
      const updated = [...prev];
      updated[idx] = { ...current, ...hydrated };
      return updated;
    });
  }, []);

  const currentGamePlatformInfo = useMemo(() => {
    if (!currentGame) return null;
    const launcher = (currentGame.launcherType || currentGame.source || "").toLowerCase();
    if (launcher === "steam") return { icon: PlatformSteamIcon, label: "Steam" };
    if (launcher === "epic") return { icon: PlatformEpicIcon, label: "Epic Games" };
    if (launcher === "ea") return { icon: PlatformEaIcon, label: "EA App" };
    if (launcher === "ubisoft") return { icon: PlatformUbisoftIcon, label: "Ubisoft" };
    if (launcher === "gog") return { icon: PlatformGogIcon, label: "GOG Galaxy" };
    if (launcher === "xbox") return { icon: PlatformXboxIcon, label: "Xbox" };
    if (launcher === "riot") return { icon: PlatformRiotIcon, label: "Riot Games" };
    if (launcher === "battlenet") return { icon: PlatformBattlenetIcon, label: "Battle.net" };
    if (launcher === "rockstar") return { icon: PlatformRockstarIcon, label: "Rockstar" };
    return { icon: PlatformLocalIcon, label: "Executável Local" };
  }, [currentGame]);

  const isCurrentGameRunning = useMemo(() => {
    if (!currentGame) return false;
    const running = resolveGameFromPresence(games, currentPresenceGame, currentPresenceExecutablePath);
    return running?.id === currentGame.id;
  }, [currentGame, games, currentPresenceGame, currentPresenceExecutablePath]);

  const handleSelectContinuePlaying = useCallback((game: Game) => {
    const idx = displayGames.findIndex((g) => g.id === game.id);
    if (idx !== -1) {
      setSelectedIndex(idx);
    }
  }, [displayGames]);

  const handlePlayContinuePlaying = useCallback((game: Game) => {
    openDetails(game);
    playSound("select");
  }, [openDetails, playSound]);

  const handleOpenDetailsContinuePlaying = useCallback((game: Game) => {
    openDetails(game);
    playSound("select");
  }, [openDetails, playSound]);

  const handleHeroPlay = useCallback((game: Game) => {
    openDetails(game);
  }, [openDetails]);

  const handleHeroOpenDetails = useCallback((game: Game) => {
    openDetails(game);
  }, [openDetails]);

  const handleHeroToggleFavorite = useCallback((game: Game) => {
    void toggleFavoriteGame(game);
  }, [toggleFavoriteGame]);

  const renderedContinuePlaying = useMemo(() => {
    if (activeCategory !== "ALL" || continuePlayingGames.length === 0) return null;
    return (
      <div className="shrink-0 [@media(max-height:799px)]:hidden">
        <DashboardContinuePlaying
          continuePlayingGames={continuePlayingGames}
          selectedGameId={currentGame?.id}
          onSelectGame={handleSelectContinuePlaying}
          onPlayGame={handlePlayContinuePlaying}
          onOpenDetails={handleOpenDetailsContinuePlaying}
          playSound={playSound}
        />
      </div>
    );
  }, [
    activeCategory,
    continuePlayingGames,
    currentGame?.id,
    handleSelectContinuePlaying,
    handlePlayContinuePlaying,
    handleOpenDetailsContinuePlaying,
    playSound,
  ]);

  const renderedHeroGame = useMemo(() => {
    if (!currentGame) return null;
    return (
      <HeroGame
        game={currentGame}
        isRunning={isCurrentGameRunning}
        platformInfo={currentGamePlatformInfo}
        isGamepadConnected={isGamepadConnected}
        gamepadFamily={gamepadFamily}
        onPlay={handleHeroPlay}
        onOpenDetails={handleHeroOpenDetails}
        onToggleFavorite={handleHeroToggleFavorite}
        playSound={playSound}
        playNowLabel={t("playNow")}
        runningLabel="Em execução"
      />
    );
  }, [
    currentGame,
    isCurrentGameRunning,
    currentGamePlatformInfo,
    isGamepadConnected,
    gamepadFamily,
    handleHeroPlay,
    handleHeroOpenDetails,
    handleHeroToggleFavorite,
    playSound,
    t,
  ]);

  const renderedGameShelf = useMemo(() => {
    return (
      <div
        className="shrink-0 pb-[var(--gap-stack)] hub-scroll transform-gpu flex flex-col gap-[var(--gap-stack)]"
        onWheel={handleGameRailWheel}
      >
        <div className="px-[var(--safe-x)] flex items-center justify-between">
          <h2 className="text-[length:var(--fs-label)] font-bold tracking-[var(--tracking-label)] uppercase text-white/60 font-display">
            {activeCategory === "ALL" ? "Biblioteca" : activePlatformConfig.label}
          </h2>
          <div className="flex items-center gap-[var(--gap-section)]">
            {!isGamepadConnected && (
              <PlatformShortcutHint
                onActivate={() => {
                  setIsPlatformModalOpen(true);
                  playSound("showModal");
                }}
              />
            )}
            <span className="text-[length:var(--fs-caption)] font-medium text-white/55">
              {displayGames.length} {displayGames.length === 1 ? "jogo" : "jogos"}
            </span>
          </div>
        </div>
        <GameRow
          games={displayGames}
          selectedIndex={selectedIndex}
          onSelect={onSelectHandler}
          onContextMenu={handleMenuAction}
          playSound={playSound}
        />
      </div>
    );
  }, [
    handleGameRailWheel,
    activeCategory,
    activePlatformConfig.label,
    displayGames,
    selectedIndex,
    onSelectHandler,
    handleMenuAction,
    playSound,
    isGamepadConnected,
  ]);

  return (
    <div
      className="relative flex h-full min-h-0 w-full overflow-hidden overscroll-none text-white no-scrollbar transition-colors duration-1000"
      style={
        {
          "--game-color": dominantColor.hex,
          "--game-text-color": dominantColor.isDark ? "#ffffff" : "#08080f",
        } as React.CSSProperties
      }
    >
      <GameEnvironment
        artwork={
          settledGame?.backgroundImage ||
          settledGame?.image ||
          settledGame?.cardImage ||
          ""
        }
        dominantColor={dominantColor}
        videoUrl={activeCategory === "ALL" && !isAnyModalOpen ? settledTrailer : undefined}
        reducedEffects={isAnyModalOpen}
        className="left-0"
        style={{ left: 0 }}
      />

      {/* Widgets flutuantes (Pulso, Amigos) com animação sincronizada ao jogo */}
      {activeCategory === "ALL" && !isLoading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
        >
          <HomeOverviewPanels
            continuePlaying={continuePlayingGames}
            favoriteGames={favoriteShowcaseGames}
            friendsPlaying={friendsPlayingNow}
            recentActivity={recentOverviewActivity}
            onOpenGame={openDetails}
            onOpenFriends={() => selectCategory("FRIENDS")}
            onOpenFriendChat={openFriendChatFromOverview}
            t={t}
          />
        </motion.div>
      )}


      <Sidebar
        activeCategory={activeCategory}
        onCategory={selectCategory}
        settingsLabel={t("settings")}
        language={launcherLanguage}
        playSound={playSound}
        platformOperations={platformOperations}
        notificationCount={
          incomingFriendRequests.length
          + Object.values(unreadMessagesByFriend).reduce(
            (total, count) => total + Math.max(0, Number(count) || 0),
            0,
          )
        }
      />

      <div
        className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden"
        style={{
          marginLeft: 0,
          contain: "layout paint style",
        }}
      >
        {/* HomeTopNav replaces old header */}
        <HomeTopNav
          activeCategory={activeCategory}
          onSelectCategory={selectCategory}
          games={games}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          searchOpen={searchOpen}
          onToggleSearch={setSearchOpen}
          onOpenAddGame={() => openAddGameModal()}
          onOpenFilterModal={() => setFilterModalOpen(true)}
          onSyncLibraries={handleSyncLibraries}
          isSyncingLibraries={isAnySyncing}
          onToggleSidebar={() => {
            window.dispatchEvent(
              new CustomEvent("checkpoint:sidebar-toggle", {
                detail: { expanded: !isSidebarExpanded },
              }),
            );
            playSound("navigate");
          }}
          hasActiveFilters={
            libraryFilters.launchers.length > 0 ||
            libraryFilters.favoritesOnly ||
            libraryFilters.withAchievements
          }
          showTabsAndSearch={isPlatformOrFavoritesPage}
          isGamepadConnected={isGamepadConnected}
          gamepadFamily={gamepadFamily}
          userDisplay={userDisplay}
          userEmail={user?.email || undefined}
          userAvatarUrl={
            userProfile?.photoURL ||
            user?.photoURL ||
            userProfile?.discordAvatar ||
            userProfile?.steamAvatar ||
            undefined
          }
          userLevel={playerLevel}
          language={launcherLanguage}
          playSound={playSound}
          onOpenProfile={() => {
            selectCategory("PROFILE");
            playSound("select");
          }}
          onOpenSettings={() => {
            selectCategory("SETTINGS");
            playSound("select");
          }}
          onLogout={() => {
            playSound("back");
            setSignOutModalOpen(true);
          }}
        />

        <div className="flex-1 flex flex-col justify-end min-h-0 hub-60fps will-change-transform" style={{ contain: "layout paint" }}>
          <AnimatePresence mode="wait" custom={activeCategory}>
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, x: activeCategory === "ALL" ? -40 : 40, scale: activeCategory === "ALL" ? 0.98 : 1 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: activeCategory === "ALL" ? 40 : -40, scale: activeCategory === "ALL" ? 1 : 0.98 }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="flex-1 flex flex-col justify-end min-h-0 w-full"
            >
              {activeCategory === "SETTINGS" ? (
                <React.Suspense fallback={
                  <div className="flex flex-1 items-center justify-center">
                    <LoadingState label="Carregando Configurações" variant="breathing" />
                  </div>
                }>
                  <SettingsPageV2
                    language={launcherLanguage}
                    effectsVolume={effectsVolume}
                    achievementVolume={achievementVolume}
                    notificationVolume={notificationVolume}
                    musicVolume={musicVolume}
                    soundTheme={soundTheme}
                    visualTheme={visualTheme}
                    languageOptions={LANGUAGE_OPTIONS}
                    appThemeOptions={APP_THEME_OPTIONS}
                    SteamIcon={SteamBrandIcon}
                    DiscordIcon={DiscordBrandIcon}
                    EpicIcon={EpicBrandIcon}
                    onLanguageChange={(next: any) => {
                      setLauncherLanguage(next);
                      playSound("select");
                    }}
                    onEffectsVolumeChange={(next: number) => {
                      setEffectsVolume(next);
                    }}
                    onAchievementVolumeChange={setAchievementVolume}
                    onNotificationVolumeChange={setNotificationVolume}
                    onMusicVolumeChange={setMusicVolume}
                    onSoundThemeChange={(next: any) => {
                      setSoundTheme(next);
                      // Volume reduzido: o clique de troca de tema soava
                      // desproporcionalmente alto comparado aos outros feedbacks da UI.
                      playSound("select", 0.45);
                    }}
                    onVisualThemeChange={(next: any) => {
                      setVisualTheme(next);
                      playSound("select", 0.45);
                    }}
                    onPreviewSound={() => playSound("select")}
                    onTestNotificationSound={() => playSound("notification")}
                    t={t}
                    steamConnected={Boolean(resolvedSteamId)}
                    discordConnected={Boolean(resolvedDiscordId)}
                    discordUsername={userProfile?.discordUsername}
                    discordAvatar={userProfile?.discordAvatar}
                    steamConnecting={steamConnecting}
                    discordConnecting={discordConnecting}
                    epicConnected={epicAuthConnected}
                    epicDisplayName={epicDisplayName}
                    epicConnecting={epicSyncing}
                    steamDisconnecting={steamDisconnecting}
                    discordDisconnecting={discordDisconnecting}
                    epicDisconnecting={epicDisconnecting}
                    onConnectSteam={connectSteam}
                    onCancelSteamConnect={cancelSteamConnect}
                    onConnectDiscord={connectDiscord}
                    onCancelDiscordConnect={cancelDiscordConnect}
                    onConnectEpic={() => setEpicConnectModalOpen(true)}
                    onDisconnectSteam={() => {
                      playSound("back");
                      setDisconnectSteamModalOpen(true);
                    }}
                    onDisconnectDiscord={() => {
                      playSound("back");
                      setDisconnectDiscordModalOpen(true);
                    }}
                    onDisconnectEpic={() => {
                      playSound("back");
                      setDisconnectEpicModalOpen(true);
                    }}
                    onTestOverlayWelcome={() => {
                      void window.electronAPI?.testOverlayWelcome();
                    }}
                    onTestOverlayAchievement={(tier) => {
                      void window.electronAPI?.testOverlayAchievement(tier);
                    }}
                    initialTab={settingsTab}
                    onTabChange={handleSettingsTabChange}
                    onClose={() => {
                      playSound("back");
                      selectCategory("ALL");
                    }}
                    platformOperations={platformOperations}
                  />
                </React.Suspense>
              ) : activeCategory === "FRIENDS" ? (
                <React.Suspense fallback={
                  <div className="flex flex-1 items-center justify-center">
                    <LoadingState label="Carregando Amigos" variant="breathing" />
                  </div>
                }>
                  <FriendsPage
                    t={t}
                    language={launcherLanguage}
                    discordConnected={Boolean(resolvedDiscordId)}
                    userDisplay={userDisplay}
                    discordUsername={userProfile?.discordUsername}
                    discordAvatar={userProfile?.discordAvatar}
                    DiscordIcon={DiscordBrandIcon}
                    friends={socialFriends}
                    unreadMessagesByFriend={unreadMessagesByFriend}
                    incomingRequests={incomingFriendRequests}
                    currentPresenceGame={currentPresenceGame}
                    onConnectDiscord={connectDiscord}
                    onRemoveFriend={(friend) => {
                      playSound("back");
                      setPendingFriendRemoval(friend);
                    }}
                    onViewFriendProfile={handleViewFriendProfile}
                    friendProfileLoadingId={friendProfileLoadingId}
                    onAcceptRequest={acceptFriendRequest}
                    onRejectRequest={rejectFriendRequest}
                    onAddFriendClick={() => {
                      playSound("select");
                      setIsAddFriendModalOpen(true);
                    }}
                    onOpenChat={(friend) => {
                      playSound("select");
                      setActiveChatFriend(friend);
                    }}
                    onStartVoiceCall={(friend, withVideo) => void startCall(friend, withVideo)}
                    onStartTestCall={startTestCall}
                    playSound={playSound}
                  />
                </React.Suspense>
              ) : activeCategory === "FEED" ? (
                <React.Suspense fallback={
                  <div className="flex flex-1 items-center justify-center">
                    <LoadingState label="Carregando Radar Gamer" variant="searching" />
                  </div>
                }>
                  <GamingRadarPage />
                </React.Suspense>
              ) : activeCategory === "MODS" ? (
                <React.Suspense fallback={
                  <div className="flex flex-1 items-center justify-center">
                    <LoadingState label="Carregando Gerenciador de Mods" variant="shaping" />
                  </div>
                }>
                  <ModsPage uid={user?.uid || "local"} games={games} />
                </React.Suspense>
              ) : activeCategory === "PROFILE" ? (
                <React.Suspense fallback={
                  <div className="flex flex-1 items-center justify-center">
                    <LoadingState label="Carregando Perfil" variant="breathing" />
                  </div>
                }>
                  <UserProfilePage
                    userProfile={userProfile}
                    user={user}
                    userId={user?.uid ?? null}
                    games={games}
                    onOpenGame={openDetails}
                    onProfileUpdated={refreshProfile}
                    playSound={playSound as any}
                    language={launcherLanguage}
                  />
                </React.Suspense>
              ) : activeCategory === "TROPHIES" ? (
                <React.Suspense fallback={
                  <div className="flex flex-1 items-center justify-center">
                    <LoadingState label="Carregando Troféus" variant="solving" />
                  </div>
                }>
                  <TrophiesPage
                    games={games}
                    onOpenGame={openDetails}
                    playSound={playSound}
                  />
                </React.Suspense>
              ) : isLoading ? (
                <div className="flex-1 flex flex-col justify-between w-full h-full">
                  <LoadingSkeleton />
                </div>
              ) : (activeCategory === "ALL" && isAnySyncing && displayGames.length === 0) ? (
                <div className="flex-1 flex flex-col justify-between w-full h-full">
                  {steamSyncing ? (
                    <PlatformLibrarySkeleton
                      platform="steam"
                      phase={(platformOperations?.steam as { status: string; phase?: string })?.phase || "reading-library"}
                      completed={(platformOperations?.steam as { status: string; completed?: number })?.completed}
                      total={(platformOperations?.steam as { status: string; total?: number })?.total}
                    />
                  ) : epicSyncing ? (
                    <PlatformLibrarySkeleton
                      platform="epic"
                      phase={(platformOperations?.epic as { status: string; phase?: string })?.phase || "reading-library"}
                      completed={(platformOperations?.epic as { status: string; completed?: number })?.completed}
                      total={(platformOperations?.epic as { status: string; total?: number })?.total}
                    />
                  ) : (
                    <LoadingSkeleton />
                  )}
                </div>
              ) : (activeCategory === "STEAM" && steamSyncing) ? (
                <div className="flex-1 flex flex-col justify-between w-full h-full">
                  <PlatformLibrarySkeleton
                    platform="steam"
                    phase={(platformOperations?.steam as { status: string; phase?: string })?.phase || "reading-library"}
                    completed={(platformOperations?.steam as { status: string; completed?: number })?.completed}
                    total={(platformOperations?.steam as { status: string; total?: number })?.total}
                  />
                </div>
              ) : (activeCategory === "EPIC" && epicSyncing) ? (
                <div className="flex-1 flex flex-col justify-between w-full h-full">
                  <PlatformLibrarySkeleton
                    platform="epic"
                    phase={(platformOperations?.epic as { status: string; phase?: string })?.phase || "reading-library"}
                    completed={(platformOperations?.epic as { status: string; completed?: number })?.completed}
                    total={(platformOperations?.epic as { status: string; total?: number })?.total}
                  />
                </div>
              ) : displayGames.length === 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center px-10 py-6 overflow-y-auto thin-scrollbar">
                  {onboardingCompleted ? (
                    <EmptyState
                      searchTerm={searchTerm}
                      activeCategory={activeCategory}
                      onAddGame={() => openAddGameModal(categoryToLauncherType(activeCategory))}
                      onConnect={connectSteam}
                      onSyncSteam={handleSyncSteam}
                      steamConnected={Boolean(resolvedSteamId)}
                      isSyncingSteam={steamSyncing}
                      isConnectingSteam={steamConnecting}
                      onConnectEpic={() => setEpicConnectModalOpen(true)}
                      onSyncEpic={async () => {
                        await handleSyncEpic();
                        await checkEpicStatus();
                      }}
                      epicConnected={epicAuthConnected}
                      isSyncingEpic={epicSyncing}
                      isConnectingEpic={epicConnecting}
                    />
                  ) : (
                    <EmptyLibraryOnboarding
                      onConnectSteam={connectSteam}
                      onOpenAddGame={() => openAddGameModal(categoryToLauncherType(activeCategory))}
                      onComplete={async () => {
                        if (!user?.uid) return;
                        localStorage.setItem(
                          `checkpoint_onboarding_${user.uid}`,
                          "1",
                        );
                        setOnboardingCompleted(true);
                        await supabase.from("profiles").update({
                          onboarding_completed_at: new Date().toISOString(),
                        }).eq("uid", user.uid);
                        await refreshProfile();
                      }}
                      playSound={playSound}
                    />
                  )}
                </div>
              ) : (
                <div className="flex min-h-0 flex-1 flex-col gap-[var(--gap-section)]">
                  {/* B. Continue Playing / Jogos Recentes (EM CIMA) */}
                  {renderedContinuePlaying}

                  {/* C. Cinematic Hero / Nome do Jogo (EM BAIXO) */}
                  {renderedHeroGame}

                  {/* D. Library / Recent Games Shelf */}
                  {renderedGameShelf}

                  {/* Steam Deck / PS5 Controller Footer Hints */}
                  <SteamDeckControllerFooter
                    isGamepadConnected={isGamepadConnected}
                    gamepadFamily={gamepadFamily}
                    onOpenPlatforms={() => {
                      setIsPlatformModalOpen(true);
                      playSound("showModal");
                      playHapticPattern("action");
                    }}
                    onOpenFilters={() => {
                      setFilterModalOpen(true);
                      playSound("select");
                      playHapticPattern("action");
                    }}
                    onOpenOptions={() => {
                      const triggerBtn = document.querySelector<HTMLButtonElement>("[data-context-menu-trigger='true']");
                      if (triggerBtn) {
                        triggerBtn.click();
                        playSound("select");
                        playHapticPattern("action");
                      } else if (currentGame) {
                        handleMenuAction("edit", currentGame);
                      }
                    }}
                    onOpenSearch={() => {
                      setSearchOpen(true);
                      playSound("select");
                      playHapticPattern("action");
                      setTimeout(() => {
                        searchInputRef.current?.focus();
                      }, 60);
                    }}
                    onToggleSidebar={() => {
                      window.dispatchEvent(
                        new CustomEvent("checkpoint:sidebar-toggle", {
                          detail: { expanded: !isSidebarExpanded },
                        }),
                      );
                      playSound("navigate");
                      playHapticPattern("action");
                    }}
                    onToggleFavorite={() => {
                      if (currentGame) {
                        void toggleFavoriteGame(currentGame);
                      }
                    }}
                    isFavorite={currentGame?.isFavorite}
                  />
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      <React.Suspense fallback={null}>
        <GameDetailPanel
          game={selectedGame}
          isOpen={isDetailOpen}
          onClose={() => {
            playSound("back");
            setIsDetailOpen(false);
          }}
          playSound={playSound}
          onLibraryChanged={refreshLibrary}
          onGameHydrated={handleGameHydrated}
          onOpenMods={() => {
            setIsDetailOpen(false);
            selectCategory("MODS");
          }}
          currentPresenceGame={currentPresenceGame}
          friends={socialFriends}
          onToggleFavorite={(game) => {
            void toggleFavoriteGame(game);
          }}
          onEditGame={(game) => {
            openAddGameModal(game);
          }}
        />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <AddGameModal
          isOpen={isAddModalOpen}
          onClose={closeAddModal}
          onSaved={() => {
            void refreshLibrary();
            if (user?.uid) {
              completeUserQuest(user.uid, "first_game", {
                playSound,
                onNotify: (msg, type) => notify(msg, type),
              });
            }
          }}
          playSound={playSound}
          gameToEdit={editingGame}
          initialLauncherType={addModalInitialLauncherType}
        />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          games={games}
          friends={socialFriends}
          onSelectGame={(game) => {
            openDetails(game);
            playSound("select");
          }}
          onPlayGame={(game) => {
            openDetails(game);
            playSound("select");
          }}
          onNavigate={(category) => {
            selectCategory(category);
            playSound("select");
          }}
          onOpenSettingsTab={(tab) => {
            selectCategory("SETTINGS");
            handleSettingsTabChange(tab as any);
            playSound("select");
          }}
          onStartCall={(friend) => {
            void startCall(friend, false);
            playSound("select");
          }}
          onOpenChat={(friend) => {
            setActiveChatFriend(friend);
            playSound("select");
          }}
          playSound={playSound}
        />
      </React.Suspense>

      <React.Suspense fallback={null}>
        <AddFriendModal
          isOpen={isAddFriendModalOpen}
          onClose={() => setIsAddFriendModalOpen(false)}
          onAddFriend={handleAddCheckpointFriend}
          onViewProfile={(profile) => void handleViewSearchedProfile(profile)}
          currentUserUid={user?.uid ?? ""}
          friendIds={friendIdSet}
          outgoingRequestIds={outgoingRequestIdSet}
          incomingRequestIds={incomingRequestIdSet}
          playSound={playSound}
          t={t}
        />
      </React.Suspense>

      <FriendProfileModal
        isOpen={Boolean(friendProfileModal)}
        onClose={() => {
          playSound("back");
          setFriendProfileModal(null);
        }}
        friendData={friendProfileModal}
        onOpenChat={openFriendChatFromOverview}
        playSound={playSound}
        onNotify={notify}
      />

      <ConfirmationModal
        isOpen={Boolean(pendingDeleteGame)}
        title="Remover jogo"
        description={
          pendingDeleteGame
            ? `Você vai remover "${pendingDeleteGame.title}" da sua biblioteca.`
            : ""
        }
        confirmLabel="Sim, remover"
        variant="delete"
        onClose={() => setPendingDeleteGame(null)}
        onConfirm={async () => {
          if (!pendingDeleteGame || !user?.uid) {
            setPendingDeleteGame(null);
            return;
          }
          try {
            await deleteLibraryGame(user.uid, pendingDeleteGame.id);
            await refreshLibrary();
            notify("Jogo removido da biblioteca.", "success");
          } catch (e) {
            notify(e instanceof Error ? e.message : "Erro ao remover jogo.", "error");
          } finally {
            setPendingDeleteGame(null);
          }
        }}
        playSound={playSound}
      />

      <ConfirmationModal
        isOpen={signOutModalOpen}
        variant="logout"
        title={t("signOutTitle")}
        description={t("signOutDescription")}
        confirmLabel="Sim, sair"
        onClose={() => setSignOutModalOpen(false)}
        onConfirm={async () => {
          setSignOutModalOpen(false);
          await handleSignOut();
        }}
        playSound={playSound}
      />

      <ConfirmationModal
        isOpen={quitAppModalOpen}
        variant="logout"
        title={t("quitAppTitle")}
        description={t("quitAppDescription")}
        confirmLabel={t("confirm")}
        cancelLabel={t("cancel")}
        onClose={() => setQuitAppModalOpen(false)}
        onConfirm={async () => {
          setQuitAppModalOpen(false);
          await window.electronAPI?.confirmAppQuit?.();
        }}
        playSound={playSound}
      />

      <ConfirmationModal
        isOpen={disconnectSteamModalOpen}
        variant="disconnect"
        title={t("disconnectSteamTitle")}
        description={t("disconnectSteamDescription")}
        confirmLabel="Sim, desconectar"
        onClose={() => setDisconnectSteamModalOpen(false)}
        onConfirm={async () => {
          setDisconnectSteamModalOpen(false);
          setSteamDisconnecting(true);
          await handleDisconnectSteam();
          setSteamDisconnecting(false);
        }}
        playSound={playSound}
      />

      <ConfirmationModal
        isOpen={disconnectDiscordModalOpen}
        variant="disconnect"
        title={t("disconnectDiscordTitle")}
        description={t("disconnectDiscordDescription")}
        confirmLabel="Sim, desconectar"
        onClose={() => setDisconnectDiscordModalOpen(false)}
        onConfirm={async () => {
          setDisconnectDiscordModalOpen(false);
          setDiscordDisconnecting(true);
          await handleDisconnectDiscord();
          setDiscordDisconnecting(false);
        }}
        playSound={playSound}
      />

      <ConfirmationModal
        isOpen={disconnectEpicModalOpen}
        variant="disconnect"
        title={t("disconnectEpicTitle")}
        description={t("disconnectEpicDescription")}
        confirmLabel="Sim, desconectar"
        onClose={() => setDisconnectEpicModalOpen(false)}
        onConfirm={async () => {
          setDisconnectEpicModalOpen(false);
          setEpicDisconnecting(true);
          try {
            await handleDisconnectEpic();
            setEpicAuthConnected(false);
            setEpicDisplayName("");
            try {
              localStorage.removeItem("checkpoint_epic_linked_uid");
            } catch { /* ignore */ }
            await refreshLibrary();
          } finally {
            setEpicDisconnecting(false);
          }
        }}
        playSound={playSound}
      />

      <ConfirmationModal
        isOpen={pendingFriendRemoval !== null}
        variant="unfriend"
        title="Desfazer amizade"
        description={
          pendingFriendRemoval
            ? `Você vai remover ${pendingFriendRemoval.name} da sua lista de amigos.`
            : ""
        }
        confirmLabel="Sim, remover"
        onClose={() => setPendingFriendRemoval(null)}
        onConfirm={async () => {
          const friend = pendingFriendRemoval;
          setPendingFriendRemoval(null);
          if (!friend) return;
          await removeFriend(friend);
        }}
        playSound={playSound}
      />

      <React.Suspense fallback={null}>
        <ChatModal
          isOpen={activeChatFriend !== null}
          onClose={() => setActiveChatFriend(null)}
          friend={activeChatFriend}
          playSound={playSound}
          onStartVoiceCall={(friend, withVideo) => void startCall(friend, withVideo)}
        />
      </React.Suspense>

      <AnimatePresence>
        {isExitingSession && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-210 flex flex-col items-center justify-center overflow-hidden bg-[#030405]"
          >
            {/* Onda de luz expandindo */}
            <motion.div
              initial={{ scale: 0, opacity: 0.8 }}
              animate={{ scale: 1, opacity: 0 }}
              transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
              className="absolute w-[60vmax] h-[60vmax] rounded-full bg-white blur-[100px] pointer-events-none"
            />

            {/* Anéis orbitais concêntricos */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
              className="absolute w-80 h-80 md:w-96 md:h-96 rounded-full border border-white/8"
            />
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 28, repeat: Infinity, ease: "linear" }}
              className="absolute w-64 h-64 md:w-80 md:h-80 rounded-full border border-white/6 border-dashed"
            />

            {/* Núcleo com Logo */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="relative z-10 flex flex-col items-center text-center"
            >
              <div className="relative mb-6">
                <motion.div
                  animate={{ scale: [1, 1.2, 1], opacity: [0.2, 0.5, 0.2] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  className="absolute inset-0 rounded-full bg-white blur-2xl"
                />
                <img
                  src={PHERIELIUM_LOGO_PATH}
                  alt="Pherielium"
                  className="relative w-20 h-20 md:w-24 md:h-24 object-contain drop-shadow-[0_0_35px_rgba(255,255,255,0.6)]"
                  draggable={false}
                />
              </div>

              <h3 className="text-2xl md:text-3xl font-display font-semibold text-white tracking-tight mb-2">
                Encerrando Sessão
              </h3>
              <p className="text-xs font-body tracking-wider text-white/40">
                Até logo
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <EpicConnectModal
        isOpen={epicConnectModalOpen}
        playSound={playSound}
        onClose={() => setEpicConnectModalOpen(false)}
        operationState={platformOperations?.epic}
        onDisconnect={async () => {
          await handleDisconnectEpic();
          await checkEpicStatus();
          await refreshLibrary();
        }}
        onConnect={async (sid) => {
          setEpicConnectModalOpen(false);
          setEpicConnecting(true);
          try {
            await platformOps.connectEpic(sid);
            notify("Epic Games conectada com sucesso! Sincronizando jogos...", "info");
            await checkEpicStatus();
            await handleSyncEpic();
          } catch (err: any) {
            notify(err?.message || "Erro ao conectar Epic Games.", "error");
          } finally {
            setEpicConnecting(false);
          }
        }}
      />

      {/* Library Filter Modal */}
      <React.Suspense fallback={null}>
        <LibraryFilterModal
          isOpen={filterModalOpen}
          onClose={() => setFilterModalOpen(false)}
          onApply={(filters) => {
            setLibraryFilters(filters);
            setFilterModalOpen(false);
          }}
          games={games}
          currentFilters={libraryFilters}
        />
      </React.Suspense>

      {/* Platform Selector Modal / Drawer */}
      <PlatformSelectorModal
        isOpen={isPlatformModalOpen}
        onClose={() => {
          setIsPlatformModalOpen(false);
          setOpenedViaShortcut(false);
        }}
        activePlatform={activeCategory}
        onSelectPlatform={(platformId) => selectCategory(platformId)}
        games={games}
        playSound={playSound}
        openedViaShortcut={openedViaShortcut}
      />

      {/* Welcome Tour Modal */}
      <React.Suspense fallback={null}>
        {isWelcomeModalOpen && (
          <WelcomeModal
            isOpen={isWelcomeModalOpen}
            onClose={handleCloseWelcomeModal}
            playSound={playSound}
            onOpenAddGame={() => {
              handleCloseWelcomeModal();
              openAddGameModal();
            }}
            onConnectPlatform={() => {
              handleCloseWelcomeModal();
              setSettingsTab("connections");
              selectCategory("SETTINGS");
            }}
          />
        )}
      </React.Suspense>

      {/* Level Up Toast — discreto, gamificado, não bloqueia */}
      <AnimatePresence>
        {showLevelUp && levelUpData && (
          <motion.div
            initial={{ opacity: 0, x: 80, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 40, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 320, damping: 24 }}
            className="fixed bottom-6 right-6 z-9999 pointer-events-auto"
            onMouseEnter={() => { if (levelUpTimerRef.current) window.clearTimeout(levelUpTimerRef.current); }}
            onMouseLeave={() => { levelUpTimerRef.current = window.setTimeout(() => setShowLevelUp(false), 2500) as any; }}
          >
            <div
              className="relative w-90 overflow-hidden rounded-2xl border bg-black/90 backdrop-blur-2xl shadow-[0_20px_60px_rgba(0,0,0,0.6)]"
              style={{
                borderColor: (levelUpData as any)?.tierInfo?.hexColor ? `${(levelUpData as any).tierInfo.hexColor}40` : "rgba(255,255,255,0.12)",
                boxShadow: `0 0 30px ${(levelUpData as any)?.tierInfo?.hexColor ?? "#fbbf24"}25, 0 20px 60px rgba(0,0,0,0.6)`,
              }}
            >
              {/* glow topo */}
              <div className="absolute -top-10 -right-10 h-32 w-32 rounded-full blur-3xl opacity-20" style={{ background: (levelUpData as any)?.tierInfo?.hexColor ?? "#fbbf24" }} />
              <div className="absolute inset-0 bg-linear-to-br from-white/6 to-transparent pointer-events-none" />
              {/* barra de progresso fina no topo */}
              {typeof (levelUpData as any)?.progress === "number" && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/5">
                  <motion.div className="h-full" style={{ background: (levelUpData as any)?.tierInfo?.hexColor ?? "#fbbf24" }} initial={{ width: 0 }} animate={{ width: `${(levelUpData as any).progress}%` }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
                </div>
              )}
              <div className="relative flex gap-4 p-4">
                <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-xl border bg-black/40" style={{ borderColor: `${(levelUpData as any)?.tierInfo?.hexColor ?? "#fbbf24"}40`, background: `${(levelUpData as any)?.tierInfo?.hexColor ?? "#fbbf24"}12` }}>
                  <motion.div initial={{ scale: 0, rotate: -30 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 260, damping: 14 }}>
                    {(levelUpData as any)?.tierInfo?.tier === "platinum" ? (
                      <span className="text-xl">💎</span>
                    ) : (
                      <Trophy className="h-7 w-7" style={{ color: (levelUpData as any)?.tierInfo?.hexColor ?? "#fbbf24" }} fill="currentColor" />
                    )}
                  </motion.div>
                  <div className="absolute -bottom-1 -right-1 flex h-5 min-w-5 items-center justify-center rounded-full border border-black bg-white px-1 text-[10px] font-black text-black">Lv{(levelUpData as any)?.prevLevel ?? ""}→{levelUpData.level}</div>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50">Nível Alcançado</p>
                      <div className="flex items-baseline gap-2">
                        <span className="text-2xl font-black text-white tracking-tight">{levelUpData.level}</span>
                        <span className={`text-xs font-bold ${(levelUpData as any)?.tierInfo ? "" : levelUpData.rankColor}`} style={(levelUpData as any)?.tierInfo ? { color: (levelUpData as any).tierInfo.hexColor } : undefined}>{(levelUpData as any)?.tierInfo?.name ?? levelUpData.rank}</span>
                      </div>
                    </div>
                    <button onClick={() => setShowLevelUp(false)} className="rounded-full p-1 text-white/40 hover:text-white hover:bg-white/10 transition-colors">
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="mt-2 flex items-center gap-2 text-[11px] font-semibold text-white/60">
                    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-bold text-amber-300">+{(levelUpData as any)?.xp?.toLocaleString?.() ?? ""} XP</span>
                    <span className="text-white/30">•</span>
                    <span>{(levelUpData as any)?.progress ?? 0}% para próximo nível</span>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button onClick={() => { setShowLevelUp(false); (window as any).checkpointSelectCategory?.("TROPHIES"); selectCategory("TROPHIES"); playSound("select"); }} className="flex-1 rounded-xl bg-white text-black px-3 py-2 text-xs font-black hover:bg-white/90 transition-colors">Ver troféus</button>
                    <button onClick={() => setShowLevelUp(false)} className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-xs font-bold text-white/70 hover:bg-white/10">Fechar</button>
                  </div>
                </div>
              </div>
              {/* partículas sparkle discreta */}
              <motion.div className="pointer-events-none absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
                <div className="absolute left-8 top-3 h-1 w-1 rounded-full bg-white/60 animate-pulse" />
                <div className="absolute right-12 top-6 h-0.5 w-0.5 rounded-full bg-white/40 animate-pulse" style={{ animationDelay: "0.3s" }} />
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Botão flutuante no canto da tela para abrir/reaparecer o Guia de Missões */}
      {
        isQuestsEligible && activeCategory === "ALL" && (
          <button
            type="button"
            onClick={() => {
              playSound("select");
              setIsQuestsModalOpen(true);
            }}
            className="fixed bottom-6 right-6 z-120 flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#0D0E15]/90 hover:bg-[#161824] border border-amber-500/40 hover:border-amber-500/80 shadow-[0_10px_30px_rgba(0,0,0,0.7),0_0_20px_rgba(245,158,11,0.2)] text-white text-xs font-bold transition-all duration-200 backdrop-blur-xl group hover:scale-105 cursor-pointer"
            title="Abrir Guia de Missões"
          >
            <div className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-500/20 text-amber-400 group-hover:bg-amber-500/30">
              <Compass className="h-3.5 w-3.5 animate-[spin_20s_linear_infinite]" />
            </div>
            <span className="tracking-wide">Missões</span>
            <span className="rounded-full bg-amber-500/25 px-2 py-0.5 font-mono text-[10px] font-extrabold text-amber-400">
              {questsStatus.completed}/{questsStatus.total}
            </span>
          </button>
        )
      }

      {/* Modal/Overlay Flutuante de Missões */}
      {
        isQuestsModalOpen && (
          <HomeOnboardingQuests
            userId={user?.uid}
            userProfile={userProfile}
            userLevel={playerLevel.level}
            hasFriends={(userProfile?.checkpointFriends?.length || 0) > 0}
            totalGames={games.length}
            favoritesCount={games.filter((g) => (g as any).isFavorite || (g as any).favorite).length}
            hasAchievements={games.some((g) => (g.completedAchievements || 0) > 0)}
            hasSteamConnected={Boolean(resolvedSteamId)}
            hasEpicConnected={epicAuthConnected}
            hasDiscordConnected={Boolean(userProfile?.discordId)}
            onOpenAddFriend={() => {
              setIsQuestsModalOpen(false);
              setIsAddFriendModalOpen(true);
            }}
            onOpenAddGame={() => {
              setIsQuestsModalOpen(false);
              openAddGameModal(categoryToLauncherType(activeCategory));
            }}
            onOpenSettings={() => {
              setIsQuestsModalOpen(false);
              selectCategory("SETTINGS");
            }}
            onOpenProfile={() => {
              setIsQuestsModalOpen(false);
              selectCategory("PROFILE");
            }}
            onOpenTrophies={() => {
              setIsQuestsModalOpen(false);
              selectCategory("TROPHIES");
            }}
            playSound={playSound}
            isModal={true}
            onClose={() => setIsQuestsModalOpen(false)}
          />
        )
      }

      <UpdateAvailableBanner />
    </div>
  );
};

export default Home;
