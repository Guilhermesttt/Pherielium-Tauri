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

const TIER_VISUAL_STYLES = {
  bronze: {
    trophyImage: PherieliumLogoBronze,
    tierImage: PherieliumTierBronze,
    image: PherieliumTierBronze,
    glow: "drop-shadow(0 0 4px rgba(205,127,50,0.35))",
    filter: "contrast(1.02) brightness(0.95)",
    textColor: "text-[#cd7f32]",
    borderColor: "border-[#cd7f32]/60",
    bgActive: "bg-[#cd7f32]/12",
    ringActive: "ring-1 ring-[#cd7f32]/40 shadow-[0_0_18px_rgba(205,127,50,0.22)]",
  },
  silver: {
    trophyImage: PherieliumLogoSilver,
    tierImage: PherieliumTierSilver,
    image: PherieliumTierSilver,
    glow: "drop-shadow(0 0 8px rgba(226,232,240,0.45))",
    filter: "contrast(1.08) brightness(1.05)",
    textColor: "text-slate-200",
    borderColor: "border-slate-300/60",
    bgActive: "bg-slate-300/12",
    ringActive: "ring-1 ring-slate-300/40 shadow-[0_0_18px_rgba(226,232,240,0.22)]",
  },
  gold: {
    trophyImage: PherieliumLogoGold,
    tierImage: PherieliumTierGold,
    image: PherieliumTierGold,
    glow: "drop-shadow(0 0 14px rgba(251,191,36,0.65)) drop-shadow(0 0 3px rgba(255,255,255,0.4))",
    filter: "contrast(1.14) brightness(1.12)",
    textColor: "text-amber-400",
    borderColor: "border-amber-400/60",
    bgActive: "bg-amber-400/12",
    ringActive: "ring-1 ring-amber-400/40 shadow-[0_0_20px_rgba(251,191,36,0.25)]",
  },
  platinum: {
    trophyImage: PherieliumLogoPlatinum,
    tierImage: PherieliumTierPlatinum,
    image: PherieliumTierPlatinum,
    glow: "drop-shadow(0 0 18px rgba(56,189,248,0.85)) drop-shadow(0 0 6px rgba(2, 148, 245, 0.95))",
    filter: "contrast(1.22) brightness(1.2)",
    textColor: "text-[#38bdf8]",
    borderColor: "border-[#38bdf8]/60",
    bgActive: "bg-[#38bdf8]/12",
    ringActive: "ring-1 ring-[#38bdf8]/40 shadow-[0_0_22px_rgba(56,189,248,0.32)]",
  },
};

