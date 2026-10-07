import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Clock, Trophy, Star, Sparkles } from "lucide-react";
import type { Game } from "../../types/domain";
import type { GamepadFamily } from "../../context/GamepadContext";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import { ControllerButtonGlyph } from "../ui/ControllerButtonGlyph";
import { formatPlayedHours, getGamePlayedHours } from "../../utils/playtime";

export interface HeroGameProps {
  game?: Game | null;
  isRunning?: boolean;
  platformInfo?: {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  } | null;
  isGamepadConnected?: boolean;
  gamepadFamily?: GamepadFamily;
  onPlay: (game: Game) => void;
  onOpenDetails: (game: Game) => void;
  onToggleFavorite?: (game: Game) => void;
  playSound?: (type: SoundEffectType) => void;
  playNowLabel?: string;
  runningLabel?: string;
}

export const HeroGame: React.FC<HeroGameProps> = React.memo(({
  game,
  isRunning = false,
  platformInfo,
  isGamepadConnected = false,
  gamepadFamily = "xbox",
  onPlay,
  onOpenDetails,
  onToggleFavorite,
  playSound,
  playNowLabel = "Jogar Agora",
  runningLabel = "Em execução",
}) => {
  if (!game) return null;

  const hours = getGamePlayedHours(game);
  const formattedHours = hours > 0 ? `${formatPlayedHours(hours)}h` : "0h";

  const handleLaunchClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    playSound?.("play");
    onPlay(game);
  };

  const handleDetailsClick = () => {
    playSound?.("select");
    onOpenDetails(game);
  };

  // Escala óptica para títulos longos caberem integralmente em uma única linha sem quebra
  const titleSizeClass = React.useMemo(() => {
    const len = game.title?.length || 0;
    if (len > 34) return "text-2xl sm:text-3xl md:text-4xl lg:text-5xl";
    if (len > 22) return "text-2xl sm:text-4xl md:text-5xl lg:text-6xl";
    return "text-3xl sm:text-5xl md:text-6xl lg:text-7xl";
  }, [game.title]);

  return (
    <div className="relative w-full px-8 sm:px-12 pt-2 sm:pt-4 pb-4 sm:pb-6 select-none flex flex-col justify-end min-h-[190px] sm:min-h-[230px]">
      <AnimatePresence mode="wait">
        <motion.div
          key={game.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-3.5 w-full max-w-[92vw] lg:max-w-[85vw]"
        >
          {/* 1. Cinematic Title Card (uma linha só sem quebra) */}
          <div className="flex flex-col min-w-0">
            <h1
              onClick={handleDetailsClick}
              title={game.title}
              className={`cursor-pointer tracking-tight font-display font-black ${titleSizeClass} bg-gradient-to-b from-[#FFFFFF] via-[#F4F4F6] to-[#A0A0A5] bg-clip-text text-transparent leading-[1.1] whitespace-nowrap truncate drop-shadow-[0_8px_30px_rgba(0,0,0,0.85)] hover:opacity-95 transition-opacity`}
            >
              {game.title}
            </h1>
          </div>

          {/* 2. Metadata Stack (Platform, Playtime, Achievements, Favorites) */}
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap text-xs text-white/80 font-medium">
            {platformInfo && (
              <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3.5 backdrop-blur-xl shadow-sm">
                <platformInfo.icon className="w-3.5 h-3.5 text-white/90 shrink-0" />
                <span className="font-semibold text-white/90">
                  {platformInfo.label}
                </span>
              </span>
            )}

            <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3.5 backdrop-blur-xl shadow-sm">
              <Clock className="w-3.5 h-3.5 text-white/60 shrink-0" />
              <span>{formattedHours} jogadas</span>
            </span>

            {Boolean(game.totalAchievements && game.totalAchievements > 0) && (
              <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-black/40 px-3.5 backdrop-blur-xl shadow-sm">
                <Trophy className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>
                  {game.completedAchievements || 0}/{game.totalAchievements} Conquistas
                </span>
              </span>
            )}

            {game.isFavorite && (
              <span className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-500/15 px-3 text-amber-300 backdrop-blur-xl shadow-sm">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                <span className="font-semibold">Favorito</span>
              </span>
            )}
          </div>

          {/* 3. Primary Action Button [ ▶ JOGAR AGORA ] */}
          <div className="flex items-center gap-4 mt-2">
            <motion.button
              type="button"
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.96 }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.25 }}
              onClick={handleLaunchClick}
              className={`flex items-center gap-3 px-8 sm:px-10 py-3.5 rounded-2xl font-display font-extrabold text-sm sm:text-base tracking-wider uppercase shadow-[0_8px_30px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.35)] transition-all cursor-pointer ${
                isRunning
                  ? "bg-emerald-600/80 text-emerald-100 border border-emerald-400/50 shadow-[0_0_28px_rgba(16,185,129,0.4)]"
                  : "bg-white text-black hover:bg-[#F2F2F2]"
              }`}
            >
              {isGamepadConnected ? (
                <ControllerButtonGlyph
                  button="A"
                  gamepadFamily={gamepadFamily}
                  size={20}
                />
              ) : isRunning ? (
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400" />
                </span>
              ) : (
                <Play className="w-4 h-4 fill-black text-black shrink-0" />
              )}

              <span>{isRunning ? runningLabel : playNowLabel}</span>
            </motion.button>

            {/* Botão Secundário: Ver Detalhes */}
            <button
              type="button"
              onClick={handleDetailsClick}
              className="flex items-center gap-2 px-5 py-3.5 rounded-2xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/10 hover:border-white/25 text-white/80 hover:text-white text-xs font-bold uppercase tracking-wider backdrop-blur-xl transition-all cursor-pointer"
            >
              <span>Detalhes</span>
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
});

HeroGame.displayName = "HeroGame";
export default HeroGame;
