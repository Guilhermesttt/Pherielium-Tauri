import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Trophy,
  Clock,
  Search,
  ChevronRight,
  ArrowUpDown,
  X,
  Zap,
  Filter
} from "lucide-react";
import type { Game } from "../types/domain";
import { formatPlayedHours, getGamePlayedHours } from "../utils/playtime";
import {
  calculateGameTrophyCounts,
  calculatePlayerLevel,
  aggregateTrophyCounts,
  getTrophyTier,
  getPSNTierInfo,
  type GameTrophyCounts,
  type PSNTier,
} from "../utils/trophyTiers";
import { getHubAggregateCounts, getUserUnifiedLevel } from "../utils/hubTrophies";
import { progressionEventBus } from "../services/progressionEvents";
import { useAuth } from "../auth/AuthProvider";
import { useGamepadNavigation } from "../hooks/useGamepadNavigation";
import { useGamepadButton } from "../context/GamepadContext";
import InputHints from "./ui/InputHints";
import { Segmented } from "./ui/refined";
import PherieliumLogoBronze from "../assets/Pherielium_Logo_Bronze.png";
import PherieliumLogoSilver from "../assets/Pherielium_Logo_Prata.png";
import PherieliumLogoGold from "../assets/Pherielium_Logo_Ouro.png";
import PherieliumLogoPlatinum from "../assets/Pherielium_Logo_Platina.png";
import PherieliumTierBronze from "../assets/Pherielium_Tier_Bronze.png";
import PherieliumTierSilver from "../assets/Pherielium_Tier_Prata.png";
import PherieliumTierGold from "../assets/Pherielium_Tier_Ouro.png";
import PherieliumTierPlatinum from "../assets/Pherielium_Tier_Platina.png";
import tierLevelClickSound from "../sounds/Phelierium Default/ui_tierLevel_click.mp3";

interface TrophiesPageProps {
  games: Game[];
  onOpenGame?: (game: Game) => void;
  playSound?: (sound: any) => void;
}

type TrophyFilter = "all" | "platinum" | "in-progress" | "not-started";
type SortOption = "progress" | "points" | "trophies" | "recent" | "title";
type FilterByPlat = "all" | "steam" | "epic" | "gog" | "riot" | "ea" | "rockstar" | "battle.net" | "ubisoft" | "xbox" | "local";

const getAchievementPercentsForGame = (
  game: Game,
): Array<{ percent: number; achieved: boolean; name?: string; description?: string; apiName?: string; id?: string }> | undefined => {
  const list = (game as any)?.achievementPercents;
  return Array.isArray(list) && list.length > 0 ? list : undefined;
};

// ============================================================
// 1. SUBCOMPONENTES VISUAIS ALTAMENTE OTIMIZADOS E MEMOIZADOS
// ============================================================

/**
 * Metais do Pherielium Refined. A cor do metal só aparece onde informa (o emblema e a barra de progresso);
 * o texto fica em tinta. Sem brilho nem drop-shadow: a imagem do emblema já carrega o metal.
 */
const TIER_VISUAL_STYLES = {
  bronze: {
    trophyImage: PherieliumLogoBronze,
    tierImage: PherieliumTierBronze,
    image: PherieliumTierBronze,
    hex: "#cd7f32",
    label: "Bronze",
  },
  silver: {
    trophyImage: PherieliumLogoSilver,
    tierImage: PherieliumTierSilver,
    image: PherieliumTierSilver,
    hex: "#cbd5e1",
    label: "Prata",
  },
  gold: {
    trophyImage: PherieliumLogoGold,
    tierImage: PherieliumTierGold,
    image: PherieliumTierGold,
    hex: "#fbbf24",
    label: "Ouro",
  },
  platinum: {
    trophyImage: PherieliumLogoPlatinum,
    tierImage: PherieliumTierPlatinum,
    image: PherieliumTierPlatinum,
    hex: "#38bdf8",
    label: "Platina",
  },
};

