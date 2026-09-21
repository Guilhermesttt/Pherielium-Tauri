import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, ExternalLink, Gamepad2, Layers, Lock, Pencil, Search, Star, Trophy, TrendingUp, User, Sparkles, ChevronDown, Camera } from "lucide-react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faDiscord, faSteam } from "@fortawesome/free-brands-svg-icons";
import tierLevelClickSound from "../sounds/Phelierium Default/ui_tierLevel_click.mp3";
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
import PherieliumTierBronze from "../assets/Pherielium_Tier_Bronze.png";
import PherieliumTierSilver from "../assets/Pherielium_Tier_Prata.png";
import PherieliumTierGold from "../assets/Pherielium_Tier_Ouro.png";
import PherieliumTierPlatinum from "../assets/Pherielium_Tier_Platina.png";
import { HomeOnboardingQuests } from "./home/HomeOnboardingQuests";
import { fetchUserGamesForProfile } from "../services/checkpointFriends";
import { cn } from "../lib/utils";

const USER_TIER_IMAGES: Record<string, string> = {
  bronze: PherieliumTierBronze,
  silver: PherieliumTierSilver,
  gold: PherieliumTierGold,
  platinum: PherieliumTierPlatinum,
};

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
      className={`group relative shrink-0 aspect-square overflow-hidden rounded-2xl border border-white/15 bg-neutral-900 shadow-[0_16px_40px_rgba(0,0,0,.5)] ${compact ? "h-[76px] w-[76px]" : "h-[92px] w-[92px]"
        } ${editable ? "cursor-pointer" : ""}`}
      title={editable ? "Clique para editar perfil e foto" : undefined}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover object-center aspect-square select-none transition-transform duration-300 group-hover:scale-105" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-xl font-black text-white/70 select-none">
          {initialsFor(displayName)}
        </div>
      )}
      {editable && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 text-white z-10">
          <Camera className="h-5 w-5 text-white" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Editar</span>
        </div>
      )}
      <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-2xl pointer-events-none z-20" />
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
    className={`flex items-center bg-[#0E0E0E] justify-between transition-colors hover:bg-white/[0.03] rounded-xl ${compact ? "py-2 px-2.5 gap-2.5" : "py-2.5 px-3 gap-3"
      }`}
  >
    <div className="flex min-w-0 items-center gap-3">
      <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#0E0E0E] text-neutral-300 ${compact ? "h-8 w-8" : "h-9 w-9"}`}>
        {avatar ? <img src={avatar} alt="" className="h-full w-full object-cover rounded-lg" /> : icon}
      </div>
      <div className="min-w-0">
        <p className="truncate text-xs font-bold text-white leading-tight">{name}</p>
        <p className="truncate text-[11px] font-medium text-neutral-400 mt-0.5">
          {connected ? username || connectedLabel : disconnectedLabel}
        </p>
      </div>
    </div>
    <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${connected ? "bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)]" : "bg-white/20"}`} />
  </div>
);

const MetricsCluster: React.FC<{
  games: number;
  hours: string | number;
  favorites: number;
  copy: { games: string; hours: string; favorites: string };
  compact?: boolean;
}> = ({ games, hours, favorites, copy, compact = false }) => (
  <div className={`flex items-center justify-between sm:justify-start gap-5 sm:gap-7 rounded-2xl bg-white/[0.03] border border-white/[0.06] backdrop-blur-md ${compact ? "px-4 py-2.5" : "px-5 py-3"}`}>
    <div className="flex flex-col">
      <span className={`${compact ? "text-base" : "text-lg sm:text-xl"} font-black text-white tabular-nums tracking-tight leading-none`}>
        {games}
      </span>
      <span className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-400 mt-1">
        {copy.games}
      </span>
    </div>
    <div className="h-6 w-px bg-white/10 shrink-0" />
    <div className="flex flex-col">
      <span className={`${compact ? "text-base" : "text-lg sm:text-xl"} font-black text-white tabular-nums tracking-tight leading-none`}>
        {hours}
      </span>
      <span className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-400 mt-1">
        {copy.hours}
      </span>
    </div>
    <div className="h-6 w-px bg-white/10 shrink-0" />
    <div className="flex flex-col">
      <span className={`${compact ? "text-base" : "text-lg sm:text-xl"} font-black text-white tabular-nums tracking-tight leading-none`}>
        {favorites}
      </span>
      <span className="text-[9px] font-extrabold uppercase tracking-widest text-neutral-400 mt-1">
        {copy.favorites}
      </span>
    </div>
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
    className={`${compact ? "rounded-2xl p-4 md:p-5" : "rounded-2xl p-5 md:p-6"} bg-[#0E0E0E] border border-[var(--color-border)] ${className}`}
    style={{
      boxShadow: "0 24px 64px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.06)",
    }}
  >
    <div className={`${compact ? "mb-3" : "mb-4"} flex items-center gap-2.5`}>
      {icon && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-white/[0.05] border border-white/[0.08] text-neutral-300">
          {icon}
        </div>
      )}
      <h2 className="text-xs sm:text-sm font-black text-neutral-300 tracking-wider uppercase font-mono">{title}</h2>
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

  useEffect(() => {
    const handler = () => setQuestsRevision((r) => r + 1);
    const unsub = progressionEventBus.onXpGained(handler);
    window.addEventListener("checkpoint:xp-gained", handler);
    return () => {
      unsub();
      window.removeEventListener("checkpoint:xp-gained", handler);
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
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      data-profile-density={compactProfile ? "compact" : "comfortable"}
      className={`relative min-h-0 flex-1 overflow-y-auto thin-scrollbar ${compactProfile ? "px-6 pb-6 pt-4" : "px-10 pb-12 pt-8"}`}
      style={{ contain: "layout paint", transform: "translate3d(0,0,0)", willChange: "transform" }}
    >


      <div className={`relative mx-auto max-w-6xl ${compactProfile ? "space-y-4" : "space-y-6"}`}>
        {/* HERO SECTION EDITORIAL MINIMALISTA */}
        <section
          className={`relative rounded-3xl border border-white/[0.08] bg-[#0B0B0B] ${compactProfile ? "p-5 md:p-6" : "p-6 sm:p-8"}`}
          style={{
            boxShadow: "0 24px 64px rgba(0,0,0,0.6), inset 0 1px 1px rgba(255,255,255,0.06)",
          }}
        >
          {/* Luz ambiente sutil na cor da patente do jogador isolada para não cortar elementos flutuantes */}
          <div className="absolute inset-0 rounded-3xl overflow-hidden pointer-events-none">
            <div
              className="absolute -top-32 -left-32 w-80 h-80 rounded-full blur-[110px] opacity-15 pointer-events-none transition-all duration-700"
              style={{ background: playerLevel.tierInfo.gradientFrom }}
            />
          </div>

          <div className="relative z-10 flex flex-col gap-6">
            {/* Linha Principal: Identidade à Esquerda | KPIs + Ações à Direita */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">

              {/* BLOCO DE IDENTIDADE: Avatar + Informações unificadas */}
              <div className="flex items-start sm:items-center gap-5 sm:gap-6 min-w-0 flex-1">
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

                <div className="min-w-0 flex-1">
                  {/* Nível 1: Nome do Jogador */}
                  <div className="flex items-center gap-3">
                    <h1 className={`${compactProfile ? "text-2xl" : "text-3xl sm:text-4xl"} font-black tracking-tight bg-gradient-to-b from-[#FFFFFF] to-[#8A8A8A] bg-clip-text text-transparent leading-none truncate`}>
                      {displayName}
                    </h1>
                  </div>

                  {/* Nível 2: Patente Proprietária 3D com Animação de Substituição de Tier */}
                  <div className="mt-2.5 flex items-center gap-2.5 flex-wrap">
                    <motion.div
                      whileHover={{ scale: 1.15, y: -2 }}
                      whileTap={{ scale: 0.88 }}
                      transition={{ type: "spring", stiffness: 400, damping: 18 }}
                      className="relative flex items-center justify-center shrink-0 cursor-pointer h-8 w-8"
                      onClick={handleTierBadgeClick}
                      onMouseEnter={() => playSound?.("hover")}
                      title={`${effectiveTierInfo.name} - Nível ${effectiveLevel} (Clique para ouvir o som)`}
                    >
                      <AnimatePresence mode="wait">
                        <motion.img
                          key={effectiveTier}
                          src={USER_TIER_IMAGES[effectiveTier] || PherieliumTierBronze}
                          alt={effectiveTierInfo.name}
                          width={32}
                          height={32}
                          initial={{
                            scale: 1.8,
                            opacity: 0,
                            filter: "brightness(1.8) drop-shadow(0 0 16px rgba(255,255,255,0.9))",
                          }}
                          animate={{
                            scale: [1.8, 1.15, 1],
                            opacity: 1,
                            filter: "brightness(1) drop-shadow(0 4px 8px rgba(0,0,0,0.5))",
                          }}
                          exit={{
                            scale: 0.1,
                            opacity: 0,
                            filter: "brightness(0.5) blur(3px)",
                          }}
                          transition={{
                            duration: 0.5,
                            ease: [0.16, 1, 0.3, 1],
                          }}
                          className="h-7 w-7 object-contain shrink-0 select-none pointer-events-none drop-shadow"
                        />
                      </AnimatePresence>
                    </motion.div>

                    <span
                      className="text-sm font-black tracking-wide transition-colors duration-500"
                      style={{ color: effectiveTierInfo.hexColor }}
                    >
                      {effectiveTierInfo.name}
                    </span>

                    <span className="text-white/20 font-bold">•</span>

                    <motion.span
                      key={effectiveLevel}
                      initial={{ y: -4, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      className="text-xs font-extrabold text-neutral-300 font-mono"
                    >
                      Lv. {effectiveLevel}
                    </motion.span>
                  </div>

                  {/* Barra de Progressão da Patente (Clean & Minimal) */}
                  <div className="mt-2.5 space-y-1 max-w-sm">
                    <div className="h-1.5 w-full sm:w-72 rounded-full bg-white/[0.06] overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, Math.max(0, playerLevel.progress))}%` }}
                        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                        className="h-full rounded-full"
                        style={{
                          background: `linear-gradient(90deg, ${playerLevel.tierInfo.gradientFrom}, ${playerLevel.tierInfo.gradientTo})`,
                          boxShadow: `0 0 8px ${playerLevel.tierInfo.gradientFrom}40`,
                        }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-400">
                      <span>{playerLevel.progress}% para {nextTierInfo?.name || "Nível Máximo"}</span>
                      {playerLevel.currentLevelXp > 0 && playerLevel.xpForNextLevel > 0 && (
                        <span className="text-[10px] text-neutral-500 font-mono">
                          {playerLevel.currentLevelXp}/{playerLevel.xpForNextLevel} XP
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Nível 3: Bio */}
                  {userProfile?.bio && (
                    <p className="mt-3 text-xs sm:text-[13px] text-neutral-300 leading-relaxed max-w-xl font-normal">
                      {userProfile.bio}
                    </p>
                  )}

                  {/* Nível 3: Plataformas Conectadas & Links */}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {hasSteamProfile && (
                      <button
                        type="button"
                        onClick={() => void openExternalProfile(`https://steamcommunity.com/profiles/${steamId}`)}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <FontAwesomeIcon icon={faSteam} className="h-3 w-3 text-neutral-400" />
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
                              onNotify?.(
                                userProfile?.discordUsername ? copy.copiedNickname : copy.copiedId,
                                "success",
                              );
                            })
                            .catch(() => onNotify?.(copy.copyError, "error"));
                        }}
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
                      >
                        <FontAwesomeIcon icon={faDiscord} className="h-3 w-3 text-neutral-400" />
                        <span>{discordDisplayName}</span>
                      </button>
                    )}
                    {userProfile?.website && /^https:\/\//i.test(userProfile.website) && (
                      <button
                        type="button"
                        className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-2.5 py-1 text-xs font-semibold text-neutral-300 transition-colors hover:bg-white/10 hover:text-white"
                        onClick={() => window.electronAPI?.openExternalUrl(userProfile.website as string)}
                      >
                        <ExternalLink className="h-3 w-3 text-neutral-400" />
                        <span>Site</span>
                      </button>
                    )}
                  </div>

                  {/* Nível 4: Tags de Gêneros Favoritos */}
                  {Boolean(userProfile?.favoriteGenres?.length) && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {userProfile?.favoriteGenres?.map((genre) => (
                        <span
                          key={genre}
                          className="rounded-md border border-white/[0.06] bg-white/[0.03] px-2 py-0.5 text-[10px] font-bold text-neutral-400 uppercase tracking-wider"
                        >
                          {genre}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* LADO DIREITO: KPIs Unificados + Botão de Edição */}
              <div className="flex flex-col sm:flex-row lg:flex-col items-start sm:items-center lg:items-end justify-between gap-4 shrink-0">
                <div className="flex items-center gap-2.5 flex-wrap">
                  {editable && Boolean(import.meta.env.DEV) && (
                    <div className="relative flex items-center">
                      <button
                        type="button"
                        onClick={() => handleSimulateLevelUp()}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/30 bg-amber-400/10 px-3 py-2 text-xs font-black text-amber-300 transition hover:bg-amber-400/20 hover:border-amber-400/50 hover:text-amber-200 cursor-pointer shadow-[0_0_15px_rgba(251,191,36,0.15)] active:scale-95"
                        title="Simular subida de nível e emitir modal com som espacial"
                      >
                        <Sparkles className="h-3.5 w-3.5 text-amber-400" />
                        <span>Simular Level UP</span>
                      </button>

                      {/* Dropdown de saltos de tier para testar a substituição visual */}
                      <div ref={tierMenuRef} className="relative ml-1">
                        <button
                          type="button"
                          onClick={() => setIsTierMenuOpen((v) => !v)}
                          className="h-8 w-8 rounded-xl border border-white/10 bg-white/[0.04] flex items-center justify-center text-neutral-400 hover:text-white hover:bg-white/10 transition cursor-pointer"
                          title="Saltar para outro Tier"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </button>

                        {isTierMenuOpen && (
                          <div className="absolute right-0 top-full mt-2 w-48 rounded-xl border border-white/15 bg-neutral-900/95 backdrop-blur-xl shadow-2xl p-1 z-50 space-y-0.5">
                            <button
                              type="button"
                              onClick={() => {
                                handleSimulateLevelUp("bronze");
                                setIsTierMenuOpen(false);
                              }}
                              className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-[#cd7f32] hover:bg-white/10 transition flex items-center gap-2 cursor-pointer"
                            >
                              <span className="h-2 w-2 rounded-full bg-[#cd7f32]" />
                              <span>Tier Bronze (Lv. 10)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleSimulateLevelUp("silver");
                                setIsTierMenuOpen(false);
                              }}
                              className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 hover:bg-white/10 transition flex items-center gap-2 cursor-pointer"
                            >
                              <span className="h-2 w-2 rounded-full bg-slate-300" />
                              <span>Tier Prata (Lv. 25)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleSimulateLevelUp("gold");
                                setIsTierMenuOpen(false);
                              }}
                              className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-amber-400 hover:bg-white/10 transition flex items-center gap-2 cursor-pointer"
                            >
                              <span className="h-2 w-2 rounded-full bg-amber-400" />
                              <span>Tier Ouro (Lv. 50)</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                handleSimulateLevelUp("platinum");
                                setIsTierMenuOpen(false);
                              }}
                              className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-[#38bdf8] hover:bg-white/10 transition flex items-center gap-2 cursor-pointer"
                            >
                              <span className="h-2 w-2 rounded-full bg-[#38bdf8]" />
                              <span>Tier Platina (Lv. 100)</span>
                            </button>
                            {simulatedLevelDelta !== 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setSimulatedLevelDelta(0);
                                  setIsTierMenuOpen(false);
                                }}
                                className="w-full text-left px-3 py-1.5 rounded-lg text-xs font-semibold text-neutral-400 hover:bg-white/5 hover:text-white border-t border-white/10 transition cursor-pointer"
                              >
                                Resetar nível original
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {editable && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsEditing(true);
                        playSound?.("showModal");
                      }}
                      className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2 text-xs font-bold text-neutral-300 transition hover:bg-white/10 hover:text-white cursor-pointer"
                    >
                      <Pencil className="h-3.5 w-3.5 text-neutral-400" />
                      <span>{copy.edit}</span>
                    </button>
                  )}
                </div>

                {isPrivateProfile ? (
                  <div className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-neutral-400">
                    <Lock className="h-4 w-4 text-neutral-400" />
                    <span className="text-xs font-bold uppercase tracking-wider">Perfil Privado</span>
                  </div>
                ) : (
                  <MetricsCluster
                    games={stats.totalGames}
                    hours={`${formatPlayedHours(stats.totalHours)}h`}
                    favorites={stats.favorites}
                    copy={copy}
                    compact={compactProfile}
                  />
                )}
              </div>
            </div>
          </div>
        </section>

        {isPrivateProfile ? (
          <section className="bg-[#0B0B0B] flex flex-col items-center justify-center rounded-2xl border border-white/10 p-12 text-center shadow-[0_24px_90px_rgba(0,0,0,0.55)]">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-xl border border-white/15 bg-white/[0.06] text-white/60 shadow-inner">
              <Lock className="h-8 w-8 text-white/80" />
            </div>
            <h2 className="text-xl font-black text-white">Perfil Privado</h2>
            <p className="mt-2 max-w-md text-sm text-white/70 leading-relaxed">
              Este jogador optou por manter suas estatísticas, biblioteca de jogos e troféus privados.
            </p>
          </section>
        ) : (
          <>
            {editable && (
              <div className="w-full mb-6">
                <div className="flex items-center justify-end mb-2">
                  <button
                    onClick={toggleQuestsVisibility}
                    className="text-[10px] uppercase tracking-wider font-bold text-white/50 hover:text-white transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    {isQuestsVisible ? "Ocultar Missões" : "Mostrar Missões"}
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
            <div className={`grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_300px] ${compactProfile ? "gap-4" : "gap-5"}`}>
              <section aria-label="Atividade do jogador" className="space-y-5">
                <Section
                  compact={compactProfile}
                  title={activeGameTab === "mostPlayed" ? copy.mostPlayed : `${copy.allGames} (${normalizedGames.length})`}
                  icon={activeGameTab === "mostPlayed" ? <TrendingUp className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
                  className={compactProfile ? "min-h-[260px]" : "min-h-[346px]"}
                >
                  {/* Tab Selector com Underline Minimalista & Search */}
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-4 border-b border-white/[0.06] pb-1">
                    <div className="flex items-center gap-6">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveGameTab("mostPlayed");
                          playSound?.("select");
                        }}
                        onMouseEnter={() => playSound?.("hover")}
                        className={`relative pb-3 text-xs font-bold transition-colors cursor-pointer ${activeGameTab === "mostPlayed" ? "text-white" : "text-neutral-500 hover:text-neutral-300"
                          }`}
                      >
                        <span>{copy.mostPlayed}</span>
                        {activeGameTab === "mostPlayed" && (
                          <motion.div
                            layoutId="profileGameTabUnderline"
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                            transition={{ type: "spring", stiffness: 500, damping: 35 }}
                          />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveGameTab("allGames");
                          playSound?.("select");
                        }}
                        onMouseEnter={() => playSound?.("hover")}
                        className={`relative pb-3 text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 ${activeGameTab === "allGames" ? "text-white" : "text-neutral-500 hover:text-neutral-300"
                          }`}
                      >
                        <span>{copy.allGames}</span>
                        <span className="text-[10px] font-mono text-neutral-400">({normalizedGames.length})</span>
                        {activeGameTab === "allGames" && (
                          <motion.div
                            layoutId="profileGameTabUnderline"
                            className="absolute bottom-0 left-0 right-0 h-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.7)]"
                            transition={{ type: "spring", stiffness: 500, damping: 35 }}
                          />
                        )}
                      </button>
                    </div>

                    {activeGameTab === "allGames" && (
                      <div className="relative w-48 sm:w-56 pb-2 sm:pb-0">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-500 pointer-events-none" />
                        <input
                          type="text"
                          placeholder={copy.searchGames}
                          value={gameSearch}
                          onChange={(e) => setGameSearch(e.target.value)}
                          className="w-full h-8 pl-8 pr-3 rounded-lg bg-white/[0.04] border border-white/10 text-xs font-medium text-white placeholder-neutral-500 focus:outline-none focus:border-white/30 focus:bg-white/[0.08] transition"
                        />
                      </div>
                    )}
                  </div>

                  {activeGameTab === "mostPlayed" ? (
                    topGames.length > 0 ? (
                      <div className="space-y-2">
                        {topGames.map((game, index) => {
                          const playedHours = getGamePlayedHours(game);
                          const pct = Math.max(4, Math.min(100, (playedHours / maxHours) * 100));
                          const itemProps = canOpenGames
                            ? {
                                onClick: () => onOpenGame?.(game),
                                className: "group grid w-full grid-cols-[20px_42px_1fr_auto] items-center gap-3.5 rounded-xl p-2.5 text-left transition-colors hover:bg-white/[0.04] cursor-pointer",
                              }
                            : {
                                className: "grid w-full grid-cols-[20px_42px_1fr_auto] items-center gap-3.5 rounded-xl p-2.5 text-left cursor-default select-none",
                              };

                          const Component = canOpenGames ? "button" : "div";

                          return (
                            <Component
                              key={game.id}
                              {...(canOpenGames ? { type: "button" } : {})}
                              {...itemProps}
                            >
                              <span className="text-right text-xs font-mono font-bold text-neutral-500">{index + 1}</span>
                              <div className="h-12 w-9 overflow-hidden rounded-lg bg-white/5 border border-white/10 shrink-0">
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
                                <p className="truncate text-xs sm:text-sm font-bold text-white">{game.title}</p>
                                {/* Barra sutil de distribuição relativa de tempo jogado */}
                                <div className="mt-2 flex items-center gap-2">
                                  <div className="h-1 w-full max-w-xs overflow-hidden rounded-full bg-white/[0.05]">
                                    <motion.div
                                      initial={{ width: 0 }}
                                      animate={{ width: `${pct}%` }}
                                      transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1], delay: index * 0.05 }}
                                      className="h-full rounded-full bg-white/30"
                                    />
                                  </div>
                                  <span className="text-[9px] font-mono text-neutral-500 shrink-0">
                                    {Math.round(pct)}% rel.
                                  </span>
                                </div>
                              </div>
                              <span className="flex items-center gap-1.5 text-xs font-mono font-bold text-neutral-300">
                                <Clock className="h-3 w-3 text-neutral-500" />
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
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[420px] overflow-y-auto pr-1 thin-scrollbar">
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
                                className: "flex items-center gap-3 p-2.5 rounded-xl border border-white/5 bg-white/[0.03] hover:bg-white/[0.07] hover:border-white/12 transition text-left cursor-pointer group",
                              }
                            : {
                                className: "flex items-center gap-3 p-2.5 rounded-xl border border-white/5 bg-white/[0.03] text-left cursor-default select-none",
                              };

                          return (
                            <Component
                              key={game.id}
                              {...(canOpenGames ? { type: "button" } : {})}
                              {...itemProps}
                            >
                              <div className="h-14 w-11 rounded-lg overflow-hidden bg-white/8 shrink-0 relative">
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
                                  <div className="flex h-full w-full items-center justify-center text-white/30">
                                    <Gamepad2 className="h-5 w-5" />
                                  </div>
                                )}
                                {game.isFavorite && (
                                  <div className="absolute top-1 right-1 h-3.5 w-3.5 rounded-full bg-black/60 flex items-center justify-center">
                                    <Star className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400" />
                                  </div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-xs font-bold text-white">{game.title}</p>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[10px] font-medium text-white/40 flex items-center gap-1">
                                    <Clock className="h-2.5 w-2.5" />
                                    {formatPlayedHours(playedHours)}h
                                  </span>
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/5 text-white/50 uppercase tracking-wider">
                                    {launcherBadge}
                                  </span>
                                </div>
                                {(game.totalAchievements || 0) > 0 && (
                                  <div className="flex items-center gap-1 mt-1 text-[10px] text-white/40">
                                    <Trophy className="h-2.5 w-2.5 text-yellow-500/80" />
                                    <span>{game.completedAchievements || 0} / {game.totalAchievements}</span>
                                  </div>
                                )}
                              </div>
                            </Component>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="py-12 text-center text-xs font-bold text-white/40">
                        {copy.noGamesFound}
                      </div>
                    )
                  )}
                </Section>

                {/* FAVORITOS: Editorial sem container pesado de card */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400/20" />
                      <h3 className="text-xs font-black text-neutral-300 tracking-wider uppercase font-mono">{copy.favorites}</h3>
                    </div>
                    {favoriteGames.length > 0 && (
                      <span className="text-[10px] font-mono text-neutral-500 font-bold">
                        {favoriteGames.length} {favoriteGames.length === 1 ? "jogo" : "jogos"}
                      </span>
                    )}
                  </div>

                  {favoriteGames.length > 0 ? (
                    <div className="flex gap-4 overflow-x-auto pb-2 pt-1 no-scrollbar">
                      {favoriteGames.map((game) => {
                        const Component = canOpenGames ? "button" : "div";
                        const itemProps = canOpenGames
                          ? {
                              onClick: () => onOpenGame?.(game),
                              className: "group w-[96px] sm:w-[104px] shrink-0 text-left transition-transform duration-200 hover:-translate-y-1 focus:outline-none cursor-pointer",
                            }
                          : {
                              className: "w-[96px] sm:w-[104px] shrink-0 text-left cursor-default select-none",
                            };

                        return (
                          <Component
                            key={game.id}
                            {...(canOpenGames ? { type: "button" } : {})}
                            {...itemProps}
                          >
                            <div className={cn(
                              "relative aspect-[3/4] w-full overflow-hidden rounded-xl bg-neutral-900 border border-white/10 shadow-lg transition-all",
                              canOpenGames && "group-hover:border-white/30 group-hover:shadow-[0_8px_24px_rgba(0,0,0,0.6)]"
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
                              "mt-2 line-clamp-2 text-xs font-bold text-neutral-300 leading-tight transition-colors",
                              canOpenGames && "group-hover:text-white"
                            )}>
                              {game.title}
                            </p>
                          </Component>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="py-4 text-xs font-medium text-neutral-500 italic">{copy.noFavorites}</p>
                  )}

                </div>
              </section>

              <aside aria-label="Resumo do perfil" className="space-y-5">
                <Section compact={compactProfile} title={copy.platforms}>
                  <div className="divide-y divide-white/[0.05]">
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
                      <span className="text-4xl font-black text-white">{stats.totalAchievements}</span>
                      <span className="ml-1 text-sm font-bold text-white/35">/ {stats.totalPossible}</span>
                    </div>
                    <span className="text-sm font-black text-white/45">{achievementPercent}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-white/8">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${achievementPercent}%` }} transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }} className="h-full rounded-full bg-white" />
                  </div>
                  <p className="mt-3 flex items-center gap-1.5 text-[10px] text-white/35">
                    <Trophy className="h-3 w-3" /> {stats.totalAchievements} {copy.unlocked}
                  </p>
                </Section>

                {/* BIBLIOTECA EDITORIAL */}
                <Section compact={compactProfile} title={copy.library}>
                  <div className="space-y-4">
                    {/* Header de Distribuição */}
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] font-mono font-bold uppercase tracking-widest text-neutral-400">Distribuição</span>
                      <span className="text-xs font-mono font-black text-white">{stats.totalGames} {stats.totalGames === 1 ? "jogo" : "jogos"}</span>
                    </div>

                    {/* Stacked bar única de distribuição */}
                    {stats.totalGames > 0 && (
                      <div className="h-2 w-full flex rounded-full overflow-hidden bg-white/[0.06] p-0.5 gap-0.5">
                        {stats.steamGames > 0 && (
                          <div
                            style={{ width: `${(stats.steamGames / stats.totalGames) * 100}%` }}
                            className="h-full bg-sky-400 rounded-full transition-all"
                            title={`Steam: ${stats.steamGames}`}
                          />
                        )}
                        {stats.epicGames > 0 && (
                          <div
                            style={{ width: `${(stats.epicGames / stats.totalGames) * 100}%` }}
                            className="h-full bg-white/90 rounded-full transition-all"
                            title={`Epic Games: ${stats.epicGames}`}
                          />
                        )}
                        {stats.localGames > 0 && (
                          <div
                            style={{ width: `${(stats.localGames / stats.totalGames) * 100}%` }}
                            className="h-full bg-neutral-500 rounded-full transition-all"
                            title={`Local: ${stats.localGames}`}
                          />
                        )}
                      </div>
                    )}

                    {/* Linhas Editoriais com traço fino */}
                    <div className="space-y-3 pt-1">
                      {libraryRows.map((row) => {
                        const pct = stats.totalGames > 0 ? (row.value / stats.totalGames) * 100 : 0;
                        return (
                          <div key={row.label} className="group">
                            <div className="flex items-center justify-between text-xs font-bold mb-1">
                              <span className="text-neutral-300 group-hover:text-white transition-colors">{row.label}</span>
                              <span className="font-mono text-neutral-400 group-hover:text-white tabular-nums transition-colors">{row.value}</span>
                            </div>
                            <div className="h-1 w-full bg-white/[0.05] rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${pct}%` }}
                                transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                                className={`h-full rounded-full ${row.label === "Steam"
                                  ? "bg-sky-400/80"
                                  : row.label === "Epic Games"
                                    ? "bg-white/80"
                                    : "bg-neutral-400/80"
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
    <User className="mb-4 h-9 w-9 text-white/20" />
    <p className="text-sm font-black text-white/40">{title}</p>
    <p className="mt-1 text-xs text-white/25">{body}</p>
  </div>
);

export default UserProfilePage;

