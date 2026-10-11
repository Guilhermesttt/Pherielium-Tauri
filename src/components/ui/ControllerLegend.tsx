import React from "react";
import { useGamepad } from "../../context/GamepadContext";
import { ControllerButtonGlyph } from "./ControllerButtonGlyph";
import type { ControllerHint } from "./controllerHints";

interface ControllerLegendProps {
  hints: ReadonlyArray<ControllerHint>;
}

/** Faixa de legendas no rodapé. Só aparece com um controle conectado. */
export const ControllerLegend: React.FC<ControllerLegendProps> = React.memo(({ hints }) => {
  const { isGamepadConnected, gamepadFamily } = useGamepad();
  if (!isGamepadConnected || hints.length === 0) return null;

  return (
    <footer
      role="navigation"
      aria-label="Atalhos do Controle"
      data-controller-legend
      className="z-20 flex shrink-0 select-none flex-wrap items-center gap-x-6 gap-y-2 border-t border-[color:var(--edge-subtle)] bg-[color-mix(in_srgb,var(--surface-base)_92%,transparent)] px-[var(--safe-x)] py-2.5 text-[12px] backdrop-blur-2xl"
    >
      {hints.map((hint) => (
        <span key={`${hint.button}-${hint.label}`} className="flex items-center gap-1.5 text-white/80">
          <ControllerButtonGlyph button={hint.button} gamepadFamily={gamepadFamily} size={20} />
          <span className="text-xs font-semibold tracking-wide">{hint.label}</span>
        </span>
      ))}
    </footer>
  );
});

ControllerLegend.displayName = "ControllerLegend";
export default ControllerLegend;
