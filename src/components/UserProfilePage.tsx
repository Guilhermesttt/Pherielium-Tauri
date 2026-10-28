import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Clock, ExternalLink, Gamepad2, Layers, Lock, Pencil, Search, Star, Trophy, TrendingUp, User, Sparkles, ChevronDown, Camera } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDiscord, faSteam } from "@fortawesome/free-brands-svg-icons";
import tierLevelClickSound from "../sounds/Phelierium Default/Deck UI Default Activation.mp3";
import { progressionEventBus } from "../services/progressionEvents";
import { EPIC_GAMES_ICON_PATH } from "../constants/assets";
import type { LauncherLanguage } from "../context/PreferencesContext";
import type { Game, UserProfile } from "../types/domain";
import { useGamepadNavigation } from "../hooks/useGamepadNavigation";
import { calculateAchievementTotals } from "../utils/achievementTotals";
import {
  calculatePlayerLevel,
  aggregateTrophyCounts,
  calculatePlayerLevelFromXp,
  getPSNTierInfo,
} from "../utils/trophyTiers";
import { getUserUnifiedLevel } from "../utils/hubTrophies";
import { useAuth } from "../auth/AuthProvider";
import {
  calculateTotalPlayedMinutes,
  formatPlayedHours,
  getGamePlayedHours,
} from "../utils/playtime";
import ProfileEditorModal from "./ProfileEditorModal";
import { RankBadge } from "./ui/RankBadge";
import { FramedImage } from "./ui/FramedImage";
import { HorizontalTabs } from "./ui/HorizontalTabs";
import { SectionTransition } from "./ui/SectionTransition";
import { HomeOnboardingQuests } from "./home/HomeOnboardingQuests";
import { areAllQuestsCompleted, getAllQuestsWithStatus, shouldShowOnboardingQuests } from "../services/userQuests";
import { fetchUserGamesForProfile } from "../services/checkpointFriends";
import { cn } from "../lib/utils";

interface UserProfilePageProps {
  userProfile: UserProfile | null;
  user: { email?: string | null; photoURL?: string | null; displayName?: string | null } | null;
  games: Game[];
  onOpenGame?: (game: Game) => void;
  onProfileUpdated?: () => Promise<void> | void;
  editable?: boolean;
  playSound?: (sound: string) => void;
  language?: LauncherLanguage;
  copyFriendDiscord?: boolean;
  onNotify?: (message: string, type?: "success" | "error" | "info") => void;
  /**
   * When provided, the page renders a server-side trophy/XP event timeline
   * (Phase 3.5). Only the self profile should pass this; the friend-profile
   * modal intentionally omits it.
   */
  userId?: string | null;
}

type LegacyGameFields = {
  minutesPlayed?: number;
  imageUrl?: string;
};

type LegacyLibrarySummaryFields = {
  steamGameCount?: number;
  epicGameCount?: number;
  localGameCount?: number;
};

const profileCopy = {
  "pt-BR": {
    connected: "Conectado", disconnected: "Não conectado", player: "Jogador",
    edit: "Editar perfil", games: "Jogos", hours: "Horas", favorites: "Favoritos",
    platforms: "Plataformas", achievements: "Conquistas", library: "Biblioteca",
    mostPlayed: "Mais jogados", allGames: "Todos os Jogos", searchGames: "Filtrar jogos...", noGamesFound: "Nenhum jogo encontrado.",
    unlocked: "conquistas desbloqueadas",
    catalogued: "jogos catalogados", catalog: "Catálogo e atalhos",
    noFavorites: "Nenhum favorito ainda.", emptyTitle: "Perfil em construção",
    emptyBody: "Jogue e favorite jogos para preencher esta área.", copiedNickname: "Nickname do Discord copiado.", copiedId: "ID do Discord copiado.", copyError: "Não foi possível copiar o Discord.",
  },
  "en-US": {
    connected: "Connected", disconnected: "Not connected", player: "Player",
    edit: "Edit profile", games: "Games", hours: "Hours", favorites: "Favorites",
    platforms: "Platforms", achievements: "Achievements", library: "Library",
    mostPlayed: "Most played", allGames: "All Games", searchGames: "Filter games...", noGamesFound: "No games found.",
    unlocked: "achievements unlocked",
    catalogued: "games catalogued", catalog: "Catalog and shortcuts",
    noFavorites: "No favorites yet.", emptyTitle: "Profile under construction",
    emptyBody: "Play and favorite games to fill this area.", copiedNickname: "Discord nickname copied.", copiedId: "Discord ID copied.", copyError: "Could not copy Discord.",
  },
  "es-ES": {
    connected: "Conectado", disconnected: "No conectado", player: "Jugador",
    edit: "Editar perfil", games: "Juegos", hours: "Horas", favorites: "Favoritos",
    platforms: "Plataformas", achievements: "Logros", library: "Biblioteca",
    mostPlayed: "Más jugados", allGames: "Todos los Juegos", searchGames: "Filtrar juegos...", noGamesFound: "No se encontraron juegos.",
    unlocked: "logros desbloqueados",
    catalogued: "juegos catalogados", catalog: "Catálogo y accesos directos",
    noFavorites: "Aún no hay favoritos.", emptyTitle: "Perfil en construcción",
    emptyBody: "Juega y marca juegos como favoritos para completar esta área.", copiedNickname: "Nickname de Discord copiado.", copiedId: "ID de Discord copiado.", copyError: "No se pudo copiar Discord.",
  },
  "fr-FR": {
    connected: "Connecté", disconnected: "Non connecté", player: "Joueur",
    edit: "Modifier le profil", games: "Jeux", hours: "Heures", favorites: "Favoris",
    platforms: "Plateformes", achievements: "Succès", library: "Bibliothèque",
    mostPlayed: "Les plus joués", allGames: "Tous les Jeux", searchGames: "Filtrer les jeux...", noGamesFound: "Aucun jeu trouvé.",
    unlocked: "succès débloqués",
    catalogued: "jeux catalogués", catalog: "Catalogue et raccourcis",
    noFavorites: "Aucun favori.", emptyTitle: "Profil en construction",
    emptyBody: "Jouez et ajoutez des jeux aux favoris pour remplir cette zone.", copiedNickname: "Pseudo Discord copié.", copiedId: "ID Discord copié.", copyError: "Impossible de copier Discord.",
  },
  "de-DE": {
    connected: "Verbunden", disconnected: "Nicht verbunden", player: "Spieler",
    edit: "Profil bearbeiten", games: "Spiele", hours: "Stunden", favorites: "Favoriten",
    platforms: "Plattformen", achievements: "Erfolge", library: "Bibliothek",
    mostPlayed: "Meistgespielt", allGames: "Alle Spiele", searchGames: "Spiele filtern...", noGamesFound: "Keine Spiele gefunden.",
    unlocked: "Erfolge freigeschaltet",
    catalogued: "Spiele katalogisiert", catalog: "Katalog und Verknüpfungen",
    noFavorites: "Noch keine Favoriten.", emptyTitle: "Profil im Aufbau",
    emptyBody: "Spiele und markiere Favoriten, um diesen Bereich zu füllen.", copiedNickname: "Discord-Name kopiert.", copiedId: "Discord-ID kopiert.", copyError: "Discord konnte nicht kopiert werden.",
  },
  "it-IT": {
    connected: "Connesso", disconnected: "Non connesso", player: "Giocatore",
    edit: "Modifica profilo", games: "Giochi", hours: "Ore", favorites: "Preferiti",
    platforms: "Piattaforme", achievements: "Obiettivi", library: "Libreria",
    mostPlayed: "Più giocati", allGames: "Tutti i Giochi", searchGames: "Filtra giochi...", noGamesFound: "Nessun gioco trovato.",
    unlocked: "obiettivi sbloccati",
    catalogued: "giochi catalogati", catalog: "Catalogo e collegamenti",
    noFavorites: "Nessun preferito.", emptyTitle: "Profilo in costruzione",
    emptyBody: "Gioca e aggiungi giochi ai preferiti per riempire questa area.", copiedNickname: "Nickname Discord copiato.", copiedId: "ID Discord copiato.", copyError: "Impossibile copiare Discord.",
  },
} as const;