const PSNTrophyIcon = React.memo<{
  type: "platinum" | "gold" | "silver" | "bronze";
  size?: number;
  glow?: boolean;
  className?: string;
}>(({ type, size = 32, glow = false, className = "" }) => {
  const config = TIER_VISUAL_STYLES[type] || TIER_VISUAL_STYLES.bronze;

  return (
    <div className={`relative inline-flex items-center justify-center shrink-0 ${className}`}>
      <img
        src={config.trophyImage || config.image}
        alt={type}
        width={size}
        height={size}
        className="object-contain shrink-0 transition-transform duration-200"
        style={{
          width: size,
          height: size,
          filter: glow ? `${config.glow} ${config.filter}` : config.filter,
        }}
      />
    </div>
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
    <div className="relative flex flex-col items-center justify-center shrink-0 group select-none">
      {/* Luz ambiente suave e controlada atrás do emblema 3D com pulso no clique */}
      <motion.div
        className="absolute -inset-3 rounded-full blur-2xl pointer-events-none opacity-40 transition-opacity duration-300 group-hover:opacity-80"
        style={{ background: `radial-gradient(circle, ${tierInfo.gradientFrom} 0%, transparent 70%)` }}
        animate={isClicked ? { scale: [1, 1.45, 1], opacity: [0.4, 0.95, 0.4] } : {}}
        transition={{ duration: 0.35, ease: "easeOut" }}
      />

      {/* Emblema 3D Hero interativo: flutuação contínua suave no hover e contração com retorno elástico no clique */}
      <motion.div
        role="button"
        tabIndex={0}
        onClick={handleClick}
        onMouseEnter={handleMouseEnter}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
        whileHover={{
          scale: 1.08,
          y: [0, -7, 0],
          transition: {
            y: {
              repeat: Infinity,
              duration: 2.2,
              ease: "easeInOut",
            },
            scale: { type: "spring", stiffness: 400, damping: 20 },
          },
        }}
        whileTap={{
          scale: 0.86,
          transition: { type: "spring", stiffness: 700, damping: 14 },
        }}
        animate={isClicked ? { scale: [0.86, 1.12, 1] } : {}}
        transition={{ type: "spring", stiffness: 500, damping: 16 }}
        className="relative z-10 flex flex-col items-center cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/50 rounded-2xl p-1.5"
        title="Patente do jogador (Clique para interagir)"
      >
        <img
          src={config.tierImage}
          alt={tierInfo.name}
          width={88}
          height={88}
          className="object-contain shrink-0 select-none drop-shadow-2xl pointer-events-none"
          style={{
            width: 88,
            height: 88,
            filter: `${config.glow} ${config.filter}`,
          }}
        />

        {/* Efeito sutil de onda de energia ao clicar */}
        {isClicked && (
          <motion.div
            initial={{ scale: 0.7, opacity: 0.9 }}
            animate={{ scale: 1.6, opacity: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className="absolute inset-0 rounded-full border-2 pointer-events-none"
            style={{ borderColor: tierInfo.hexColor }}
          />
        )}

        {/* Pedestal / Badge discreto de Nível integrado */}
        <div className="mt-1 flex items-center gap-1 rounded-full bg-black/60 border border-white/10 px-2.5 py-0.5 backdrop-blur-md shadow-lg group-hover:border-white/25 transition-colors">
          <span className="text-[9px] font-black uppercase tracking-wider text-white/50">LV</span>
          <span className="text-xs font-black text-white leading-none tracking-tight">{level}</span>
        </div>
      </motion.div>
    </div>
  );
});

const RankProgressionRail = React.memo<{
  completionPct: number;
  currentTier: "platinum" | "gold" | "silver" | "bronze";
}>(({ completionPct, currentTier }) => {
  const nodes = useMemo(
    () => [
      { id: "bronze" as const, label: "Bronze", minPct: 0, image: PherieliumLogoBronze, color: "#cd7f32" },
      { id: "silver" as const, label: "Prata", minPct: 35, image: PherieliumLogoSilver, color: "#cbd5e1" },
      { id: "gold" as const, label: "Ouro", minPct: 65, image: PherieliumLogoGold, color: "#fbbf24" },
      { id: "platinum" as const, label: "Platina", minPct: 100, image: PherieliumLogoPlatinum, color: "#38bdf8" },
    ],
    [],
  );

  return (
    <div className="relative pt-2 pb-0.5">
      {/* Linha de progresso */}
      <div className="relative h-1.5 w-full rounded-full bg-white/[0.05] overflow-hidden">
        <div
          className="absolute inset-y-0 left-0 rounded-full transition-all duration-300"
          style={{
            width: `${Math.max(0, Math.min(100, completionPct))}%`,
            background:
              completionPct >= 100
                ? "linear-gradient(90deg, #cd7f32 0%, #cbd5e1 35%, #fbbf24 65%, #38bdf8 100%)"
                : completionPct >= 65
                  ? "linear-gradient(90deg, #cd7f32 0%, #cbd5e1 45%, #fbbf24 100%)"
                  : completionPct >= 35
                    ? "linear-gradient(90deg, #cd7f32 0%, #cbd5e1 100%)"
                    : "#cd7f32",
            boxShadow:
              completionPct >= 100
                ? "0 0 10px rgba(56,189,248,0.5)"
                : completionPct >= 65
                  ? "0 0 8px rgba(251,191,36,0.35)"
                  : undefined,
          }}
        />
      </div>

      {/* Marcadores dos Ranks na Trilha */}
      <div className="relative -mt-3 flex items-center justify-between pointer-events-none">
        {nodes.map((node) => {
          const isReached = completionPct >= node.minPct;
          const isCurrent = currentTier === node.id;

          return (
            <div key={node.id} className="flex flex-col items-center">
              <div
                className={`relative flex items-center justify-center rounded-full transition-all duration-200 ${isCurrent
                  ? "h-5 w-5 ring-2 ring-white/30 shadow-md scale-110"
                  : isReached
                    ? "h-4 w-4"
                    : "h-4 w-4 opacity-25 grayscale"
                  }`}
                style={{
                  background: isReached ? "#151719" : "#111315",
                  boxShadow: isCurrent ? `0 0 10px ${node.color}` : undefined,
                }}
              >
                <img src={node.image} alt={node.label} className="h-3 w-3 object-contain" />
              </div>
              <div className="mt-1 flex items-center gap-1">
                <span
                  className={`text-[9px] font-black uppercase tracking-wider ${isCurrent ? "text-white font-extrabold" : isReached ? "text-neutral-400" : "text-neutral-600"
                    }`}
                  style={{ color: isCurrent ? node.color : undefined }}
                >
                  {node.label}
                </span>
                <span className="text-[8px] text-neutral-600 font-medium">{node.minPct}%</span>
              </div>
            </div>
          );
        })}
      </div>
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
    const hasPlatinum = trophyCounts.platinum > 0 || completionPct >= 100;
    const hours = useMemo(() => getGamePlayedHours(game), [game]);

    const handleClick = useCallback(() => {
      onOpen?.(game);
    }, [onOpen, game]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onOpen?.(game);
        }
      },
      [onOpen, game],
    );

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

    const tierName = useMemo(() => {
      switch (gameTier) {
        case "platinum":
          return "PLATINA";
        case "gold":
          return "OURO";
        case "silver":
          return "PRATA";
        case "bronze":
        default:
          return "BRONZE";
      }
    }, [gameTier]);

    // Gradiente dinâmico com feixes de laser perimetrais duplos sincronizados (Dual Laser Beam)
    const borderBeamGradient = useMemo(() => {
      switch (gameTier) {
        case "platinum":
          return "conic-gradient(from 0deg, transparent 0deg, transparent 40deg, rgba(56,189,248,0.2) 65deg, #0284c7 85deg, #38bdf8 100deg, #ffffff 110deg, #38bdf8 120deg, transparent 135deg, transparent 220deg, rgba(56,189,248,0.2) 245deg, #0284c7 265deg, #38bdf8 280deg, #ffffff 290deg, #38bdf8 300deg, transparent 315deg, transparent 360deg)";
        case "gold":
          return "conic-gradient(from 0deg, transparent 0deg, transparent 40deg, rgba(251,191,36,0.2) 65deg, #d97706 85deg, #fbbf24 100deg, #ffffff 110deg, #fbbf24 120deg, transparent 135deg, transparent 220deg, rgba(251,191,36,0.2) 245deg, #d97706 265deg, #fbbf24 280deg, #ffffff 290deg, #fbbf24 300deg, transparent 315deg, transparent 360deg)";
        case "silver":
          return "conic-gradient(from 0deg, transparent 0deg, transparent 40deg, rgba(203,213,225,0.2) 65deg, #64748b 85deg, #cbd5e1 100deg, #ffffff 110deg, #cbd5e1 120deg, transparent 135deg, transparent 220deg, rgba(226,232,240,0.2) 245deg, #64748b 265deg, #cbd5e1 280deg, #ffffff 290deg, #cbd5e1 300deg, transparent 315deg, transparent 360deg)";
        case "bronze":
        default:
          return "conic-gradient(from 0deg, transparent 0deg, transparent 40deg, rgba(205,127,50,0.2) 65deg, #9a3412 85deg, #cd7f32 100deg, #ffedd5 110deg, #cd7f32 120deg, transparent 135deg, transparent 220deg, rgba(205,127,50,0.2) 245deg, #9a3412 265deg, #cd7f32 280deg, #ffedd5 290deg, #cd7f32 300deg, transparent 315deg, transparent 360deg)";
      }
    }, [gameTier]);

    return (
      <motion.div
        whileHover={{ y: -3, scale: 1.004 }}
        whileTap={{ scale: 0.99 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        tabIndex={0}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onMouseEnter={handleMouseEnter}
        className="group relative flex flex-col gap-4 rounded-2xl p-4 sm:p-5 transition-all duration-300 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40 shadow-[0_4px_24px_rgba(0,0,0,0.4)]"
      >
        {/* Glow ambiente externo expansivo e suave no card inteiro */}
        <div
          className="absolute -inset-1.5 sm:-inset-2 rounded-3xl blur-2xl opacity-0 group-hover:opacity-75 transition-all duration-500 pointer-events-none z-0"
          style={{
            background:
              gameTier === "platinum"
                ? "radial-gradient(ellipse at 80% 50%, rgba(56,189,248,0.38) 0%, rgba(2,132,199,0.12) 55%, transparent 75%)"
                : gameTier === "gold"
                  ? "radial-gradient(ellipse at 80% 50%, rgba(251,191,36,0.35) 0%, rgba(217,119,6,0.12) 55%, transparent 75%)"
                  : gameTier === "silver"
                    ? "radial-gradient(ellipse at 80% 50%, rgba(226,232,240,0.25) 0%, rgba(100,116,139,0.1) 55%, transparent 75%)"
                    : "radial-gradient(ellipse at 80% 50%, rgba(205,127,50,0.28) 0%, rgba(154,52,18,0.1) 55%, transparent 75%)",
          }}
        />

        {/* Halo neon exterior da borda animada (duplicado com blur de 8px para emitir rastro neon luminoso) */}
        <div className="absolute -inset-[2.5px] rounded-2xl overflow-hidden pointer-events-none opacity-0 group-hover:opacity-100 blur-[8px] transition-opacity duration-500 z-0">
          <div
            className="absolute -inset-[200%] animate-spin"
            style={{
              animationDuration: "3.5s",
              background: borderBeamGradient,
            }}
          />
        </div>

        {/* Borda Animada Luminous Nítida (1.5px) */}
        <div className="absolute -inset-[1.5px] rounded-2xl overflow-hidden pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 z-0">
          <div
            className="absolute -inset-[200%] animate-spin"
            style={{
              animationDuration: "3.5s",
              background: borderBeamGradient,
            }}
          />
        </div>

        {/* Borda estática base sutil em repouso */}
        <div className="absolute inset-0 rounded-2xl border border-white/[0.08] group-hover:border-transparent transition-colors duration-300 pointer-events-none z-0" />

        {/* Superfície interna do Card (cobre o miolo deixando a borda de 1.5px visível) */}
        <div className="absolute inset-[1.5px] rounded-[14.5px] bg-[#0E1012] group-hover:bg-[#121519] transition-colors duration-300 pointer-events-none z-0 overflow-hidden">
          {/* Efeito Sheen transversal dinâmico com brilho vívido passando no hover */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.06] to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000 ease-out pointer-events-none" />

          {/* Gradiente sutil no topo do card dando profundidade de vidro fosco */}
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-white/[0.03] to-transparent pointer-events-none" />
        </div>


        {/* Linha Superior: Cover + Info no lado esquerdo | Patente 3D Hero no lado direito */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          {/* LADO ESQUERDO: Mini-Poster + Metadados limpos */}
          <div className="flex items-center gap-4 min-w-0 flex-1">
            <div className="relative shrink-0 group/cover">
              {/* Luz ambiente suave atrás da capa */}
              <div
                className="absolute -inset-1 rounded-xl blur-md opacity-25 group-hover/cover:opacity-45 transition-opacity pointer-events-none"
                style={{
                  background: hasPlatinum
                    ? "radial-gradient(circle, rgba(56,189,248,0.4) 0%, transparent 70%)"
                    : "radial-gradient(circle, rgba(255,255,255,0.15) 0%, transparent 70%)",
                }}
              />
              <div className="relative w-16 h-22 sm:w-[66px] sm:h-[90px] rounded-xl overflow-hidden border border-white/10 bg-neutral-900 shadow-md">
                {game.cardImage || game.image ? (
                  <img
                    src={game.cardImage || game.image}
                    alt=""
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-neutral-800 text-white/30 text-xs font-bold">
                    {game.title?.slice(0, 2).toUpperCase()}
                  </div>
                )}
                {/* Highlight interno e vinheta */}
                <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-xl pointer-events-none" />
              </div>
            </div>

            <div className="min-w-0 flex-1 space-y-1.5">
              <h3
                className={`truncate text-base sm:text-lg font-black transition-colors ${hasPlatinum ? "text-white group-hover:text-[#7dd3fc]" : "text-neutral-100 group-hover:text-white"
                  }`}
              >
                {game.title}
              </h3>

              {/* Metadados elegantes sem excesso de pílulas */}
              <div className="flex items-center gap-2 text-xs text-neutral-400 flex-wrap">
                <span className="font-semibold text-neutral-300">{launcherLabel}</span>
                {hours > 0 && (
                  <>
                    <span className="text-neutral-600">•</span>
                    <span className="flex items-center gap-1 font-medium text-neutral-400">
                      <Clock className="h-3 w-3 text-neutral-500" /> {formatPlayedHours(hours)}h
                    </span>
                  </>
                )}
                {trophyCounts.points ? (
                  <>
                    <span className="text-neutral-600">•</span>
                    <span className="flex items-center gap-1 font-bold text-amber-400/90">
                      <Zap className="h-3 w-3 text-amber-400" /> +{trophyCounts.points} XP
                    </span>
                  </>
                ) : null}
              </div>
            </div>
          </div>

          {/* LADO DIREITO: Insígnia 3D Hero Flutuante + Status Semântico */}
          <div className="flex items-center justify-between sm:justify-end gap-5 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-white/5">
            <div className="flex items-center gap-3.5">
              {/* Emblema 3D Flutuante (sem caixa quadrada) */}
              <div className="relative flex items-center justify-center shrink-0">
                <div
                  className="absolute -inset-3 rounded-full blur-xl pointer-events-none opacity-40 group-hover:opacity-95 group-hover:scale-125 transition-all duration-500"
                  style={{
                    background:
                      gameTier === "platinum"
                        ? "radial-gradient(circle, rgba(56,189,248,0.55) 0%, rgba(2,132,199,0.2) 60%, transparent 80%)"
                        : gameTier === "gold"
                          ? "radial-gradient(circle, rgba(251,191,36,0.5) 0%, rgba(217,119,6,0.2) 60%, transparent 80%)"
                          : gameTier === "silver"
                            ? "radial-gradient(circle, rgba(226,232,240,0.35) 0%, rgba(100,116,139,0.15) 60%, transparent 80%)"
                            : "radial-gradient(circle, rgba(205,127,50,0.4) 0%, rgba(154,52,18,0.15) 60%, transparent 80%)",
                  }}
                />
                <img
                  src={tierStyle.trophyImage}
                  alt={tierName}
                  width={64}
                  height={64}
                  className="object-contain shrink-0 transition-transform duration-300 group-hover:scale-110 group-hover:-translate-y-1 select-none"
                  style={{
                    width: 64,
                    height: 64,
                    filter: `${tierStyle.glow} ${tierStyle.filter}`,
                  }}
                />
              </div>

              {/* Status da Patente */}
              <div className="flex flex-col items-start min-w-[110px]">
                <span className={`text-xs font-black tracking-widest uppercase ${tierStyle.textColor}`}>
                  {tierName}
                </span>
                <span className={`text-sm font-black tracking-tight ${hasPlatinum ? "text-[#38bdf8]" : "text-white"}`}>
                  {completionPct === 100 ? "100% Concluído" : `${completionPct}% Concluído`}
                </span>
                <span className="text-[10px] text-neutral-400 font-medium">
                  {completionPct === 100
                    ? `${trophyCounts.total} de ${trophyCounts.total} marcos`
                    : `${trophyCounts.completed} de ${trophyCounts.total} marcos`}
                </span>
              </div>
            </div>

            <ChevronRight
              className={`h-4 w-4 transition-transform duration-200 group-hover:translate-x-1 ${hasPlatinum ? "text-[#38bdf8]" : "text-neutral-500 group-hover:text-white"
                }`}
            />
          </div>
        </div>

        {/* Linha Inferior: Trilha Visual de Progressão de Patentes (Rank Progression Rail) */}
        <div className="relative z-10 pt-1">
          <RankProgressionRail completionPct={completionPct} currentTier={gameTier} />
        </div>
      </motion.div>
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

  return (
    <motion.div
      ref={scrollRef}
      data-system-page="trophies"
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", bounce: 0, duration: 0.4 }}
      className="relative min-h-0 flex-1 overflow-y-auto thin-scrollbar px-10 pb-16 pt-8 text-white font-sans"
      style={{ contain: "layout paint", transform: "translate3d(0,0,0)", willChange: "transform" }}
    >
      <div className="mx-auto mb-8 w-full max-w-5xl">
        <h1
          className="font-display font-black bg-gradient-to-b from-[#FFFFFF] to-[#8A8A8A] bg-clip-text text-transparent leading-[1.08]"
          style={{ fontSize: "clamp(28px, 4vw, 40px)", letterSpacing: "-0.02em" }}
        >
          Troféus
        </h1>
        <p className="mt-2 max-w-2xl text-sm font-body leading-relaxed text-white/50">
          Gerencie suas conquistas e monitore o seu progresso rumo à platina.
        </p>
      </div>

      <div className="mx-auto max-w-5xl space-y-7">
        {/* Banner PlayStation PSN Level */}
        <section className="relative rounded-3xl border border-white/[0.08] p-6 sm:p-8 shadow-[0_32px_64px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.12)] overflow-hidden bg-[#0B0B0B]">

          <div
            className="absolute -top-32 -left-32 w-80 h-80 rounded-full blur-[100px] opacity-25 pointer-events-none transition-all duration-700"
            style={{ background: tierInfo.gradientFrom }}
          />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
            {/* Patente & Progresso (Unidade Hero) */}
            <div className="flex items-center gap-6 min-w-0">
              <PSNTierBadge
                tier={levelInfo.tier}
                subTier={levelInfo.subTier}
                level={levelInfo.level}
                playSound={playSound}
              />
              <div className="min-w-0 flex-1 space-y-2.5">
                <div className="flex items-center gap-3">
                  <h2 className={`text-2xl sm:text-3xl font-black tracking-tight ${tierInfo.color}`}>
                    {levelInfo.tierName}
                  </h2>
                  <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-widest text-neutral-300">
                    PATENTE ATUAL
                  </span>
                </div>

                <div className="space-y-1.5 max-w-sm">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="text-white font-bold">{levelInfo.currentLevelXp} / {levelInfo.xpForNextLevel} XP</span>
                      {levelInfo.level < 999 && (
                        <>
                          <span className="text-neutral-500 font-normal">•</span>
                          <span className="text-amber-400 font-bold truncate">
                            Faltam {nextGoal}
                          </span>
                        </>
                      )}
                    </div>
                    <span className={`font-black ml-2 shrink-0 ${tierInfo.color}`}>{levelInfo.progress}%</span>
                  </div>

                  <div className="relative h-2 w-full rounded-full bg-neutral-800/80 overflow-hidden border border-white/5 shadow-inner">
                    <motion.div
                      className="absolute inset-y-0 left-0 rounded-full"
                      style={{
                        background: `linear-gradient(90deg, ${tierInfo.gradientFrom}, ${tierInfo.gradientTo})`,
                        boxShadow: `0 0 10px ${tierInfo.gradientFrom}`,
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${levelInfo.progress}%` }}
                      transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    />
                  </div>
                </div>

                {/* Total Acumulado com peso visual reduzido */}
                <div className="flex items-center gap-1.5 text-[11px] font-medium text-neutral-500">
                  <span>Total acumulado:</span>
                  <span className="text-neutral-300 font-semibold flex items-center gap-1">
                    <Zap className="h-3 w-3 text-amber-400/80" />
                    {levelInfo.xp.toLocaleString()} XP
                  </span>
                </div>
              </div>
            </div>

            {/* Progression Ladder (Escalada de Troféus por Patente) */}
            <div className="flex flex-col gap-2.5 rounded-3xl border border-white/[0.08] p-3.5 sm:p-4 shrink-0 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] bg-[#0B0B0B]">

              <div className="flex items-center justify-between px-1 text-[10px] font-extrabold uppercase tracking-widest text-neutral-400">
                <span>Escalada de Troféus</span>
                <span className="text-neutral-500 font-medium">Total: {totalStats.unlocked} troféus</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { type: "bronze" as const, label: "Bronze", xp: 15, count: totalStats.bronze },
                  { type: "silver" as const, label: "Prata", xp: 30, count: totalStats.silver },
                  { type: "gold" as const, label: "Ouro", xp: 90, count: totalStats.gold },
                  { type: "platinum" as const, label: "Platina", xp: 300, count: totalStats.platinum },
                ].map((item) => {
                  const isCurrentTier = levelInfo.tier === item.type;
                  const style = TIER_VISUAL_STYLES[item.type];

                  return (
                    <div
                      key={item.type}
                      className={`relative flex flex-col items-center justify-center p-3 rounded-xl transition-all group min-w-[78px] ${isCurrentTier
                        ? `${style.borderColor} ${style.bgActive} ${style.ringActive}`
                        : "border border-white/5 bg-white/[0.02] opacity-75 hover:opacity-100 hover:border-white/15"
                        }`}
                    >
                      {isCurrentTier && (
                        <span className="absolute -top-2 rounded-full bg-amber-400 text-black px-1.5 py-0.2 text-[8px] font-black uppercase tracking-wider shadow-sm">
                          Atual
                        </span>
                      )}

                      <PSNTrophyIcon type={item.type} size={36} glow={isCurrentTier || item.count > 0} />
                      <div className="mt-1.5 flex items-baseline gap-1">
                        <span className={`text-lg font-black tabular-nums ${style.textColor}`}>
                          {item.count}
                        </span>
                        <span className="text-[10px] font-semibold text-neutral-400">troféus</span>
                      </div>
                      <span className="text-[9px] font-bold uppercase tracking-wider text-white/40 group-hover:text-white/70 transition-colors text-center">
                        {item.label} ({item.xp})
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        {/* Controles de Filtros e Busca */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 py-1">
          <div className="flex items-center gap-1.5 p-1 rounded-3xl border border-white/[0.08] overflow-x-auto shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] bg-[#0B0B0B]">

            {filterTabs.map((f) => (
              <motion.button
                key={f.id}
                whileTap={{ scale: 0.95 }}
                onClick={() => handleFilterSelect(f.id)}
                onMouseEnter={() => playSound?.("hover")}
                className={`flex items-center gap-2 rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer whitespace-nowrap focus-visible:ring-2 focus-visible:ring-white/50 outline-none ${filter === f.id
                  ? "bg-white text-black shadow-md"
                  : "bg-transparent text-neutral-400 hover:text-white hover:bg-white/5"
                  }`}
              >
                <span>{f.label}</span>
                <span
                  className={`rounded-full px-1.5 py-0.2 text-[10px] font-extrabold ${filter === f.id ? "bg-black/10 text-black" : "bg-white/10 text-white/60"
                    }`}
                >
                  {f.count}
                </span>
              </motion.button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            {/* Filtro de Ordenação */}
            <div className="relative" ref={sortRef}>
              <button
                onClick={() => setIsSortOpen((prev) => !prev)}
                onMouseEnter={() => playSound?.("hover")}
                className="flex items-center gap-2 rounded-2xl border border-white/10 bg-neutral-900/60 px-3.5 py-2 text-xs font-bold text-neutral-300 transition-all hover:border-white/20 hover:text-white cursor-pointer"
                title="Ordenar jogos"
              >
                <ArrowUpDown className="h-3.5 w-3.5 text-neutral-400" />
                <span>{sortOptions.find((opt) => opt.value === sortBy)?.label || "Maior %"}</span>
              </button>

              {isSortOpen && (
                <div className="absolute right-0 top-full mt-2 w-44 rounded-2xl border border-white/10 bg-[#0B0B0B] shadow-xl overflow-hidden z-20">
                  {sortOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        playSound?.("select");
                        setSortBy(opt.value);
                        setIsSortOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${sortBy === opt.value
                        ? "bg-white/10 text-white font-bold"
                        : "text-neutral-400 hover:bg-white/5 hover:text-white"
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Filtro por Plataforma */}
            <div className="relative" ref={platFilterRef}>
              <button
                onClick={() => setIsPlatformFilterOpen((prev) => !prev)}
                onMouseEnter={() => playSound?.("hover")}
                className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-xs font-bold transition-all cursor-pointer ${filterByPlat !== "all"
                  ? "border-[#38bdf8]/40 bg-[#38bdf8]/10 text-[#38bdf8]"
                  : "border-white/10 bg-neutral-900/60 text-neutral-300 hover:border-white/20 hover:text-white"
                  }`}
                title="Filtrar por plataforma"
              >
                <Filter className="h-3.5 w-3.5" />
                {filterByPlat !== "all" && (
                  <span className="rounded-full bg-[#38bdf8]/20 px-1.5 text-[10px]">1</span>
                )}
              </button>

              {isPlataformFilterOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 rounded-2xl border border-white/10 bg-[#0B0B0B] shadow-xl overflow-hidden z-20">
                  {platformOptions.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={() => {
                        playSound?.("select");
                        setFilterByPlat(opt.value);
                        setIsPlatformFilterOpen(false);
                      }}
                      className={`w-full text-left px-4 py-2.5 text-xs font-semibold transition-colors cursor-pointer ${filterByPlat === opt.value
                        ? "bg-white/10 text-white font-bold"
                        : "text-neutral-400 hover:bg-white/5 hover:text-white"
                        }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="relative group">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-500 transition-colors group-focus-within:text-white" />
              <input
                type="text"
                value={searchTerm}
                onChange={handleSearchChange}
                placeholder="Buscar jogos..."
                className="h-10 w-56 sm:w-64 rounded-2xl border border-white/10 bg-neutral-900/60 pl-10 pr-8 text-xs font-medium text-white placeholder:text-neutral-500 outline-none transition-all focus:border-white/30"
              />
              {searchTerm && (
                <button
                  onClick={handleClearSearch}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white p-0.5 transition-colors cursor-pointer"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Lista de Jogos Memoizada */}
        <div className="space-y-3">
          {renderedGameRows}

          {filteredGames.length === 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-24 text-center rounded-3xl border border-white/5 bg-black/20"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-white/10 bg-white/5 mb-4">
                <Trophy className="h-8 w-8 text-neutral-500" strokeWidth={1.5} />
              </div>
              <h3 className="text-base font-bold text-neutral-300">
                {filter === "platinum"
                  ? "Nenhum jogo platinado ainda"
                  : filter === "in-progress"
                    ? "Nenhum jogo em progresso no momento"
                    : filter === "not-started"
                      ? "Você já iniciou todos os seus jogos!"
                      : "Nenhum jogo encontrado"}
              </h3>
              <p className="text-xs text-neutral-500 mt-1 max-w-sm">
                {filter === "platinum"
                  ? "Complete 100% das conquistas de um jogo para conquistar seu troféu de Platina!"
                  : "Tente alterar os filtros de busca para ver seus outros jogos e troféus."}
              </p>
            </motion.div>
          )}
        </div>

        {/* InputHints oficial do sistema (Imagem 2) */}
        <div className="pt-6 pb-2 flex justify-end">
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
      </div>
    </motion.div>
  );
};

export default React.memo(TrophiesPage);

