import React, { useMemo } from "react";
import { ChevronDown, ChevronUp, RotateCcw, Star, Trophy } from "lucide-react";
import type { LibraryFilters } from "../LibraryFilterModal";
import type { Game } from "../../types/domain";

const SORTS: { id: LibraryFilters["sortBy"]; label: string }[] = [
  { id: "title", label: "Nome" },
  { id: "hours", label: "Horas jogadas" },
  { id: "recent", label: "Jogado recentemente" },
  { id: "achievements", label: "Conquistas" },
];

export const DEFAULT_LIBRARY_FILTERS: LibraryFilters = {
  launchers: [],
  categories: [],
  favoritesOnly: false,
  withAchievements: false,
  minHours: 0,
  maxHours: 0,
  sortBy: "title",
  sortDir: "asc",
};

/** Quantos filtros além da plataforma estão ligados (a ordenação padrão não conta). */
export function activeFilterCount(filters: LibraryFilters): number {
  return (
    Number(filters.favoritesOnly) +
    Number(filters.withAchievements) +
    filters.categories.length +
    (filters.sortBy !== DEFAULT_LIBRARY_FILTERS.sortBy || filters.sortDir !== DEFAULT_LIBRARY_FILTERS.sortDir ? 1 : 0)
  );
}

interface LibraryFilterPanelProps {
  games: Game[];
  filters: LibraryFilters;
  onChange: (filters: LibraryFilters) => void;
  playSound?: (sound: "select" | "hover") => void;
}

const chip = (active: boolean) =>
  `inline-flex h-11 cursor-pointer items-center gap-2 rounded-[var(--corner-sm)] px-4 text-[length:var(--step-0)] font-semibold transition-colors ${
    active ? "bg-[var(--ink)] text-[var(--tone-0)]" : "bg-[var(--tone-3)] text-[var(--ink-muted)] hover:bg-[var(--tone-4)] hover:text-[var(--ink)]"
  }`;

/**
 * Filtros da biblioteca dentro do seletor de plataforma (Alt + scroll): favoritos, com conquistas,
 * gêneros e ordenação. Cada clique vale na hora; a plataforma continua sendo a roda ao lado.
 */
export const LibraryFilterPanel: React.FC<LibraryFilterPanelProps> = ({ games, filters, onChange, playSound }) => {
  const categories = useMemo(() => {
    const set = new Set<string>();
    games.forEach((game) => {
      if (game.category) set.add(game.category);
    });
    return [...set].sort();
  }, [games]);

  const update = (patch: Partial<LibraryFilters>) => {
    playSound?.("select");
    onChange({ ...filters, ...patch });
  };
  const toggleCategory = (category: string) =>
    update({
      categories: filters.categories.includes(category)
        ? filters.categories.filter((c) => c !== category)
        : [...filters.categories, category],
    });
  const pickSort = (sortBy: LibraryFilters["sortBy"]) =>
    update(filters.sortBy === sortBy ? { sortDir: filters.sortDir === "asc" ? "desc" : "asc" } : { sortBy, sortDir: sortBy === "title" ? "asc" : "desc" });

  const active = activeFilterCount(filters);

  return (
    <aside
      data-filter-panel
      aria-label="Filtros da biblioteca"
      className="thin-scrollbar max-h-[78vh] w-[380px] space-y-7 overflow-y-auto rounded-[var(--corner-lg)] bg-[color-mix(in_srgb,var(--tone-1)_92%,transparent)] p-7 text-[var(--ink)]"
    >
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-[length:var(--step-2)] font-semibold">Filtros</h2>
        <button
          type="button"
          disabled={active === 0}
          onClick={() => update({ ...DEFAULT_LIBRARY_FILTERS, launchers: filters.launchers })}
          className="inline-flex h-10 cursor-pointer items-center gap-2 rounded-[var(--corner-sm)] bg-[var(--tone-3)] px-3.5 text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] transition-colors hover:bg-[var(--tone-4)] hover:text-[var(--ink)] disabled:cursor-default disabled:opacity-40"
        >
          <RotateCcw className="h-4 w-4" aria-hidden /> Limpar
        </button>
      </header>

      <div className="flex flex-wrap gap-2">
        <button type="button" aria-pressed={filters.favoritesOnly} onClick={() => update({ favoritesOnly: !filters.favoritesOnly })} className={chip(filters.favoritesOnly)}>
          <Star className="h-4 w-4" aria-hidden /> Favoritos
        </button>
        <button type="button" aria-pressed={filters.withAchievements} onClick={() => update({ withAchievements: !filters.withAchievements })} className={chip(filters.withAchievements)}>
          <Trophy className="h-4 w-4" aria-hidden /> Com conquistas
        </button>
      </div>

      {categories.length > 0 && (
        <section aria-label="Gêneros">
          <h3 className="mb-3 text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)]">Gêneros</h3>
          <div className="flex flex-wrap gap-2">
            {categories.map((category) => (
              <button key={category} type="button" aria-pressed={filters.categories.includes(category)} onClick={() => toggleCategory(category)} className={chip(filters.categories.includes(category))}>
                {category}
              </button>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Ordenar por">
        <h3 className="mb-3 text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)]">Ordenar por</h3>
        <div className="flex flex-wrap gap-2">
          {SORTS.map((sort) => {
            const selected = filters.sortBy === sort.id;
            return (
              <button key={sort.id} type="button" aria-pressed={selected} onClick={() => pickSort(sort.id)} className={chip(selected)}>
                {sort.label}
                {selected && (filters.sortDir === "asc" ? <ChevronUp className="h-4 w-4" aria-label="crescente" /> : <ChevronDown className="h-4 w-4" aria-label="decrescente" />)}
              </button>
            );
          })}
        </div>
      </section>
    </aside>
  );
};
