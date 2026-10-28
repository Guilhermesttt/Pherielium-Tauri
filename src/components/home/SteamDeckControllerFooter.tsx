import React from "react";
import type { GamepadFamily } from "../../context/GamepadContext";
import { ControllerButtonGlyph } from "../ui/ControllerButtonGlyph";

export interface SteamDeckControllerFooterProps {
  isGamepadConnected?: boolean;
  gamepadFamily?: GamepadFamily;
  onOpenPlatforms: () => void;
  onOpenFilters: () => void;
  onToggleFavorite?: () => void;
  onOpenOptions?: () => void;
  onOpenSearch?: () => void;
  onToggleSidebar?: () => void;
  isFavorite?: boolean;
}

export const SteamDeckControllerFooter: React.FC<SteamDeckControllerFooterProps> = ({
  isGamepadConnected = false,
  gamepadFamily = "xbox",
  onOpenPlatforms,
  onOpenFilters,
  onToggleFavorite,
  onOpenOptions,
  onOpenSearch,
  onToggleSidebar,
  isFavorite = false,
}) => {
  // Sem controle não há legendas aqui: o atalho Alt + Scroll aparece no menu da biblioteca (HomeTopNav).
  if (!isGamepadConnected) return null;

  return (
    <footer
      className="console-footer shrink-0 flex items-center justify-end gap-[var(--gap-section)] px-[var(--safe-x)] pb-4 pt-2 select-none z-20"
      role="navigation"
      aria-label="Atalhos do Controle"
    >
      {/* Primary Action Buttons with official vector icons */}
      <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
        {/* (A) / (✕) Iniciar */}
        <div className="flex items-center gap-1.5 text-[var(--ink)]">
          <ControllerButtonGlyph
            button="A"
            gamepadFamily={gamepadFamily}
            size={20}
          />
          <span className="font-semibold tracking-wide text-xs">Iniciar</span>
        </div>

        {/* (X) / (□) Opções do jogo */}
        <button
          type="button"
          onClick={onOpenOptions}
          className="flex items-center gap-1.5 text-[var(--ink-muted)] hover:text-white transition-all cursor-pointer group active:scale-95"
          title="Opções do jogo"
        >
          <ControllerButtonGlyph
            button="X"
            gamepadFamily={gamepadFamily}
            size={20}
          />
          <span className="font-medium group-hover:font-semibold transition-all text-xs">
            Opções
          </span>
        </button>

        {/* (Y) / (△) Favoritar */}
        {onToggleFavorite && (
          <button
            type="button"
            onClick={onToggleFavorite}
            className="flex items-center gap-1.5 text-[var(--ink-muted)] hover:text-white transition-all cursor-pointer group active:scale-95"
          >
            <ControllerButtonGlyph
              button="Y"
              gamepadFamily={gamepadFamily}
              size={20}
            />
            <span className={`font-medium transition-all text-xs ${isFavorite ? "text-amber-400 font-semibold" : ""}`}>
              {isFavorite ? "Favorito ★" : "Favoritar"}
            </span>
          </button>
        )}

        {/* (LT) / (L2) Plataformas */}
        <button
          type="button"
          onClick={onOpenPlatforms}
          className="flex items-center gap-1.5 text-[var(--ink-muted)] hover:text-white transition-all cursor-pointer group active:scale-95"
          title="Abrir seletor giratório de plataformas"
        >
          <ControllerButtonGlyph
            button="L2"
            gamepadFamily={gamepadFamily}
            size={20}
          />
          <span className="font-medium group-hover:font-semibold transition-all text-xs">
            Plataformas
          </span>
        </button>

        {/* (RT) / (R2) Filtros */}
        <button
          type="button"
          onClick={onOpenFilters}
          className="flex items-center gap-1.5 text-[var(--ink-muted)] hover:text-white transition-all cursor-pointer group active:scale-95"
          title="Abrir filtros de biblioteca"
        >
          <ControllerButtonGlyph
            button="R2"
            gamepadFamily={gamepadFamily}
            size={20}
          />
          <span className="font-medium group-hover:font-semibold transition-all text-xs">
            Filtros
          </span>
        </button>
      </div>

      {/* Secondary Bumper & Navigation Helpers */}
      <div className="hidden lg:flex items-center gap-5 text-[var(--ink-muted)]">
        {/* (View) / (Share) Buscar */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex items-center gap-1.5 text-[var(--ink-muted)] hover:text-white transition-all cursor-pointer"
          title="Buscar jogos"
        >
          <ControllerButtonGlyph
            button="SHARE"
            gamepadFamily={gamepadFamily}
            size={18}
          />
          <span className="text-[length:var(--step-0)] font-medium">Buscar</span>
        </button>

        {/* (Menu) / (Options) Menu lateral */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex items-center gap-1.5 text-[var(--ink-muted)] hover:text-white transition-all cursor-pointer"
          title="Menu lateral"
        >
          <ControllerButtonGlyph
            button="OPTIONS"
            gamepadFamily={gamepadFamily}
            size={18}
          />
          <span className="text-[length:var(--step-0)] font-medium">Menu Lateral</span>
        </button>

        <div className="flex items-center gap-1 text-[var(--ink-muted)]">
          <ControllerButtonGlyph
            button="LB"
            gamepadFamily={gamepadFamily}
            size={17}
          />
          <span className="text-[length:var(--step-0)] text-[var(--ink-faint)]">/</span>
          <ControllerButtonGlyph
            button="RB"
            gamepadFamily={gamepadFamily}
            size={17}
          />
          <span className="text-[length:var(--step-0)] ml-1 font-medium">Abas</span>
        </div>

        <div className="flex items-center gap-1.5 text-[var(--ink-muted)]">
          <ControllerButtonGlyph
            button="B"
            gamepadFamily={gamepadFamily}
            size={20}
          />
          <span className="text-[length:var(--step-0)] font-medium">Voltar</span>
        </div>
      </div>
    </footer>
  );
};

export default SteamDeckControllerFooter;
