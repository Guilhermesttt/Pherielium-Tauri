import React from "react";
import { ChevronRight, Layers } from "lucide-react";
import type { GamePanelMod } from "../../types/gameDetail";

/**
 * Resumo dos mods do jogo na aba Jogar: quantos estão ativos e os primeiros da lista, com um
 * atalho para a aba Mods. Sem mods, convida a instalar (o diferencial é instalar da Nexus em um
 * clique, sem abrir pastas do jogo).
 */
export interface GameDetailModsCardProps {
  mods: readonly GamePanelMod[];
  onOpenMods?: () => void;
}

const PREVIEW = 4;

export const GameDetailModsCard: React.FC<GameDetailModsCardProps> = React.memo(({ mods, onOpenMods }) => {
  const active = mods.filter((mod) => mod.enabled).length;
  const preview = mods.slice(0, PREVIEW);
  const hidden = mods.length - preview.length;

  return (
    <section aria-label="Mods do jogo" className="flex flex-col gap-5 rounded-[var(--corner-lg)] bg-[var(--tone-2)] p-6">
      <header>
        <p className="flex items-center gap-2 text-[length:var(--step-0)] font-medium text-[var(--ink-muted)]">
          <Layers className="h-4 w-4" aria-hidden="true" />
          Mods
        </p>
        {mods.length > 0 ? (
          <p className="mt-1 text-[length:var(--step-4)] font-semibold leading-none tracking-[-0.02em] text-[var(--ink)]">
            <span className="font-metric">{active}</span>
            <span className="text-[length:var(--step-2)] font-medium text-[var(--ink-muted)]">
              {" "}
              {active === 1 ? "ativo" : "ativos"} de <span className="font-metric">{mods.length}</span>
            </span>
          </p>
        ) : (
          <p className="mt-1 text-[length:var(--step-3)] font-semibold leading-tight tracking-[-0.02em] text-[var(--ink)]">
            Nenhum mod instalado
          </p>
        )}
      </header>

      {mods.length > 0 ? (
        <ul className="flex flex-col gap-1">
          {preview.map((mod) => (
            <li key={mod.id} className="flex h-12 items-center gap-3 rounded-[var(--node)] bg-[var(--tone-1)] px-3">
              {mod.pictureUrl ? (
                <img src={mod.pictureUrl} alt="" className="h-8 w-8 shrink-0 rounded-[var(--corner-sm)] object-cover" draggable={false} />
              ) : (
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[var(--corner-sm)] bg-[var(--tone-3)] text-[var(--ink-faint)]">
                  <Layers className="h-4 w-4" aria-hidden="true" />
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-[length:var(--step-1)] font-medium text-[var(--ink)]">{mod.name}</span>
              <span
                className={`shrink-0 text-[length:var(--step-0)] ${mod.enabled ? "text-[var(--live)]" : "text-[var(--ink-faint)]"}`}
              >
                {mod.enabled ? "Ativo" : "Desativado"}
              </span>
            </li>
          ))}
          {hidden > 0 && (
            <li className="px-3 pt-1 text-[length:var(--step-0)] text-[var(--ink-muted)]">
              e mais <span className="font-metric">{hidden}</span>
            </li>
          )}
        </ul>
      ) : (
        <p className="text-[length:var(--step-1)] leading-relaxed text-[var(--ink-muted)]">
          Instale mods da Nexus em um clique, sem abrir as pastas do jogo.
        </p>
      )}

      {onOpenMods && (
        <button
          type="button"
          onClick={onOpenMods}
          className="group mt-auto flex h-11 cursor-pointer items-center justify-between rounded-[var(--node)] bg-[var(--tone-3)] px-4 text-[length:var(--step-1)] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--tone-4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
        >
          {mods.length > 0 ? "Gerenciar mods" : "Abrir mods"}
          <ChevronRight className="h-5 w-5 text-[var(--ink-muted)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </button>
      )}
    </section>
  );
});

GameDetailModsCard.displayName = "GameDetailModsCard";
export default GameDetailModsCard;
