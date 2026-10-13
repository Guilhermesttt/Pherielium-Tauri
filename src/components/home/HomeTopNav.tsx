import React, { useRef } from "react";
import { motion } from "framer-motion";
import { Search, Plus, SlidersHorizontal, X, RefreshCw } from "lucide-react";
import { PHERIELIUM_LOGO_PATH } from "../../constants/assets";
import { FOCUS_TRANSITION } from "../../styles/motion";
import { ConsoleLibraryTabs } from "./ConsoleLibraryTabs";
import { TopBarClock } from "./TopBarClock";
import { ProfileDropdown } from "../ui/ProfileDropdown";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../ui/dropdown-menu";
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
      className="shrink-0 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-[var(--gap-inline)] px-[var(--safe-x)] pt-[var(--header-pt-safe)] pb-[var(--gap-stack)] relative z-30 select-none will-change-transform"
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
          <div className="flex h-[var(--control-h)] w-[var(--control-h)] shrink-0 items-center justify-center rounded-[var(--node)] bg-[color-mix(in_srgb,var(--tone-2)_88%,transparent)] group-hover:bg-[var(--tone-3)] transition-[background-color,transform] duration-[var(--dur-focus)] ease-[var(--ease-focus)] active:scale-95">
            <img
              src={PHERIELIUM_LOGO_PATH}
              alt=""
              className="ctl-icon object-contain grayscale brightness-200 opacity-90 group-hover:opacity-100 transition-opacity"
            />
          </div>
          <span className="font-display font-semibold text-[length:var(--fs-heading)] leading-none tracking-[-0.03em] text-[var(--ink)]">
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
                      ? "text-[var(--ink-faint)]"
                      : "text-[var(--ink-muted)] group-hover:text-white"
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

            {/* Sincronizar: um botão só; com contas conectadas abre um menu (tudo / só Steam / só Epic) */}
            {onSyncLibraries && (onSyncSteam || onSyncEpic) ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={isSyncingLibraries}
                    title="Sincronizar jogos"
                    aria-label="Sincronizar jogos Steam e Epic"
                    className="ctl-circle"
                    onPointerEnter={() => playSound("hover")}
                  >
                    <RefreshCw className={`ctl-icon ${isSyncingLibraries ? "animate-spin" : ""}`} />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" sideOffset={10} className="min-w-[220px] rounded-[var(--corner-md)] border-0 bg-[var(--tone-3)] p-1.5">
                  <DropdownMenuItem
                    onSelect={() => {
                      onSyncLibraries();
                      playSound("select");
                    }}
                    className="cursor-pointer gap-2.5 rounded-[var(--node)] px-3.5 py-2 text-[length:var(--fs-caption)] font-medium text-[var(--ink)] focus:bg-[var(--tone-4)]"
                  >
                    <RefreshCw className="h-4 w-4 text-[var(--ink-muted)]" />
                    Sincronizar tudo
                  </DropdownMenuItem>
                  {onSyncSteam && (
                    <DropdownMenuItem
                      disabled={isSyncingSteam}
                      onSelect={() => {
                        onSyncSteam();
                        playSound("select");
                      }}
                      className="cursor-pointer gap-2.5 rounded-[var(--node)] px-3.5 py-2 text-[length:var(--fs-caption)] font-medium text-[var(--ink)] focus:bg-[var(--tone-4)]"
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
                      className="cursor-pointer gap-2.5 rounded-[var(--node)] px-3.5 py-2 text-[length:var(--fs-caption)] font-medium text-[var(--ink)] focus:bg-[var(--tone-4)]"
                    >
                      <EpicBrandIcon className="h-4 w-4 text-[var(--ink-muted)]" />
                      <span className="flex min-w-0 flex-col leading-tight">
                        <span>{isSyncingEpic ? "Sincronizando Epic…" : "Só a Epic Games"}</span>
                        <span className="text-[length:var(--fs-label)] font-normal text-[var(--ink-faint)]">{syncAgo(lastEpicSyncAt)}</span>
                      </span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              onSyncLibraries && (
                <button
                  type="button"
                  onClick={() => {
                    onSyncLibraries();
                    playSound("select");
                  }}
                  disabled={isSyncingLibraries}
                  title="Sincronizar jogos da Steam e Epic"
                  aria-label="Sincronizar jogos Steam e Epic"
                  className="ctl-circle"
                >
                  <RefreshCw className={`ctl-icon ${isSyncingLibraries ? "animate-spin" : ""}`} />
                </button>
              )
            )}

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
