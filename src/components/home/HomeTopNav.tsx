import React, { useRef } from "react";
import { motion } from "framer-motion";
import { Search, Plus, SlidersHorizontal, X } from "lucide-react";
import { PHERIELIUM_LOGO_PATH } from "../../constants/assets";
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

  return (
    <motion.header
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="shrink-0 flex items-center justify-between px-8 sm:px-12 pt-7 pb-4 relative z-30 select-none will-change-transform"
      role="banner"
    >
      {/* 1. Left: Pherielium Brand Identity */}
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex items-center gap-3 group cursor-pointer focus-visible:outline-none"
          title="Abrir menu lateral"
          aria-label="Menu principal Pherielium"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] border border-white/10 group-hover:border-white/25 group-hover:bg-white/[0.09] shadow-sm transition-all active:scale-95">
            <img
              src={PHERIELIUM_LOGO_PATH}
              alt=""
              className="h-5 w-5 object-contain grayscale brightness-200 opacity-90 group-hover:opacity-100 transition-opacity"
            />
          </div>
          <span className="font-display font-bold text-lg sm:text-xl tracking-tight bg-gradient-to-b from-[#FFFFFF] to-[#999999] bg-clip-text text-transparent">
            Pherielium
          </span>
        </button>
      </div>

      {/* 2. Center: Console Library Tabs (TODOS OS JOGOS, FAVORITOS, Custom Filters, +) */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-10 flex items-center justify-center">
        {showTabsAndSearch && (
          <div className="pointer-events-auto">
            <ConsoleLibraryTabs
              activeCategory={activeCategory}
              onSelectTab={onSelectCategory}
              gamepadFamily={gamepadFamily}
              isGamepadConnected={isGamepadConnected}
              playSound={playSound}
              games={games}
            />
          </div>
        )}
      </div>

      {/* 3. Right: Secondary Actions (Search, Add, Filters, Clock, Profile) */}
      <div className="flex items-center gap-3">
        {showTabsAndSearch && (
          <>
            {/* Expandable Search Pill */}
            <motion.div
              initial={false}
              animate={{
                width: searchOpen || searchTerm ? 220 : 36,
                borderColor: searchOpen || searchTerm ? "rgba(255,255,255,0.2)" : "rgba(255,255,255,0.08)",
              }}
              transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
              className="relative flex items-center h-9 rounded-full bg-black/50 overflow-hidden border backdrop-blur-xl shadow-inner"
            >
              <button
                type="button"
                onClick={handleSearchClick}
                className={`group absolute left-0 w-9 h-9 flex items-center justify-center transition-colors z-10 ${
                  searchOpen || searchTerm
                    ? "pointer-events-none"
                    : "hover:bg-white/[0.08] cursor-pointer"
                }`}
                aria-label="Abrir pesquisa"
                title="Pesquisar"
              >
                <Search
                  className={`w-4 h-4 transition-colors ${
                    searchOpen || searchTerm
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
                placeholder="Buscar jogos..."
                className={`absolute left-0 top-0 h-full w-full pl-9 pr-8 text-xs text-white placeholder:text-white/35 bg-transparent outline-none transition-opacity duration-200 ${
                  searchOpen || searchTerm
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
                  className="absolute right-2 top-1/2 -translate-y-1/2 p-1 hover:bg-white/10 rounded-full transition-all z-10"
                >
                  <X className="w-3.5 h-3.5 text-white/50 hover:text-white" />
                </button>
              )}
            </motion.div>

            {/* Add Game Button (+) */}
            <button
              type="button"
              onClick={() => {
                onOpenAddGame();
                playSound("showModal");
              }}
              title="Adicionar Jogo"
              aria-label="Adicionar jogo"
              className="flex items-center justify-center w-9 h-9 rounded-full bg-black/40 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white/70 hover:text-white backdrop-blur-xl transition-all cursor-pointer shadow-sm active:scale-95"
            >
              <Plus className="w-4 h-4" />
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
              className={`flex items-center justify-center w-9 h-9 rounded-full border backdrop-blur-xl transition-all cursor-pointer shadow-sm active:scale-95 ${
                hasActiveFilters
                  ? "bg-white/20 border-white/40 text-white shadow-[0_0_12px_rgba(255,255,255,0.2)]"
                  : "bg-black/40 hover:bg-white/10 border-white/10 hover:border-white/20 text-white/70 hover:text-white"
              }`}
            >
              <SlidersHorizontal className="w-4 h-4" />
            </button>
          </>
        )}

        {/* Live Clock */}
        <TopBarClock />

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
