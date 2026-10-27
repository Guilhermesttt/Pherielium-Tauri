import React, { useState, useMemo, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search,
  ChevronDown,
  LayoutGrid,
  ListFilter,
  Sparkles,
  MoreVertical,
  ArrowUpRight,
  PackageOpen,
  CheckCircle2,
  FolderPlus,
} from "lucide-react";
import type { Game } from "../types/domain";
import { usePreferences } from "../context/PreferencesContext";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { useGamepadNavigation } from "../hooks/useGamepadNavigation";
import { useGamepadButton } from "../context/GamepadContext";
import ModGameDetailPanel, {
  type InstalledModEntry,
} from "../components/mods/ModGameDetailPanel";
import { GhostSelect } from "../components/ui/GhostSelect";
import { installedModsStorageKey } from "../services/installedMods";
import {
  ALL_CATEGORIES,
  MODS_SORT_OPTIONS,
  MODS_STATUS_OPTIONS,
  asSortOrder,
  asStatusFilter,
  distinctCategories,
  filterAndSortMods,
  type ModsSortOrder,
  type ModsStatusFilter,
} from "../services/modsListing";

interface ModsPageProps {
  uid: string;
  games: Game[];
  /** Jogo cuja página de mods já abre ao entrar (vindo de "Gerenciar mods completo" na tela do jogo). */
  initialGameId?: string | null;
  /** Avisa o Home quando a página de um jogo abre ou fecha, para ele travar as gavetas laterais. */
  onGameOpenChange?: (isOpen: boolean) => void;
}

const MODS_PREFS_KEY = "pherielium:mods:filters:v1";

/** Filtros guardados da última vez; qualquer valor inválido volta ao padrão. */
const readModsPrefs = (): { category: string; status: ModsStatusFilter; sort: ModsSortOrder } => {
  try {
    const raw = JSON.parse(localStorage.getItem(MODS_PREFS_KEY) || "{}") as Record<string, unknown>;
    return {
      category: typeof raw.category === "string" && raw.category ? raw.category : ALL_CATEGORIES,
      status: asStatusFilter(raw.status),
      sort: asSortOrder(raw.sort),
    };
  } catch {
    return { category: ALL_CATEGORIES, status: "ALL", sort: "AZ" };
  }
};

const storageKeys = {
  folders: (uid: string) => `checkpoint_mod_game_folders_${uid}`,
  domains: (uid: string) => `checkpoint_mod_game_domains_${uid}`,
  installed: installedModsStorageKey,
};

