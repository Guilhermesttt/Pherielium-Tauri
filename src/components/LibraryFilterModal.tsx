import React, { useState, useMemo, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Filter, Star, Trophy, Search } from "lucide-react";
import type { Game } from "../types/domain";
import { getGamePlayedHours } from "../utils/playtime";
import { useGamepad, useGamepadButton, playHapticPattern } from "../context/GamepadContext";
import { ControllerButtonGlyph } from "./ui/ControllerButtonGlyph";
import { modalBackdropMotion, modalMotion } from "../design-system/motion";
import { useModalSounds } from "../hooks/useModalSounds";

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
  useModalSounds(isOpen);
  const { isGamepadConnected, gamepadFamily } = useGamepad();
  const [filters, setFilters] = useState<LibraryFilters>({ ...currentFilters });
  const [searchGenre, setSearchGenre] = useState("");
  const [focusedIndex, setFocusedIndex] = useState(0);

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

  const toggleCategory = useCallback((cat: string) => {
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.includes(cat)
        ? prev.categories.filter((c) => c !== cat)
        : [...prev.categories, cat],
    }));
  }, []);

  const handleApply = useCallback(() => {
    playHapticPattern("action");
    onApply(filters);
    onClose();
  }, [filters, onApply, onClose]);

  const handleReset = useCallback(() => {
    playHapticPattern("action");
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
  }, []);

  // Map out linear focusable list for controller navigation
  type FocusTarget =
    | { type: "quick"; id: "favorites" | "achievements" }
    | { type: "sort"; id: LibraryFilters["sortBy"] }
    | { type: "category"; id: string }
    | { type: "action"; id: "reset" | "apply" };

  const focusableItems: FocusTarget[] = useMemo(() => {
    const list: FocusTarget[] = [
      { type: "quick", id: "favorites" },
      { type: "quick", id: "achievements" },
    ];
    SORT_OPTIONS.forEach((opt) => {
      list.push({ type: "sort", id: opt.id as LibraryFilters["sortBy"] });
    });
    filteredCategories.forEach((cat) => {
      list.push({ type: "category", id: cat });
    });
    list.push({ type: "action", id: "reset" });
    list.push({ type: "action", id: "apply" });
    return list;
  }, [filteredCategories]);

  // Keep focusedIndex in valid bounds
  useEffect(() => {
    if (focusedIndex >= focusableItems.length) {
      setFocusedIndex(Math.max(0, focusableItems.length - 1));
    }
  }, [focusableItems.length, focusedIndex]);

  const moveFocus = useCallback((delta: number) => {
    setFocusedIndex((prev) => {
      const next = Math.max(0, Math.min(focusableItems.length - 1, prev + delta));
      if (next !== prev) {
        playHapticPattern("nav");
      }
      return next;
    });
  }, [focusableItems.length]);

  const activateFocused = useCallback(() => {
    const item = focusableItems[focusedIndex];
    if (!item) return;

    playHapticPattern("action");
    if (item.type === "quick") {
      if (item.id === "favorites") {
        setFilters((p) => ({ ...p, favoritesOnly: !p.favoritesOnly }));
      } else {
        setFilters((p) => ({ ...p, withAchievements: !p.withAchievements }));
      }
    } else if (item.type === "sort") {
      setFilters((p) => ({
        ...p,
        sortBy: item.id,
        sortDir: p.sortBy === item.id ? (p.sortDir === "asc" ? "desc" : "asc") : "asc",
      }));
    } else if (item.type === "category") {
      toggleCategory(item.id);
    } else if (item.type === "action") {
      if (item.id === "reset") {
        handleReset();
      } else {
        handleApply();
      }
    }
  }, [focusableItems, focusedIndex, handleApply, handleReset, toggleCategory]);

  // Gamepad bindings with high priority (250) when modal is open
  useGamepadButton("O", handleApply, isOpen, 250);
  useGamepadButton("R2", handleApply, isOpen, 250);
  useGamepadButton("SQUARE", handleReset, isOpen, 250);
  useGamepadButton("X", activateFocused, isOpen, 250);
  useGamepadButton("DPAD_UP", () => moveFocus(-1), isOpen, 250);
  useGamepadButton("DPAD_DOWN", () => moveFocus(1), isOpen, 250);
  useGamepadButton("DPAD_LEFT", () => moveFocus(-1), isOpen, 250);
  useGamepadButton("DPAD_RIGHT", () => moveFocus(1), isOpen, 250);

  // Sync currentFilters into state when modal opens
  useEffect(() => {
    if (isOpen) {
      setFilters({ ...currentFilters });
      setFocusedIndex(0);
    }
  }, [isOpen, currentFilters]);

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          {...modalBackdropMotion}
          className="fixed inset-0 z-[100] flex items-center justify-center"
          onClick={onClose}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />

          {/* Modal */}
          <motion.div
            {...modalMotion}
            onClick={(e) => e.stopPropagation()}
            className="bg-[var(--tone-1)] relative z-10 w-full max-w-lg max-h-[85vh] overflow-y-auto rounded-[var(--corner-lg)] border border-transparent shadow-[0_24px_80px_rgba(0,0,0,0.8),inset_0_1px_0_rgba(255,255,255,0.06)] thin-scrollbar"
          >
            {/* Header */}
            <div className="sticky top-0 z-20 flex items-center justify-between border-b border-transparent bg-[var(--tone-1)]/95 backdrop-blur-md px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-[var(--corner-sm)] border border-transparent bg-[var(--tone-3)]">
                  <Filter className="h-4 w-4 text-[var(--ink-muted)]" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-[var(--ink)]">Filtros da Biblioteca</h2>
                  <p className="text-[length:var(--step-0)] text-[var(--ink-faint)]">{gameCount} de {games.length} jogos</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-[var(--corner-sm)] border border-transparent bg-[var(--tone-3)] text-[var(--ink-faint)] transition-colors hover:bg-[var(--tone-4)] hover:text-[var(--ink)] cursor-pointer"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-6">
              {/* Quick Toggles */}
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setFilters((p) => ({ ...p, favoritesOnly: !p.favoritesOnly }));
                    playHapticPattern("action");
                  }}
                  className={`flex items-center gap-2 rounded-[var(--corner-sm)] border px-4 py-2.5 text-[length:var(--step-0)] font-bold transition-all cursor-pointer ${
                    isGamepadConnected && focusableItems[focusedIndex]?.type === "quick" && focusableItems[focusedIndex]?.id === "favorites"
                      ? "ring-2 ring-[color:var(--tone-4)] bg-[var(--tone-3)] shadow-[0_0_16px_rgba(255,255,255,0.2)]"
                      : ""
                  } ${
                    filters.favoritesOnly
                      ? "border-transparent bg-[var(--tone-3)] text-[var(--ink)]"
                      : "border-transparent bg-[var(--tone-3)] text-[var(--ink-muted)] hover:bg-[var(--tone-4)]"
                  }`}
                >
                  <Star className={`h-3.5 w-3.5 ${filters.favoritesOnly ? "fill-[var(--ink)] text-[var(--ink)]" : ""}`} />
                  Favoritos
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFilters((p) => ({ ...p, withAchievements: !p.withAchievements }));
                    playHapticPattern("action");
                  }}
                  className={`flex items-center gap-2 rounded-[var(--corner-sm)] border px-4 py-2.5 text-[length:var(--step-0)] font-bold transition-all cursor-pointer ${
                    isGamepadConnected && focusableItems[focusedIndex]?.type === "quick" && focusableItems[focusedIndex]?.id === "achievements"
                      ? "ring-2 ring-[color:var(--tone-4)] bg-[var(--tone-3)] shadow-[0_0_16px_rgba(255,255,255,0.2)]"
                      : ""
                  } ${
                    filters.withAchievements
                      ? "border-transparent bg-[var(--tone-3)] text-[var(--live)]"
                      : "border-transparent bg-[var(--tone-3)] text-[var(--ink-muted)] hover:bg-[var(--tone-4)]"
                  }`}
                >
                  <Trophy className="h-3.5 w-3.5 text-[var(--live)]" />
                  Com Conquistas
                </button>
              </div>

              {/* Categories/Genres */}
              <div>
                <h3 className="mb-3 text-[length:var(--step-0)] font-bold uppercase tracking-wider text-[var(--ink-faint)]">Gêneros</h3>
                <div className="relative mb-2">
                  <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--ink-faint)]" />
                  <input aria-label="Buscar gênero"
                    type="text"
                    value={searchGenre}
                    onChange={(e) => setSearchGenre(e.target.value)}
                    placeholder="Buscar gênero..."
                    className="w-full rounded-[var(--corner-sm)] border border-transparent bg-[var(--tone-3)] py-2 pl-9 pr-3 text-[length:var(--step-0)] text-[var(--ink)] placeholder:text-[var(--ink-faint)] outline-none focus:border-transparent"
                  />
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto thin-scrollbar p-1">
                  {filteredCategories.map((cat) => {
                    const isFocused = isGamepadConnected && focusableItems[focusedIndex]?.type === "category" && focusableItems[focusedIndex]?.id === cat;
                    const isSelected = filters.categories.includes(cat);
                    return (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => {
                          toggleCategory(cat);
                          playHapticPattern("action");
                        }}
                        className={`rounded-[10px] border px-2.5 py-1.5 text-[length:var(--step-0)] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                          isFocused ? "ring-2 ring-[color:var(--tone-4)] shadow-[0_0_12px_rgba(255,255,255,0.25)]" : ""
                        } ${
                          isSelected
                            ? "border-transparent bg-[var(--tone-4)] text-[var(--ink)]"
                            : "border-transparent bg-[var(--tone-3)] text-[var(--ink-faint)] hover:bg-[var(--tone-4)]"
                        }`}
                      >
                        {cat}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sort */}
              <div>
                <h3 className="mb-3 text-[length:var(--step-0)] font-bold uppercase tracking-wider text-[var(--ink-faint)]">Ordenar por</h3>
                <div className="flex gap-2 flex-wrap">
                  {SORT_OPTIONS.map((opt) => {
                    const isFocused = isGamepadConnected && focusableItems[focusedIndex]?.type === "sort" && focusableItems[focusedIndex]?.id === opt.id;
                    const isSelected = filters.sortBy === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setFilters((p) => ({
                            ...p,
                            sortBy: opt.id as LibraryFilters["sortBy"],
                            sortDir: p.sortBy === opt.id ? (p.sortDir === "asc" ? "desc" : "asc") : "asc",
                          }));
                          playHapticPattern("action");
                        }}
                        className={`rounded-[10px] border px-3 py-2 text-[length:var(--step-0)] font-semibold transition-all cursor-pointer ${
                          isFocused ? "ring-2 ring-[color:var(--tone-4)] shadow-[0_0_12px_rgba(255,255,255,0.25)]" : ""
                        } ${
                          isSelected
                            ? "border-transparent bg-[var(--tone-4)] text-[var(--ink)] shadow-sm"
                            : "border-transparent bg-[var(--tone-3)] text-[var(--ink-muted)] hover:bg-[var(--tone-4)]"
                        }`}
                      >
                        {opt.label}
                        {isSelected && (
                          <span className="ml-1 text-[var(--ink)]">{filters.sortDir === "asc" ? "↑" : "↓"}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Footer Buttons & Controller Legend Bar */}
            <div className="sticky bottom-0 flex flex-col border-t border-transparent bg-[var(--tone-1)]/95 backdrop-blur-md px-6 py-4 gap-3">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={handleReset}
                  className={`rounded-[var(--corner-sm)] border px-4 py-2 text-[length:var(--step-0)] font-bold transition-all cursor-pointer ${
                    isGamepadConnected && focusableItems[focusedIndex]?.type === "action" && focusableItems[focusedIndex]?.id === "reset"
                      ? "ring-2 ring-[color:var(--tone-4)] bg-[var(--tone-3)] border-transparent text-[var(--ink)]"
                      : "border-transparent bg-[var(--tone-3)] text-[var(--ink-muted)] hover:bg-[var(--tone-4)] hover:text-[var(--ink)]"
                  }`}
                >
                  Limpar Filtros
                </button>
                <button
                  type="button"
                  onClick={handleApply}
                  className={`rounded-[var(--corner-sm)] border px-6 py-2 text-[length:var(--step-0)] font-bold transition-all cursor-pointer ${
                    isGamepadConnected && focusableItems[focusedIndex]?.type === "action" && focusableItems[focusedIndex]?.id === "apply"
                      ? "ring-2 ring-[color:var(--tone-4)] bg-[var(--tone-4)] border-transparent text-[var(--ink)] shadow-[0_0_20px_rgba(255,255,255,0.3)]"
                      : "border-transparent bg-[var(--tone-4)] text-[var(--ink)] hover:bg-[var(--tone-4)] hover:shadow-[0_0_20px_rgba(255,255,255,0.15)]"
                  }`}
                >
                  Aplicar ({gameCount})
                </button>
              </div>

              {/* Controller Hints Strip */}
              {isGamepadConnected && (
                <div className="flex items-center justify-between pt-2.5 border-t border-transparent text-[length:var(--step-0)] text-[var(--ink-muted)] select-none">
                  <div className="flex items-center gap-1.5">
                    <ControllerButtonGlyph button="DPAD" gamepadFamily={gamepadFamily} size={16} />
                    <span>Navegar</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[var(--ink)]">
                    <ControllerButtonGlyph button="A" gamepadFamily={gamepadFamily} size={16} />
                    <span className="font-semibold text-[var(--ink)]">Alternar</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ControllerButtonGlyph button="X" gamepadFamily={gamepadFamily} size={16} />
                    <span>Limpar</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <ControllerButtonGlyph button="B" gamepadFamily={gamepadFamily} size={16} />
                    <span>Aplicar / Fechar</span>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LibraryFilterModal;
