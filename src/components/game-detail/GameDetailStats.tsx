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
  game,
  achievementsUnlocked,
  achievementsTotal,
  formattedHours,
  lastSession,
  hasEpicLaunchShortcut,
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
            <span
              className="text-3xl sm:text-5xl font-black text-white tracking-tighter"
            >
              {achievementsUnlocked}
            </span>
            <span className="text-sm font-bold text-white/35 uppercase tracking-widest">
              / {achievementsTotal} {copy.achievements}
            </span>
          </div>

          <div className="w-px h-12 bg-[var(--color-surface)] shrink-0 hidden sm:block" />

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-black text-white/35 uppercase tracking-[0.28em]">
              {copy.timePlayed}
            </span>
            <span className="text-xl font-black text-white/90 tracking-tight">
              {formattedHours}
            </span>
          </div>

          <div className="w-px h-12 bg-[var(--color-surface)] shrink-0 hidden sm:block" />

          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-black text-white/35 uppercase tracking-[0.28em]">
              {copy.lastSession}
            </span>
            <span className="text-xl font-black text-white/90 tracking-tight">
              {lastSession}
            </span>
          </div>
        </div>

        {/* Barra de Progresso Suave */}
        {achievementsTotal > 0 && (
          <div className="w-full h-[3px] rounded-full bg-[var(--color-surface)] overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-white/60"
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1], delay: 0.2 }}
            />
          </div>
        )}
      </div>

      {/* Tags de Metadados / Fonte */}
      <div className="inline-flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-2xl bg-[var(--color-surface)] border border-[var(--color-ui-detail)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] self-start"
        style={{
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
        }}>
        {game.launcherType === "steam" && (
          <span className="text-[10px] font-black text-white/35 uppercase tracking-[0.22em]">
            {copy.appId}{" "}
            <span className="text-white/80 ml-1.5">{game.steamAppId || "---"}</span>
          </span>
        )}
        {game.launcherType === "epic" && (
          <span className="text-[10px] font-black text-white/35 uppercase tracking-[0.22em]">
            {copy.epicShortcutLabel}{" "}
            <span className="text-white/80 ml-1.5">
              {hasEpicLaunchShortcut ? copy.epicShortcut : copy.epicStore}
            </span>
          </span>
        )}
        {(game.launcherType === "steam" || game.launcherType === "epic") && (
          <span className="h-3 w-px bg-white/10" />
        )}
        <span className="text-[10px] font-black text-white/35 uppercase tracking-[0.22em]">
          {copy.source}{" "}
          <span className="text-white/80 ml-1.5">
            {game.source === "steam"
              ? copy.sourceSteamSync
              : game.source === "epic"
                ? copy.sourceEpicCatalog
                : copy.sourceManual}
          </span>
        </span>
      </div>
    </div>
  );
});

GameDetailStats.displayName = "GameDetailStats";
