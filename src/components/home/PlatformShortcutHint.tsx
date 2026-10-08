import React from "react";

interface PlatformShortcutHintProps {
  onActivate: () => void;
}

/** Mouse de lado: a roda acesa é a parte que o atalho pede para girar. */
const WheelGlyph: React.FC = () => (
  <svg
    viewBox="0 0 14 20"
    aria-hidden
    className="h-[1.55em] w-auto shrink-0 overflow-visible"
    fill="none"
  >
    <rect x="1" y="1" width="12" height="18" rx="6" stroke="currentColor" strokeWidth="1.3" opacity="0.55" />
    <path d="M1.6 8.2h10.8" stroke="currentColor" strokeWidth="1.1" opacity="0.3" />
    <rect
      x="5.6"
      y="3.4"
      width="2.8"
      height="4"
      rx="1.4"
      className="platform-hint-wheel"
      style={{ fill: "rgb(var(--launcher-accent))" }}
    />
  </svg>
);

/**
 * Dica do atalho Alt + rolar do mouse (abre o seletor de plataformas). Também é o
 * próprio atalho para quem usa mouse sem teclado à mão: clicar abre o mesmo seletor.
 */
export const PlatformShortcutHint: React.FC<PlatformShortcutHintProps> = ({ onActivate }) => (
  <button
    type="button"
    onClick={onActivate}
    aria-label="Filtrar por plataforma. Atalho: segure Alt e role o mouse"
    title="Segure Alt e role o mouse"
    className="platform-hint group inline-flex items-center gap-[0.55em] rounded-full py-[0.3em] pl-[0.35em] pr-[0.95em] text-[length:var(--fs-label)] font-medium text-white/55 transition-colors duration-[var(--dur-focus)] ease-[var(--ease-focus)] hover:text-white/90 focus-visible:text-white/90"
  >
    <kbd className="inline-flex min-w-[2.4em] items-center justify-center rounded-[0.45em] border border-white/16 border-b-[2px] border-b-white/22 bg-white/[0.07] px-[0.6em] py-[0.12em] font-display text-[0.92em] font-semibold leading-none text-white/80">
      Alt
    </kbd>
    <WheelGlyph />
    <span>Plataformas</span>
  </button>
);

export default PlatformShortcutHint;
