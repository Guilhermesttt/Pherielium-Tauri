import React, { useMemo, useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { ConsolePageLayout } from "./ui/ConsolePageLayout";
import { HorizontalTabs } from "./ui/HorizontalTabs";
import { SectionTransition } from "./ui/SectionTransition";
import {
  Trophy,
  Clock,
  ChevronRight,
  ArrowUpDown,
  Zap,
  Filter,
  Search,
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
import { closestToPlatinum } from "../utils/trophyGoals";
import { progressionEventBus } from "../services/progressionEvents";
import { useAuth } from "../auth/AuthProvider";
import { useGamepadButton } from "../context/GamepadContext";
import InputHints from "./ui/InputHints";
import PherieliumLogoBronze from "../assets/Pherielium_Logo_Bronze.png";
import PherieliumLogoSilver from "../assets/Pherielium_Logo_Prata.png";
import PherieliumLogoGold from "../assets/Pherielium_Logo_Ouro.png";
import PherieliumLogoPlatinum from "../assets/Pherielium_Logo_Platina.png";
import PherieliumTierBronze from "../assets/Pherielium_Tier_Bronze.png";
import PherieliumTierSilver from "../assets/Pherielium_Tier_Prata.png";
import PherieliumTierGold from "../assets/Pherielium_Tier_Ouro.png";
import PherieliumTierPlatinum from "../assets/Pherielium_Tier_Platina.png";
import tierLevelClickSound from "../sounds/Phelierium Default/Deck UI Default Activation.mp3";
import { GAMEPAD_PRIORITY } from "../context/gamepadSubscribers";

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
 * Metais do Pherielium Refined (tokens `--tier-*`). A cor do metal só aparece onde informa (o emblema e a barra de progresso);
 * o texto fica em tinta. Sem brilho nem drop-shadow: a imagem do emblema já carrega o metal.
 */
const TIER_VISUAL_STYLES = {
  bronze: {
    trophyImage: PherieliumLogoBronze,
    tierImage: PherieliumTierBronze,
    image: PherieliumTierBronze,
    color: "rgb(var(--tier-bronze))",
    label: "Bronze",
  },
  silver: {
    trophyImage: PherieliumLogoSilver,
    tierImage: PherieliumTierSilver,
    image: PherieliumTierSilver,
    color: "rgb(var(--tier-silver))",
    label: "Prata",
  },
  gold: {
    trophyImage: PherieliumLogoGold,
    tierImage: PherieliumTierGold,
    image: PherieliumTierGold,
    color: "rgb(var(--tier-gold))",
    label: "Ouro",
  },
  platinum: {
    trophyImage: PherieliumLogoPlatinum,
    tierImage: PherieliumTierPlatinum,
    image: PherieliumTierPlatinum,
    color: "rgb(var(--tier-platinum))",
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
      <span className="mt-2 inline-flex items-baseline gap-1 rounded-[var(--corner-sm)] bg-[var(--tone-3)] px-3 py-1">
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
      className="relative h-2 w-full overflow-hidden rounded-[var(--corner-sm)] bg-[var(--tone-4)]"
    >
      <motion.div
        className="h-full rounded-[var(--corner-sm)]"
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.6, ease: [0.32, 0.72, 0, 1] }}
        style={{ backgroundColor: TIER_VISUAL_STYLES[currentTier].color }}
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
        className="group flex w-full cursor-pointer items-center gap-6 rounded-[var(--corner-md)] bg-[var(--tone-2)] p-5 text-left outline-none transition-colors duration-[var(--dur-2)] hover:bg-[var(--tone-3)] focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
      >
        <div className="relative h-[104px] w-[72px] shrink-0 overflow-hidden rounded-[var(--corner-sm)] bg-[var(--tone-3)]">
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
  const { user } = useAuth();
  const [isPlataformFilterOpen, setIsPlatformFilterOpen] = useState(false);
  const [isSortOpen, setIsSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);
  const platFilterRef = useRef<HTMLDivElement>(null);
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

  // Jogo mais perto da Platina (vira o atalho "Próximo objetivo")
  const platinumGoal = useMemo(() => closestToPlatinum(enrichedGames), [enrichedGames]);

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
    playSound?.("tabSwitch");
  }, true, GAMEPAD_PRIORITY.page);

  useGamepadButton("R1", () => {
    const currentIndex = TROPHY_FILTER_ORDER.indexOf(filter);
    const nextIndex = (currentIndex + 1) % TROPHY_FILTER_ORDER.length;
    setFilter(TROPHY_FILTER_ORDER[nextIndex]);
    playSound?.("tabSwitch");
  }, true, GAMEPAD_PRIORITY.page);

  const tierStyle = TIER_VISUAL_STYLES[levelInfo.tier] || TIER_VISUAL_STYLES.bronze;
  const selectedSortLabel = sortOptions.find((opt) => opt.value === sortBy)?.label || "Maior %";
  const selectedPlatformLabel = platformOptions.find((opt) => opt.value === filterByPlat)?.label || "Todas as Plataformas";

  const sortButton = (
    <div className="relative" ref={sortRef}>
      <button
        type="button"
        onClick={() => setIsSortOpen((prev) => !prev)}
        onMouseEnter={() => playSound?.("hover")}
        aria-haspopup="listbox"
        aria-expanded={isSortOpen}
        aria-label={`Ordenar: ${selectedSortLabel}`}
        className="flex h-12 cursor-pointer items-center gap-2.5 rounded-[var(--corner-sm)] bg-[var(--tone-3)] px-5 text-[length:var(--step-0)] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--tone-4)]"
      >
        <ArrowUpDown className="h-4 w-4 text-[var(--ink-muted)]" aria-hidden="true" />
        <span>{selectedSortLabel}</span>
      </button>

      {isSortOpen && (
        <div role="listbox" aria-label="Ordenar jogos" className="absolute right-0 top-full z-20 mt-2 w-52 overflow-hidden rounded-[var(--corner-md)] bg-[var(--tone-3)] p-2">
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
              className={`sel-pill flex h-11 w-full cursor-pointer items-center rounded-[var(--corner-sm)] px-4 text-left text-[length:var(--step-0)] ${
                sortBy === opt.value ? "" : "text-[var(--ink-muted)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );

  const platformButton = (
    <div className="relative" ref={platFilterRef}>
      <button
        type="button"
        onClick={() => setIsPlatformFilterOpen((prev) => !prev)}
        onMouseEnter={() => playSound?.("hover")}
        aria-haspopup="listbox"
        aria-expanded={isPlataformFilterOpen}
        aria-label={`Plataforma: ${selectedPlatformLabel}`}
        className={`flex h-12 cursor-pointer items-center gap-2.5 rounded-[var(--corner-sm)] px-5 text-[length:var(--step-0)] font-semibold transition-colors ${
          filterByPlat !== "all"
            ? "bg-[var(--ink)] text-[var(--tone-0)]"
            : "bg-[var(--tone-3)] text-[var(--ink)] hover:bg-[var(--tone-4)]"
        }`}
      >
        <Filter className="h-4 w-4" aria-hidden="true" />
        <span>{filterByPlat === "all" ? "Plataforma" : selectedPlatformLabel}</span>
      </button>

      {isPlataformFilterOpen && (
        <div
          role="listbox"
          aria-label="Filtrar por plataforma"
          className="thin-scrollbar absolute right-0 top-full z-20 mt-2 max-h-80 w-60 overflow-y-auto rounded-[var(--corner-md)] bg-[var(--tone-3)] p-2"
        >
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
              className={`sel-pill flex h-11 w-full cursor-pointer items-center rounded-[var(--corner-sm)] px-4 text-left text-[length:var(--step-0)] ${
                filterByPlat === opt.value ? "" : "text-[var(--ink-muted)]"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}

    </div>
  );

  const searchField = (
    <div className="relative w-64">
      <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-faint)]" aria-hidden="true" />
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        aria-label="Buscar jogos"
        placeholder="Buscar jogos"
        className="h-12 w-full rounded-[var(--corner-sm)] bg-[var(--tone-2)] pl-11 pr-4 text-[length:var(--step-0)] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-faint)] focus:bg-[var(--tone-3)]"
      />
    </div>
  );

  return (
    <ConsolePageLayout
      title="Troféus"
      systemPage="trophies"
      gamepadPriority={1}
      emptyLine="Suas conquistas de todas as lojas num lugar só."
      readings={[
        { label: "Troféus", value: totalStats.unlocked },
        { label: "Platinas", value: totalStats.platinum },
        { label: "Jogos", value: totalStats.gamesCount },
      ]}
      actions={
        <>
          {sortButton}
          {platformButton}
          {searchField}
        </>
      }
      tabs={
        <HorizontalTabs
          activeId={filter}
          onChange={(id) => handleFilterSelect(id as TrophyFilter)}
          className="t-tabs--squircle t-tabs--neon flex-wrap"
          tabClassName="flex h-12 items-center gap-2.5 whitespace-nowrap"
          tabs={filterTabs.map((f) => ({
            id: f.id,
            label: (
              <span className="flex items-center gap-2.5">
                {f.label}
                <span className="font-metric rounded-full bg-[var(--tone-4)] px-1.5 text-center text-[length:var(--step-0)] font-bold leading-5 text-[var(--ink)]">{f.count}</span>
              </span>
            ),
          }))}
        />
      }
      footer={
        <InputHints
          hints={[
            { button: "L1_R1", label: "Filtrar" },
            { button: "DPAD", label: "Navegar" },
            { button: "X", label: "Abrir Jogo" },
            { button: "SCROLL", label: "Rolar" },
            { button: "O", label: "Voltar" },
          ]}
        />
      }
    >
      <div className="space-y-8">
        {/* Patente e escalada lado a lado: a patente leva a borda neon (o que é importante), a escalada só no degrau atual */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
          <section aria-label="Sua patente" className="neon-border rounded-[var(--corner-lg)] bg-[var(--tone-1)] p-8">
            <div className="flex min-w-0 items-center gap-7">
              <PSNTierBadge tier={levelInfo.tier} subTier={levelInfo.subTier} level={levelInfo.level} playSound={playSound} />
              <div className="min-w-0 flex-1 space-y-5">
                <div>
                  <p className="text-[length:var(--fs-label)] font-bold uppercase tracking-[0.08em] text-[var(--ink-muted)]">Patente</p>
                  <h2 className="mt-1 text-[length:var(--step-4)] font-semibold leading-tight tracking-[-0.035em] text-[var(--ink)]">{levelInfo.tierName}</h2>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-baseline justify-between gap-3 text-[length:var(--step-0)]">
                    <span className="font-metric font-semibold text-[var(--ink)]">
                      {levelInfo.currentLevelXp} / {levelInfo.xpForNextLevel} XP
                    </span>
                    <span className="font-metric font-semibold text-[var(--ink)]">{levelInfo.progress}%</span>
                  </div>
                  <div
                    role="progressbar"
                    aria-label="Progresso até o próximo nível"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={levelInfo.progress}
                    className="relative h-2.5 w-full overflow-hidden rounded-[var(--corner-sm)] bg-[var(--tone-3)]"
                  >
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-[var(--corner-sm)]"
                      style={{ backgroundColor: tierStyle.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${levelInfo.progress}%` }}
                      transition={{ duration: 1, ease: [0.32, 0.72, 0, 1] }}
                    />
                  </div>
                  {levelInfo.level < 999 && <p className="text-[length:var(--step-0)] text-[var(--ink-muted)]">Faltam {nextGoal}</p>}
                </div>

                <p className="flex flex-wrap items-center gap-x-2 text-[length:var(--step-0)] text-[var(--ink-muted)]">
                  <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--ink)]">
                    <Zap className="h-3.5 w-3.5" aria-hidden="true" />
                    <span className="font-metric">{levelInfo.xp.toLocaleString()}</span> XP do hub
                  </span>
                </p>
                {levelInfo.xp === 0 && totalStats.unlocked > 0 && (
                  <p className="text-[length:var(--step-0)] leading-snug text-[var(--ink-faint)]">
                    Troféus sincronizados alimentam sua vitrine. Ganhe XP em sessões pelo hub e completando missões.
                  </p>
                )}
              </div>
            </div>
          </section>

          <section aria-label="Escalada de troféus" className="rounded-[var(--corner-lg)] bg-[var(--tone-1)] p-8">
            <p className="mb-5 text-[length:var(--fs-label)] font-bold uppercase tracking-[0.08em] text-[var(--ink-muted)]">Escalada de troféus</p>
            <ul className="grid grid-cols-2 gap-3">
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
                    className={`flex items-center gap-4 rounded-[var(--corner-md)] px-5 py-4 ${isCurrentTier ? "neon-border bg-[var(--tone-3)]" : "bg-[var(--tone-2)]"}`}
                  >
                    <PSNTrophyIcon type={item.type} size={44} dimmed={item.count === 0} />
                    <span className="min-w-0">
                      <span className="font-metric block text-[length:var(--step-3)] font-semibold leading-none text-[var(--ink)]">{item.count}</span>
                      <span className="mt-1.5 block text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)]">{style.label}</span>
                      <span className="font-metric block text-[length:var(--step-0)] text-[var(--ink-faint)]">{item.xp} XP</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>
        </div>

        {/* Próximo objetivo: o jogo mais perto da Platina, com a arte de ponta a ponta */}
        {platinumGoal && (
          <section aria-label="Próximo objetivo">
            <button
              type="button"
              onClick={() => {
                playSound?.("select");
                onOpenGame?.(platinumGoal.game);
              }}
              onMouseEnter={() => playSound?.("hover")}
              className="neon-border neon-border--animated group relative isolate flex w-full cursor-pointer items-center gap-6 overflow-hidden rounded-[var(--corner-lg)] bg-[var(--tone-1)] p-7 text-left transition-transform active:scale-[0.995]"
            >
              {(platinumGoal.game.backgroundImage || platinumGoal.game.cardImage || platinumGoal.game.image) && (
                <img
                  src={platinumGoal.game.backgroundImage || platinumGoal.game.cardImage || platinumGoal.game.image}
                  alt=""
                  aria-hidden
                  className="absolute inset-0 -z-10 h-full w-full object-cover object-center"
                  draggable={false}
                />
              )}
              <span
                className="absolute inset-0 -z-10"
                style={{ background: "linear-gradient(90deg, color-mix(in srgb, var(--tone-0) 94%, transparent) 0%, color-mix(in srgb, var(--tone-0) 70%, transparent) 55%, color-mix(in srgb, var(--tone-0) 35%, transparent) 100%)" }}
              />
              <span className="min-w-0 flex-1">
                <span className="block text-[length:var(--fs-label)] font-bold uppercase tracking-[0.08em]" style={{ color: "rgb(var(--tier-platinum))" }}>
                  Mais perto da Platina
                </span>
                <span className="mt-1.5 block truncate text-[length:var(--step-4)] font-semibold tracking-[-0.025em] text-[var(--ink)]">{platinumGoal.game.title}</span>
                <span className="mt-1.5 block text-[length:var(--step-0)] text-[var(--ink-muted)]">
                  Faltam <span className="font-metric text-[var(--ink)]">{platinumGoal.remaining}</span> {platinumGoal.remaining === 1 ? "conquista" : "conquistas"} de{" "}
                  <span className="font-metric">{platinumGoal.total}</span>
                </span>
                <span
                  role="progressbar"
                  aria-label={`Progresso em ${platinumGoal.game.title}`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={platinumGoal.percent}
                  className="mt-4 block h-2 w-full max-w-md overflow-hidden rounded-[var(--corner-sm)] bg-[var(--tone-3)]"
                >
                  <span className="block h-full rounded-[var(--corner-sm)]" style={{ width: `${platinumGoal.percent}%`, backgroundColor: "rgb(var(--tier-platinum))" }} />
                </span>
              </span>
              <span className="font-metric shrink-0 text-[length:var(--step-5)] font-semibold text-[var(--ink)]">{platinumGoal.percent}%</span>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--corner-sm)] bg-[var(--ink)] text-[var(--tone-0)]">
                <ChevronRight className="h-5 w-5 transition-transform duration-150 group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </button>
          </section>
        )}

        {/* Lista de jogos */}
        <SectionTransition id={`${filter}|${sortBy}|${filterByPlat}`} className="space-y-3">
          {renderedGameRows}

          {filteredGames.length === 0 && (
            <div className="flex flex-col items-center justify-center rounded-[var(--corner-lg)] bg-[var(--tone-1)] px-6 py-20 text-center">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-[var(--corner-md)] bg-[var(--tone-3)]">
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
            </div>
          )}
        </SectionTransition>
      </div>
    </ConsolePageLayout>
  );
};

export default React.memo(TrophiesPage);

