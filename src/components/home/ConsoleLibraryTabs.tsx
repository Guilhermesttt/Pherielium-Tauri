import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, MoreVertical, Settings2 } from "lucide-react";
import type { Game } from "../../types/domain";
import type { GamepadFamily } from "../../context/GamepadContext";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import { ControllerButtonGlyph } from "../ui/ControllerButtonGlyph";
import {
  getCustomLibraryFilters,
  type CustomLibraryFilter,
} from "../../services/customLibraryFilters";
import { CustomFilterModal } from "./CustomFilterModal";

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
        className="ctl-pill hidden lg:flex max-w-full min-w-0 gap-1.5 p-1"
        role="tablist"
        aria-label="Abas da Biblioteca"
      >
        {/* L1 / LB Bumper Badge (Only visible when gamepad is connected) */}
        {isGamepadConnected && (
          <div
            className="flex items-center justify-center p-0.5"
            title="Pressione L1/LB para voltar aba"
          >
            <ControllerButtonGlyph
              button="LB"
              gamepadFamily={gamepadFamily}
              size={18}
            />
          </div>
        )}

        {/* Tabs */}
        <div
          ref={trackRef}
          onScroll={updateOverflow}
          className="no-scrollbar flex min-w-0 items-center gap-1 overflow-x-auto"
          style={fadeMask ? { maskImage: fadeMask, WebkitMaskImage: fadeMask } : undefined}
        >
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
                  className={`relative flex h-[calc(var(--control-h)-10px)] items-center gap-1.5 px-[var(--space-4)] rounded-full text-[length:var(--fs-label)] font-bold tracking-wider uppercase whitespace-nowrap transition-colors duration-[var(--dur-focus)] ease-[var(--ease-focus)] cursor-pointer select-none ${
                    isActive
                      ? "text-white"
                      : "text-[#8E8E93] hover:text-white/90 hover:bg-white/[0.04]"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeLibraryTab"
                      className="absolute inset-0 rounded-full bg-[var(--selection-bg)] border border-[color:var(--edge-strong)] shadow-[var(--elev-pill)] -z-10"
                      transition={{
                        type: "spring",
                        bounce: 0.15,
                        duration: 0.35,
                      }}
                    />
                  )}
                  <span className="max-w-[18ch] truncate">{tab.label}</span>

                  {/* Botão de edição para filtros personalizados */}
                  {"isCustom" in tab && tab.filter && (
                    <button
                      type="button"
                      onClick={(e) => handleOpenEdit(tab.filter, e)}
                      title="Editar este filtro"
                      className="opacity-0 group-hover/tab:opacity-100 p-0.5 rounded-full hover:bg-white/15 text-white/50 hover:text-white transition-opacity"
                    >
                      <Settings2 className="h-[1.1em] w-[1.1em]" />
                    </button>
                  )}
                </button>
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
          className="flex h-[calc(var(--control-h)-10px)] w-[calc(var(--control-h)-10px)] shrink-0 items-center justify-center rounded-full bg-white/[0.04] hover:bg-white/[0.12] border border-[color:var(--edge-subtle)] hover:border-[color:var(--edge-strong)] text-white/60 hover:text-white transition-[background-color,border-color,color,transform] duration-[var(--dur-focus)] ease-[var(--ease-focus)] cursor-pointer active:scale-90 ml-0.5"
        >
          <Plus className="h-[45%] w-[45%]" />
        </button>

        {/* R1 / RB Bumper Badge (Only visible when gamepad is connected) */}
        {isGamepadConnected && (
          <div
            className="flex items-center justify-center p-0.5"
            title="Pressione R1/RB para avançar aba"
          >
            <ControllerButtonGlyph
              button="RB"
              gamepadFamily={gamepadFamily}
              size={18}
            />
          </div>
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
