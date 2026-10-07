import React, { useRef } from "react";
import { motion } from "framer-motion";
import { Search, Plus, SlidersHorizontal, X } from "lucide-react";
import { PHERIELIUM_LOGO_PATH } from "../../constants/assets";
import { FOCUS_TRANSITION } from "../../styles/motion";
import { ConsoleLibraryTabs } from "./ConsoleLibraryTabs";
import { TopBarClock } from "./TopBarClock";
import { ProfileDropdown } from "../ui/ProfileDropdown";
import type { Game } from "../../types/domain";
import type { GamepadFamily } from "../../context/GamepadContext";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import type { LauncherLanguage } from "../../context/PreferencesContext";
import type { PlayerLevelInfo } from "../../utils/trophyTiers";

export interface HomeTopNavProps {
  activeCategory: string;
  onSelectCategory: (category: string) => void;
  games: Game[];
  searchTerm: string;
  onSearchChange: (term: string) => void;
  searchOpen: boolean;
  onToggleSearch: (open: boolean) => void;
  onOpenAddGame: () => void;
  onOpenFilterModal: () => void;
  onToggleSidebar?: () => void;
  hasActiveFilters?: boolean;
  showTabsAndSearch?: boolean;
  isGamepadConnected?: boolean;
  gamepadFamily?: GamepadFamily;
  userDisplay: string;
  userEmail?: string;
  userAvatarUrl?: string;
  userLevel?: PlayerLevelInfo | number;
  language?: LauncherLanguage;
  playSound: (type: SoundEffectType) => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  onLogout: () => void;
}

