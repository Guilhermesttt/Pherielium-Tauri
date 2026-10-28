import React, { useState, useMemo, useEffect } from "react";
import { X, Search, Check, Trash2, Filter } from "lucide-react";
import ModalShell from "../ui/ModalShell";
import { useMountWhileOpen } from "../ui/mountWhileOpen";
import type { Game } from "../../types/domain";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import type { CustomLibraryFilter } from "../../services/customLibraryFilters";
import {
  addCustomLibraryFilter,
  updateCustomLibraryFilter,
  deleteCustomLibraryFilter,
} from "../../services/customLibraryFilters";

interface CustomFilterModalProps {
  isOpen: boolean;
  onClose: () => void;
  games: Game[];
  filterToEdit?: CustomLibraryFilter | null;
  onFilterSaved?: (filterId: string) => void;
  onFilterDeleted?: (filterId: string) => void;
  playSound?: (type: SoundEffectType) => void;
}

const CustomFilterModalBody: React.FC<CustomFilterModalProps> = ({
  isOpen,
  onClose,
  games = [],
  filterToEdit,
  onFilterSaved,
  onFilterDeleted,
  playSound,
}) => {
  const [filterName, setFilterName] = useState("");
  const [selectedGameIds, setSelectedGameIds] = useState<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (isOpen) {
      if (filterToEdit) {
        setFilterName(filterToEdit.name);
        setSelectedGameIds(new Set(filterToEdit.gameIds));
      } else {
        setFilterName("");
        setSelectedGameIds(new Set());
      }
      setSearchQuery("");
    }
  }, [isOpen, filterToEdit]);

  const filteredGames = useMemo(() => {
    if (!searchQuery.trim()) return games;
    const query = searchQuery.toLowerCase().trim();
    return games.filter((g) => g.title.toLowerCase().includes(query));
  }, [games, searchQuery]);

  const handleToggleGame = (gameId: string) => {
    playSound?.("navigate");
    setSelectedGameIds((prev) => {
      const next = new Set(prev);
      if (next.has(gameId)) {
        next.delete(gameId);
      } else {
        next.add(gameId);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    playSound?.("select");
    setSelectedGameIds(new Set(games.map((g) => g.id)));
  };

  const handleClearAll = () => {
    playSound?.("select");
    setSelectedGameIds(new Set());
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = filterName.trim();
    if (!trimmed) return;

    const gameIdsArray = Array.from(selectedGameIds);

    if (filterToEdit) {
      updateCustomLibraryFilter(filterToEdit.id, trimmed, gameIdsArray);
      playSound?.("select");
      onFilterSaved?.(filterToEdit.id);
    } else {
      const created = addCustomLibraryFilter(trimmed, gameIdsArray);
      playSound?.("select");
      onFilterSaved?.(created.id);
    }
    onClose();
  };

  const handleDelete = () => {
    if (!filterToEdit) return;
    deleteCustomLibraryFilter(filterToEdit.id);
    playSound?.("delete");
    onFilterDeleted?.(filterToEdit.id);
    onClose();
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClassName="max-w-2xl"
      className="p-0 bg-[var(--tone-1)] border border-transparent rounded-[var(--corner-lg)] shadow-[0_24px_70px_rgba(0,0,0,0.85)] overflow-hidden select-none"
    >
      <form onSubmit={handleSave} className="flex flex-col max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-transparent">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-[10px] bg-[var(--tone-3)] text-[var(--ink)]">
              <Filter className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-display font-bold text-[var(--ink)] tracking-tight">
                {filterToEdit ? "Editar Filtro Personalizado" : "Novo Filtro Personalizado"}
              </h3>
              <p className="text-[length:var(--step-0)] text-[var(--ink-faint)]">
                Crie abas exclusivas para organizar seus jogos como preferir
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--tone-4)] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="px-6 py-5 flex flex-col gap-4 overflow-y-auto no-scrollbar">
          {/* Nome do Filtro */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] uppercase tracking-wider">
              Nome do Filtro
            </label>
            <input aria-label="Nome do filtro"
              type="text"
              value={filterName}
              onChange={(e) => setFilterName(e.target.value)}
              placeholder="Ex: Meus RPGs, Campanhas, Multiplayer..."
              autoFocus
              className="w-full px-4 py-2.5 rounded-[var(--corner-sm)] bg-[var(--tone-3)] border border-transparent focus:border-transparent focus:outline-none text-[var(--ink)] text-sm placeholder:text-[var(--ink-faint)] transition-colors"
            />
          </div>

          {/* Seletor de Jogos */}
          <div className="flex flex-col gap-2 mt-2">
            <div className="flex items-center justify-between">
              <label className="text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] uppercase tracking-wider">
                Selecionar Jogos ({selectedGameIds.size} de {games.length})
              </label>
              <div className="flex items-center gap-3 text-[length:var(--step-0)]">
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                >
                  Selecionar todos
                </button>
                <span className="text-[var(--ink-faint)]">|</span>
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="text-[var(--ink-muted)] hover:text-[var(--ink)] transition-colors cursor-pointer"
                >
                  Limpar
                </button>
              </div>
            </div>

            {/* Barra de busca de jogos dentro da modal */}
            <div className="relative w-full">
              <Search className="w-4 h-4 text-[var(--ink-faint)] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input aria-label="Buscar jogos para o filtro"
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar jogos para incluir no filtro..."
                className="w-full pl-10 pr-4 py-2 rounded-[var(--corner-sm)] bg-[var(--tone-3)] border border-transparent text-[var(--ink)] text-[length:var(--step-0)] placeholder:text-[var(--ink-faint)] focus:outline-none focus:border-transparent"
              />
            </div>

            {/* Lista com checkboxes dos jogos */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[300px] overflow-y-auto no-scrollbar p-1 rounded-[var(--corner-sm)] bg-black/20 border border-transparent">
              {filteredGames.length === 0 ? (
                <div className="col-span-2 py-8 text-center text-[length:var(--step-0)] text-[var(--ink-faint)]">
                  Nenhum jogo encontrado para esta busca.
                </div>
              ) : (
                filteredGames.map((game) => {
                  const isChecked = selectedGameIds.has(game.id);
                  const cover = game.cardImage || game.image;
                  return (
                    <div
                      key={game.id}
                      onClick={() => handleToggleGame(game.id)}
                      className={`flex items-center gap-3 p-2 rounded-[var(--corner-sm)] border transition-all cursor-pointer ${
                        isChecked
                          ? "bg-[var(--tone-3)] border-transparent text-[var(--ink)] shadow-sm"
                          : "bg-[var(--tone-3)] border-transparent hover:bg-[var(--tone-4)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-[10px] flex items-center justify-center shrink-0 border transition-all ${
                          isChecked
                            ? "bg-[var(--live)] border-transparent text-[var(--tone-0)] shadow-sm"
                            : "border-transparent bg-black/40"
                        }`}
                      >
                        {isChecked && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                      </div>

                      <div className="w-8 h-10 rounded-[10px] overflow-hidden bg-black/50 shrink-0">
                        {cover && (
                          <img
                            src={cover}
                            alt=""
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>

                      <span className="text-[length:var(--step-0)] font-medium truncate flex-1">
                        {game.title}
                      </span>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-transparent bg-black/20">
          <div>
            {filterToEdit && (
              <button
                type="button"
                onClick={handleDelete}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-[10px] text-[length:var(--step-0)] font-semibold text-[var(--danger)] hover:text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] transition-colors cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir Filtro
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-[var(--corner-sm)] text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--tone-4)] transition-colors cursor-pointer"
            >
              Cancelar
            </button>

            <button
              type="submit"
              disabled={!filterName.trim()}
              className="px-5 py-2 rounded-[var(--corner-sm)] text-[length:var(--step-0)] font-bold uppercase tracking-wider bg-[var(--ink)] text-[var(--tone-0)] hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer shadow-lg active:scale-95"
            >
              Salvar Filtro
            </button>
          </div>
        </div>
      </form>
    </ModalShell>
  );
};

export const CustomFilterModal: React.FC<CustomFilterModalProps> = (props) => {
  const mounted = useMountWhileOpen(props.isOpen);
  return mounted ? <CustomFilterModalBody {...props} /> : null;
};

export default CustomFilterModal;
