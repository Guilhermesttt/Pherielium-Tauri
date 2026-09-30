import React from "react";
import { motion } from "framer-motion";
import type { Game } from "../../types/domain";
import type { GameDetailCopy } from "../../types/gameDetail";

interface GameDetailStatsProps {
  game: Game;
  achievementsUnlocked: number;
  achievementsTotal: number;
  formattedHours: string;
  lastSession: string;
  hasEpicLaunchShortcut: boolean;
  copy: GameDetailCopy;
}

export const GameDetailStats: React.FC<GameDetailStatsProps> = React.memo(({
  achievementsUnlocked,
  achievementsTotal,
  formattedHours,
  lastSession,
  copy,
}) => {
  const percent = achievementsTotal > 0
    ? Math.min(100, (achievementsUnlocked / achievementsTotal) * 100)
    : 0;

  return (
    <div className="flex flex-col gap-6 w-full">
      {/* Bloco de Métricas Principais */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-4 sm:gap-8">
          <div className="flex items-baseline gap-2">
            <span className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              {achievementsUnlocked}
            </span>
            <span className="text-xs font-semibold text-white/40 uppercase tracking-wider">
              / {achievementsTotal} {copy.achievements}
            </span>
          </div>

          <div className="w-px h-10 bg-white/10 shrink-0 hidden sm:block" />

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              {copy.timePlayed}
            </span>
            <span className="text-lg sm:text-xl font-semibold text-white/95 tracking-tight">
              {formattedHours}
            </span>
          </div>

          <div className="w-px h-10 bg-white/10 shrink-0 hidden sm:block" />

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-semibold text-white/40 uppercase tracking-wider">
              {copy.lastSession}
            </span>
            <span className="text-lg sm:text-xl font-semibold text-white/95 tracking-tight">
              {lastSession}
            </span>
          </div>
        </div>

        {/* Barra de Progresso Suave */}
        {achievementsTotal > 0 && (
          <div className="w-full h-1 rounded-full bg-white/10 overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-white/80"
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            />
          </div>
        )}
      </div>
    </div>
  );
});

GameDetailStats.displayName = "GameDetailStats";
