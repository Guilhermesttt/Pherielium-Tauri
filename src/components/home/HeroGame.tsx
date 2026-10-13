import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Trophy, Star } from "lucide-react";
import type { Game } from "../../types/domain";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import { formatPlayedHours, getGamePlayedHours } from "../../utils/playtime";

export interface HeroGameProps {
  game?: Game | null;
  isRunning?: boolean;
  platformInfo?: {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  } | null;
  onOpenDetails: (game: Game) => void;
  playSound?: (type: SoundEffectType) => void;
  runningLabel?: string;
}

export const HeroGame: React.FC<HeroGameProps> = React.memo(({
  game,
  isRunning = false,
  platformInfo,
  onOpenDetails,
  playSound,
  runningLabel = "Em execução",
}) => {
  if (!game) return null;

  const hours = getGamePlayedHours(game);
  const formattedHours = hours > 0 ? `${formatPlayedHours(hours)}h` : "0h";

  const handleDetailsClick = () => {
    playSound?.("select");
    onOpenDetails(game);
  };

  // Escala óptica para títulos longos caberem integralmente em uma única linha
  // sem quebra: fator aplicado sobre --fs-hero, que já é fluido por resolução.
  const titleFontSize = React.useMemo(() => {
    const len = game.title?.length || 0;
    const factor = len > 28 ? 0.52 : len > 18 ? 0.68 : 1;
    return `calc(var(--fs-hero) * ${factor})`;
  }, [game.title]);

  return (
    <div className="relative w-full flex-1 px-[var(--safe-x)] select-none flex flex-col justify-end min-h-[var(--hero-min-h)]">
      <AnimatePresence mode="wait">
        <motion.div
          key={game.id}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.38, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-[var(--gap-stack)] w-full max-w-[92vw] lg:max-w-[85vw]"
        >
          {/* 1. Título. Jogar e detalhes ficam no controle (A / clique no título) e nos cards. */}
          <div className="flex w-full items-end">
            <h1
              onClick={handleDetailsClick}
              title={game.title}
              style={{ fontSize: titleFontSize }}
              className="min-w-0 flex-1 cursor-pointer tracking-[-0.04em] font-display font-semibold text-[var(--ink)] leading-[1.05] whitespace-nowrap truncate drop-shadow-[0_8px_30px_var(--elev-shadow-color)] hover:opacity-95 transition-opacity"
            >
              {game.title}
            </h1>
          </div>

          {/* 2. Estatísticas e plataforma */}
          <div className="flex items-center gap-[var(--gap-inline)] flex-wrap text-[length:var(--fs-caption)] text-[var(--ink)] font-medium">
            {isRunning && (
              <span className="inline-flex h-[var(--control-h)] shrink-0 items-center gap-1.5 rounded-[var(--node)] bg-[color-mix(in_srgb,var(--tone-1)_88%,transparent)] px-4 text-[var(--ink)]">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--live)] opacity-60 motion-reduce:hidden" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--live)]" />
                </span>
                <span className="font-semibold">{runningLabel}</span>
              </span>
            )}

            {platformInfo && (
              <span className="inline-flex h-[var(--control-h)] shrink-0 items-center gap-1.5 rounded-[var(--node)] bg-[color-mix(in_srgb,var(--tone-1)_88%,transparent)] px-4">
                <platformInfo.icon className="w-3.5 h-3.5 text-[var(--ink)] shrink-0" />
                <span className="font-semibold text-[var(--ink)]">{platformInfo.label}</span>
              </span>
            )}

            <span className="inline-flex h-[var(--control-h)] shrink-0 items-center gap-1.5 rounded-[var(--node)] bg-[color-mix(in_srgb,var(--tone-1)_88%,transparent)] px-4">
              <Clock className="w-3.5 h-3.5 text-[var(--ink-muted)] shrink-0" />
              <span>{formattedHours} jogadas</span>
            </span>

            {Boolean(game.totalAchievements && game.totalAchievements > 0) && (
              <span className="inline-flex h-[var(--control-h)] shrink-0 items-center gap-1.5 rounded-[var(--node)] bg-[color-mix(in_srgb,var(--tone-1)_88%,transparent)] px-4">
                <Trophy className="w-3.5 h-3.5 text-amber-300 shrink-0" />
                <span>
                  {game.completedAchievements || 0}/{game.totalAchievements} Conquistas
                </span>
              </span>
            )}

            {game.isFavorite && (
              <span className="inline-flex h-[var(--control-h)] shrink-0 items-center gap-1.5 rounded-[var(--node)] bg-[color-mix(in_srgb,var(--tone-1)_88%,transparent)] px-4 text-[var(--ink)]">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                <span className="font-semibold">Favorito</span>
              </span>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
});

HeroGame.displayName = "HeroGame";
export default HeroGame;