const EpicIcon: React.FC<{ className?: string }> = ({ className }) => (
  <img
    width={96}
    height={96}
    src={EPIC_GAMES_ICON_PATH}
    alt="Epic Games"
    className={className}
    style={{ filter: "invert(1)" }}
  />
);

const avatarUrl = (profile: UserProfile | null, authPhotoURL?: string | null) =>
  profile?.photoURL || authPhotoURL || profile?.discordAvatar || profile?.steamAvatar || "";

const initialsFor = (name: string) =>
  name
    .split(" ")
    .map((word) => word[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

const openExternalProfile = async (url: string) => {
  if (window.electronAPI?.openExternalUrl) {
    await window.electronAPI.openExternalUrl(url);
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
};

const copyToClipboard = async (value: string) => {
  if (window.electronAPI?.copyToClipboard) {
    try {
      const result = await window.electronAPI.copyToClipboard(value);
      if (result?.ok !== false) return;
    } catch {
      // Builds antigos ou um preload ainda em memória podem não expor o IPC.
      // Nesse caso, continuamos com os fallbacks do Chromium abaixo.
    }
  }
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      // O Electron pode bloquear navigator.clipboard dependendo do foco/permissão.
    }
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = typeof document.execCommand === "function" && document.execCommand("copy");
  input.remove();
  if (!copied) throw new Error("Clipboard unavailable");
};

const ProfileAvatar: React.FC<{
  profile: UserProfile | null;
  authPhotoURL?: string | null;
  displayName: string;
  compact?: boolean;
  editable?: boolean;
  onEditClick?: () => void;
}> = ({ profile, authPhotoURL, displayName, compact = false, editable = false, onEditClick }) => {
  const src = avatarUrl(profile, authPhotoURL);
  return (
    <div
      onClick={editable ? onEditClick : undefined}
      className={`group relative shrink-0 aspect-square overflow-hidden rounded-[var(--corner-lg)] bg-[var(--tone-2)] ring-[6px] ring-[var(--tone-1)] ${compact ? "h-[104px] w-[104px]" : "h-[136px] w-[136px]"
        } ${editable ? "cursor-pointer" : ""}`}
      title={editable ? "Clique para editar perfil e foto" : undefined}
    >
      {src ? (
        <FramedImage src={src} className="h-full w-full object-cover object-center aspect-square select-none" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-[var(--ink-muted)] select-none">
          {initialsFor(displayName)}
        </div>
      )}
      {editable && (
        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-[var(--ink)] z-10">
          <Camera className="h-5 w-5 text-[var(--ink)]" />
          <span className="text-[length:var(--step-0)] font-semibold">Editar</span>
        </div>
      )}
    </div>
  );
};

const PlatformRow: React.FC<{
  name: string;
  connected: boolean;
  username?: string;
  avatar?: string;
  icon: React.ReactNode;
  connectedLabel: string;
  disconnectedLabel: string;
  compact?: boolean;
}> = ({ name, connected, username, avatar, icon, connectedLabel, disconnectedLabel, compact = false }) => (
  <div
    className={`flex items-center bg-[var(--tone-2)] justify-between transition-colors hover:bg-[var(--tone-3)] rounded-[var(--corner-md)] ${compact ? "py-3 px-4 gap-3" : "py-4 px-5 gap-4"
      }`}
  >
    <div className="flex min-w-0 items-center gap-3">
      <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-[var(--corner-sm)] bg-[var(--tone-3)] text-[var(--ink)] ${compact ? "h-10 w-10" : "h-12 w-12"}`}>
        {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover" /> : icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[length:var(--step-1)] font-semibold text-[var(--ink)] leading-tight">{name}</p>
        <p className="truncate text-[length:var(--step-0)] text-[var(--ink-muted)] mt-0.5">
          {connected ? username || connectedLabel : disconnectedLabel}
        </p>
      </div>
    </div>
    <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${connected ? "bg-[var(--live)]" : "bg-[var(--tone-4)]"}`} />
  </div>
);

interface SectionProps {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  compact?: boolean;
}

const Section: React.FC<SectionProps> = ({
  title,
  icon,
  children,
  className = "",
  compact = false,
}) => (
  <section
    className={`${compact ? "rounded-[var(--corner-lg)] p-5 md:p-6" : "rounded-[var(--corner-lg)] p-6 md:p-8"} bg-[var(--tone-1)] ${className}`}
  >
    <div className={`${compact ? "mb-4" : "mb-6"} flex items-center gap-3`}>
      {icon && (
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--corner-sm)] bg-[var(--tone-3)] text-[var(--ink-muted)]">
          {icon}
        </div>
      )}
      <h2 className="font-display text-[length:var(--step-2)] font-semibold leading-tight text-[var(--ink)]">{title}</h2>
    </div>
    {children}
  </section>
);

