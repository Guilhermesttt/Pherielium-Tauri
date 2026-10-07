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
  // As legendas de controle só aparecem quando um controle estiver conectado
  if (!isGamepadConnected) {
    return null;
  }

  return (
    <footer
      className="shrink-0 flex items-center justify-between px-[var(--safe-x)] py-2.5 bg-[#0A0A0A]/95 backdrop-blur-2xl border-t border-white/[0.08] shadow-[0_-8px_32px_rgba(0,0,0,0.7)] select-none text-[12px] z-20"
      role="navigation"
      aria-label="Atalhos do Controle"
    >
      {/* Primary Action Buttons with official vector icons */}
      <div className="flex items-center gap-4 sm:gap-6 flex-wrap">
        {/* (A) / (✕) Iniciar */}
        <div className="flex items-center gap-1.5 text-white/90">
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
          className="flex items-center gap-1.5 text-[#D3D3D3] hover:text-white transition-all cursor-pointer group active:scale-95"
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
            className="flex items-center gap-1.5 text-[#D3D3D3] hover:text-white transition-all cursor-pointer group active:scale-95"
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
          className="flex items-center gap-1.5 text-[#D3D3D3] hover:text-white transition-all cursor-pointer group active:scale-95"
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
          className="flex items-center gap-1.5 text-[#D3D3D3] hover:text-white transition-all cursor-pointer group active:scale-95"
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
      <div className="hidden lg:flex items-center gap-5 text-white/70">
        {/* (View) / (Share) Buscar */}
        <button
          type="button"
          onClick={onOpenSearch}
          className="flex items-center gap-1.5 text-white/70 hover:text-white transition-all cursor-pointer"
          title="Buscar jogos"
        >
          <ControllerButtonGlyph
            button="SHARE"
            gamepadFamily={gamepadFamily}
            size={18}
          />
          <span className="text-[11px] font-medium">Buscar</span>
        </button>

        {/* (Menu) / (Options) Menu lateral */}
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex items-center gap-1.5 text-white/70 hover:text-white transition-all cursor-pointer"
          title="Menu lateral"
        >
          <ControllerButtonGlyph
            button="OPTIONS"
            gamepadFamily={gamepadFamily}
            size={18}
          />
          <span className="text-[11px] font-medium">Menu Lateral</span>
        </button>

        <div className="flex items-center gap-1 text-white/70">
          <ControllerButtonGlyph
            button="LB"
            gamepadFamily={gamepadFamily}
            size={17}
          />
          <span className="text-[10px] text-white/40">/</span>
          <ControllerButtonGlyph
            button="RB"
            gamepadFamily={gamepadFamily}
            size={17}
          />
          <span className="text-[11px] ml-1 font-medium">Abas</span>
        </div>

        <div className="flex items-center gap-1.5 text-white/70">
          <ControllerButtonGlyph
            button="B"
            gamepadFamily={gamepadFamily}
            size={20}
          />
          <span className="text-[11px] font-medium">Voltar</span>
        </div>
      </div>
    </footer>
  );
};

export default SteamDeckControllerFooter;
