import React, { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Filter, Star, Trophy, Search } from "lucide-react";
import type { Game } from "../types/domain";
import { getGamePlayedHours } from "../utils/playtime";

export interface LibraryFilters {
  launchers: string[];
  categories: string[];
  favoritesOnly: boolean;
  withAchievements: boolean;
  minHours: number;
  maxHours: number;
  sortBy: "title" | "hours" | "recent" | "achievements";
  sortDir: "asc" | "desc";
}

interface LibraryFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  onApply: (filters: LibraryFilters) => void;
  games: Game[];
  currentFilters: LibraryFilters;
}

const SORT_OPTIONS = [
  { id: "title", label: "Nome" },
  { id: "hours", label: "Horas jogadas" },
  { id: "recent", label: "Jogado recentemente" },
  { id: "achievements", label: "Conquistas" },
];

const LibraryFilterModal: React.FC<LibraryFilterModalProps> = ({
  isOpen,
  onClose,
  onApply,
  games,
  currentFilters,
}) => {
  const [filters, setFilters] = useState<LibraryFilters>({ ...currentFilters });
  const [searchGenre, setSearchGenre] = useState("");

  const categories = useMemo(() => {
    const catSet = new Set<string>();
    games.forEach((g) => {
      if (g.category) catSet.add(g.category);
    });
    return Array.from(catSet).sort();
  }, [games]);

  const filteredCategories = useMemo(() => {
    if (!searchGenre.trim()) return categories;
    const s = searchGenre.toLowerCase();
    return categories.filter((c) => c.toLowerCase().includes(s));
  }, [categories, searchGenre]);

  const gameCount = useMemo(() => {
    return games.filter((g) => {
      if (filters.launchers.length > 0 && !filters.launchers.includes(g.launcherType || "local")) return false;
      if (filters.categories.length > 0 && !filters.categories.includes(g.category || "")) return false;
      if (filters.favoritesOnly && !g.isFavorite) return false;
      if (filters.withAchievements && (!g.totalAchievements || g.totalAchievements === 0)) return false;
      const hours = getGamePlayedHours(g);
      if (filters.minHours > 0 && hours < filters.minHours) return false;
      if (filters.maxHours > 0 && hours > filters.maxHours) return false;
      return true;
    }).length;
  }, [games, filters]);

  const toggleCategory = (cat: string) => {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  };

  const handleApply = () => {
    onApply(filters);
    onClose();
  };

  const handleReset = () => {
    const defaultFilters: LibraryFilters = {
      launchers: [],
      categories: [],
      favoritesOnly: false,
      withAchievements: false,
      minHours: 0,
      maxHours: 0,
      sortBy: "title",
      sortDir: "asc",
    };
    setFilters(defaultFilters);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="bg-[#0E0E0E] relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-3xl border border-[var(--color-border)] shadow-[0_24px_80px_rgba(0,0,0,0.8)] thin-scrollbar"
          >
            {/* Header */}
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-white/[0.06] bg-black/40 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.06]">
                  <Filter className="h-4 w-4 text-white/70" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Filtros da Biblioteca</h2>
                  <p className="text-[10px] text-white/40">{gameCount} de {games.length} jogos</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04] text-white/40 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Quick Toggles */}
              <div className="flex gap-3">
                <button
                  onClick={() => setFilters((p) => ({ ...p, favoritesOnly: !p.favoritesOnly }))}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all ${
                    filters.favoritesOnly
                      ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                      : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.06]"
                  }`}
                >
                  <Star className={`h-3.5 w-3.5 ${filters.favoritesOnly ? "fill-yellow-400" : ""}`} />
                  Favoritos
                </button>
                <button
                  onClick={() => setFilters((p) => ({ ...p, withAchievements: !p.withAchievements }))}
                  className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-bold transition-all ${
                    filters.withAchievements
                      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
                      : "border-white/10 bg-white/[0.03] text-white/50 hover:bg-white/[0.06]"
                  }`}
                >
                  <Trophy className="h-3.5 w-3.5" />
                  Com Conquistas
                </button>
              </div>

              {/* Categories/Genres */}
              <div>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-white/40">Gêneros</h3>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white/30" />
                  <input
                    type="text"
                    value={searchGenre}
                    onChange={(e) => setSearchGenre(e.target.value)}
                    placeholder="Buscar gênero..."
                    className="w-full rounded-xl border border-white/[0.06] bg-white/[0.03] py-2 pl-9 pr-3 text-xs text-white placeholder:text-white/25 outline-none focus:border-white/20"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto thin-scrollbar">
                  {filteredCategories.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      className={`rounded-lg border px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                        filters.categories.includes(cat)
                          ? "border-white/20 bg-white/10 text-white"
                          : "border-white/[0.06] bg-white/[0.02] text-white/35 hover:bg-white/[0.06]"
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div>
                <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-white/40">Ordenar por</h3>
                <div className="flex gap-2">
                  {SORT_OPTIONS.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setFilters((p) => ({
                        ...p,
                        sortBy: opt.id as LibraryFilters["sortBy"],
                        sortDir: p.sortBy === opt.id ? (p.sortDir === "asc" ? "desc" : "asc") : "asc",
                      }))}
                      className={`rounded-lg border px-3 py-2 text-xs font-semibold transition-all ${
                        filters.sortBy === opt.id
                          ? "border-white/20 bg-white/10 text-white"
                          : "border-white/[0.06] bg-white/[0.02] text-white/40 hover:bg-white/[0.06]"
                      }`}
                    >
                      {opt.label}
                      {filters.sortBy === opt.id && (
                        <span className="ml-1">{filters.sortDir === "asc" ? "↑" : "↓"}</span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="sticky bottom-0 flex items-center justify-between border-t border-white/[0.06] bg-black/40 px-6 py-4">
              <button
                onClick={handleReset}
                className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold text-white/50 transition-colors hover:bg-white/10 hover:text-white"
              >
                Limpar Filtros
              </button>
              <button
                onClick={handleApply}
                className="rounded-xl border border-white/20 bg-white/10 px-6 py-2 text-xs font-bold text-white transition-all hover:bg-white/20 hover:shadow-[0_0_20px_rgba(255,255,255,0.1)]"
              >
                Aplicar ({gameCount})
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LibraryFilterModal;
