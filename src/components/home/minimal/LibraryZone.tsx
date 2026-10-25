import React, { useEffect, useRef } from "react";
import type { Game } from "../../../types/domain";
import { LibraryCard } from "./LibraryCard";

export interface LibraryZoneProps {
  /** Título da seção ("Biblioteca" ou o nome da plataforma filtrada). */
  title: string;
  games: readonly Game[];
  selectedIndex: number;
  /** Clique no card: o pai decide (selecionar, abrir o detalhe). */
  onSelect: (index: number, game: Game) => void;
  onHoverCard?: () => void;
  /** Ação do canto direito do título (ex.: o atalho de plataformas). */
  trailing?: React.ReactNode;
}

/**
 * Zona 2: a biblioteca em grade. Cards verticais de proporção única, espaçamento generoso e
 * contagem em mono. O card em foco (teclado ou controle) rola para dentro da vista.
 */
export const LibraryZone: React.FC<LibraryZoneProps> = ({ title, games, selectedIndex, onSelect, onHoverCard, trailing }) => {
  const gridRef = useRef<HTMLDivElement>(null);

  // O foco do controle rola para a vista. Não roda na montagem: com o índice 0 isso rolaria a
  // página para baixo ao abrir a Home e esconderia o jogo em foco.
  const mounted = useRef(false);
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true;
      return;
    }
    const card = gridRef.current?.querySelector<HTMLElement>(`[data-library-index="${selectedIndex}"]`);
    card?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIndex]);

  // Teclado: setas andam pelos cards (esquerda/direita de um em um, cima/baixo por linha).
  const onGridKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const grid = gridRef.current;
    const keys = ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Home", "End"];
    if (!grid || !keys.includes(event.key)) return;
    const cards = Array.from(grid.querySelectorAll<HTMLElement>("[data-library-index]"));
    const current = cards.indexOf(document.activeElement as HTMLElement);
    if (current === -1) return;
    const columns = Math.max(1, getComputedStyle(grid).gridTemplateColumns.split(" ").length);
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -columns, ArrowDown: columns };
    const target =
      event.key === "Home" ? 0 : event.key === "End" ? cards.length - 1 : Math.min(cards.length - 1, Math.max(0, current + step[event.key]));
    event.preventDefault();
    cards[target]?.focus();
  };

  return (
    <section aria-label={title} className="flex flex-col gap-6 pb-12 pt-10">
      <header className="flex items-end justify-between gap-4">
        <h2 className="font-display text-[length:var(--step-4)] font-semibold tracking-[-0.03em] text-[var(--ink)]">{title}</h2>
        <div className="flex items-center gap-5">
          {trailing}
          <span className="text-[length:var(--step-0)] text-[var(--ink-muted)]">
            <span className="font-metric">{games.length}</span> {games.length === 1 ? "jogo" : "jogos"}
          </span>
        </div>
      </header>

      {games.length === 0 ? (
        <p className="rounded-3xl border border-[var(--tone-3)] bg-[var(--tone-0)] px-8 py-16 text-center text-[length:var(--step-1)] text-[var(--ink-muted)]">
          Nenhum jogo por aqui ainda.
        </p>
      ) : (
        <div
          ref={gridRef}
          onKeyDown={onGridKeyDown}
          // colunas com teto: com poucos jogos ou janela larga, os cards não viram pôsteres gigantes
          className="grid grid-cols-[repeat(auto-fill,minmax(176px,232px))] justify-start gap-5"
        >
          {games.map((game, index) => (
            <LibraryCard key={game.id} game={game} index={index} isSelected={index === selectedIndex} onSelect={onSelect} onHover={onHoverCard} />
          ))}
        </div>
      )}
    </section>
  );
};
