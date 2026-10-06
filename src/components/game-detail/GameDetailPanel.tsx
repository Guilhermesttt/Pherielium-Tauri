import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, X, ChevronLeft, ChevronRight, Camera, Play } from "lucide-react";
import type { Game } from "../../types/domain";
import type { GameDetailPanelProps } from "../../types/gameDetail";
import { DETAIL_PANEL_COPY, CATEGORY_LABELS } from "../../types/gameDetail";
import { useAuth } from "../../auth/AuthProvider";
import { usePreferences } from "../../context/PreferencesContext";
import { useNotification } from "../NotificationCenter";
import { useGamepad, useGamepadButton } from "../../context/GamepadContext";
import { useGamepadNavigation } from "../../hooks/useGamepadNavigation";
import { activateElementWithController } from "../../utils/controllerTextInput";
import { sanitizeStoreHtml } from "../../utils/sanitizeStoreHtml";
import ModalShell from "../ui/ModalShell";
import { useGameDetailState } from "../../hooks/useGameDetailState";
import { useGameDetailAsync } from "../../hooks/useGameDetailAsync";
import { useGameDetailActions } from "../../hooks/useGameDetailActions";

import { GameDetailSteamHero } from "./GameDetailSteamHero";
import { GameDetailSteamActionBar } from "./GameDetailSteamActionBar";
import { GameDetailFriends } from "./GameDetailFriends";
import { GameDetailStats } from "./GameDetailStats";
import { GameDetailAchievements } from "./GameDetailAchievements";
import { GameDetailSocialMods } from "./GameDetailSocialMods";
import { FramerCarouselThumbnails } from "../ui/framer-thumbnails";
import { ControllerButtonGlyph } from "../ui/ControllerButtonGlyph";

