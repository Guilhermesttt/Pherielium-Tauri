import React, { useMemo } from "react";
import type { Game } from "../../../types/domain";
import { pickResumeGame } from "../../commandPaletteLogic";
import { HeroZone } from "./HeroZone";
import { LibraryZone } from "./LibraryZone";

export interface HomeMinimalProps {
  /** Jogos exibidos na biblioteca (já filtrados pela plataforma/busca). */
  games: readonly Game[];
  /** Todos os jogos: o herói é o último jogado entre eles. */
  allGames: readonly Game[];
  libraryTitle: string;
  selectedIndex: number;
  runningGameId?: string | null;
  platformLabel?: string;
  onPlay: (game: Game) => void;
  onOpenDetails: (game: Game) => void;
  /** Clique num card da biblioteca. */
  onSelect: (index: number, game: Game) => void;
  onHover?: () => void;
  trailing?: React.ReactNode;
}

/**
 * Home minimalista, em duas zonas: o jogo em foco (último jogado) e a biblioteca em grade.
 * Fundo preto absoluto, superfícies e bordas nos tons de cinza do tema, sem sombras. Rola na
 * vertical; a barra de rolagem fica escondida.
 */
export const HomeMinimal: React.FC<HomeMinimalProps> = ({
  games,
  allGames,
  libraryTitle,
  selectedIndex,
  runningGameId,
  platformLabel,
  onPlay,
  onOpenDetails,
  onSelect,
  onHover,
  trailing,
}) => {
  const hero = useMemo(() => pickResumeGame(allGames) ?? allGames[0] ?? null, [allGames]);

  return (
    <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[var(--gray-0)] px-[max(var(--safe-x),1.5rem)] pt-2 sm:px-[max(var(--safe-x),2rem)]">
      {hero && (
        <HeroZone
          game={hero}
          isRunning={runningGameId === hero.id}
          platformLabel={platformLabel}
          onPlay={onPlay}
          onOpenDetails={onOpenDetails}
          onHover={onHover}
        />
      )}
      <LibraryZone
        title={libraryTitle}
        games={games}
        selectedIndex={selectedIndex}
        onSelect={onSelect}
        onHoverCard={onHover}
        trailing={trailing}
      />
    </div>
  );
};

export default HomeMinimal;
