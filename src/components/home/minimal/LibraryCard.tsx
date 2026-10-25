import React from "react";
import type { Game } from "../../../types/domain";
import { formatPlayedHours, getGamePlayedHours } from "../../../utils/playtime";

export interface LibraryCardProps {
  game: Game;
  index: number;
  /** Foco atual (teclado ou controle): ganha a borda clara e a capa inteira. */
  isSelected: boolean;
  onSelect: (index: number, game: Game) => void;
  onHover?: () => void;
}

/**
 * Card vertical da biblioteca (capa 2:3). A capa fica escurecida e só ganha brilho total no hover
 * ou no foco; a borda é fina e o card cresce de leve no hover. Sem sombras.
 */
export const LibraryCard: React.FC<LibraryCardProps> = React.memo(({ game, index, isSelected, onSelect, onHover }) => {
  const art = game.cardImage || game.image;
  const hours = getGamePlayedHours(game);

  return (
    <button
      type="button"
      data-library-index={index}
      title={game.title}
      aria-current={isSelected ? "true" : undefined}
      onClick={() => onSelect(index, game)}
      onPointerEnter={onHover}
      className={`group flex cursor-pointer flex-col overflow-hidden rounded-3xl border bg-[var(--tone-0)] text-left transition-[transform,border-color] duration-300 ease-out motion-safe:hover:scale-[1.02] motion-safe:active:scale-[0.99] ${
        isSelected ? "border-[var(--gray-6)]" : "border-[var(--tone-3)] hover:border-[var(--gray-5)]"
      }`}
    >
      <span className="relative block aspect-[2/3] w-full overflow-hidden bg-[var(--tone-2)]">
        {art ? (
          <img
            src={art}
            alt=""
            loading="lazy"
            draggable={false}
            className={`h-full w-full object-cover transition-[filter] duration-500 ease-out group-hover:brightness-100 ${
              isSelected ? "brightness-100" : "brightness-[0.65]"
            }`}
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center px-4 text-center font-display text-[length:var(--step-2)] font-semibold text-[var(--ink-faint)]">
            {game.title}
          </span>
        )}
      </span>
      <span className="flex flex-col gap-0.5 px-4 pb-4 pt-3.5">
        <span className="truncate text-[length:var(--step-1)] font-semibold text-[var(--ink)]">{game.title}</span>
        <span className="font-metric text-[length:var(--step-0)] text-[var(--ink-muted)]">
          {hours > 0 ? `${formatPlayedHours(hours)} h` : "Sem sessões"}
        </span>
      </span>
    </button>
  );
});
LibraryCard.displayName = "LibraryCard";