export const HomeTopNav: React.FC<HomeTopNavProps> = ({
  activeCategory,
  onSelectCategory,
  games,
  searchTerm,
  onSearchChange,
  searchOpen,
  onToggleSearch,
  onOpenAddGame,
  onOpenFilterModal,
  onToggleSidebar,
  hasActiveFilters = false,
  showTabsAndSearch = true,
  isGamepadConnected = false,
  gamepadFamily = "xbox",
  userDisplay,
  userEmail,
  userAvatarUrl,
  userLevel,
  language = "pt-BR",
  playSound,
  onOpenProfile,
  onOpenSettings,
  onLogout,
}) => {
  const searchInputRef = useRef<HTMLInputElement>(null);

  const handleSearchClick = () => {
    if (!searchOpen) {
      onToggleSearch(true);
      setTimeout(() => searchInputRef.current?.focus(), 50);
      playSound("select");
    }
  };

  const searchExpanded = searchOpen || Boolean(searchTerm);

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={FOCUS_TRANSITION}
      className="shrink-0 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-[var(--gap-inline)] px-[var(--safe-x)] pt-[var(--safe-y)] pb-[var(--gap-stack)] relative z-30 select-none will-change-transform"
      role="banner"
    >
      {/* 1. Left: Pherielium Brand Identity */}
      <div className="flex min-w-0 items-center justify-self-start">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex items-center gap-[var(--gap-inline)] group cursor-pointer focus-visible:outline-none"
          title="Abrir menu lateral"
          aria-label="Menu principal Pherielium"
        >
          <div className="flex h-[var(--control-h)] w-[var(--control-h)] shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-white/[0.05] border border-[color:var(--edge-subtle)] group-hover:border-[color:var(--edge-strong)] group-hover:bg-white/[0.09] transition-[background-color,border-color,transform] duration-[var(--dur-focus)] ease-[var(--ease-focus)] active:scale-95">
            <img
              src={PHERIELIUM_LOGO_PATH}
              alt=""
              className="ctl-icon object-contain grayscale brightness-200 opacity-90 group-hover:opacity-100 transition-opacity"
            />
          </div>
          <span className="font-display font-bold text-[length:var(--fs-heading)] leading-none tracking-tight bg-gradient-to-b from-[#FFFFFF] to-[#999999] bg-clip-text text-transparent">
            Pherielium
          </span>
        </button>
      </div>

      {/* 2. Center: Console Library Tabs (TODOS OS JOGOS, FAVORITOS, Custom Filters, +).
          Coluna central do grid (1fr auto 1fr) => centralizada em relacao a tela;
          max-width impede que muitas abas invadam os grupos laterais. */}
      <div
        className="relative z-10 flex w-max min-w-0 items-center justify-center justify-self-center"
        style={{ maxWidth: "calc(100vw - 2 * var(--safe-x) - 2 * var(--header-side-reserve))" }}
      >
        {showTabsAndSearch && (
          <ConsoleLibraryTabs
            activeCategory={activeCategory}
            onSelectTab={onSelectCategory}
            gamepadFamily={gamepadFamily}
            isGamepadConnected={isGamepadConnected}
            playSound={playSound}
            games={games}
          />
        )}
      </div>

      {/* 3. Right: Secondary Actions (Search, Add, Filters, Clock, Profile) */}
      <div className="flex min-w-0 items-center justify-end gap-[var(--gap-inline)] justify-self-end">
        {showTabsAndSearch && (
          <>
            {/* Search: o slot mantém o tamanho de um botão; a pílula se expande para a
                direita, por cima de +/filtros/relógio (que somem), sem empurrar o layout
                nem invadir a pill de abas. */}
            <div className="relative z-20 h-[var(--control-h)] w-[var(--control-h)] shrink-0">
            <div
              style={searchExpanded ? { width: "var(--search-open-w)" } : undefined}
              className={`ctl-circle !absolute left-0 top-0 justify-start overflow-hidden transition-[width,border-color] duration-[var(--dur-focus)] ease-[var(--ease-focus)] ${
                searchExpanded ? "!border-[color:var(--edge-selected)] !bg-[color:var(--surface-raised)]" : ""
              }`}
            >
              <button
                type="button"
                onClick={handleSearchClick}
                className={`group absolute left-0 top-0 flex h-full w-[var(--control-h)] items-center justify-center transition-colors z-10 ${
                  searchExpanded
                    ? "pointer-events-none"
                    : "hover:bg-white/[0.08] cursor-pointer"
                }`}
                aria-label="Abrir pesquisa"
                title="Pesquisar"
              >
                <Search
                  className={`ctl-icon transition-colors ${
                    searchExpanded
                      ? "text-white/40"
                      : "text-white/60 group-hover:text-white"
                  }`}
                />
              </button>

              <input
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={() => onToggleSearch(true)}
                onBlur={() => {
                  if (!searchTerm) onToggleSearch(false);
                }}
                placeholder="Buscar..."
                className={`absolute left-0 top-0 h-full w-full pl-[var(--control-h)] ${searchTerm ? "pr-[var(--control-h)]" : "pr-3"} text-[length:var(--fs-caption)] text-white placeholder:text-white/35 bg-transparent outline-none transition-opacity duration-[var(--dur-focus)] ${
                  searchExpanded
                    ? "opacity-100"
                    : "opacity-0 pointer-events-none"
                }`}
              />

              {searchTerm && (
                <button
                  type="button"
                  aria-label="Limpar pesquisa"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSearchChange("");
                    searchInputRef.current?.focus();
                    playSound("back");
                  }}
                  className="absolute right-1 top-1/2 flex h-[calc(var(--control-h)-8px)] w-[calc(var(--control-h)-8px)] -translate-y-1/2 items-center justify-center rounded-full hover:bg-white/10 transition-colors z-10"
                >
                  <X className="h-[45%] w-[45%] text-white/50 hover:text-white" />
                </button>
              )}
            </div>
            </div>

            {/* Controles cobertos pela busca aberta */}
            <div
              className={`flex items-center gap-[var(--gap-inline)] transition-opacity duration-[var(--dur-focus)] ease-[var(--ease-focus)] ${
                searchExpanded ? "pointer-events-none opacity-0" : ""
              }`}
              aria-hidden={searchExpanded}
            >

            {/* Add Game Button (+) */}
            <button
              type="button"
              onClick={() => {
                onOpenAddGame();
                playSound("showModal");
              }}
              title="Adicionar Jogo"
              aria-label="Adicionar jogo"
              className="ctl-circle"
            >
              <Plus className="ctl-icon" />
            </button>

            {/* Filter / Context Menu Button */}
            <button
              type="button"
              onClick={() => {
                onOpenFilterModal();
                playSound("select");
              }}
              title="Filtros da biblioteca"
              aria-label="Filtros"
              data-active={hasActiveFilters}
              className="ctl-circle"
            >
              <SlidersHorizontal className="ctl-icon" />
            </button>

            {/* Live Clock (omitido em janelas estreitas para nao invadir a pill de abas) */}
            <div className="hidden min-[1360px]:block">
              <TopBarClock />
            </div>
            </div>
          </>
        )}
        {!showTabsAndSearch && (
          <div className="hidden min-[1360px]:block">
            <TopBarClock />
          </div>
        )}

        {/* User Profile */}
        <ProfileDropdown
          userDisplay={userDisplay}
          email={userEmail}
          avatarUrl={userAvatarUrl}
          userLevel={userLevel}
          language={language}
          playSound={playSound}
          onOpenProfile={onOpenProfile}
          onOpenSettings={onOpenSettings}
          onLogout={onLogout}
        />
      </div>
    </motion.header>
  );
};

export default React.memo(HomeTopNav);