const readRecord = <T,>(key: string): Record<string, T> => {
  try {
    const value = JSON.parse(localStorage.getItem(key) || "{}");
    return value && typeof value === "object" && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
};

const normalizeInstalledMods = (
  record: Record<string, InstalledModEntry[]>,
): Record<string, InstalledModEntry[]> =>
  Object.fromEntries(
    Object.entries(record).map(([gameId, mods]) => [
      gameId,
      (Array.isArray(mods) ? mods : []).map((mod) => {
        if (mod.enabled && !mod.manifestPath) {
          return { ...mod, enabled: false, status: "downloaded" as const };
        }
        return mod;
      }),
    ]),
  );

export const getGameArtwork = (game: Game): string => {
  if (game.cardImage) return game.cardImage;
  if (game.image && (game.image.startsWith("http") || game.image.startsWith("data:"))) return game.image;
  if (game.backgroundImage) return game.backgroundImage;
  if (game.steamAppId) {
    return `https://cdn.cloudflare.steamstatic.com/steam/apps/${game.steamAppId}/header.jpg`;
  }
  return game.image || "";
};

// ============================================================
// MOD GAME CARD MEMOIZADO
// ============================================================

interface ModGameCardProps {
  game: Game;
  index: number;
  gameModsCount: number;
  activeModsCount: number;
  hasFolder: boolean;
  artwork: string;
  totalGames: number;
  onSelectGame: (game: Game) => void;
  playSound?: (type: any) => void;
}

const ModGameCard = React.memo<ModGameCardProps>(
  ({
    game,
    index,
    gameModsCount,
    activeModsCount,
    hasFolder,
    artwork,
    totalGames,
    onSelectGame,
    playSound,
  }) => {
    const handleCardClick = useCallback(() => {
      playSound?.("select");
      onSelectGame(game);
    }, [game, onSelectGame, playSound]);

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          playSound?.("select");
          onSelectGame(game);
        }
      },
      [game, onSelectGame, playSound],
    );

    const handleMouseEnter = useCallback(() => {
      playSound?.("hover");
    }, [playSound]);

    return (
      <div
        data-gamepad-id={`mods-card-${index}`}
        data-gamepad-nav-up={index < 4 ? "mods-sort" : `mods-card-${index - 4}`}
        data-gamepad-nav-down={index + 4 < totalGames ? `mods-card-${index + 4}` : undefined}
        tabIndex={0}
        role="button"
        aria-label={`Gerenciar mods de ${game.title}`}
        onClick={handleCardClick}
        onKeyDown={handleKeyDown}
        className="group relative flex cursor-pointer flex-col justify-between rounded-[var(--corner-md)] bg-[var(--tone-1)] p-3 text-left transition-colors duration-[var(--dur-2)] hover:bg-[var(--tone-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
      >
        <div>
          <div className="relative mb-4 aspect-[460/215] w-full overflow-hidden rounded-[var(--corner-sm)] bg-[var(--tone-3)]">
            {artwork ? (
              <img
                src={artwork}
                alt=""
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-[var(--dur-3)] ease-[var(--spring)] group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center px-2 text-center text-[length:var(--step-0)] font-semibold text-[var(--ink-faint)]">
                {game.title}
              </div>
            )}
          </div>

          <div className="px-1">
            <h3 className="truncate text-[length:var(--step-1)] font-semibold text-[var(--ink)]">{game.title}</h3>
            <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[length:var(--step-0)] text-[var(--ink-muted)]">
              {hasFolder ? (
                <span className="inline-flex items-center gap-1.5 text-[var(--ink)]">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                  Pasta vinculada
                </span>
              ) : (
                <span>Sem pasta vinculada</span>
              )}
              {gameModsCount > 0 && (
                <>
                  <span aria-hidden="true" className="text-[var(--ink-faint)]">·</span>
                  <span className="tabular-nums">
                    {activeModsCount > 0 ? `${activeModsCount} de ${gameModsCount} ativos` : `${gameModsCount} mods`}
                  </span>
                </>
              )}
            </p>
          </div>
        </div>

        {/* Ação: a pílula tonal do sistema (o cartão inteiro é o botão; isto só diz o que acontece) */}
        <div
          aria-hidden="true"
          className="mt-4 flex h-10 w-full items-center justify-center gap-2 rounded-[var(--node)] bg-[var(--tone-3)] text-[length:var(--step-0)] font-semibold text-[var(--ink)] transition-colors group-hover:bg-[var(--tone-4)]"
        >
          {!hasFolder ? (
            <>
              <FolderPlus className="h-4 w-4 text-[var(--ink-muted)]" />
              <span>Vincular pasta</span>
            </>
          ) : gameModsCount === 0 ? (
            <>
              <PackageOpen className="h-4 w-4 text-[var(--ink-muted)]" />
              <span>Explorar mods</span>
            </>
          ) : (
            <span>Gerenciar ({gameModsCount})</span>
          )}
        </div>
      </div>
    );
  },
  (prev, next) =>
    prev.game.id === next.game.id &&
    prev.index === next.index &&
    prev.gameModsCount === next.gameModsCount &&
    prev.activeModsCount === next.activeModsCount &&
    prev.hasFolder === next.hasFolder &&
    prev.artwork === next.artwork &&
    prev.totalGames === next.totalGames &&
    prev.onSelectGame === next.onSelectGame &&
    prev.playSound === next.playSound,
);

// ============================================================
// PÁGINA PRINCIPAL DE MODS
// ============================================================