export const GameDetailPanel: React.FC<GameDetailPanelProps> = ({
  game,
  isOpen,
  onClose,
  playSound,
  onLibraryChanged,
  onGameHydrated,
  onOpenMods,
  currentPresenceGame,
  friends = [],
  onToggleFavorite,
  onEditGame,
}) => {
  const { user, userProfile } = useAuth();
  const { language, closeOnLaunch } = usePreferences();
  const { notify } = useNotification();
  const { isGamepadConnected, gamepadFamily, activeInputType } = useGamepad();

  const detailLanguage =
    language === "pt-BR" || language === "en-US" || language === "es-ES"
      ? language
      : "en-US";
  const copy = DETAIL_PANEL_COPY[detailLanguage] || DETAIL_PANEL_COPY["en-US"];

  const steamLogoUrl = React.useMemo(() => {
    if (!game) return null;
    if (game.steamAppId) {
      return `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppId}/logo.png`;
    }
    return (game as any).logoImage || null;
  }, [game]);

  const friendsPlayingCount = React.useMemo(() => {
    if (!game || !friends) return 0;
    const title = game.title.trim().toLowerCase();
    return friends.filter((f) => {
      if (!f.playing) return false;
      const p = f.playing.trim().toLowerCase();
      return p.includes(title) || title.includes(p) || f.status === "playing";
    }).length;
  }, [game, friends]);

  const scrollRef = React.useRef<HTMLDivElement>(null);

  // Hook de Estado Reducer
  const {
    state,
    dispatch,
    setActiveTab,
    openGallery,
    closeGallery,
    setGalleryIndex,
    openDeleteModal,
    closeDeleteModal,
    setDeleteConfirmText,
    setAchievementFilter,
    setAchievementSearch,
    resetForGame,
  } = useGameDetailState(copy.tabPlay);

  // Hook de Dados Assíncronos
  const asyncData = useGameDetailAsync({
    game,
    isOpen,
    language,
    user,
    userProfile,
    onGameHydrated,
    onLibraryChanged,
    currentPresenceGame,
  });

  // Hook de Ações
  const actions = useGameDetailActions({
    game,
    state,
    dispatch,
    launchProfile: asyncData.launchProfile,
    user,
    closeOnLaunch,
    copy,
    notify,
    onClose,
    onLibraryChanged,
    onOpenMods,
    playSound,
  });

  // Reset de abas e estado ao trocar de jogo
  React.useEffect(() => {
    if (isOpen) {
      resetForGame(copy.tabPlay);
    }
  }, [game?.id, isOpen, copy.tabPlay, resetForGame]);

  // Monitora movimento do mouse para ocultar as legendas de controle quando o mouse for usado
  const [isMouseActive, setIsMouseActive] = React.useState(false);
  const mouseTimerRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    if (!isOpen) return;
    const handleMouseMove = () => {
      setIsMouseActive(true);
      if (mouseTimerRef.current) window.clearTimeout(mouseTimerRef.current);
      mouseTimerRef.current = window.setTimeout(() => {
        setIsMouseActive(false);
      }, 2500);
    };

    window.addEventListener("mousemove", handleMouseMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      if (mouseTimerRef.current) window.clearTimeout(mouseTimerRef.current);
    };
  }, [isOpen]);

  const tabs = React.useMemo(
    () => [copy.tabPlay, copy.tabAbout, copy.tabAchievements, copy.tabCaptures, copy.tabMods, copy.tabManage],
    [copy]
  );

  // Navegação por teclado nas abas
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || state.galleryModalOpen || state.deleteModalOpen || state.isLaunching) return;
      const currentIndex = tabs.indexOf(state.activeTab);
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % tabs.length;
        setActiveTab(tabs[nextIndex]);
        playSound("navigate");
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        setActiveTab(tabs[prevIndex]);
        playSound("navigate");
      } else if (e.key === "Escape" && !state.galleryModalOpen && !state.deleteModalOpen) {
        onClose();
        playSound("back");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, state.activeTab, state.galleryModalOpen, state.deleteModalOpen, state.isLaunching, tabs, playSound, onClose, setActiveTab]);

  // Gamepad L1 / R1 para trocar de abas
  useGamepadButton("L1", () => {
    if (!isOpen || state.deleteModalOpen || state.galleryModalOpen || state.isLaunching) return;
    const i = tabs.indexOf(state.activeTab);
    if (i > 0) {
      setActiveTab(tabs[i - 1]);
      playSound("navigate");
    }
  });

  useGamepadButton("R1", () => {
    if (!isOpen || state.deleteModalOpen || state.galleryModalOpen || state.isLaunching) return;
    const i = tabs.indexOf(state.activeTab);
    if (i >= 0 && i < tabs.length - 1) {
      setActiveTab(tabs[i + 1]);
      playSound("navigate");
    }
  });

  // Botão X / A para iniciar ou interagir
  useGamepadButton("X", () => {
    if (!isOpen || state.galleryModalOpen || state.deleteModalOpen || state.isLaunching) return;

    if (
      document.activeElement instanceof HTMLElement &&
      document.activeElement !== document.body &&
      scrollRef.current?.contains(document.activeElement)
    ) {
      activateElementWithController(document.activeElement);
      return;
    }

    if (state.activeTab === copy.tabPlay) {
      actions.handleLaunch();
    }
  }, isOpen && !state.galleryModalOpen && !state.deleteModalOpen, 10);

  // Botão Quadrado / X para fotos
  useGamepadButton("SQUARE", () => {
    if (!isOpen || state.galleryModalOpen || state.deleteModalOpen || state.isLaunching) return;
    if (asyncData.localScreenshots.length > 0) {
      openGallery(0);
      playSound("select");
    }
  });

  // Gamepad navigation hook
  useGamepadNavigation({
    onClose: () => {
      if (state.galleryModalOpen) {
        closeGallery();
        playSound("modalClose");
      } else if (state.deleteModalOpen) {
        closeDeleteModal();
        playSound("back");
      } else if (isOpen && !state.isLaunching) {
        onClose();
        playSound("back");
      }
    },
    scrollRef: scrollRef as React.RefObject<HTMLElement>,
    disableX: true,
    disableO: false,
    enabled: isOpen,
  });

  // Imagens e dados derivados
  const heroImage = React.useMemo(() => {
    if (!game) return "";
    if (asyncData.isSteamGame) {
      return game.backgroundImage || game.image || asyncData.steamDetails.data?.backgroundImage ||
        (game.steamAppId ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppId}/library_hero.jpg` : "");
    }
    if (asyncData.isEpicGame) {
      return game.backgroundImage || game.image || asyncData.epicDetails.data?.backgroundImage || "";
    }
    return game.backgroundImage || game.image || "";
  }, [game, asyncData.isSteamGame, asyncData.isEpicGame, asyncData.steamDetails.data, asyncData.epicDetails.data]);

  const coverImage = React.useMemo(() => {
    if (!game) return "";
    if (asyncData.isSteamGame) {
      return game.cardImage || game.image || asyncData.steamDetails.data?.cardImage ||
        (game.steamAppId ? `https://cdn.akamai.steamstatic.com/steam/apps/${game.steamAppId}/library_600x900_2x.jpg` : "") ||
        game.backgroundImage || "";
    }
    if (asyncData.isEpicGame) {
      return game.cardImage || game.image || asyncData.epicDetails.data?.cardImage || game.backgroundImage || "";
    }
    return game.cardImage || game.image || game.backgroundImage || "";
  }, [game, asyncData.isSteamGame, asyncData.isEpicGame, asyncData.steamDetails.data, asyncData.epicDetails.data]);

  const platformLabel = React.useMemo(() => {
    if (asyncData.isSteamGame) return copy.steamLabel;
    if (asyncData.isEpicGame) return copy.epicLabel;
    return copy.localLabel;
  }, [asyncData.isSteamGame, asyncData.isEpicGame, copy]);

  const localizedCategory = React.useMemo(() => {
    const raw = String(game?.category || "").toUpperCase();
    return CATEGORY_LABELS[raw]?.[language] || game?.category || copy.library;
  }, [game?.category, language, copy.library]);

  const formattedHours = React.useMemo(() => {
    const minutes = Math.round((game?.hoursPlayed || 0) * 60);
    if (minutes < 60) return `${minutes}m`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m > 0 ? `${h}h ${m}m` : `${h}h`;
  }, [game?.hoursPlayed]);

  const lastSession = React.useMemo(() => {
    if (!game?.lastPlayedAt) {
      return (game?.hoursPlayed || 0) > 0 ? copy.noHubSession : copy.neverStarted;
    }
    try {
      return new Date(game.lastPlayedAt).toLocaleDateString(language, {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    } catch {
      return (game?.hoursPlayed || 0) > 0 ? copy.noHubSession : copy.neverStarted;
    }
  }, [game?.lastPlayedAt, game?.hoursPlayed, language, copy.neverStarted, copy.noHubSession]);

  const sanitizedAboutHtml = React.useMemo(() => {
    const raw =
      asyncData.steamDetails.data?.aboutTheGame ||
      asyncData.steamDetails.data?.description ||
      asyncData.epicDetails.data?.aboutTheGame ||
      asyncData.epicDetails.data?.description ||
      game?.aboutTheGame ||
      game?.description ||
      copy.noDescription;
    return sanitizeStoreHtml(raw);
  }, [asyncData.steamDetails.data, asyncData.epicDetails.data, game?.aboutTheGame, game?.description, copy.noDescription]);

  const sanitizedSupportedLanguagesHtml = React.useMemo(() => {
    const raw = asyncData.steamDetails.data?.supportedLanguages;
    return raw ? sanitizeStoreHtml(raw) : undefined;
  }, [asyncData.steamDetails.data]);

  const sanitizedMinRequirementsHtml = React.useMemo(() => {
    const raw = asyncData.steamDetails.data?.pcRequirements?.minimum;
    return raw ? sanitizeStoreHtml(raw) : undefined;
  }, [asyncData.steamDetails.data]);

  const sanitizedRecRequirementsHtml = React.useMemo(() => {
    const raw = asyncData.steamDetails.data?.pcRequirements?.recommended;
    return raw ? sanitizeStoreHtml(raw) : undefined;
  }, [asyncData.steamDetails.data]);

  const hasEpicLaunchShortcut = Boolean(
    asyncData.isEpicGame &&
    String(game?.epicLaunchId || game?.executablePath || game?.epicCatalogId || "").split(":").filter(Boolean).length >= 3
  );

  const galleryItems = React.useMemo(() => {
    const items: Array<{ id: string; type: "image"; url: string }> = [];
    const seen = new Set<string>();

    const addUrl = (url: string, prefix: string, idx: number) => {
      if (url && typeof url === "string" && !seen.has(url)) {
        seen.add(url);
        items.push({ id: `${prefix}-${idx}`, type: "image", url });
      }
    };

    asyncData.localScreenshots.forEach((url, i) => addUrl(url, "local", i));
    (game?.screenshots || []).forEach((url, i) => addUrl(url, "game", i));
    (asyncData.epicDetails.data?.screenshots || []).forEach((url, i) => addUrl(url, "epic", i));
    (asyncData.steamDetails.data?.screenshots || []).forEach((url, i) => addUrl(url, "steam", i));

    return items;
  }, [
    asyncData.localScreenshots,
    game?.screenshots,
    asyncData.epicDetails.data?.screenshots,
    asyncData.steamDetails.data?.screenshots,
  ]);

  if (!game) return null;

  return (
    <div className="fixed inset-0 z-100 overflow-hidden pointer-events-none">
      <div
        className="t-panel-slide w-full h-full bg-[#0C0D10] overflow-y-auto detail-panel-scrollbar select-none"
        data-open={isOpen ? "true" : "false"}
        ref={scrollRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Detalhes de ${game.title}`}
      >
        {/* 1. Grand Widescreen Horizontal Wallpaper Hero Box */}
        <GameDetailSteamHero
          game={game}
          heroImage={heroImage}
          steamLogoUrl={steamLogoUrl}
          isRunning={asyncData.isRunning}
          friendsPlayingCount={friendsPlayingCount}
          onClose={onClose}
          userAvatar={userProfile?.photoURL || user?.photoURL || undefined}
        />

        {/* 2. Spacious Content Container (Generous padding 2rem to 4rem, Apple Design Guidelines + Steam Big Picture) */}
        <div className="max-w-6xl w-full mx-auto px-6 sm:px-12 md:px-16 py-8 pb-8 flex flex-col gap-8">
          {/* Action Bar (Play button, last session, playtime, cloud status, controller & settings tools) */}
          <GameDetailSteamActionBar
            game={game}
            isLaunching={state.isLaunching}
            isRunning={asyncData.isRunning}
            launchError={state.launchError}
            formattedHours={formattedHours}
            lastSession={lastSession}
            isFavorite={game.isFavorite}
            isGamepadConnected={isGamepadConnected}
            gamepadFamily={gamepadFamily}
            copy={copy}
            onLaunch={actions.handleLaunch}
            onToggleFavorite={() => onToggleFavorite?.(game)}
            onEditGame={() => onEditGame?.(game)}
            playSound={playSound}
          />

          {/* Centered Capsule Pill Navigation Tabs */}
          <div className="flex justify-center w-full my-2">
            <div className="flex items-center gap-1.5 sm:gap-2 p-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] backdrop-blur-md shadow-inner">
              {tabs.map((tabKey) => {
                const isActive = state.activeTab === tabKey;
                return (
                  <button
                    key={tabKey}
                    type="button"
                    onClick={() => {
                      setActiveTab(tabKey);
                      playSound("navigate");
                    }}
                    className={`px-5 sm:px-7 py-2 rounded-full text-xs font-display font-bold tracking-wider uppercase transition-all cursor-pointer ${
                      isActive
                        ? "bg-white/15 text-white shadow-md ring-1 ring-white/25"
                        : "text-white/50 hover:text-white hover:bg-white/5"
                    }`}
                  >
                    {tabKey}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Dynamic Tab Content */}
          <AnimatePresence mode="wait" initial={false}>
            {state.activeTab === copy.tabPlay && (
              <motion.div
                key="panel-play"
                role="tabpanel"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.24 }}
                className="w-full flex flex-col gap-10"
              >
                {/* Amigos jogando o jogo agora ou recentemente (Steam Big Picture pattern) */}
                <GameDetailFriends
                  game={game}
                  friends={friends}
                  playSound={playSound}
                />

                {/* Métricas e Progresso */}
                <GameDetailStats
                  game={game}
                  achievementsUnlocked={asyncData.achievements.data.filter((a) => a.achieved).length}
                  achievementsTotal={asyncData.achievements.data.length || game.totalAchievements || 0}
                  formattedHours={formattedHours}
                  lastSession={lastSession}
                  hasEpicLaunchShortcut={hasEpicLaunchShortcut}
                  copy={copy}
                />

                {/* Photo Wall rápido na aba Jogar */}
                {galleryItems.length > 0 && (
                  <div className="w-full">
                    <h3 className="text-[10px] font-black tracking-[0.28em] text-white/35 uppercase mb-4 flex items-center gap-2">
                      <Camera className="w-3.5 h-3.5" /> {copy.photoWall}
                      <span className="ml-1 px-2 py-0.5 rounded-md bg-[#0F0F0F] border border-[#161616] text-[9px] font-black text-white/40">
                        {galleryItems.length}
                      </span>
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {galleryItems.slice(0, 4).map((item, idx) => (
                        <button
                          key={idx}
                          onClick={() => {
                            openGallery(idx);
                            playSound("select");
                          }}
                          className="group relative rounded-xl overflow-hidden aspect-video border border-[#161616] bg-[#0F0F0F] hover:border-white/30 hover:bg-white/10 transition-all cursor-pointer"
                        >
                          <img src={item.url} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

                  {state.activeTab === copy.tabAchievements && (
                    <motion.div
                      key="panel-achievements"
                      role="tabpanel"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.24 }}
                      className="w-full"
                    >
                      <GameDetailAchievements
                        achievements={asyncData.achievements.data}
                        isLoading={asyncData.achievements.loading}
                        error={asyncData.achievements.error}
                        filter={state.achievementFilter}
                        searchQuery={state.achievementSearch}
                        copy={copy}
                        locale={detailLanguage}
                        onFilterChange={setAchievementFilter}
                        onSearchChange={setAchievementSearch}
                        onRetry={asyncData.achievements.retry}
                        playSound={playSound}
                      />
                    </motion.div>
                  )}

                  {(state.activeTab === copy.tabAbout ||
                    state.activeTab === copy.tabCaptures ||
                    state.activeTab === copy.tabMods ||
                    state.activeTab === copy.tabManage) && (
                      <motion.div
                        key={`panel-${state.activeTab}`}
                        role="tabpanel"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.24 }}
                        className="w-full"
                      >
                        <GameDetailSocialMods
                          game={game}
                          activeTab={state.activeTab}
                          copy={copy}
                          localScreenshots={asyncData.localScreenshots}
                          gameMods={asyncData.gameMods}
                          sanitizedAboutHtml={sanitizedAboutHtml}
                          sanitizedSupportedLanguagesHtml={sanitizedSupportedLanguagesHtml}
                          sanitizedMinRequirementsHtml={sanitizedMinRequirementsHtml}
                          sanitizedRecRequirementsHtml={sanitizedRecRequirementsHtml}
                          isAboutLoading={asyncData.steamDetails.loading || asyncData.epicDetails.loading}
                          developer={asyncData.steamDetails.data?.developer || asyncData.epicDetails.data?.developer || game.developer}
                          publisher={asyncData.steamDetails.data?.publisher || asyncData.epicDetails.data?.publisher || game.publisher}
                          releaseDate={asyncData.steamDetails.data?.releaseDate || asyncData.epicDetails.data?.releaseDate || game.releaseDate}
                          localizedCategory={localizedCategory}
                          metacritic={asyncData.steamDetails.data?.metacritic || undefined}
                          priceOverview={asyncData.steamDetails.data?.priceOverview || undefined}
                          tags={asyncData.epicDetails.data?.tags || game.tags}
                          launchProfile={asyncData.launchProfile}
                          displayOptions={asyncData.displayOptions}
                          onLaunchProfileChange={asyncData.setLaunchProfile}
                          onSaveLaunchProfile={actions.handleSaveLaunchProfile}
                          onOpenDeleteModal={openDeleteModal}
                          onOpenFolder={actions.handleOpenFolder}
                          onSelectEpicInstallFolder={actions.handleSelectEpicInstallFolder}
                          onSelectEpicExecutable={actions.handleSelectEpicExecutable}
                          onOpenMods={onOpenMods}
                          onSelectCapture={openGallery}
                          playSound={playSound}
                        />
                      </motion.div>
                    )}
                </AnimatePresence>
        </div>

        {/* Steam Big Picture Controller Legend Bar at bottom of scroll (follows page scroll, hides on mouse) */}
        {isGamepadConnected && !isMouseActive && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="w-full max-w-6xl mx-auto px-6 sm:px-12 md:px-16 pt-6 pb-12 flex items-center justify-between text-xs text-white/60 select-none border-t border-white/[0.06]"
          >
            <div className="flex items-center gap-2">
              <ControllerButtonGlyph button="OPTIONS" gamepadFamily={gamepadFamily} size={18} />
              <span className="font-bold tracking-wide">Menu</span>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-1.5">
                <ControllerButtonGlyph button="LB" gamepadFamily={gamepadFamily} size={16} />
                <span className="text-white/30">/</span>
                <ControllerButtonGlyph button="RB" gamepadFamily={gamepadFamily} size={16} />
                <span className="ml-1">Abas</span>
              </div>
              <div className="flex items-center gap-1.5 text-white/90">
                <ControllerButtonGlyph button="A" gamepadFamily={gamepadFamily} size={18} />
                <span className="font-semibold text-white">Iniciar / Selecionar</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ControllerButtonGlyph button="B" gamepadFamily={gamepadFamily} size={18} />
                <span>Voltar</span>
              </div>
            </div>
          </motion.div>
        )}

          {/* ============================================================
              MODAL DE GALERIA / LIGHTBOX
              ============================================================ */}
          <ModalShell
            isOpen={state.galleryModalOpen}
            onClose={() => {
              closeGallery();
              playSound("modalClose");
            }}
            maxWidthClassName="max-w-5xl"
            className="p-0 bg-transparent border-0 shadow-none"
            backdropClassName="bg-black/90 "
            zIndexClassName="z-[160]"
            reducedEffects
          >
            {galleryItems.length > 0 && (
              <div className="relative w-full rounded-3xl overflow-hidden shadow-2xl">
                <FramerCarouselThumbnails items={galleryItems} initialIndex={state.currentGalleryIndex} />

                <button
                  onClick={() => {
                    closeGallery();
                    playSound("modalClose");
                  }}
                  className="absolute top-4 right-4 w-10 h-10 aspect-square rounded-full shrink-0 flex items-center justify-center p-0 bg-black/60 border border-white/20 text-white hover:bg-black/90 transition-colors z-50 shadow-lg"
                  aria-label={copy.close}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
          </ModalShell>

          {/* ============================================================
              MODAL DE EXCLUSÃO DE JOGO
              ============================================================ */}
          <ModalShell
            isOpen={state.deleteModalOpen}
            onClose={() => {
              closeDeleteModal();
              playSound("back");
            }}
            maxWidthClassName="max-w-md"
            className="p-0 bg-transparent border-0 shadow-none"
            backdropClassName="bg-black/90"
            zIndexClassName="z-[160]"
            reducedEffects
          >
            <div className="w-full max-w-[340px] mx-auto bg-[var(--color-surface)]  rounded-[32px] overflow-hidden border border-[var(--color-ui-detail)] shadow-[0_32px_64px_rgba(0,0,0,0.6)] p-8 flex flex-col items-center">

              {/* Animated Trash Icon Area */}
              <div className="relative w-32 h-32 flex items-center justify-center mb-2">
                {/* Floating Papers (Frosted Dark Glass) */}
                <motion.div
                  animate={{ y: [0, -8, 0], rotate: [10, 25, 10], opacity: [0.7, 1, 0.7] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", delay: 0.2 }}
                  className="absolute top-6 left-2 w-5 h-6 bg-white/10  border border-white/20 rounded-sm shadow-sm"
                  style={{ clipPath: "polygon(0 0, 100% 15%, 85% 100%, 15% 100%)" }}
                />
                <motion.div
                  animate={{ y: [0, 12, 0], rotate: [-15, -30, -15], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 0.8 }}
                  className="absolute bottom-6 left-6 w-4 h-5 bg-[var(--color-surface)]  border border-white/10 rounded-sm shadow-sm"
                  style={{ clipPath: "polygon(10% 0, 100% 0, 90% 100%, 0 85%)" }}
                />
                <motion.div
                  animate={{ y: [0, -15, 0], rotate: [45, 60, 45], opacity: [0.8, 1, 0.8] }}
                  transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut", delay: 0.5 }}
                  className="absolute top-10 right-4 w-6 h-6 bg-white/10  border border-white/20 rounded-sm shadow-sm"
                  style={{ clipPath: "polygon(0 15%, 100% 0, 85% 100%, 15% 85%)" }}
                />
                <motion.div
                  animate={{ y: [0, 10, 0], rotate: [-20, -5, -20], opacity: [0.6, 0.9, 0.6] }}
                  transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut", delay: 1.2 }}
                  className="absolute bottom-8 right-6 w-5 h-5 bg-[var(--color-surface)]  border border-white/10 rounded-sm shadow-sm"
                  style={{ clipPath: "polygon(15% 0, 100% 15%, 85% 100%, 0 85%)" }}
                />

                {/* Trash Can Body (Dark Metal) */}
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  className="relative z-10 flex flex-col items-center drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)]"
                >
                  <div className="w-8 h-1.5 bg-[#48484A] rounded-t-md absolute -top-1.5 z-10" />
                  <div className="w-[84px] h-3 bg-[#48484A] rounded-full border-[3px] border-[#2C2C2E] shadow-sm relative z-20" />
                  <div className="w-[68px] h-20 bg-gradient-to-b from-[#3A3A3C] to-[#1C1C1E] rounded-b-[18px] border-[3px] border-t-0 border-[#2C2C2E] relative -top-1 flex justify-evenly pt-2 pb-3 px-2">
                    <div className="w-1.5 h-full bg-black/40 rounded-full" />
                    <div className="w-1.5 h-full bg-black/40 rounded-full" />
                    <div className="w-1.5 h-full bg-black/40 rounded-full" />
                    <div className="w-1.5 h-full bg-black/40 rounded-full" />
                  </div>
                </motion.div>
              </div>

              {/* Text Content */}
              <h2 className="text-[19px] font-semibold text-white tracking-tight mb-2 text-center">
                {copy.removeGame || "Delete File"}
              </h2>
              <p className="text-[13px] font-medium text-white/60 text-center leading-[1.4] mb-8 px-2 max-w-[240px]">
                {copy.confirmRemove(game.title)}
              </p>

              {/* Buttons */}
              <div className="flex gap-3 w-full">
                <button
                  type="button"
                  onClick={() => {
                    closeDeleteModal();
                    playSound("back");
                  }}
                  disabled={state.isDeleting}
                  className="flex-1 py-3 rounded-full bg-white/10 hover:bg-white/20 border border-white/5 text-[14px] font-medium text-white transition-all disabled:opacity-40"
                >
                  {copy.cancel}
                </button>
                <button
                  type="button"
                  onClick={actions.handleDeleteGame}
                  disabled={state.isDeleting}
                  className="flex-1 py-3 rounded-full bg-[#FF453A] hover:bg-[#FF5147] border border-[#FF453A]/50 text-[14px] font-medium text-white shadow-[0_4px_16px_rgba(255,69,58,0.4)] hover:shadow-[0_6px_20px_rgba(255,69,58,0.6)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  {state.isDeleting ? copy.removing : (copy.remove || "Delete")}
                </button>
              </div>
            </div>
          </ModalShell>

          {/* ============================================================
              TELA CINEMATOGRÁFICA DE LAUNCH
              ============================================================ */}
          <AnimatePresence>
            {state.isLaunching && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[200] bg-black flex flex-col items-center justify-center overflow-hidden"
                role="alert"
                aria-label="Iniciando o jogo"
              >
                <motion.div
                  initial={{ scale: 1.05 }}
                  animate={{ scale: 1.15 }}
                  transition={{ duration: 8, ease: "easeOut" }}
                  className="absolute inset-0 z-0"
                >
                  <img
                    src={heroImage || undefined}
                    alt=""
                    className="w-full h-full object-cover blur-[12px] brightness-[0.25]"
                    loading="eager"
                  />
                </motion.div>

                <div className="relative z-10 flex flex-col items-center justify-center text-center">
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
                    className="relative w-40 h-40 flex items-center justify-center mb-8"
                  >
                    <div
                      className="absolute inset-0 rounded-full border border-white/10 animate-ping"
                      style={{ animationDuration: "3s" }}
                    />
                    <div
                      className="absolute inset-4 rounded-full border-t border-white/30 animate-spin"
                      style={{ animationDuration: "2s" }}
                    />
                    <div
                      className="absolute inset-8 rounded-full border-b border-white/60 animate-spin"
                      style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
                    />
                    <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                      {game.logoImage ? (
                        <img src={game.logoImage} alt="" className="w-12 object-contain opacity-80 animate-pulse" />
                      ) : (
                        <Play className="w-8 h-8 text-white/80 animate-pulse fill-white/80" />
                      )}
                    </div>
                  </motion.div>

                  <h2 className="text-3xl md:text-4xl font-display font-light tracking-[0.25em] text-white uppercase mb-3 drop-shadow-[0_0_20px_rgba(255,255,255,0.4)]">
                    {game.title}
                  </h2>
                  <p className="text-[10px] font-bold text-white/40 tracking-[0.4em] uppercase animate-pulse">
                    {copy.launching}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
    </div>
  );
};

export default GameDetailPanel;