const UserProfilePage: React.FC<UserProfilePageProps> = ({
  userProfile,
  user,
  games,
  onOpenGame,
  onProfileUpdated,
  editable = true,
  playSound,
  language = "pt-BR",
  copyFriendDiscord = false,
  onNotify,
  userId = null,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isEditing, setIsEditing] = useState(false);
  useGamepadNavigation({
    scrollRef: scrollRef as React.RefObject<HTMLElement>,
    scrollSpeed: 25,
    disableX: true,
    disableO: true,
  });
  const copy = profileCopy[language];
  const compactProfile = !editable;
  const isPrivateProfile = !editable && userProfile?.profileVisibility === "private";
  const targetUid = userId || userProfile?.uid;
  const localDisplayName = targetUid && typeof window !== "undefined"
    ? localStorage.getItem(`phelierium_custom_display_name_${targetUid}`)
    : null;
  const displayName = localDisplayName || userProfile?.displayName || user?.displayName || user?.email?.split("@")[0] || copy.player;

  const [fetchedGames, setFetchedGames] = useState<Game[]>([]);
  const profileGames = games && games.length > 0 ? games : fetchedGames;

  useEffect(() => {
    const currentTargetUid = userId || userProfile?.uid;
    if (!currentTargetUid || (games && games.length > 0) || fetchedGames.length > 0) return;

    let isMounted = true;
    fetchUserGamesForProfile(currentTargetUid, userProfile)
      .then((loaded) => {
        if (isMounted && loaded && loaded.length > 0) {
          setFetchedGames(loaded);
        }
      })
      .catch((err) => {
        console.warn("[UserProfilePage] Erro ao carregar jogos do perfil:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [userId, userProfile, games, fetchedGames.length]);

  const normalizedGames = useMemo(() => {
    return (profileGames || []).map((game) => {
      const legacyGame = game as Game & LegacyGameFields;
      const minutes = Math.max(
        0,
        Number(legacyGame.minutesPlayed) || 0,
        Number(game.steamPlaytimeMinutes) || 0,
        Number(game.locallyTrackedMinutes) || 0,
        Math.round((Number(game.hoursPlayed) || 0) * 60),
      );
      return {
        ...game,
        hoursPlayed: minutes / 60,
        isFavorite: Boolean(game.isFavorite),
        cardImage: game.cardImage || legacyGame.imageUrl || game.image,
        image: game.image || legacyGame.imageUrl || game.cardImage,
      } as Game;
    });
  }, [profileGames]);

  const topGames = useMemo(() => {
    const withHours = [...normalizedGames]
      .filter((game) => getGamePlayedHours(game) > 0)
      .sort((a, b) => getGamePlayedHours(b) - getGamePlayedHours(a));
    if (withHours.length > 0) return withHours.slice(0, 5);
    return [...normalizedGames].slice(0, 5);
  }, [normalizedGames]);

  const favoriteGames = useMemo(() => {
    const explicit = normalizedGames.filter((game) => game.isFavorite);
    if (explicit.length > 0) {
      return explicit.slice(0, 6);
    }
    // Para perfil de amigo sem favoritos explícitos marcados, exibe os jogos de maior destaque/tempo
    if (!editable) {
      const withPlayed = topGames.filter((g) => getGamePlayedHours(g) > 0);
      if (withPlayed.length > 0) return withPlayed.slice(0, 6);
      return topGames.slice(0, 6);
    }
    return [];
  }, [normalizedGames, editable, topGames]);

  const stats = useMemo(() => {
    const totalMinutes = normalizedGames.length > 0
      ? calculateTotalPlayedMinutes(normalizedGames)
      : (userProfile?.librarySummary
          ? Math.max(0, Math.round(Number(userProfile.librarySummary.minutesPlayed) || 0))
          : 0);
    const totalHours = totalMinutes / 60;
    const achievementTotals = calculateAchievementTotals(normalizedGames);
    const storedAchievementSummary = userProfile?.achievementSummary;
    const totalAchievements =
      achievementTotals.unlocked > 0 || achievementTotals.available > 0
        ? achievementTotals.unlocked
        : Number(storedAchievementSummary?.unlocked || 0);
    const totalPossible =
      achievementTotals.available > 0
        ? achievementTotals.available
        : Math.max(Number(storedAchievementSummary?.available ?? 0), totalAchievements);
    const legacyLibrarySummary = userProfile?.librarySummary as
      | (UserProfile["librarySummary"] & LegacyLibrarySummaryFields)
      | undefined;
    const explicitFavoritesCount = normalizedGames.filter((game) => game.isFavorite).length;
    const favorites = explicitFavoritesCount > 0
      ? explicitFavoritesCount
      : (!editable && favoriteGames.length > 0
          ? favoriteGames.length
          : (userProfile?.librarySummary?.favorites ?? 0));
    const steamGames = normalizedGames.length > 0
      ? normalizedGames.filter((game) => game.launcherType === "steam").length
      : (userProfile?.librarySummary?.steamGames ?? legacyLibrarySummary?.steamGameCount ?? 0);
    const epicGames = normalizedGames.length > 0
      ? normalizedGames.filter((game) => game.launcherType === "epic").length
      : (userProfile?.librarySummary?.epicGames ?? legacyLibrarySummary?.epicGameCount ?? 0);
    const localGames = normalizedGames.length > 0
      ? normalizedGames.filter((game) => !game.launcherType || game.launcherType === "local").length
      : (userProfile?.librarySummary?.localGames ?? legacyLibrarySummary?.localGameCount ?? 0);
    const totalGames = normalizedGames.length || userProfile?.librarySummary?.games || 0;
    return { totalGames, totalHours, totalAchievements, totalPossible, favorites, steamGames, epicGames, localGames };
  }, [normalizedGames, userProfile, editable, favoriteGames.length]);

  const canOpenGames = Boolean(editable && onOpenGame);

  const [activeGameTab, setActiveGameTab] = useState<"mostPlayed" | "allGames">("mostPlayed");
  const [gameSearch, setGameSearch] = useState("");

  const filteredAllGames = useMemo(() => {
    const q = gameSearch.trim().toLowerCase();
    const sorted = [...normalizedGames].sort((a, b) => {
      const diff = getGamePlayedHours(b) - getGamePlayedHours(a);
      if (diff !== 0) return diff;
      return a.title.localeCompare(b.title);
    });
    if (!q) return sorted;
    return sorted.filter((g) => g.title.toLowerCase().includes(q));
  }, [normalizedGames, gameSearch]);

  const achievementPercent =
    stats.totalPossible > 0 ? Math.round((stats.totalAchievements / stats.totalPossible) * 100) : 0;
  const maxHours = Math.max(topGames[0] ? getGamePlayedHours(topGames[0]) : 1, 1);
  const libraryRows = [
    { label: "Steam", value: stats.steamGames },
    { label: "Epic Games", value: stats.epicGames },
    { label: "Local", value: stats.localGames },
  ];
  const steamId = String(userProfile?.steamId || "").trim();
  const discordId = String(userProfile?.discordId || "").trim();
  const hasSteamProfile = /^\d{10,20}$/.test(steamId);
  const hasDiscordProfile = /^\d{10,24}$/.test(discordId);
  const discordDisplayName = String(userProfile?.discordUsername || discordId).trim();

  const { user: authUser } = useAuth();

  // Missões de Engajamento do Jogador (Phelierium Quests)
  const [questsRevision, setQuestsRevision] = useState(0);
  const [isQuestsVisible, setIsQuestsVisible] = useState(() => {
    return localStorage.getItem("checkpoint_quests_visible") !== "false";
  });

  const toggleQuestsVisibility = useCallback(() => {
    setIsQuestsVisible(prev => {
      const next = !prev;
      localStorage.setItem("checkpoint_quests_visible", String(next));
      return next;
    });
  }, []);

  // Ouvir atualizações de missões e XP em tempo real
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
  const playerLevel = useMemo(() => {
    void questsRevision;
    const isSelf = editable && authUser?.uid;
    if (isSelf) {
      return getUserUnifiedLevel(authUser.uid, normalizedGames);
    }
    // Amigos ou perfis consultados via busca
    const anyProfile = userProfile as (UserProfile & { levelProgress?: { total_xp?: number; current_level?: number; progress_pct?: number }; level?: number }) | null;
    const levelProgress = anyProfile?.levelProgress;
    if (levelProgress?.total_xp != null && Number(levelProgress.total_xp) > 0) {
      return calculatePlayerLevelFromXp(Number(levelProgress.total_xp));
    }
    const rawLvl = Number(levelProgress?.current_level ?? anyProfile?.level ?? 0);
    if (rawLvl > 1) {
      const tierInfo = getPSNTierInfo(rawLvl);
      return {
        level: rawLvl,
        xp: 0,
        progress: Number(levelProgress?.progress_pct ?? 0),
        currentLevelXp: 0,
        xpForNextLevel: 0,
        tier: tierInfo.tier,
        subTier: tierInfo.subTier,
        tierName: tierInfo.name,
        rank: tierInfo.name,
        rankColor: tierInfo.color,
        tierInfo,
      };
    }
    const agg = aggregateTrophyCounts(normalizedGames);
    return calculatePlayerLevel(stats.totalHours, stats.totalAchievements, stats.totalGames, agg);
  }, [normalizedGames, stats, editable, authUser?.uid, userProfile, questsRevision]);

  const shouldShowQuests = useMemo(() => {
    const uid = userId || userProfile?.uid || authUser?.uid;
    if (!uid) return false;
    void questsRevision;

    const quests = getAllQuestsWithStatus(uid);
    const allDone = areAllQuestsCompleted(uid) || (quests.length > 0 && quests.every((q) => q.completed));
    if (allDone) return false;

    return shouldShowOnboardingQuests(uid, userProfile, {
      totalGames: games.length,
      level: playerLevel.level,
    });
  }, [userId, userProfile, authUser?.uid, questsRevision, games.length, playerLevel.level]);

  // Auto-validação de marcos alcançados (ex: jogos na biblioteca, plataformas conectadas, etc.)
  useEffect(() => {
    if (!editable || !authUser?.uid) return;
    const uid = authUser.uid;

    // Se já tem pelo menos 1 jogo na biblioteca
    if (stats.totalGames > 0) {
      import("../services/userQuests").then(({ completeUserQuest }) => {
        completeUserQuest(uid, "first_game");
      });
    }

    // Se tem plataformas conectadas
    if (hasSteamProfile || hasDiscordProfile || stats.epicGames > 0) {
      import("../services/userQuests").then(({ completeUserQuest }) => {
        completeUserQuest(uid, "connect_platform");
      });
    }

    // Se tem amigos adicionados
    if ((userProfile?.checkpointFriends?.length || 0) > 0) {
      import("../services/userQuests").then(({ completeUserQuest }) => {
        completeUserQuest(uid, "first_friend");
      });
    }

    // Se tem jogos favoritados
    if (stats.favorites > 0) {
      import("../services/userQuests").then(({ completeUserQuest }) => {
        completeUserQuest(uid, "favorite_game");
      });
    }

    // Se já desbloqueou alguma conquista
    if (stats.totalAchievements > 0) {
      import("../services/userQuests").then(({ completeUserQuest }) => {
        completeUserQuest(uid, "first_trophy");
      });
    }
  }, [
    editable,
    authUser?.uid,
    stats.totalGames,
    stats.favorites,
    stats.totalAchievements,
    hasSteamProfile,
    hasDiscordProfile,
    stats.epicGames,
    userProfile?.checkpointFriends?.length,
  ]);


  const [simulatedLevelDelta, setSimulatedLevelDelta] = useState(0);
  const [isTierMenuOpen, setIsTierMenuOpen] = useState(false);
  const tierMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!isTierMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (tierMenuRef.current && !tierMenuRef.current.contains(e.target as Node)) {
        setIsTierMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isTierMenuOpen]);

  const effectiveLevel = Math.min(999, Math.max(1, playerLevel.level + simulatedLevelDelta));
  const effectiveTierInfo = useMemo(() => getPSNTierInfo(effectiveLevel), [effectiveLevel]);
  const effectiveTier = effectiveTierInfo.tier;

  const nextTierInfo = useMemo(() => {
    if (effectiveLevel >= 999) return null;
    return getPSNTierInfo(effectiveLevel + 1);
  }, [effectiveLevel]);

  const handleTierBadgeClick = useCallback(() => {
    try {
      const audio = new Audio(tierLevelClickSound);
      audio.volume = 0.8;
      audio.play().catch(() => { });
    } catch {
      playSound?.("select");
    }
  }, [playSound]);

  const handleSimulateLevelUp = useCallback(
    (targetTier?: "bronze" | "silver" | "gold" | "platinum") => {
      let nextLevel = effectiveLevel + 1;

      if (targetTier) {
        if (targetTier === "bronze") nextLevel = 10;
        else if (targetTier === "silver") nextLevel = 25;
        else if (targetTier === "gold") nextLevel = 50;
        else if (targetTier === "platinum") nextLevel = 100;
      }

      const nextInfo = getPSNTierInfo(nextLevel);
      setSimulatedLevelDelta(nextLevel - playerLevel.level);

      progressionEventBus.emitLevelUp({
        oldLevel: effectiveLevel,
        newLevel: nextLevel,
        levelInfo: {
          ...playerLevel,
          level: nextLevel,
          tier: nextInfo.tier,
          subTier: nextInfo.subTier,
          tierName: nextInfo.name,
          rank: nextInfo.name,
          rankColor: nextInfo.color,
          tierInfo: nextInfo,
          progress: 0,
          currentLevelXp: 0,
          xpForNextLevel: 100,
        },
        tierInfo: nextInfo,
      });
    },
    [effectiveLevel, playerLevel],
  );

  return (
    <motion.div
      ref={scrollRef}
      data-system-page
      data-profile-density={compactProfile ? "compact" : "comfortable"}
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      className="relative min-h-0 flex-1 overflow-y-auto thin-scrollbar"
      style={{ padding: "var(--safe-y) var(--safe-x) 48px", contain: "layout paint" }}
    >


      <div className={`relative mx-auto max-w-[1280px] ${compactProfile ? "space-y-6" : "space-y-8"}`}>
        {/* IDENTIDADE: uma capa nítida, o avatar subindo sobre ela, o nome e a patente logo ao lado;
            bio e links à esquerda, a progressão de patente à direita. Sem desfoque sobre o banner. */}
        <section aria-label="Identidade do jogador" className="overflow-hidden rounded-[var(--corner-lg)] bg-[var(--tone-1)]">
          <div className={`relative overflow-hidden bg-[var(--tone-2)] ${compactProfile ? "h-[190px]" : "h-[260px]"}`}>
            {userProfile?.bannerURL && (
              <FramedImage src={userProfile.bannerURL} className="absolute inset-0 h-full w-full select-none object-cover" draggable={false} />
            )}
            {/* só um véu de leitura nas bordas: escurece o suficiente para os botões, sem esconder a arte */}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0"
              style={{
                background:
                  "linear-gradient(to bottom, color-mix(in srgb, var(--tone-0) 45%, transparent) 0%, transparent 38%), linear-gradient(to top, color-mix(in srgb, var(--tone-1) 85%, transparent) 0%, transparent 42%)",
              }}
            />
            <div className="absolute right-5 top-5 flex flex-wrap items-center justify-end gap-2.5 sm:right-8 sm:top-6">
              {editable && Boolean(import.meta.env.DEV) && typeof window !== "undefined" && window.localStorage?.getItem("checkpoint_dev_tools") === "true" && (
                    <div className="relative flex items-center">
                      <button
                        type="button"
                        onClick={() => handleSimulateLevelUp()}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-black text-amber-300 transition hover:bg-amber-400/20 hover:border-amber-400/50 hover:text-amber-200 cursor-pointer shadow-[0_0_15px_rgba(251,191,36,0.15)] active:scale-95"
                        title="Simular subida de nível e emitir modal com som espacial"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-[rgb(var(--tier-gold))]" />
                        <span>Simular Level UP</span>
                      </button>

                      {/* Dropdown de saltos de tier para testar a substituição visual */}
                      <div ref={tierMenuRef} className="relative ml-1">
                        <button
                          type="button"
                          onClick={() => setIsTierMenuOpen((v) => !v)}
                          className="h-8 w-8 rounded-xl border border-[color:var(--border-subtle)] bg-[var(--tone-3)] flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--tone-4)] transition cursor-pointer"
                          title="Saltar para outro Tier"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>

                        {isTierMenuOpen && (
                          <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-[color:var(--border-subtle)] bg-[var(--tone-2)] backdrop-blur-xl shadow-2xl p-1 z-50 space-y-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                handleSimulateLevelUp("bronze");
                                setIsTierMenuOpen(false);
                              }}
                              className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-[rgb(var(--tier-bronze))] hover:bg-[var(--tone-4)] transition flex items-center gap-2 cursor-pointer"
                            >
                              <span className="h-2 w-2 rounded-full bg-[rgb(var(--tier-bronze))]" />
                              <span>Tier Bronze (Lv. 10)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleSimulateLevelUp("silver");
                                setIsTierMenuOpen(false);
                              }}
                              className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-[rgb(var(--tier-silver))] hover:bg-[var(--tone-4)] transition flex items-center gap-2 cursor-pointer"
                            >
                              <span className="h-2 w-2 rounded-full bg-[rgb(var(--tier-silver))]" />
                              <span>Tier Prata (Lv. 25)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleSimulateLevelUp("gold");
                                setIsTierMenuOpen(false);
                              }}
                              className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-[rgb(var(--tier-gold))] hover:bg-[var(--tone-4)] transition flex items-center gap-2 cursor-pointer"
                            >
                              <span className="h-2 w-2 rounded-full bg-[rgb(var(--tier-gold))]" />
                              <span>Tier Ouro (Lv. 50)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleSimulateLevelUp("platinum");
                                setIsTierMenuOpen(false);
                              }}
                              className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-[rgb(var(--tier-platinum))] hover:bg-[var(--tone-4)] transition flex items-center gap-2 cursor-pointer"
                            >
                              <span className="h-2 w-2 rounded-full bg-[rgb(var(--tier-platinum))]" />
                              <span>Tier Platina (Lv. 100)</span>
                            </button>
                            {simulatedLevelDelta !== 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSimulatedLevelDelta(0);
                                  setIsTierMenuOpen(false);
                                }}
                                className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-[var(--ink-muted)] hover:bg-[var(--tone-3)] hover:text-[var(--ink)] border-t border-[color:var(--border-subtle)] transition cursor-pointer"
                              >
                                Resetar nível original
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

              {editable && !userProfile?.bannerURL && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    playSound?.("showModal");
                  }}
                  className="inline-flex h-12 cursor-pointer items-center gap-2.5 rounded-[var(--corner-sm)] bg-[var(--tone-3)] px-6 text-[length:var(--step-0)] font-semibold text-[var(--ink)] transition hover:bg-[var(--tone-4)] active:scale-95"
                >
                  <Camera className="h-4 w-4" />
                  Adicionar banner
                </button>
              )}
              {editable && (
                <button
                  type="button"
                  onClick={() => {
                    setIsEditing(true);
                    playSound?.("showModal");
                  }}
                  className="inline-flex h-12 cursor-pointer items-center gap-2.5 rounded-[var(--corner-sm)] bg-[var(--ink)] px-6 text-[length:var(--step-0)] font-semibold text-[var(--tone-0)] transition hover:opacity-90 active:scale-95"
                >
                  <Pencil className="h-4 w-4" />
                  <span>{copy.edit}</span>
                </button>
              )}
            </div>
          </div>

          <div className="px-6 pb-8 sm:px-10">
            {/* nome em primeiro lugar; a leitura da biblioteca fica na mesma linha, à direita */}
            <div className="-mt-[68px] flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-10">
              <div className="relative z-10 flex min-w-0 flex-col gap-5 sm:flex-row sm:items-end sm:gap-7">
                <ProfileAvatar
                  profile={userProfile}
                  authPhotoURL={user?.photoURL}
                  displayName={displayName}
                  compact={compactProfile}
                  editable={editable}
                  onEditClick={() => {
                    setIsEditing(true);
                    playSound?.("showModal");
                  }}
                />
                <div className="min-w-0 pb-1">
                  <h1 className="truncate font-display text-[length:var(--step-5)] font-bold leading-none tracking-tight text-[var(--ink)]">{displayName}</h1>
                </div>
              </div>

              {isPrivateProfile ? (
                <div className="flex items-center gap-2.5 self-start rounded-[var(--corner-sm)] bg-[var(--tone-3)] px-5 py-3 text-[var(--ink-muted)] lg:self-end">
                  <Lock className="h-4 w-4" />
                  <span className="text-[length:var(--step-0)] font-semibold">Perfil privado</span>
                </div>
              ) : (
                <dl className="flex flex-wrap items-baseline gap-x-9 gap-y-2 pb-1">
                  {[
                    [stats.totalGames, copy.games],
                    [`${formatPlayedHours(stats.totalHours)}h`, copy.hours],
                    [stats.favorites, copy.favorites],
                  ].map(([value, label]) => (
                    <div key={String(label)} className="flex items-baseline gap-2.5">
                      <dd className="font-metric text-[length:var(--step-3)] font-semibold leading-none text-[var(--ink)]">{value}</dd>
                      <dt className="text-[length:var(--step-0)] text-[var(--ink-muted)]">{label}</dt>
                    </div>
                  ))}
                </dl>
              )}
            </div>

            <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12">
              {/* quem é: bio, contas e gêneros */}
              <div className="min-w-0 space-y-5">
                {userProfile?.bio && <p className="max-w-xl text-[length:var(--step-1)] leading-relaxed text-[var(--ink)]">{userProfile.bio}</p>}

                {(hasSteamProfile || hasDiscordProfile || (userProfile?.website && /^https:\/\//i.test(userProfile.website))) && (
                  <div className="flex flex-wrap items-center gap-3">
                    {hasSteamProfile && (
                      <button
                        type="button"
                        onClick={() => void openExternalProfile(`https://steamcommunity.com/profiles/${steamId}`)}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--corner-sm)] bg-[var(--tone-3)] px-4 py-2.5 text-[length:var(--step-0)] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--tone-4)]"
                      >
                        <FontAwesomeIcon icon={faSteam} className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
                        <span>{userProfile?.steamUsername || "Steam"}</span>
                      </button>
                    )}
                    {hasDiscordProfile && (
                      <button
                        type="button"
                        onClick={() => {
                          if (!copyFriendDiscord) {
                            void openExternalProfile(`https://discord.com/users/${discordId}`);
                            return;
                          }
                          void copyToClipboard(discordDisplayName)
                            .then(() => {
                              onNotify?.(userProfile?.discordUsername ? copy.copiedNickname : copy.copiedId, "success");
                            })
                            .catch(() => onNotify?.(copy.copyError, "error"));
                        }}
                        className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--corner-sm)] bg-[var(--tone-3)] px-4 py-2.5 text-[length:var(--step-0)] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--tone-4)]"
                      >
                        <FontAwesomeIcon icon={faDiscord} className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
                        <span>{discordDisplayName}</span>
                      </button>
                    )}
                    {userProfile?.website && /^https:\/\//i.test(userProfile.website) && (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-2 rounded-[var(--corner-sm)] bg-[var(--tone-3)] px-4 py-2.5 text-[length:var(--step-0)] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--tone-4)]"
                        onClick={() => window.electronAPI?.openExternalUrl(userProfile.website as string)}
                      >
                        <ExternalLink className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
                        <span>Site</span>
                      </button>
                    )}
                  </div>
                )}

                {Boolean(userProfile?.favoriteGenres?.length) && (
                  <div className="flex flex-wrap gap-2">
                    {userProfile?.favoriteGenres?.map((genre) => (
                      <span key={genre} className="rounded-[var(--corner-sm)] bg-[var(--tone-2)] px-3.5 py-2 text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)]">
                        {genre}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* a patente e o caminho até a próxima: o clique toca o som da patente */}
              <button
                type="button"
                onClick={handleTierBadgeClick}
                onMouseEnter={() => playSound?.("hover")}
                title={`${effectiveTierInfo.name} - Nível ${effectiveLevel} (Clique para ouvir o som)`}
                className="flex min-w-0 cursor-pointer items-center gap-6 self-start rounded-[var(--corner-md)] bg-[var(--tone-2)] p-6 text-left transition-colors hover:bg-[var(--tone-3)] active:scale-[0.99]"
              >
                <RankBadge level={{ level: effectiveLevel, tier: effectiveTier, rank: effectiveTierInfo.name }} size={72} />
                <span className="min-w-0 flex-1 space-y-2.5">
                  <span className="block h-2.5 w-full overflow-hidden rounded-[var(--corner-sm)] bg-[var(--tone-4)]">
                    <motion.span
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, Math.max(0, playerLevel.progress))}%` }}
                      transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                      className="block h-full rounded-[var(--corner-sm)]"
                      style={{ backgroundColor: playerLevel.tierInfo.hexColor }}
                    />
                  </span>
                  <span className="flex items-baseline justify-between gap-3 text-[length:var(--step-0)] text-[var(--ink-muted)]">
                    <span>
                      <span className="font-metric text-[var(--ink)]">{playerLevel.progress}%</span> para {nextTierInfo?.name || "Nível Máximo"}
                    </span>
                    {playerLevel.currentLevelXp > 0 && playerLevel.xpForNextLevel > 0 && (
                      <span className="font-metric">
                        {playerLevel.currentLevelXp}/{playerLevel.xpForNextLevel} XP
                      </span>
                    )}
                  </span>
                </span>
              </button>
            </div>
          </div>
        </section>

        {isPrivateProfile ? (
          <section className="bg-[var(--tone-1)] flex flex-col items-center justify-center rounded-[var(--corner-lg)] p-16 text-center">
            <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[var(--corner-md)] bg-[var(--tone-3)] text-[var(--ink-muted)]">
              <Lock className="h-8 w-8 text-[var(--ink)]" />
            </div>
            <h2 className="text-xl font-bold text-[var(--ink)]">Perfil privado</h2>
            <p className="mt-2 max-w-md text-sm text-[var(--ink-muted)] leading-relaxed">
              Este jogador optou por manter suas estatísticas, biblioteca de jogos e troféus privados.
            </p>
          </section>
        ) : (
          <>
            {editable && shouldShowQuests && (
              <div className="w-full mb-6">
                <div className="flex items-center justify-end mb-2">
                  <button
                    onClick={toggleQuestsVisibility}
                    className="text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {isQuestsVisible ? "Ocultar missões" : "Mostrar missões"}
                  </button>
                </div>
                {isQuestsVisible && (
                  <HomeOnboardingQuests
                    userId={userId || userProfile?.uid}
                    userProfile={userProfile}
                    userLevel={playerLevel.level}
                    hasFriends={(userProfile?.checkpointFriends?.length || 0) > 0}
                    totalGames={games.length}
                    favoritesCount={stats.favorites}
                    hasAchievements={games.some((g) => (g.completedAchievements || 0) > 0)}
                    hasSteamConnected={Boolean(userProfile?.steamId)}
                    hasEpicConnected={localStorage.getItem("checkpoint_epic_linked_uid") === (userId || userProfile?.uid)}
                    hasDiscordConnected={Boolean(userProfile?.discordId)}
                    onOpenAddFriend={() => { }}
                    onOpenAddGame={() => { }}
                    onOpenSettings={() => { }}
                    onOpenProfile={() => { }}
                    onOpenTrophies={() => { }}
                    playSound={playSound}
                  />
                )}
              </div>
            )}
            <div className={`grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] ${compactProfile ? "gap-6" : "gap-8"}`}>
              <section aria-label="Atividade do jogador" className="space-y-8">
                {/* FAVORITOS: Editorial sem container pesado de card */}
                <div className="space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-[rgb(var(--tier-gold))] fill-[rgb(var(--tier-gold)/0.2)]" />
                      <h3 className="font-display text-[length:var(--step-2)] font-semibold text-[var(--ink)]">{copy.favorites}</h3>
                    </div>
                    {favoriteGames.length > 0 && (
                      <span className="text-[length:var(--step-0)] font-medium text-[var(--ink-muted)]">
                        {stats.favorites > favoriteGames.length
                          ? `${favoriteGames.length} de ${stats.favorites} favoritos`
                          : `${favoriteGames.length} ${favoriteGames.length === 1 ? "favorito" : "favoritos"}`}
                      </span>
                    )}
                  </div>

                  {favoriteGames.length > 0 ? (
                    <div className="flex gap-5 overflow-x-auto pb-2 pt-1 no-scrollbar">
                      {favoriteGames.map((game) => {
                        const Component = canOpenGames ? "button" : "div";
                        const itemProps = canOpenGames
                          ? {
                              onClick: () => onOpenGame?.(game),
                              className: "group w-[140px] sm:w-[168px] shrink-0 text-left transition-transform duration-200 hover:-translate-y-1 cursor-pointer",
                            }
                          : {
                              className: "w-[140px] sm:w-[168px] shrink-0 text-left cursor-default select-none",
                            };

                        return (
                          <Component
                            key={game.id}
                            {...(canOpenGames ? { type: "button" } : {})}
                            {...itemProps}
                          >
                            <div className={cn(
                              "relative aspect-[3/4] w-full overflow-hidden rounded-[var(--corner-md)] bg-[var(--tone-2)] transition-all",
                              canOpenGames && "group-hover:opacity-90"
                            )}>
                              {(game.cardImage || game.image) && (
                                <img
                                  src={game.cardImage || game.image}
                                  alt={game.title}
                                  className={cn(
                                    "h-full w-full object-cover transition-transform duration-300",
                                    canOpenGames && "group-hover:scale-105"
                                  )}
                                />
                              )}
                            </div>
                            <p className={cn(
                              "mt-3 line-clamp-2 text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] leading-snug transition-colors",
                              canOpenGames && "group-hover:text-[var(--ink)]"
                            )}>
                              {game.title}
                            </p>
                          </Component>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="py-4 text-[length:var(--step-0)] text-[var(--ink-faint)]">{copy.noFavorites}</p>
                  )}

                </div>

                <Section
                  compact={compactProfile}
                  title={copy.games}
                  icon={activeGameTab === "mostPlayed" ? <TrendingUp className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
                  className={compactProfile ? "min-h-[260px]" : "min-h-[346px]"}
                >
                  {/* Abas com o bloco de tinta que desliza, e a busca da lista completa */}
                  <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
                    <HorizontalTabs
                      activeId={activeGameTab}
                      onChange={(id) => {
                        setActiveGameTab(id as "mostPlayed" | "allGames");
                        playSound?.("select");
                      }}
                      className="t-tabs--squircle"
                      tabClassName="flex h-12 items-center gap-2 whitespace-nowrap"
                      tabs={[
                        { id: "mostPlayed", label: copy.mostPlayed },
                        {
                          id: "allGames",
                          label: (
                            <span className="flex items-center gap-2">
                              {copy.allGames}
                              <span className="font-metric text-[length:var(--step-0)] opacity-70">{normalizedGames.length}</span>
                            </span>
                          ),
                        },
                      ]}
                    />

                    {activeGameTab === "allGames" && (
                      <div className="relative w-56 sm:w-64">
                        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-faint)]" />
                        <input aria-label={copy.searchGames}
                          type="text"
                          placeholder={copy.searchGames}
                          value={gameSearch}
                          onChange={(e) => setGameSearch(e.target.value)}
                          className="h-12 w-full rounded-[var(--corner-sm)] bg-[var(--tone-2)] pl-11 pr-4 text-[length:var(--step-0)] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-faint)] focus:bg-[var(--tone-3)]"
                        />
                      </div>
                    )}
                  </div>

                  <SectionTransition id={activeGameTab}>
                  {activeGameTab === "mostPlayed" ? (
                    topGames.length > 0 ? (
                      <div className="space-y-3">
                        {topGames.map((game, index) => {
                          const playedHours = getGamePlayedHours(game);
                          const pct = Math.max(4, Math.min(100, (playedHours / maxHours) * 100));
                          const itemProps = canOpenGames
                            ? {
                                onClick: () => onOpenGame?.(game),
                                className: "group grid w-full grid-cols-[28px_64px_1fr_auto] items-center gap-5 rounded-[var(--corner-md)] bg-[var(--tone-2)] p-3.5 text-left transition-colors hover:bg-[var(--tone-3)] cursor-pointer",
                              }
                            : {
                                className: "grid w-full grid-cols-[28px_64px_1fr_auto] items-center gap-5 rounded-[var(--corner-md)] bg-[var(--tone-2)] p-3.5 text-left cursor-default select-none",
                              };

                          const Component = canOpenGames ? "button" : "div";

                          return (
                            <Component
                              key={game.id}
                              {...(canOpenGames ? { type: "button" } : {})}
                              {...itemProps}
                            >
                              <span className="text-right text-[length:var(--step-1)] font-semibold tabular-nums text-[var(--ink-faint)]">{index + 1}</span>
                              <div className="h-[88px] w-[64px] overflow-hidden rounded-[var(--corner-sm)] bg-[var(--tone-3)] shrink-0">
                                {(game.cardImage || game.image) && (
                                  <img
                                    src={game.cardImage || game.image}
                                    alt=""
                                    className={cn(
                                      "h-full w-full object-cover transition-transform",
                                      canOpenGames && "group-hover:scale-105"
                                    )}
                                  />
                                )}
                              </div>
                              <div className="min-w-0 pr-2">
                                <p className="truncate text-[length:var(--step-1)] font-semibold text-[var(--ink)]">{game.title}</p>
                                {/* Barra sutil de distribuição relativa de tempo jogado */}
                                <div className="mt-2.5 flex items-center gap-2">
                                  <div className="h-2 w-full max-w-sm overflow-hidden rounded-[var(--corner-sm)] bg-[var(--tone-4)]">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${pct}%` }}
                                      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: index * 0.05 }}
                                      className="h-full rounded-[var(--corner-sm)] bg-[var(--ink-muted)]"
                                    />
                                  </div>
                                </div>
                              </div>
                              <span className="flex items-center gap-1.5 text-[length:var(--step-1)] font-semibold tabular-nums text-[var(--ink)]">
                                <Clock className="h-3.5 w-3.5 text-[var(--ink-faint)]" />
                                {formatPlayedHours(playedHours)}h
                              </span>
                            </Component>
                          );
                        })}
                      </div>
                    ) : (
                      <EmptyProfileState compact={compactProfile} title={copy.emptyTitle} body={copy.emptyBody} />
                    )
                  ) : (
                    /* Todos os Jogos Tab */
                    filteredAllGames.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-h-[520px] overflow-y-auto pr-1 thin-scrollbar">
                        {filteredAllGames.map((game) => {
                          const playedHours = getGamePlayedHours(game);
                          const launcherBadge = game.launcherType === "steam"
                            ? "Steam"
                            : game.launcherType === "epic"
                              ? "Epic Games"
                              : "Local";

                          const Component = canOpenGames ? "button" : "div";
                          const itemProps = canOpenGames
                            ? {
                                onClick: () => onOpenGame?.(game),
                                className: "flex items-center gap-4 p-4 rounded-[var(--corner-md)] bg-[var(--tone-2)] hover:bg-[var(--tone-3)] transition-colors text-left cursor-pointer group",
                              }
                            : {
                                className: "flex items-center gap-4 p-4 rounded-[var(--corner-md)] bg-[var(--tone-2)] text-left cursor-default select-none",
                              };

                          return (
                            <Component
                              key={game.id}
                              {...(canOpenGames ? { type: "button" } : {})}
                              {...itemProps}
                            >
                              <div className="h-[88px] w-[64px] rounded-[var(--corner-sm)] overflow-hidden bg-[var(--tone-3)] shrink-0 relative">
                                {(game.cardImage || game.image) ? (
                                  <img
                                    src={game.cardImage || game.image}
                                    alt=""
                                    className={cn(
                                      "h-full w-full object-cover transition-transform",
                                      canOpenGames && "group-hover:scale-105"
                                    )}
                                  />
                                ) : (
                                  <div className="flex h-full w-full items-center justify-center text-[var(--ink-faint)]">
                                    <Gamepad2 className="h-5 w-5" />
                                  </div>
                                )}
                                {game.isFavorite && (
                                  <div className="absolute top-1 right-1 h-3.5 w-3.5 rounded-full bg-black/60 flex items-center justify-center">
                                    <Star className="h-2.5 w-2.5 text-[rgb(var(--tier-gold))] fill-[rgb(var(--tier-gold))]" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[length:var(--step-1)] font-semibold text-[var(--ink)]">{game.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[length:var(--step-0)] text-[var(--ink-muted)] flex items-center gap-1">
                                    <Clock className="h-2.5 w-2.5" />
                                    {formatPlayedHours(playedHours)}h
                                  </span>
                                  <span className="text-[length:var(--step-0)] font-semibold px-2.5 py-1 rounded-[10px] bg-[var(--tone-3)] text-[var(--ink-muted)]">
                                    {launcherBadge}
                                  </span>
                                </div>
                                {(game.totalAchievements || 0) > 0 && (
                                  <div className="flex items-center gap-1 mt-1 text-[length:var(--step-0)] text-[var(--ink-faint)]">
                                    <Trophy className="h-2.5 w-2.5 text-[rgb(var(--tier-gold)/0.8)]" />
                                    <span>{game.completedAchievements || 0} / {game.totalAchievements}</span>
                                  </div>
                                )}
                              </div>
                            </Component>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-xs font-bold text-[var(--ink-faint)]">
                        {copy.noGamesFound}
                      </div>
                    )
                  )}
                  </SectionTransition>
                </Section>

              </section>

              <aside aria-label="Resumo do perfil" className="space-y-6">
                <Section compact={compactProfile} title={copy.platforms}>
                  <div className="space-y-2">
                    <PlatformRow
                      name="Steam"
                      connected={Boolean(userProfile?.steamId)}
                      avatar={userProfile?.steamAvatar}
                      username={userProfile?.steamUsername || userProfile?.steamId}
                      icon={<FontAwesomeIcon icon={faSteam} className="h-4 w-4" />}
                      connectedLabel={copy.connected}
                      disconnectedLabel={copy.disconnected}
                      compact={compactProfile}
                    />
                    <PlatformRow
                      name="Epic Games"
                      connected={stats.epicGames > 0}
                      username={stats.epicGames > 0 ? `${stats.epicGames} ${copy.catalogued}` : copy.catalog}
                      icon={<EpicIcon className="h-4 w-4" />}
                      connectedLabel={copy.connected}
                      disconnectedLabel={copy.disconnected}
                      compact={compactProfile}
                    />
                    <PlatformRow
                      name="Discord"
                      connected={Boolean(userProfile?.discordId)}
                      avatar={userProfile?.discordAvatar}
                      username={userProfile?.discordUsername}
                      icon={<FontAwesomeIcon icon={faDiscord} className="h-4 w-4" />}
                      connectedLabel={copy.connected}
                      disconnectedLabel={copy.disconnected}
                      compact={compactProfile}
                    />
                  </div>
                </Section>

                <Section compact={compactProfile} title={copy.achievements}>
                  <div className="mb-3 flex items-end justify-between">
                    <div>
                      <span className="font-metric text-[44px] font-semibold leading-none text-[var(--ink)]">{stats.totalAchievements}</span>
                      <span className="ml-1.5 text-[length:var(--step-1)] text-[var(--ink-faint)]">/ {stats.totalPossible}</span>
                    </div>
                    <span className="text-[length:var(--step-2)] font-semibold text-[var(--ink-muted)] tabular-nums">{achievementPercent}%</span>
                  </div>
                  <div className="h-2.5 overflow-hidden rounded-[var(--corner-sm)] bg-[var(--tone-3)]">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${achievementPercent}%` }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-[var(--corner-sm)] bg-[var(--ink)]" />
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-[length:var(--step-0)] text-[var(--ink-faint)]">
                    <Trophy className="h-3 w-3" /> {stats.totalAchievements} {copy.unlocked}
                  </p>
                </Section>

                {/* BIBLIOTECA EDITORIAL */}
                <Section compact={compactProfile} title={copy.library}>
                  <div className="space-y-4">
                    {/* Header de Distribuição */}
                    <div className="flex items-baseline justify-between">
                      <span className="text-[length:var(--step-0)] text-[var(--ink-muted)]">Distribuição</span>
                      <span className="text-[length:var(--step-1)] font-semibold tabular-nums text-[var(--ink)]">{stats.totalGames} {stats.totalGames === 1 ? "jogo" : "jogos"}</span>
                    </div>

                    {/* Stacked bar única de distribuição */}
                    {stats.totalGames > 0 && (
                      <div className="h-2.5 w-full flex rounded-[var(--corner-sm)] overflow-hidden bg-[var(--tone-3)] p-0.5 gap-0.5">
                        {stats.steamGames > 0 && (
                          <div
                            style={{ width: `${(stats.steamGames / stats.totalGames) * 100}%` }}
                            className="h-full bg-[var(--ink)] rounded-[var(--corner-sm)] transition-all"
                            title={`Steam: ${stats.steamGames}`}
                          />
                        )}
                        {stats.epicGames > 0 && (
                          <div
                            style={{ width: `${(stats.epicGames / stats.totalGames) * 100}%` }}
                            className="h-full bg-[var(--ink-muted)] rounded-[var(--corner-sm)] transition-all"
                            title={`Epic Games: ${stats.epicGames}`}
                          />
                        )}
                        {stats.localGames > 0 && (
                          <div
                            style={{ width: `${(stats.localGames / stats.totalGames) * 100}%` }}
                            className="h-full bg-[var(--ink-faint)] rounded-[var(--corner-sm)] transition-all"
                            title={`Local: ${stats.localGames}`}
                          />
                        )}
                      </div>
                    )}

                    {/* Linhas Editoriais com traço fino */}
                    <div className="space-y-4 pt-1">
                      {libraryRows.map((row) => {
                        const pct = stats.totalGames > 0 ? (row.value / stats.totalGames) * 100 : 0;
                        return (
                          <div key={row.label} className="group">
                            <div className="flex items-center justify-between text-[length:var(--step-1)] font-medium mb-1.5">
                              <span className="text-[var(--ink-muted)] group-hover:text-[var(--ink)] transition-colors">{row.label}</span>
                              <span className="font-mono text-[var(--ink-muted)] group-hover:text-[var(--ink)] tabular-nums transition-colors">{row.value}</span>
                            </div>
                            <div className="h-1.5 w-full bg-[var(--tone-3)] rounded-[var(--corner-sm)] overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                className={`h-full rounded-[var(--corner-sm)] ${row.label === "Steam"
                                  ? "bg-[var(--ink)]"
                                  : row.label === "Epic Games"
                                    ? "bg-[var(--ink-muted)]"
                                    : "bg-[var(--ink-muted)]"
                                  }`}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </Section>
              </aside>
            </div>
          </>
        )}
      </div>
      <ProfileEditorModal
        isOpen={isEditing}
        profile={userProfile}
        fallbackName={displayName}
        fallbackPhotoURL={user?.photoURL}
        onClose={() => {
          setIsEditing(false);
          playSound?.("back");
        }}
        onSaved={onProfileUpdated}
      />
    </motion.div>
  );
};

const EmptyProfileState: React.FC<{ title: string; body: string; compact?: boolean }> = ({ title, body, compact = false }) => (
  <div className={`flex flex-col items-center justify-center text-center ${compact ? "h-40" : "h-56"}`}>
    <User className="mb-4 h-9 w-9 text-[var(--ink-faint)]" />
    <p className="text-sm font-semibold text-[var(--ink-faint)]">{title}</p>
    <p className="mt-1 text-xs text-[var(--ink-faint)]">{body}</p>
  </div>
);

export default UserProfilePage;