const PSNTrophyIcon = React.memo<{
  type: "platinum" | "gold" | "silver" | "bronze";
  size?: number;
  dimmed?: boolean;
  className?: string;
}>(({ type, size = 32, dimmed = false, className = "" }) => {
  const config = TIER_VISUAL_STYLES[type] || TIER_VISUAL_STYLES.bronze;

  return (
    <img
      src={config.trophyImage || config.image}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={`object-contain shrink-0 transition-opacity duration-[var(--dur-2)] ${dimmed ? "opacity-40 grayscale" : ""} ${className}`}
      style={{ width: size, height: size }}
    />
  );
});

const PSNTierBadge = React.memo<{
  tier: PSNTier;
  subTier: number;
  level: number;
  playSound?: (sound: any) => void;
}>(({ tier, level, playSound }) => {
  const tierInfo = useMemo(() => getPSNTierInfo(level), [level]);
  const config = TIER_VISUAL_STYLES[tier] || TIER_VISUAL_STYLES.bronze;
  const [isClicked, setIsClicked] = useState(false);

  const handleClick = useCallback(() => {
    try {
      const audio = new Audio(tierLevelClickSound);
      audio.volume = 0.8;
      audio.play().catch(() => { });
    } catch {
      playSound?.("select");
    }
    setIsClicked(true);
    setTimeout(() => setIsClicked(false), 320);
  }, [playSound]);

  const handleMouseEnter = useCallback(() => {
    playSound?.("hover");
  }, [playSound]);

  return (
    <motion.button
      type="button"
      onClick={handleClick}
      onMouseEnter={handleMouseEnter}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.9 }}
      animate={isClicked ? { scale: [0.9, 1.06, 1] } : {}}
      transition={{ type: "spring", bounce: 0.35, duration: 0.42 }}
      className="relative flex shrink-0 cursor-pointer flex-col items-center rounded-[var(--corner-lg)] p-2 outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
      aria-label={`Patente ${tierInfo.name}, nível ${level}`}
    >
      <img
        src={config.tierImage}
        alt=""
        aria-hidden="true"
        width={112}
        height={112}
        className="pointer-events-none select-none object-contain"
        style={{ width: 112, height: 112 }}
      />
      <span className="mt-2 inline-flex items-baseline gap-1 rounded-[var(--node)] bg-[var(--tone-3)] px-3 py-1">
        <span className="text-[length:var(--step-0)] font-medium text-[var(--ink-muted)]">Nível</span>
        <span className="text-[length:var(--step-1)] font-semibold tabular-nums text-[var(--ink)]">{level}</span>
      </span>
    </motion.button>
  );
});

const RankProgressionRail = React.memo<{
  completionPct: number;
  currentTier: "platinum" | "gold" | "silver" | "bronze";
  label: string;
}>(({ completionPct, currentTier, label }) => {
  const value = Math.max(0, Math.min(100, completionPct));
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={value}
      className="relative h-1.5 w-full overflow-hidden rounded-[var(--node)] bg-[var(--tone-3)]"
    >
      <motion.div
        className="h-full rounded-[var(--node)]"
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
        style={{ backgroundColor: TIER_VISUAL_STYLES[currentTier].hex }}
      />
    </div>
  );
});


const platformOptions: { value: FilterByPlat; label: string }[] = [
  { value: "all", label: "Todas as Plataformas" },
  { value: "steam", label: "Steam" },
  { value: "epic", label: "Epic" },
  { value: "local", label: "Jogos Locais" },
  { value: "gog", label: "GOG" },
  { value: "riot", label: "Riot Games" },
  { value: "xbox", label: "Xbox" },
  { value: "ea", label: "EA Games" },
  { value: "rockstar", label: "Rockstar" },
  { value: "ubisoft", label: "Ubisoft" },
  { value: "battle.net", label: "Battle.net" },
];

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "progress", label: "Maior %" },
  { value: "points", label: "Mais Pontos" },
  { value: "trophies", label: "Mais Troféus" },
  { value: "recent", label: "Mais Recentes" },
  { value: "title", label: "Alfabética" },
];

