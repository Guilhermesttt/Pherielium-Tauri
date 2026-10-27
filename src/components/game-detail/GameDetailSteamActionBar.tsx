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
  /** Abre o painel rápido de controle deste jogo. */
  onOpenControllerPanel?: () => void;
  playSound: (type: SoundEffectType) => void;
}

export const GameDetailSteamActionBar: React.FC<GameDetailSteamActionBarProps> =
  React.memo(
    ({
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
      onOpenControllerPanel,
      playSound,
    }) => {
      return (
        <div className="w-full select-none flex flex-col gap-3">
          <div className="w-full flex flex-wrap items-center justify-between gap-6 py-4">
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
                className={`group relative overflow-hidden flex h-[var(--cta-h)] min-h-14 items-center gap-3.5 rounded-[var(--node)] px-10 sm:px-14 font-display font-black text-[length:var(--step-2)] sm:text-[length:var(--step-3)] tracking-tight transition-all cursor-pointer ${
                  isRunning
                    ? "bg-[color-mix(in_srgb,var(--live)_80%,black)] text-white"
                    : "btn-play"
                }`}
              >
                {/* Luminous Shimmer Sheen Effect */}
                {!isRunning && (
                  <span className="pointer-events-none absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-in-out bg-gradient-to-r from-transparent via-white/50 to-transparent" />
                )}

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
                ) : isLaunching ? (
                  <span className="relative flex h-3 w-3 shrink-0">
                    <span className="animate-spin inline-flex h-3 w-3 rounded-full border-2 border-white border-t-transparent" />
                  </span>
                ) : (
                  <Play className="w-4 h-4 fill-current shrink-0" />
                )}
                <span className="relative z-10 font-black">
                  {isLaunching
                    ? copy.launching
                    : isRunning
                      ? copy.running
                      : copy.launch || "JOGAR AGORA"}
                </span>
              </motion.button>

              {/* Session & Playtime Stacks */}
              <div className="flex items-center gap-6 sm:gap-8 text-xs">
                <div className="flex flex-col">
                  <span className="text-[length:var(--step-0)] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                    Última Sessão
                  </span>
                  <span className="text-sm font-semibold text-[var(--ink)]">
                    {lastSession}
                  </span>
                </div>

                <div className="w-px h-8 bg-white/10 shrink-0" />

                <div className="flex flex-col">
                  <span className="text-[length:var(--step-0)] font-bold uppercase tracking-wider text-[var(--ink-faint)]">
                    Tempo de Jogo
                  </span>
                  <span className="text-sm font-semibold text-[var(--ink)]">
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
                onClick={() => {
                  if (!onOpenControllerPanel) return;
                  playSound("select");
                  onOpenControllerPanel();
                }}
                disabled={!onOpenControllerPanel}
                className="flex items-center justify-center w-11 h-11 rounded-[var(--node)] bg-[var(--tone-2)] hover:bg-[var(--tone-3)] transition-colors text-[var(--ink-muted)] hover:text-white transition-all cursor-pointer shadow-md disabled:cursor-not-allowed disabled:opacity-40"
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
                  className="flex items-center justify-center w-11 h-11 rounded-[var(--node)] bg-[var(--tone-2)] hover:bg-[var(--tone-3)] transition-colors text-[var(--ink-muted)] hover:text-white transition-all cursor-pointer shadow-md"
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
                  className={`flex items-center justify-center w-11 h-11 rounded-[var(--node)] transition-colors cursor-pointer ${
                    isFavorite
                      ? "bg-amber-500/20 text-amber-300"
                      : "bg-[var(--tone-2)] hover:bg-[var(--tone-3)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                  }`}
                  title={
                    isFavorite
                      ? "Remover dos Favoritos"
                      : "Adicionar aos Favoritos"
                  }
                  aria-label="Favoritar"
                >
                  <Star
                    className={`w-5 h-5 ${isFavorite ? "fill-amber-400" : ""}`}
                  />
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
    },
  );

GameDetailSteamActionBar.displayName = "GameDetailSteamActionBar";
export default GameDetailSteamActionBar;
