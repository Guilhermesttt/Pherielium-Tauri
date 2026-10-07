import React from "react";
import { motion } from "framer-motion";
import type { Game } from "../../types/domain";
import type { GameDetailCopy } from "../../types/gameDetail";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import { HorizontalTabs } from "../ui/HorizontalTabs";

interface GameDetailHeaderProps {
  game: Game;
  coverImage: string;
  platformLabel: string;
  localizedCategory: string;
  isRunning: boolean;
  activeTab: string;
  tabs: string[];
  copy: GameDetailCopy;
  actionsSlot: React.ReactNode;
  onTabChange: (tab: string) => void;
  playSound: (type: SoundEffectType) => void;
}


export const GameDetailHeader: React.FC<GameDetailHeaderProps> = React.memo(({
  game,
  coverImage,
  platformLabel,
  localizedCategory,
  isRunning,
  activeTab,
  tabs,
  copy,
  actionsSlot,
  onTabChange,
  playSound,
}) => {
  return (
    <>
      {/* Header (Capa + Título + Badges + Botão Jogar) */}
      <div className="flex flex-col sm:flex-row items-start sm:items-end gap-6 sm:gap-8 mb-8">
        <div className="w-28 sm:w-32 h-40 sm:h-44 rounded-3xl overflow-hidden shrink-0 border border-white/10 -mt-24 relative z-20 bg-black shadow-[0_20px_50px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.12)]">
          <img
            src={coverImage || undefined}
            alt={game.title}
            className="w-full h-full object-cover"
          />
        </div>

        <div className="flex-1 min-w-0 pb-2">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <h1
              title={game.title}
              className="text-2xl sm:text-4xl md:text-5xl font-display font-bold tracking-tight text-white mb-3 leading-[1.1] whitespace-nowrap truncate"
            >
              {game.title}
            </h1>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-[10px] font-semibold tracking-wider text-white/80 uppercase shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
                {platformLabel}
              </span>
              {localizedCategory && localizedCategory.toUpperCase() !== platformLabel.toUpperCase() && (
                <span className="inline-flex items-center px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-[10px] font-semibold tracking-wider text-white/50 uppercase shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
                  {localizedCategory}
                </span>
              )}
              {isRunning && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-semibold tracking-wider text-emerald-400 uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {copy.running}
                </span>
              )}
            </div>
          </motion.div>
        </div>

        {/* Slot de Ação (Botão Jogar na lateral direita alinhado à base) */}
        <div className="shrink-0 w-full sm:w-[220px] pb-2">
          {actionsSlot}
        </div>
      </div>

      {/* Abas de Navegação */}
      <div className="mb-10 overflow-x-auto hide-scrollbar">
        <HorizontalTabs
          activeId={activeTab}
          onChange={(id) => {
            onTabChange(id);
            playSound("navigate");
          }}
          className="!bg-transparent !p-0 gap-1 sm:gap-2 mb-2"
          tabClassName="relative px-4 py-2 rounded-full text-[12px] font-semibold tracking-wide uppercase transition-all shrink-0 !h-auto"
          tabs={tabs.map(tabKey => {
            const isActive = activeTab === tabKey;
            return {
              id: tabKey,
              label: <div>{tabKey}</div>
            };
          })}
        />
      </div>
    </>
  );
});

GameDetailHeader.displayName = "GameDetailHeader";
