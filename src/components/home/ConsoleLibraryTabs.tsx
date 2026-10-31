import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { Plus, Settings2 } from "lucide-react";
import type { Game } from "../../types/domain";
import type { GamepadFamily } from "../../context/GamepadContext";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import { ControllerButtonGlyph } from "../ui/ControllerButtonGlyph";
import {
  getCustomLibraryFilters,
  type CustomLibraryFilter,
} from "../../services/customLibraryFilters";
import { CustomFilterModal } from "./CustomFilterModal";
import { useSlidingPill } from "../../hooks/useSlidingPill";

export interface ConsoleLibraryTabsProps {
  activeCategory: string;
  onSelectTab: (tabId: string) => void;
  gamepadFamily?: GamepadFamily;
  isGamepadConnected?: boolean;
  playSound?: (sound: SoundEffectType) => void;
  games?: Game[];
}

export const BASE_LIBRARY_CONSOLE_TABS = [
  { id: "ALL", label: "TODOS OS JOGOS" },
  { id: "FAVORITES", label: "FAVORITOS" },
] as const;

export const ConsoleLibraryTabs: React.FC<ConsoleLibraryTabsProps> = ({
  activeCategory,
  onSelectTab,
  gamepadFamily = "xbox",
  isGamepadConnected = false,
  playSound,
  games = [],
}) => {
  const [customFilters, setCustomFilters] = useState<CustomLibraryFilter[]>(() =>
    getCustomLibraryFilters()
  );
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFilter, setEditingFilter] = useState<CustomLibraryFilter | null>(
    null
  );

  const refreshCustomFilters = useCallback(() => {
    setCustomFilters(getCustomLibraryFilters());
  }, []);

  useEffect(() => {
    refreshCustomFilters();
    window.addEventListener(
      "checkpoint:custom-filters-changed",
      refreshCustomFilters
    );
    return () =>
      window.removeEventListener(
        "checkpoint:custom-filters-changed",
        refreshCustomFilters
      );
  }, [refreshCustomFilters]);

  const allTabs = useMemo(() => {
    const customItems = customFilters.map((f) => ({
      id: f.id,
      label: f.name.toUpperCase(),
      isCustom: true,
      filter: f,
    }));
    return [...BASE_LIBRARY_CONSOLE_TABS, ...customItems];
  }, [customFilters]);

  // Muitas abas (colecoes do usuario): o trilho rola e ganha fade nas bordas com overflow.
  const trackRef = useRef<HTMLDivElement>(null);
  const pillRef = useRef<HTMLSpanElement>(null);
  useSlidingPill(trackRef, pillRef, `${activeCategory}|${allTabs.length}`);
  const [overflow, setOverflow] = useState({ left: false, right: false });

  const updateOverflow = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    const left = el.scrollLeft > 1;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 1;
    setOverflow((prev) =>
      prev.left === left && prev.right === right ? prev : { left, right },
    );
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return;
    updateOverflow();
    const observer = new ResizeObserver(updateOverflow);
    observer.observe(el);
    return () => observer.disconnect();
  }, [updateOverflow, allTabs.length]);

  useEffect(() => {
    const el = trackRef.current;
    const active = el?.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
    if (!el || !active) return;
    const pad = 24;
    if (active.offsetLeft - pad < el.scrollLeft) {
      el.scrollTo({ left: active.offsetLeft - pad, behavior: "smooth" });
    } else if (active.offsetLeft + active.offsetWidth + pad > el.scrollLeft + el.clientWidth) {
      el.scrollTo({
        left: active.offsetLeft + active.offsetWidth + pad - el.clientWidth,
        behavior: "smooth",
      });
    }
  }, [activeCategory, allTabs.length]);

  const fadeMask =
    overflow.left || overflow.right
      ? `linear-gradient(to right, ${overflow.left ? "transparent 0, #000 28px" : "#000 0"}, ${
          overflow.right ? "#000 calc(100% - 28px), transparent 100%" : "#000 100%"
        })`
      : undefined;

  const handleOpenCreate = () => {
    playSound?.("select");
    setEditingFilter(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (filter: CustomLibraryFilter, e: React.MouseEvent) => {
    e.stopPropagation();
    playSound?.("select");
    setEditingFilter(filter);
    setIsModalOpen(true);
  };

  return (
    <>
      <div
        className="console-tabs flex max-w-full min-w-0 items-center gap-3"
        role="tablist"
        aria-label="Abas da Biblioteca"
      >
        {/* Aba anterior: LB no controle, Q no teclado (como os chips L1/R1 de console) */}
        {isGamepadConnected && (
          <span className="console-bumper" title="Aba anterior" aria-hidden="true">
            <ControllerButtonGlyph button="LB" gamepadFamily={gamepadFamily} size={16} />
          </span>
        )}

        {/* Tabs */}
        <div
          ref={trackRef}
          onScroll={updateOverflow}
          className="no-scrollbar relative flex min-w-0 items-center gap-1.5 overflow-x-auto"
          style={fadeMask ? { maskImage: fadeMask, WebkitMaskImage: fadeMask } : undefined}
        >
          <span ref={pillRef} className="console-tab-pill" aria-hidden="true" />
          {allTabs.map((tab) => {
            const isActive = activeCategory === tab.id;
            return (
              <div key={tab.id} className="relative group/tab flex shrink-0 items-center">
                <button
                  role="tab"
                  aria-selected={isActive}
                  type="button"
                  onClick={() => {
                    onSelectTab(tab.id);
                    playSound?.("select");
                  }}
                  onContextMenu={(e) => {
                    if ("isCustom" in tab && tab.filter) {
                      e.preventDefault();
                      handleOpenEdit(tab.filter, e);
                    }
                  }}
                  title={tab.label}
                  data-active={isActive}
                  className={`console-tab-item relative flex h-[calc(var(--control-h)-8px)] items-center pl-4 ${"isCustom" in tab && tab.filter ? "pr-8" : "pr-4"} whitespace-nowrap cursor-pointer select-none`}
                >
                  <span className="max-w-[18ch] truncate">{tab.label}</span>

                </button>
                {/* Botão de edição para filtros personalizados */}
                  {"isCustom" in tab && tab.filter && (
                    <button
                      type="button"
                      onClick={(e) => handleOpenEdit(tab.filter, e)}
                      title="Editar este filtro"
                      aria-label={`Editar o filtro ${tab.label}`}
                      className="absolute right-2 top-1/2 z-10 -translate-y-1/2 opacity-0 group-hover/tab:opacity-100 focus-visible:opacity-100 p-1 rounded-[8px] hover:bg-[var(--tone-4)] text-[var(--ink-muted)] hover:text-[var(--ink)] transition-opacity"
                    >
                      <Settings2 className="h-[1.1em] w-[1.1em]" />
                    </button>
                  )}
              </div>
            );
          })}
        </div>

        {/* Botão Adicionar Filtro Personalizado (+) */}
        <button
          type="button"
          onClick={handleOpenCreate}
          title="Criar novo filtro personalizado"
          aria-label="Criar filtro personalizado"
          className="console-bumper cursor-pointer transition-colors duration-[var(--dur-focus)] hover:text-[var(--ink)] active:scale-90"
        >
          <Plus className="h-3 w-3" />
        </button>

        {/* Próxima aba: RB no controle, E no teclado */}
        {isGamepadConnected && (
          <span className="console-bumper" title="Próxima aba" aria-hidden="true">
            <ControllerButtonGlyph button="RB" gamepadFamily={gamepadFamily} size={16} />
          </span>
        )}
      </div>

      {/* Modal para Criar / Editar Filtro Personalizado */}
      <CustomFilterModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        games={games}
        filterToEdit={editingFilter}
        onFilterSaved={(filterId) => {
          refreshCustomFilters();
          onSelectTab(filterId);
        }}
        onFilterDeleted={(deletedId) => {
          refreshCustomFilters();
          if (activeCategory === deletedId) {
            onSelectTab("ALL");
          }
        }}
        playSound={playSound}
      />
    </>
  );
};

export default ConsoleLibraryTabs;