// ============================================================
// 2. LINHA DA LISTA DE JOGOS MEMOIZADA (GAME ROW)
// ============================================================

interface GameRowProps {
  game: Game;
  index: number;
  trophyCounts: GameTrophyCounts;
  completionPct: number;
  onOpen?: (game: Game) => void;
  playSound?: (sound: any) => void;
}

const GameRow = React.memo<GameRowProps>(
  ({ game, trophyCounts, completionPct, onOpen, playSound }) => {
    const hours = useMemo(() => getGamePlayedHours(game), [game]);

    const handleClick = useCallback(() => {
      onOpen?.(game);
    }, [onOpen, game]);

    const handleMouseEnter = useCallback(() => {
      playSound?.("hover");
    }, [playSound]);

    const launcherLabel = useMemo(() => {
      if (game.launcherType === "steam") return "Steam";
      if (game.launcherType === "epic") return "Epic Games";
      return game.launcherType?.toUpperCase() || "PC";
    }, [game.launcherType]);

    // Patente atingida pelo progresso neste jogo
    const gameTier = useMemo<"platinum" | "gold" | "silver" | "bronze">(() => {
      if (completionPct >= 100) return "platinum";
      if (completionPct >= 65) return "gold";
      if (completionPct >= 35) return "silver";
      return "bronze";
    }, [completionPct]);

    const tierStyle = TIER_VISUAL_STYLES[gameTier];
    const cover = game.cardImage || game.image;
    // 0% não é Bronze conquistado: o emblema fica apagado e o rótulo diz o que é.
    const notStarted = trophyCounts.completed === 0;
    const statusLabel = notStarted ? "Não iniciado" : tierStyle.label;

    return (
      <motion.button
        type="button"
        whileTap={{ scale: 0.99 }}
        transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        aria-label={`${game.title}: ${statusLabel}, ${completionPct}% concluído`}
        className="group flex w-full cursor-pointer items-center gap-5 rounded-[var(--corner-md)] bg-[var(--tone-1)] p-4 text-left outline-none transition-colors duration-[var(--dur-2)] hover:bg-[var(--tone-2)] focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
      >
        <div className="relative h-[88px] w-16 shrink-0 overflow-hidden rounded-[var(--corner-sm)] bg-[var(--tone-3)]">
          {cover ? (
            <img
              src={cover}
              alt=""
              className="h-full w-full object-cover transition-transform duration-[var(--dur-3)] ease-[var(--spring)] group-hover:scale-105"
              loading="lazy"
              decoding="async"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[length:var(--step-0)] font-semibold text-[var(--ink-faint)]">
              {game.title?.slice(0, 2).toUpperCase()}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 space-y-1">
              <h3 className="truncate text-[length:var(--step-2)] font-semibold text-[var(--ink)]">{game.title}</h3>
              <div className="flex flex-wrap items-center gap-x-2 text-[length:var(--step-0)] text-[var(--ink-muted)]">
                <span>{launcherLabel}</span>
                {hours > 0 && (
                  <>
                    <span aria-hidden="true" className="text-[var(--ink-faint)]">·</span>
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-[var(--ink-faint)]" aria-hidden="true" /> {formatPlayedHours(hours)}h
                    </span>
                  </>
                )}
                <span aria-hidden="true" className="text-[var(--ink-faint)]">·</span>
                <span className="tabular-nums">
                  {trophyCounts.completed} de {trophyCounts.total} conquistas
                </span>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-3">
              <PSNTrophyIcon type={gameTier} size={40} dimmed={notStarted} />
              <div className="min-w-[72px] text-right">
                <div className="text-[length:var(--step-2)] font-semibold tabular-nums text-[var(--ink)]">{completionPct}%</div>
                <div className="text-[length:var(--step-0)] text-[var(--ink-muted)]">{statusLabel}</div>
              </div>
              <ChevronRight
                className="h-4 w-4 text-[var(--ink-faint)] transition-transform duration-[var(--dur-2)] ease-[var(--spring)] group-hover:translate-x-1 group-hover:text-[var(--ink)]"
                aria-hidden="true"
              />
            </div>
          </div>

          <RankProgressionRail completionPct={completionPct} currentTier={gameTier} label={`Progresso em ${game.title}`} />
        </div>
      </motion.button>
    );
  },
  (prev, next) => {
    return (
      prev.game.id === next.game.id &&
      prev.index === next.index &&
      prev.completionPct === next.completionPct &&
      prev.trophyCounts.completed === next.trophyCounts.completed &&
      prev.trophyCounts.total === next.trophyCounts.total &&
      prev.trophyCounts.platinum === next.trophyCounts.platinum &&
      prev.trophyCounts.gold === next.trophyCounts.gold &&
      prev.trophyCounts.silver === next.trophyCounts.silver &&
      prev.trophyCounts.bronze === next.trophyCounts.bronze &&
      prev.onOpen === next.onOpen &&
      prev.playSound === next.playSound
    );
  },
);

// ============================================================
// 3. PÁGINA PRINCIPAL DE TROFÉUS
// ============================================================

const TrophiesPage: React.FC<TrophiesPageProps> = ({ games, onOpenGame, playSound }) => {
  const [filter, setFilter] = useState<TrophyFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("progress");
  const [filterByPlat, setFilterByPlat] = useState<FilterByPlat>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const { user } = useAuth();
  const [isPlataformFilterOpen, setIsPlatformFilterOpen] = useState(false);
  const platFilterRef = useRef<HTMLDivElement>(null);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
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

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (platFilterRef.current && !platFilterRef.current.contains(e.target as Node)) {
        setIsPlatformFilterOpen(false);
      }
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setIsSortOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useGamepadNavigation({
    scrollRef: scrollRef as React.RefObject<HTMLElement>,
    scrollSpeed: 25,
    enabled: true,
    priority: 1,
  });

  const gamesWithAchievements = useMemo(() => {
    return (games || []).filter((g) => (g.totalAchievements || 0) > 0);
  }, [games]);

  // FASE 1: Enriquecimento de Dados (Cálculo Único e Centralizado)
  const enrichedGames = useMemo(() => {
    return gamesWithAchievements.map((game) => {
      const t = game.totalAchievements || 0;
      const u = game.completedAchievements || 0;
      const pct = t > 0 ? Math.round((u / t) * 100) : 0;
      const counts = calculateGameTrophyCounts(t, u, getAchievementPercentsForGame(game));
      return { game, t, u, pct, counts };
    });
  }, [gamesWithAchievements]);

  // Estatísticas Globais do Jogador e Nível Unificado
  const totalStats = useMemo(() => {
    const gamesForAggregate = gamesWithAchievements.map((g) => ({
      totalAchievements: g.totalAchievements,
      completedAchievements: g.completedAchievements,
      achievementPercents: getAchievementPercentsForGame(g),
    }));
    const agg = aggregateTrophyCounts(gamesForAggregate);

    // Fonte unificada e canônica do ecossistema para o nível do jogador
    const playerLevel = user?.uid
      ? getUserUnifiedLevel(user.uid, games as any)
      : calculatePlayerLevel(0, 0, 0, agg);

    return {
      total: agg.total,
      unlocked: agg.completed,
      platinum: agg.platinum,
      gold: agg.gold,
      silver: agg.silver,
      bronze: agg.bronze,
      gamesCount: gamesWithAchievements.length,
      playerLevel,
    };
  }, [gamesWithAchievements, games, user?.uid, xpRevision]);

  // FASE 2: Filtragem e Ordenação Estável
  const filteredGames = useMemo(() => {
    let list = [...enrichedGames];

    if (filter === "platinum") list = list.filter((g) => g.t > 0 && g.u >= g.t);
    else if (filter === "in-progress") list = list.filter((g) => g.u > 0 && g.u < g.t);
    else if (filter === "not-started") list = list.filter((g) => g.u === 0);

    if (searchTerm.trim()) {
      const s = searchTerm.toLowerCase().trim();
      list = list.filter((g) => g.game.title?.toLowerCase().includes(s));
    }

    list.sort((a, b) => {
      if (sortBy === "progress") return b.pct - a.pct;
      if (sortBy === "points") return (b.counts.points || 0) - (a.counts.points || 0);
      if (sortBy === "trophies") return b.u - a.u;
      if (sortBy === "recent") {
        const aTime = a.game.lastPlayedAt ? new Date(a.game.lastPlayedAt).getTime() : 0;
        const bTime = b.game.lastPlayedAt ? new Date(b.game.lastPlayedAt).getTime() : 0;
        return bTime - aTime;
      }
      if (sortBy === "title") return (a.game.title || "").localeCompare(b.game.title || "");
      return b.pct - a.pct;
    });

    list = list.filter((g) => filterByPlat === "all" || g.game.launcherType === filterByPlat)

    return list;
  }, [enrichedGames, filter, searchTerm, sortBy, filterByPlat]);

  // FASE 3: Renderização de Jogos Otimizada e Memoizada
  const renderedGameRows = useMemo(() => {
    return filteredGames.map(({ game, pct, counts }, idx) => (
      <GameRow
        key={game.id}
        game={game}
        index={idx}
        trophyCounts={counts}
        completionPct={pct}
        onOpen={onOpenGame}
        playSound={playSound}
      />
    ));
  }, [filteredGames, onOpenGame, playSound]);

  const levelInfo = totalStats.playerLevel;
  const tierInfo = levelInfo.tierInfo;

  const nextGoal = useMemo(() => {
    if (levelInfo.level >= 999) return "Nível Máximo";
    const xpRemaining = Math.max(0, levelInfo.xpForNextLevel - levelInfo.currentLevelXp);
    const nextTier = getPSNTierInfo(levelInfo.level + 1);
    const targetName = nextTier.name !== levelInfo.tierName ? nextTier.name : `Nível ${levelInfo.level + 1}`;
    return `${xpRemaining} XP para ${targetName}`;
  }, [levelInfo]);

  // Callbacks Estáveis
  const handleFilterSelect = useCallback(
    (newFilter: TrophyFilter) => {
      playSound?.("select");
      setFilter(newFilter);
    },
    [playSound],
  );

  const handleSortChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setSortBy(e.target.value as SortOption);
  }, []);

  const handleFilterByPlat = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilterByPlat(e.target.value as FilterByPlat);
  }, []);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchTerm("");
  }, []);


  const plataformsTab = useMemo(() => {
    return enrichedGames.filter((g) => filterByPlat === "all" || g.game.launcherType?.toLowerCase() === filterByPlat.toLowerCase());
  }, [filterByPlat, enrichedGames])


  const filterTabs = useMemo(
    () => [
      { id: "all" as TrophyFilter, label: "Todos", count: plataformsTab.length },
      { id: "platinum" as TrophyFilter, label: "Platinados", count: plataformsTab.filter((g) => g.counts.platinum > 0).length },
      {
        id: "in-progress" as TrophyFilter,
        label: "Em Progresso",
        count: plataformsTab.filter(
          (g) => (g.counts.completed || 0) > 0 && (g.counts.completed || 0) < (g.counts.total || 0),
        ).length,
      },
      {
        id: "not-started" as TrophyFilter,
        label: "Não Iniciados",
        count: plataformsTab.filter((g) => (g.counts.completed || 0) === 0).length,
      },


    ],
    [gamesWithAchievements, plataformsTab, totalStats.platinum],
  );

  const TROPHY_FILTER_ORDER: TrophyFilter[] = useMemo(() => ["all", "platinum", "in-progress", "not-started"], []);

  useGamepadButton("L1", () => {
    const currentIndex = TROPHY_FILTER_ORDER.indexOf(filter);
    const prevIndex = (currentIndex - 1 + TROPHY_FILTER_ORDER.length) % TROPHY_FILTER_ORDER.length;
    setFilter(TROPHY_FILTER_ORDER[prevIndex]);
    playSound?.("select");
  });

  useGamepadButton("R1", () => {
    const currentIndex = TROPHY_FILTER_ORDER.indexOf(filter);
    const nextIndex = (currentIndex + 1) % TROPHY_FILTER_ORDER.length;
    setFilter(TROPHY_FILTER_ORDER[nextIndex]);
    playSound?.("select");
  });

  const tierStyle = TIER_VISUAL_STYLES[levelInfo.tier] || TIER_VISUAL_STYLES.bronze;
  const selectedSortLabel = sortOptions.find((opt) => opt.value === sortBy)?.label || "Maior %";
  const selectedPlatformLabel = platformOptions.find((opt) => opt.value === filterByPlat)?.label || "Todas as Plataformas";

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      className="relative flex min-h-0 flex-1 flex-col text-[var(--ink)] font-sans"
      style={{ contain: "layout paint", transform: "translate3d(0,0,0)", willChange: "transform" }}
    >
      <div
        ref={scrollRef}
        data-system-page="trophies"
        className="min-h-0 flex-1 overflow-y-auto thin-scrollbar px-10 pb-10 pt-10"
      >
      <div className="mx-auto mb-10 w-full max-w-5xl">
        <h1 className="font-display text-[length:var(--step-5)] font-semibold leading-[1.02] tracking-[-0.04em] text-[var(--ink)]">
          Troféus
        </h1>
        <p className="mt-3 max-w-2xl text-[length:var(--step-1)] leading-relaxed text-[var(--ink-muted)]">
          Suas conquistas de todas as lojas num lugar só, e o caminho até a próxima patente.
        </p>
      </div>

      <div className="mx-auto max-w-5xl space-y-8">
        {/* Patente do jogador: o emblema é o único destaque; um degrau de tom separa, sem borda nem brilho */}
        <section aria-label="Sua patente" className="rounded-[var(--corner-lg)] bg-[var(--tone-1)] p-8">
          <div className="flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 items-center gap-6">
              <PSNTierBadge
                tier={levelInfo.tier}
                subTier={levelInfo.subTier}
                level={levelInfo.level}
                playSound={playSound}
              />
              <div className="min-w-0 flex-1 space-y-4">
                <div>
                  <p className="text-[length:var(--step-0)] text-[var(--ink-muted)]">Patente atual</p>
                  <h2 className="font-display text-[length:var(--step-4)] font-semibold leading-tight tracking-[-0.035em] text-[var(--ink)]">
                    {levelInfo.tierName}
                  </h2>
                </div>

                <div className="max-w-sm space-y-2">
                  <div className="flex items-baseline justify-between gap-3 text-[length:var(--step-0)]">
                    <span className="font-semibold tabular-nums text-[var(--ink)]">
                      {levelInfo.currentLevelXp} / {levelInfo.xpForNextLevel} XP
                    </span>
                    <span className="font-semibold tabular-nums text-[var(--ink)]">{levelInfo.progress}%</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="Progresso até o próximo nível"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={levelInfo.progress}
                    className="relative h-2 w-full overflow-hidden rounded-[var(--node)] bg-[var(--tone-3)]"
                  >
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-[var(--node)]"
                      style={{ backgroundColor: tierStyle.hex }}
                      initial={{ width: 0 }}
                      animate={{ width: `${levelInfo.progress}%` }}
                      transition={{ duration: 1, ease: [0.32, 0.72, 0, 1] }}
                    />
                  </div>
                  {levelInfo.level < 999 && (
                    <p className="text-[length:var(--step-0)] text-[var(--ink-muted)]">Faltam {nextGoal}</p>
                  )}
                </div>

                <div className="space-y-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-[length:var(--step-0)] text-[var(--ink-muted)]">
                    <span className="inline-flex items-center gap-1 font-semibold text-[var(--ink)]">
                      <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                      {levelInfo.xp.toLocaleString()} XP do hub
                    </span>
                    <span aria-hidden="true" className="text-[var(--ink-faint)]">·</span>
                    <span>{totalStats.unlocked} troféus sincronizados</span>
                  </p>
                  {levelInfo.xp === 0 && totalStats.unlocked > 0 && (
                    <p className="text-[length:var(--step-0)] leading-snug text-[var(--ink-faint)]">
                      Troféus sincronizados alimentam sua vitrine. Ganhe XP em sessões pelo hub e completando missões.
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Escalada: quantos troféus de cada metal, e quanto XP cada um vale */}
            <div className="shrink-0">
              <p className="mb-3 text-[length:var(--step-0)] text-[var(--ink-muted)]">
                Escalada de troféus · {totalStats.unlocked} no total
              </p>
              <ul className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {[
                  { type: "bronze" as const, xp: 15, count: totalStats.bronze },
                  { type: "silver" as const, xp: 30, count: totalStats.silver },
                  { type: "gold" as const, xp: 90, count: totalStats.gold },
                  { type: "platinum" as const, xp: 300, count: totalStats.platinum },
                ].map((item) => {
                  const isCurrentTier = levelInfo.tier === item.type;
                  const style = TIER_VISUAL_STYLES[item.type];
                  return (
                    <li
                      key={item.type}
                      aria-current={isCurrentTier ? "true" : undefined}
                      className={`flex min-w-[96px] flex-col items-center rounded-[var(--corner-md)] px-3 py-4 ${
                        isCurrentTier ? "bg-[var(--tone-3)]" : "bg-[var(--tone-2)]"
                      }`}
                    >
                      <PSNTrophyIcon type={item.type} size={40} dimmed={item.count === 0} />
                      <span className="mt-2 text-[length:var(--step-3)] font-semibold tabular-nums leading-none text-[var(--ink)]">
                        {item.count}
                      </span>
                      <span className="mt-1 text-[length:var(--step-0)] text-[var(--ink-muted)]">
                        {style.label} · {item.xp} XP
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        </section>

        {/* Filtros e busca */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Segmented
            label="Filtrar troféus"
            options={filterTabs.map((f) => ({ value: f.id, label: `${f.label} ${f.count}` }))}
            value={filter}
            onChange={handleFilterSelect}
            className="max-w-full overflow-x-auto [scrollbar-width:none]"
          />

          <div className="flex items-center gap-2">
            {/* Ordenação */}
            <div className="relative" ref={sortRef}>
              <button
                type="button"
                onClick={() => setIsSortOpen((prev) => !prev)}
                onMouseEnter={() => playSound?.("hover")}
                aria-haspopup="listbox"
                aria-expanded={isSortOpen}
                aria-label={`Ordenar: ${selectedSortLabel}`}
                className="flex h-11 cursor-pointer items-center gap-2 rounded-[var(--node)] bg-[var(--tone-2)] px-4 text-[length:var(--step-0)] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--tone-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
              >
                <ArrowUpDown className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden="true" />
                <span>{selectedSortLabel}</span>
              </button>

              {isSortOpen && (
                <div role="listbox" aria-label="Ordenar jogos" className="absolute right-0 top-full z-20 mt-2 w-48 overflow-hidden rounded-[var(--corner-md)] bg-[var(--tone-3)] p-1.5">
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={sortBy === opt.value}
                      onClick={() => {
                        playSound?.("select");
                        setSortBy(opt.value);
                        setIsSortOpen(false);
                      }}
                      className={`flex h-10 w-full cursor-pointer items-center rounded-[var(--node)] px-3.5 text-left text-[length:var(--step-0)] transition-colors ${
                        sortBy === opt.value
                          ? "bg-[var(--tone-4)] font-semibold text-[var(--ink)]"
                          : "text-[var(--ink-muted)] hover:bg-[var(--tone-4)] hover:text-[var(--ink)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Plataforma */}
            <div className="relative" ref={platFilterRef}>
              <button
                type="button"
                onClick={() => setIsPlatformFilterOpen((prev) => !prev)}
                onMouseEnter={() => playSound?.("hover")}
                aria-haspopup="listbox"
                aria-expanded={isPlataformFilterOpen}
                aria-label={`Plataforma: ${selectedPlatformLabel}`}
                className={`flex h-11 cursor-pointer items-center gap-2 rounded-[var(--node)] px-4 text-[length:var(--step-0)] font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] ${
                  filterByPlat !== "all"
                    ? "bg-[var(--ink)] text-[var(--tone-0)]"
                    : "bg-[var(--tone-2)] text-[var(--ink)] hover:bg-[var(--tone-3)]"
                }`}
              >
                <Filter className="h-4 w-4" aria-hidden="true" />
                <span>{filterByPlat === "all" ? "Plataforma" : selectedPlatformLabel}</span>
              </button>

              {isPlataformFilterOpen && (
                <div role="listbox" aria-label="Filtrar por plataforma" className="absolute right-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-[var(--corner-md)] bg-[var(--tone-3)] p-1.5">
                  {platformOptions.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      role="option"
                      aria-selected={filterByPlat === opt.value}
                      onClick={() => {
                        playSound?.("select");
                        setFilterByPlat(opt.value);
                        setIsPlatformFilterOpen(false);
                      }}
                      className={`flex h-10 w-full cursor-pointer items-center rounded-[var(--node)] px-3.5 text-left text-[length:var(--step-0)] transition-colors ${
                        filterByPlat === opt.value
                          ? "bg-[var(--tone-4)] font-semibold text-[var(--ink)]"
                          : "text-[var(--ink-muted)] hover:bg-[var(--tone-4)] hover:text-[var(--ink)]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Busca */}
            <div className="group relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-faint)] transition-colors group-focus-within:text-[var(--ink)]" aria-hidden="true" />
              <input
                type="search"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Buscar jogos"
                aria-label="Buscar jogos"
                className="h-11 w-56 rounded-[var(--node)] bg-[var(--tone-2)] pl-11 pr-9 text-[length:var(--step-0)] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-faint)] focus:bg-[var(--tone-3)] focus-visible:ring-2 focus-visible:ring-[var(--ink)] sm:w-64 [&::-webkit-search-cancel-button]:hidden"
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={handleClearSearch}
                  aria-label="Limpar busca"
                  className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[var(--node)] text-[var(--ink-faint)] transition-colors hover:bg-[var(--tone-4)] hover:text-[var(--ink)]"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Lista de jogos */}
        <div className="space-y-2">
          {renderedGameRows}

          {filteredGames.length === 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col items-center justify-center rounded-[var(--corner-lg)] bg-[var(--tone-1)] px-6 py-20 text-center"
            >
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[var(--node)] bg-[var(--tone-3)]">
                <Trophy className="h-7 w-7 text-[var(--ink-muted)]" strokeWidth={1.5} aria-hidden="true" />
              </div>
              <h3 className="text-[length:var(--step-2)] font-semibold text-[var(--ink)]">
                {filter === "platinum"
                  ? "Nenhum jogo platinado ainda"
                  : filter === "in-progress"
                    ? "Nenhum jogo em progresso no momento"
                    : filter === "not-started"
                      ? "Você já iniciou todos os seus jogos!"
                      : "Nenhum jogo encontrado"}
              </h3>
              <p className="mt-2 max-w-sm text-[length:var(--step-0)] text-[var(--ink-muted)]">
                {filter === "platinum"
                  ? "Complete 100% das conquistas de um jogo para conquistar seu troféu de Platina!"
                  : "Tente alterar os filtros de busca para ver seus outros jogos e troféus."}
              </p>
            </motion.div>
          )}
        </div>
      </div>
      </div>
      {/* Legenda fixa no rodapé da página (fora da rolagem), como nas demais. */}
      <div className="flex shrink-0 justify-end px-10 py-3">
        <InputHints
          hints={[
            { button: "L1_R1", label: "Filtrar" },
            { button: "DPAD", label: "Navegar" },
            { button: "X", label: "Abrir Jogo" },
            { button: "SCROLL", label: "Rolar" },
            { button: "O", label: "Voltar" },
          ]}
        />
      </div>
    </motion.div>
  );
};

export default React.memo(TrophiesPage);

