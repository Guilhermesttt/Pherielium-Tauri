import React, { useState, useEffect, useCallback, useMemo } from "react";
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
        className="hidden lg:flex items-center gap-1.5 p-1 rounded-full bg-[#0E0E0E]/90 border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_4px_20px_rgba(0,0,0,0.5)] backdrop-blur-xl"
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
        <div className="flex items-center gap-1">
          {allTabs.map((tab) => {
            const isActive = activeCategory === tab.id;
            return (
              <div key={tab.id} className="relative group/tab flex items-center">
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
                  className={`relative flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold tracking-wider uppercase transition-colors duration-200 cursor-pointer select-none ${
                    isActive
                      ? "text-white"
                      : "text-[#8E8E93] hover:text-white/90 hover:bg-white/[0.04]"
                  }`}
                >
                  {isActive && (
                    <motion.div
                      layoutId="activeLibraryTab"
                      className="absolute inset-0 rounded-full bg-[#262626] border border-white/[0.12] shadow-[0_2px_12px_rgba(0,0,0,0.6),inset_0_1px_0_rgba(255,255,255,0.18)] -z-10"
                      transition={{
                        type: "spring",
                        bounce: 0.15,
                        duration: 0.35,
                      }}
                    />
                  )}
                  <span>{tab.label}</span>

                  {/* Botão de edição para filtros personalizados */}
                  {"isCustom" in tab && tab.filter && (
                    <button
                      type="button"
                      onClick={(e) => handleOpenEdit(tab.filter, e)}
                      title="Editar este filtro"
                      className="opacity-0 group-hover/tab:opacity-100 p-0.5 rounded-full hover:bg-white/15 text-white/50 hover:text-white transition-opacity"
                    >
                      <Settings2 className="w-3 h-3" />
                    </button>
                  )}
                </button>
              </div>
            );
          })}

          {/* Botão Adicionar Filtro Personalizado (+) */}
          <button
            type="button"
            onClick={handleOpenCreate}
            title="Criar novo filtro personalizado"
            aria-label="Criar filtro personalizado"
            className="flex items-center justify-center w-7 h-7 rounded-full bg-white/[0.04] hover:bg-white/[0.12] border border-white/[0.06] hover:border-white/20 text-white/60 hover:text-white transition-all cursor-pointer shadow-sm active:scale-90 ml-0.5"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

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
