import React, { useRef } from "react";
import { motion } from "framer-motion";
import { Search, Plus, SlidersHorizontal, X, RefreshCw, MoreHorizontal } from "lucide-react";
import { PHERIELIUM_LOGO_PATH } from "../../constants/assets";
import { FOCUS_TRANSITION } from "../../styles/motion";
import { ConsoleLibraryTabs } from "./ConsoleLibraryTabs";
import { TopBarClock } from "./TopBarClock";
import { ProfileDropdown } from "../ui/ProfileDropdown";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { EpicBrandIcon, SteamBrandIcon } from "../Sidebar";
import type { Game } from "../../types/domain";
import type { GamepadFamily } from "../../context/GamepadContext";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import type { LauncherLanguage } from "../../context/PreferencesContext";
import type { PlayerLevelInfo } from "../../utils/trophyTiers";

/** "Última vez há 12 min" para o menu de sincronização. */
function syncAgo(at: number): string {
  if (!at) return "Ainda não sincronizada";
  const min = Math.max(0, Math.round((Date.now() - at) / 60_000));
  if (min < 1) return "Sincronizada agora";
  if (min < 60) return `Sincronizada há ${min} min`;
  const h = Math.round(min / 60);
  return h < 24 ? `Sincronizada há ${h} h` : `Sincronizada há ${Math.round(h / 24)} d`;
}

