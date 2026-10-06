import React from "react";
import { motion } from "framer-motion";
import { Play, Settings, Gamepad2, Star } from "lucide-react";
import type { Game } from "../../types/domain";
import type { GameDetailCopy } from "../../types/gameDetail";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import type { GamepadFamily } from "../../context/GamepadContext";
import { ControllerButtonGlyph } from "../ui/ControllerButtonGlyph";

interface GameDetailSteamActionBarProps {
  game: Game;
  isLaunching: boolean;
  isRunning: boolean;
  launchError: string | null;
  formattedHours: string;
  lastSession: string;
  isFavorite?: boolean;
  isGamepadConnected?: boolean;
  gamepadFamily?: GamepadFamily;
  copy: GameDetailCopy;
  onLaunch: () => void;
  onToggleFavorite?: () => void;
  onEditGame?: () => void;
  playSound: (type: SoundEffectType) => void;
}

export const GameDetailSteamActionBar: React.FC<GameDetailSteamActionBarProps> = React.memo(({
  game,
  isLaunching,
  isRunning,
  launchError,
  formattedHours,
  lastSession,
  isFavorite = false,
  isGamepadConnected = false,
  gamepadFamily = "xbox",
  copy,
  onLaunch,
  onToggleFavorite,
  onEditGame,
  playSound,
}) => {
  return (
    <div className="w-full select-none flex flex-col gap-3">
      <div className="w-full flex flex-wrap items-center justify-between gap-6 py-4 border-b border-white/[0.08]">
        {/* Left Side: Big Play Button + Session / Playtime Info */}
        <div className="flex flex-wrap items-center gap-6 sm:gap-8">
          {/* Primary Action Button (White Editorial Pill with Dynamic Shimmer Sheen) */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            transition={{ type: "spring", bounce: 0.2, duration: 0.25 }}
            onClick={() => {
              if (isLaunching || isRunning) return;
              playSound("play");
              onLaunch();
            }}
            disabled={isLaunching || isRunning}
            className={`group relative overflow-hidden flex items-center gap-3 px-8 sm:px-10 py-3.5 rounded-2xl font-display font-black text-sm sm:text-base tracking-wider uppercase transition-all cursor-pointer ${
              isRunning
                ? "bg-emerald-600/80 text-emerald-100 border border-emerald-400/50 shadow-[0_0_28px_rgba(16,185,129,0.4)]"
                : isLaunching
                  ? "bg-white/90 text-black shadow-lg"
                  : "bg-white text-black hover:bg-[#F2F2F2] shadow-[0_8px_30px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.4)] hover:shadow-[0_12px_36px_rgba(255,255,255,0.2),inset_0_1px_0_rgba(255,255,255,0.6)]"
            }`}
          >
            {/* Luminous Shimmer Sheen Effect */}
            {!isRunning && (
              <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/50 to-transparent" />
            )}

            {isGamepadConnected ? (
              <ControllerButtonGlyph button="A" gamepadFamily={gamepadFamily} size={20} />
            ) : isRunning ? (
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-400" />
              </span>
            ) : isLaunching ? (
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-spin inline-flex h-3 w-3 rounded-full border-2 border-black border-t-transparent" />
              </span>
            ) : (
              <Play className="w-4 h-4 fill-black text-black shrink-0" />
            )}
            <span className="relative z-10 font-black">
              {isLaunching ? copy.launching : isRunning ? copy.running : (copy.launch || "JOGAR AGORA")}
            </span>
          </motion.button>

          {/* Session & Playtime Stacks */}
          <div className="flex items-center gap-6 sm:gap-8 text-xs">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                Última Sessão
              </span>
              <span className="text-sm font-semibold text-white/90">
                {lastSession}
              </span>
            </div>

            <div className="w-px h-8 bg-white/10 shrink-0" />

            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-white/40">
                Tempo de Jogo
              </span>
              <span className="text-sm font-semibold text-white/90">
                {formattedHours}
              </span>
            </div>
          </div>
        </div>

        {/* Right Side: Tools & Settings Icons */}
        <div className="flex items-center gap-3">
          {/* Controller Config Button */}
          <button
            type="button"
            className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 hover:border-white/25 text-white/70 hover:text-white transition-all cursor-pointer shadow-md"
            title="Configuração do Controle"
            aria-label="Configuração do Controle"
          >
            <Gamepad2 className="w-5 h-5" />
          </button>

          {/* Settings / Manage Button */}
          {onEditGame && (
            <button
              type="button"
              onClick={onEditGame}
              className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/[0.05] hover:bg-white/[0.12] border border-white/10 hover:border-white/25 text-white/70 hover:text-white transition-all cursor-pointer shadow-md"
              title="Gerenciar Jogo"
              aria-label="Gerenciar Jogo"
            >
              <Settings className="w-5 h-5" />
            </button>
          )}

          {/* Favorite Toggle Button */}
          {onToggleFavorite && (
            <button
              type="button"
              onClick={onToggleFavorite}
              className={`flex items-center justify-center w-11 h-11 rounded-xl border transition-all cursor-pointer shadow-md ${
                isFavorite
                  ? "bg-amber-500/20 border-amber-400/50 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]"
                  : "bg-white/[0.05] hover:bg-white/[0.12] border-white/10 text-white/70 hover:text-white"
              }`}
              title={isFavorite ? "Remover dos Favoritos" : "Adicionar aos Favoritos"}
              aria-label="Favoritar"
            >
              <Star className={`w-5 h-5 ${isFavorite ? "fill-amber-400" : ""}`} />
            </button>
          )}
        </div>
      </div>



      {launchError && (
        <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-200">
          {launchError}
        </div>
      )}
    </div>
  );
});

GameDetailSteamActionBar.displayName = "GameDetailSteamActionBar";
export default GameDetailSteamActionBar;