export const ModsPage: React.FC<ModsPageProps> = ({ uid, games, initialGameId = null, onGameOpenChange }) => {
  const { effectsVolume, soundTheme, notificationVolume } = usePreferences();
  const { playSound } = useSoundEffects(
    effectsVolume / 100,
    soundTheme,
    notificationVolume / 100,
  );

  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>(() => readModsPrefs().category);
  const [statusFilter, setStatusFilter] = useState<ModsStatusFilter>(() => readModsPrefs().status);
  const [sortOrder, setSortOrder] = useState<ModsSortOrder>(() => readModsPrefs().sort);
  const [selectedGame, setSelectedGame] = useState<Game | null>(
    () => games.find((game) => game.id === initialGameId) ?? null,
  );
  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Já na página de mods (biblioteca carregada depois, ou outro jogo pedido): abre o jogo pedido
  // (uma vez por pedido: depois de fechar a página, uma atualização da biblioteca não a reabre)
  const appliedInitialRef = React.useRef<string | null>(selectedGame?.id ?? null);
  useEffect(() => {
    if (!initialGameId || appliedInitialRef.current === initialGameId) return;
    const requested = games.find((game) => game.id === initialGameId);
    if (!requested) return;
    appliedInitialRef.current = initialGameId;
    setSelectedGame(requested);
  }, [initialGameId, games]);

  // O Home trava a sidebar e a gaveta de amigos enquanto a página de um jogo está aberta
  const isGameOpen = Boolean(selectedGame);
  useEffect(() => {
    onGameOpenChange?.(isGameOpen);
    return () => onGameOpenChange?.(false);
  }, [isGameOpen, onGameOpenChange]);

  useGamepadNavigation({
    scrollRef: scrollRef as React.RefObject<HTMLElement>,
    enabled: !selectedGame,
    disableX: true,
    disableO: true,
  });

  const [gameFolders, setGameFolders] = useState<Record<string, string>>(() =>
    readRecord<string>(storageKeys.folders(uid)),
  );
  const [gameDomains, setGameDomains] = useState<Record<string, string>>(() =>
    readRecord<string>(storageKeys.domains(uid)),
  );
  const [installedByGame, setInstalledByGame] = useState<
    Record<string, InstalledModEntry[]>
  >(() =>
    normalizeInstalledMods(
      readRecord<InstalledModEntry[]>(storageKeys.installed(uid)),
    ),
  );

  useEffect(() => {
    localStorage.setItem(
      storageKeys.installed(uid),
      JSON.stringify(installedByGame),
    );
  }, [installedByGame, uid]);

  const chooseGameFolder = useCallback(async () => {
    if (!selectedGame || !window.electronAPI?.selectModGameDirectory) return;
    const folder = await window.electronAPI.selectModGameDirectory(selectedGame.title);
    if (!folder) return;
    setGameFolders((prev) => {
      const next = { ...prev, [selectedGame.id]: folder };
      localStorage.setItem(storageKeys.folders(uid), JSON.stringify(next));
      return next;
    });
  }, [selectedGame, uid]);

  const saveGameDomain = useCallback((domain: string) => {
    if (!selectedGame) return;
    setGameDomains((prev) => {
      const next = { ...prev, [selectedGame.id]: domain };
      localStorage.setItem(storageKeys.domains(uid), JSON.stringify(next));
      return next;
    });
  }, [selectedGame, uid]);

  const toggleInstalledMod = useCallback((
    modId: string,
    enabled: boolean,
  ) => {
    if (!selectedGame) return;
    setInstalledByGame((prev) => {
      const nextForGame: InstalledModEntry[] = (
        prev[selectedGame.id] || []
      ).map((mod) =>
        mod.id === modId
          ? {
            ...mod,
            enabled,
            status: enabled ? "installed" : "downloaded",
            ...(!enabled ? { manifestPath: undefined } : {}),
          }
          : mod,
      );
      const next = { ...prev, [selectedGame.id]: nextForGame };
      localStorage.setItem(storageKeys.installed(uid), JSON.stringify(next));
      return next;
    });
  }, [selectedGame, uid]);

  const removeInstalledMod = useCallback((modId: string) => {
    if (!selectedGame) return;
    setInstalledByGame((prev) => {
      const next = {
        ...prev,
        [selectedGame.id]: (prev[selectedGame.id] || []).filter((mod) => mod.id !== modId),
      };
      localStorage.setItem(storageKeys.installed(uid), JSON.stringify(next));
      return next;
    });
  }, [selectedGame, uid]);

  const recordDownloadedMod = useCallback(
    (mod: InstalledModEntry) => {
      if (!selectedGame) return;
      setInstalledByGame((current) => {
        const currentForGame = current[selectedGame.id] || [];
        const existing = currentForGame.find((entry) => entry.id === mod.id);
        const mergedMod: InstalledModEntry = existing
          ? {
            ...existing,
            ...mod,
            name: mod.name || existing.name,
            author:
              mod.author === "Nexus Mods"
                ? existing.author || mod.author
                : mod.author,
            pictureUrl: mod.pictureUrl || existing.pictureUrl,
            version: mod.version || existing.version,
            status:
              existing.status === "installed" && mod.status === "downloaded"
                ? "installed"
                : mod.status,
            enabled:
              existing.status === "installed" && mod.status === "downloaded"
                ? existing.enabled
                : mod.enabled,
          }
          : mod;
        const nextForGame = [
          mergedMod,
          ...currentForGame.filter((entry) => entry.id !== mod.id),
        ];
        const next = { ...current, [selectedGame.id]: nextForGame };
        localStorage.setItem(storageKeys.installed(uid), JSON.stringify(next));
        return next;
      });
    },
    [selectedGame, uid],
  );

  const handleDownloadRecorded = useCallback(
    (mod: InstalledModEntry) => {
      recordDownloadedMod(mod);
    },
    [recordDownloadedMod],
  );

  const enrichedGames = useMemo(() => {
    return games.map((game) => {
      const gameMods = installedByGame[game.id] || [];
      const activeMods = gameMods.filter((m) => m.enabled).length;
      const artwork = getGameArtwork(game);
      const hasFolder = Boolean(gameFolders[game.id]);
      return {
        game,
        gameModsCount: gameMods.length,
        activeModsCount: activeMods,
        hasFolder,
        artwork,
      };
    });
  }, [games, installedByGame, gameFolders]);

  const categoryOptions = useMemo(
    () => [
      { value: ALL_CATEGORIES, label: "Todas as Categorias" },
      ...distinctCategories(enrichedGames).map((category) => ({ value: category, label: category })),
    ],
    [enrichedGames],
  );

  // Uma categoria guardada que não existe mais (jogo removido) não pode esvaziar a lista.
  const activeCategory = categoryOptions.some((option) => option.value === categoryFilter) ? categoryFilter : ALL_CATEGORIES;

  const filteredGames = useMemo(
    () =>
      filterAndSortMods(enrichedGames, {
        query: searchTerm,
        status: statusFilter,
        category: activeCategory,
        sort: sortOrder,
      }),
    [enrichedGames, searchTerm, statusFilter, activeCategory, sortOrder],
  );

  // Lembra os filtros entre aberturas da janela (preferência local, só deste PC).
  useEffect(() => {
    try {
      localStorage.setItem(MODS_PREFS_KEY, JSON.stringify({ category: categoryFilter, status: statusFilter, sort: sortOrder }));
    } catch (error) {
      console.warn("[ModsPage] não foi possível guardar os filtros:", error);
    }
  }, [categoryFilter, statusFilter, sortOrder]);

  const configuredGames = useMemo(
    () => games.filter((game) => Boolean(gameFolders[game.id])).length,
    [games, gameFolders],
  );

  const { totalInstalledMods, activeInstalledMods } = useMemo(() => {
    const allMods = Object.values(installedByGame).flat();
    return {
      totalInstalledMods: allMods.length,
      activeInstalledMods: allMods.filter((m) => m.enabled).length,
    };
  }, [installedByGame]);

  const handleSelectGame = useCallback((game: Game) => {
    setSelectedGame(game);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedGame(null);
  }, []);

  useGamepadButton(
    "O",
    () => {
      if (selectedGame) {
        playSound?.("back");
        setSelectedGame(null);
      }
    },
    Boolean(selectedGame),
    15,
  );

  return (
    <motion.div
      ref={scrollRef}
      data-system-page
      className="flex flex-col min-h-0 flex-1 overflow-y-auto thin-scrollbar hub-scroll"
      style={{ padding: "40px 40px 64px", contain: "layout paint", transform: "translate3d(0,0,0)", willChange: "transform" }}
    >
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <header className="flex flex-col gap-6 pb-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="font-display text-[length:var(--step-5)] font-semibold leading-[1.02] tracking-[-0.04em] text-[var(--ink)]">
              Mods
            </h1>
            <p className="mt-3 max-w-xl text-[length:var(--step-1)] leading-relaxed text-[var(--ink-muted)]">
              Vincule a pasta de cada jogo e ative os mods da comunidade sem sair do hub.
            </p>
          </div>

          <dl className="flex flex-wrap gap-x-8 gap-y-3">
            {[
              { value: games.length, label: "na biblioteca" },
              { value: configuredGames, label: "pastas vinculadas" },
              { value: `${activeInstalledMods} de ${totalInstalledMods}`, label: "mods ativos" },
            ].map((metric) => (
              <div key={metric.label} className="flex flex-col-reverse">
                <dt className="mt-1 text-[length:var(--step-0)] text-[var(--ink-muted)]">{metric.label}</dt>
                <dd className="text-[length:var(--step-3)] font-semibold tabular-nums leading-none text-[var(--ink)]">{metric.value}</dd>
              </div>
            ))}
          </dl>
        </header>

        {/* Content Tabs / Main Layout */}
        <div>
          {/* Main Grid View */}
          <div className="space-y-6">
            {/* Filter and Search Bar */}
            <div className="flex flex-col items-stretch justify-between gap-3 md:flex-row md:items-center">
              {/* Search Field */}
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-faint)]" aria-hidden="true" />
                <input
                  id="mods-search-input"
                  type="search"
                  aria-label="Pesquisar jogos com suporte a mods"
                  placeholder="Pesquisar jogos"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-11 w-full rounded-[var(--node)] bg-[var(--tone-2)] pl-11 pr-4 text-[length:var(--step-0)] text-[var(--ink)] placeholder:text-[var(--ink-faint)] outline-none transition-colors focus:bg-[var(--tone-3)] focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
                />
              </div>

              {/* Status and Sort Controls */}
              <div className="flex items-center gap-2 flex-wrap z-50">
                <div className="relative z-[52]">
                  <GhostSelect
                    value={activeCategory}
                    onChange={(val) => setCategoryFilter(val)}
                    options={categoryOptions}
                    className="w-44"
                  />
                </div>

                <div className="relative z-[51]">
                  <GhostSelect
                    value={statusFilter}
                    onChange={(val) => setStatusFilter(asStatusFilter(val))}
                    options={MODS_STATUS_OPTIONS}
                    className="w-40"
                  />
                </div>

                <div className="relative z-[50]">
                  <GhostSelect
                    value={sortOrder}
                    onChange={(val) => setSortOrder(asSortOrder(val))}
                    options={MODS_SORT_OPTIONS}
                    className="w-44"
                  />
                </div>
              </div>

              {/* Grade/lista: os botões ainda não trocam a visualização (pendência anterior ao redesign). */}
              <div className="flex items-center rounded-[var(--node)] bg-[var(--tone-2)] p-1">
                <button
                  type="button"
                  title="Visualização em Grade"
                  aria-label="Visualização em grade"
                  className="flex h-9 w-9 items-center justify-center rounded-[var(--node)] bg-[var(--tone-4)] text-[var(--ink)]"
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  title="Visualização em Lista"
                  aria-label="Visualização em lista"
                  className="flex h-9 w-9 items-center justify-center rounded-[var(--node)] text-[var(--ink-muted)] hover:text-[var(--ink)]"
                >
                  <ListFilter className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </div>
            {/* Games Grid Memoizado */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {filteredGames.map(({ game, gameModsCount, activeModsCount, hasFolder, artwork }, index) => (
                <ModGameCard
                  key={game.id}
                  game={game}
                  index={index}
                  gameModsCount={gameModsCount}
                  activeModsCount={activeModsCount}
                  hasFolder={hasFolder}
                  artwork={artwork}
                  totalGames={filteredGames.length}
                  onSelectGame={handleSelectGame}
                  playSound={playSound}
                />
              ))}
            </div>

            <section className="flex flex-col items-start justify-between gap-5 rounded-[var(--corner-lg)] bg-[var(--tone-1)] p-6 sm:flex-row sm:items-center">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--node)] bg-[var(--tone-3)] text-[var(--ink)]">
                  <Sparkles className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="text-[length:var(--step-2)] font-semibold text-[var(--ink)]">
                    Descubra novos mods para seus jogos favoritos
                  </h2>
                  <p className="mt-1 text-[length:var(--step-0)] text-[var(--ink-muted)]">
                    Milhares de mods da comunidade no Nexus Mods.
                  </p>
                </div>
              </div>

              <a
                href="https://www.nexusmods.com"
                target="_blank"
                rel="noreferrer"
                onMouseEnter={() => playSound?.("hover")}
                className="inline-flex h-11 shrink-0 cursor-pointer items-center gap-2 rounded-[var(--node)] bg-[var(--ink)] px-5 text-[length:var(--step-0)] font-semibold text-[var(--tone-0)] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--tone-1)]"
              >
                <span>Explorar o Nexus Mods</span>
                <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
              </a>
            </section>
          </div>
        </div>
      </div>

      {/* Detalhes do Jogo Selecionado com Mods */}
      {selectedGame && (
        <ModGameDetailPanel
          game={selectedGame}
          isOpen={Boolean(selectedGame)}
          gameFolder={gameFolders[selectedGame.id] || ""}
          gameDomain={gameDomains[selectedGame.id] || ""}
          installedMods={installedByGame[selectedGame.id] || []}
          onClose={handleCloseDetail}
          onChooseFolder={chooseGameFolder}
          onSaveDomain={saveGameDomain}
          onToggleMod={toggleInstalledMod}
          onRemoveMod={removeInstalledMod}
          onDownloadRecorded={handleDownloadRecorded}
        />
      )}
    </motion.div>
  );
};

export default React.memo(ModsPage);