const MENU_ITEM =
  "cursor-pointer gap-2.5 rounded-[var(--node)] px-3.5 py-2 text-[length:var(--fs-caption)] font-medium text-[var(--ink)] focus:bg-[var(--tone-4)]";

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
  onSyncLibraries?: () => void;
  isSyncingLibraries?: boolean;
  /** sincronizar só a Steam / só a Epic (só aparecem com a conta conectada) */
  onSyncSteam?: () => void;
  onSyncEpic?: () => void;
  isSyncingSteam?: boolean;
  isSyncingEpic?: boolean;
  /** quando cada plataforma foi sincronizada pela última vez (ms; 0 = nunca) */
  lastSteamSyncAt?: number;
  lastEpicSyncAt?: number;
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
  onSyncLibraries,
  isSyncingLibraries = false,
  onSyncSteam,
  onSyncEpic,
  isSyncingSteam = false,
  isSyncingEpic = false,
  lastSteamSyncAt = 0,
  lastEpicSyncAt = 0,
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
      className="shrink-0 flex flex-col gap-[calc(var(--gap-section)*1.4)] px-[var(--safe-x)] pt-[var(--header-pt-safe)] pb-[var(--gap-section)] relative z-30 select-none will-change-transform"
      role="banner"
    >
      {/* 1. Linha de status: marca e hora à esquerda; busca, menu e perfil à direita */}
      <div className="flex items-center justify-between gap-[var(--gap-inline)]">
      <div className="flex min-w-0 items-center gap-[var(--gap-inline)]">
        <button
          type="button"
          onClick={onToggleSidebar}
          className="flex items-center gap-[var(--gap-inline)] group cursor-pointer"
          title="Abrir menu lateral"
          aria-label="Menu principal Pherielium"
        >
          <div className="flex h-[var(--control-h)] w-[var(--control-h)] shrink-0 items-center justify-center rounded-[var(--node)] bg-[color-mix(in_srgb,var(--tone-2)_88%,transparent)] group-hover:bg-[var(--tone-3)] transition-[background-color,transform] duration-[var(--dur-focus)] ease-[var(--ease-focus)] active:scale-95">
            <img
              src={PHERIELIUM_LOGO_PATH}
              alt=""
              className="ctl-icon object-contain grayscale brightness-200 opacity-90 group-hover:opacity-100 transition-opacity"
            />
          </div>
        </button>
        <TopBarClock />
      </div>

      <div className="flex min-w-0 items-center justify-end gap-[var(--gap-inline)]">
        {showTabsAndSearch && (
          <>
            {/* Controles cobertos pela busca aberta */}
            <div
              className={`flex items-center gap-[var(--gap-inline)] transition-opacity duration-[var(--dur-focus)] ease-[var(--ease-focus)] ${
                searchExpanded ? "pointer-events-none opacity-0" : ""
              }`}
              aria-hidden={searchExpanded}
              // cobertos pela busca: fora da ordem de Tab e do leitor de tela enquanto estão invisíveis
              inert={searchExpanded}
            >

            {/* Ações da biblioteca num menu só: adicionar, filtrar e sincronizar */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  title="Biblioteca"
                  aria-label="Ações da biblioteca"
                  data-active={hasActiveFilters}
                  className="ctl-circle"
                  onPointerEnter={() => playSound("hover")}
                >
                  <MoreHorizontal className={`ctl-icon ${isSyncingLibraries ? "animate-pulse" : ""}`} />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" sideOffset={10} className="min-w-[240px] rounded-[var(--corner-md)] border-0 bg-[var(--tone-3)] p-1.5">
                <DropdownMenuItem
                  onSelect={() => {
                    onOpenAddGame();
                    playSound("showModal");
                  }}
                  className={MENU_ITEM}
                >
                  <Plus className="h-4 w-4 text-[var(--ink-muted)]" />
                  Adicionar jogo
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() => {
                    onOpenFilterModal();
                    playSound("select");
                  }}
                  className={MENU_ITEM}
                >
                  <SlidersHorizontal className="h-4 w-4 text-[var(--ink-muted)]" />
                  <span className="flex min-w-0 flex-col leading-tight">
                    <span>Plataforma e filtros</span>
                    {hasActiveFilters && (
                      <span className="text-[length:var(--fs-label)] font-normal text-[var(--ink-faint)]">Filtros ativos</span>
                    )}
                  </span>
                  {/* o atalho que quase ninguém acha sozinho */}
                  <span className="console-hints ml-auto flex items-center gap-1 pl-4" aria-hidden="true">
                    <kbd>Alt</kbd>
                    <span>+</span>
                    <kbd>Scroll</kbd>
                  </span>
                </DropdownMenuItem>
                {onSyncLibraries && (
                  <>
                    <DropdownMenuSeparator className="bg-[var(--tone-4)]" />
                    <DropdownMenuItem
                      disabled={isSyncingLibraries}
                      onSelect={() => {
                        onSyncLibraries();
                        playSound("select");
                      }}
                      className={MENU_ITEM}
                    >
                      <RefreshCw className={`h-4 w-4 text-[var(--ink-muted)] ${isSyncingLibraries ? "animate-spin" : ""}`} />
                      {isSyncingLibraries ? "Sincronizando…" : "Sincronizar tudo"}
                    </DropdownMenuItem>
                    {onSyncSteam && (
                      <DropdownMenuItem
                        disabled={isSyncingSteam}
                        onSelect={() => {
                          onSyncSteam();
                          playSound("select");
                        }}
                        className={MENU_ITEM}
                      >
                        <SteamBrandIcon className="h-4 w-4 text-[var(--ink-muted)]" />
                        <span className="flex min-w-0 flex-col leading-tight">
                          <span>{isSyncingSteam ? "Sincronizando Steam…" : "Só a Steam"}</span>
                          <span className="text-[length:var(--fs-label)] font-normal text-[var(--ink-faint)]">{syncAgo(lastSteamSyncAt)}</span>
                        </span>
                      </DropdownMenuItem>
                    )}
                    {onSyncEpic && (
                      <DropdownMenuItem
                        disabled={isSyncingEpic}
                        onSelect={() => {
                          onSyncEpic();
                          playSound("select");
                        }}
                        className={MENU_ITEM}
                      >
                        <EpicBrandIcon className="h-4 w-4 text-[var(--ink-muted)]" />
                        <span className="flex min-w-0 flex-col leading-tight">
                          <span>{isSyncingEpic ? "Sincronizando Epic…" : "Só a Epic Games"}</span>
                          <span className="text-[length:var(--fs-label)] font-normal text-[var(--ink-faint)]">{syncAgo(lastEpicSyncAt)}</span>
                        </span>
                      </DropdownMenuItem>
                    )}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            </div>

            {/* Busca: o slot mantém o tamanho de um botão; a pílula cresce para a esquerda, por
                cima do menu (que some), sem empurrar o perfil. */}
            <div className="relative z-20 h-[var(--control-h)] w-[var(--control-h)] shrink-0">
            <div
              style={searchExpanded ? { width: "min(360px, 36vw)" } : undefined}
              className={`ctl-circle !absolute right-0 top-0 justify-start overflow-hidden transition-[width,border-color] duration-[var(--dur-focus)] ease-[var(--ease-focus)] ${
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
                      ? "text-[var(--ink-faint)]"
                      : "text-[var(--ink-muted)] group-hover:text-white"
                  }`}
                />
              </button>

              <input aria-label="Buscar na biblioteca"
                ref={searchInputRef}
                type="text"
                value={searchTerm}
                onChange={(e) => onSearchChange(e.target.value)}
                onFocus={() => onToggleSearch(true)}
                onBlur={() => {
                  if (!searchTerm) onToggleSearch(false);
                }}
                placeholder="Buscar..."
                className={`absolute left-0 top-0 h-full w-full pl-[var(--control-h)] ${searchTerm ? "pr-[var(--control-h)]" : "pr-3"} text-[length:var(--fs-caption)] text-white placeholder:text-[var(--ink-faint)] bg-transparent outline-none transition-opacity duration-[var(--dur-focus)] ${
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
                  <X className="h-[45%] w-[45%] text-[var(--ink-muted)] hover:text-white" />
                </button>
              )}
            </div>
            </div>

          </>
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
      </div>

      {/* 2. Abas da biblioteca: linha própria, alinhadas à esquerda */}
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
    </motion.header>
  );
};

export default React.memo(HomeTopNav);
