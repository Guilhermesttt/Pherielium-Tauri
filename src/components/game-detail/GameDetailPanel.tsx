import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, X, ChevronLeft, ChevronRight, Play } from "lucide-react";
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

import { GameLaunchIntro } from "./GameLaunchIntro";
import { ConsoleTrophyList } from "./console/ConsoleTrophyList";
import { GameDetailSocialMods } from "./GameDetailSocialMods";
import GameControllerPanel from "./GameControllerPanel";
import { ConsoleGameScreen } from "./console/ConsoleGameScreen";
import { FramerCarouselThumbnails } from "../ui/framer-thumbnails";
import { acquireLauncherInputLock } from "../../utils/launcherInputLock";
import { holdBackgroundVideo } from "../../utils/videoHold";
import { GAMEPAD_PRIORITY } from "../../context/gamepadSubscribers";

export const GameDetailPanel: React.FC<GameDetailPanelProps> = ({
  game,
  isOpen,
  onClose,
  playSound,
  onLibraryChanged,
  onGameHydrated,
  onOpenMods,
  onOpenControllerSettings,
  currentPresenceGame,
  friends = [],
  onToggleFavorite,
  onEditGame,
  launchRequest,
}) => {
  const { user, userProfile } = useAuth();
  const { language, closeOnLaunch, gameBootIntroEnabled, gameBootIntroSoundEnabled, effectsVolume, soundTheme } = usePreferences();
  const { notify } = useNotification();
  const { isGamepadConnected, gamepadFamily, activeInputType } = useGamepad();
  // Guarda DE QUAL JOGO o painel de controle está aberto, em vez de um booleano:
  // ao trocar de jogo o painel fecha sozinho (o id deixa de bater), sem efeito
  // nem setState em cascata, e nunca edita o perfil do jogo errado.
  const [controllerPanelGameId, setControllerPanelGameId] = React.useState<string | null>(null);
  const controllerPanelOpen = Boolean(game) && controllerPanelGameId === game?.id;

  const detailLanguage =
    language === "pt-BR" || language === "en-US" || language === "es-ES"
      ? language
      : "en-US";
  const copy = DETAIL_PANEL_COPY[detailLanguage] || DETAIL_PANEL_COPY["en-US"];

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
    launchIntroEnabled: gameBootIntroEnabled,
    copy,
    notify,
    onClose,
    onLibraryChanged,
    onOpenMods,
    playSound,
  });

  // Modo lista da aba Jogar (a arte recua e aparecem as conquistas recentes). Guarda DE QUAL
  // jogo está aberto, como o painel de controle: ao trocar de jogo volta fechado, sem efeito.
  const [listGameId, setListGameId] = React.useState<string | null>(null);
  const listOpen = Boolean(game) && listGameId === game?.id;
  const setListOpen = React.useCallback(
    (open: boolean) => setListGameId(open && game ? game.id : null),
    [game],
  );

  // Reset de abas e estado ao trocar de jogo
  React.useEffect(() => {
    if (isOpen) {
      resetForGame(copy.tabPlay);
    }
  }, [game?.id, isOpen, copy.tabPlay, resetForGame]);

  // A Home pediu "Jogar" pelo herói: abre este painel e dispara o mesmo lançamento do botão
  // de jogar (intro, perfil de lançamento e monitoramento). Cada pedido vale uma vez.
  // Fica DEPOIS do reset acima: no mesmo commit o reset roda primeiro e não apaga o "lançando".
  // O perfil de lançamento do jogo chega ao estado um render depois de abrir; lançar antes
  // usaria o do jogo anterior (argumentos, monitor). Por isso espera ele bater com o jogo.
  const handledLaunchRequest = React.useRef(0);
  const launchProfileReady =
    Boolean(game) && JSON.stringify(asyncData.launchProfile) === JSON.stringify(game?.launchProfile || {});
  React.useEffect(() => {
    if (!isOpen || !game || !launchRequest || !launchProfileReady) return;
    if (handledLaunchRequest.current === launchRequest) return;
    handledLaunchRequest.current = launchRequest;
    void actions.handleLaunch();
  }, [actions, game, isOpen, launchProfileReady, launchRequest]);

  // Durante a animação de lançamento o controle não mexe em nada do launcher: antes
  // o analógico direito ainda rolava o painel por trás da intro do mascote.
  const isLaunchingNow = state.isLaunching;
  React.useEffect(() => {
    if (!isLaunchingNow) return;
    const releaseInput = acquireLauncherInputLock();
    // e o vídeo de fundo congela: a intro é o momento de maior custo de render
    const releaseVideo = holdBackgroundVideo();
    return () => {
      releaseInput();
      releaseVideo();
    };
  }, [isLaunchingNow]);

  const tabs = React.useMemo(
    () => [copy.tabPlay, copy.tabAbout, copy.tabAchievements, copy.tabCaptures, copy.tabMods, copy.tabManage],
    [copy]
  );

  // Navegação por teclado nas abas
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen || state.galleryModalOpen || state.deleteModalOpen || state.isLaunching) return;
      // Campos de texto (busca de conquistas, perfil de lançamento) ficam com as setas.
      const target = e.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      const currentIndex = tabs.indexOf(state.activeTab);
      const onPlayTab = state.activeTab === copy.tabPlay;
      if (e.key === "ArrowRight") {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % tabs.length;
        setActiveTab(tabs[nextIndex]);
        playSound("navigate");
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + tabs.length) % tabs.length;
        setActiveTab(tabs[prevIndex]);
        playSound("navigate");
      } else if (e.key === "ArrowDown" && onPlayTab && !listOpen) {
        e.preventDefault();
        setListOpen(true);
        playSound("navigate");
      } else if (e.key === "Escape" && !state.galleryModalOpen && !state.deleteModalOpen) {
        if (onPlayTab && listOpen) {
          setListOpen(false);
          playSound("back");
          return;
        }
        onClose();
        playSound("back");
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, state.activeTab, state.galleryModalOpen, state.deleteModalOpen, state.isLaunching, tabs, playSound, onClose, setActiveTab, copy.tabPlay, listOpen, setListOpen]);

  // Gamepad L1 / R1 para trocar de abas
  useGamepadButton("L1", () => {
    if (!isOpen || state.deleteModalOpen || state.galleryModalOpen || state.isLaunching) return;
    const i = tabs.indexOf(state.activeTab);
    if (i > 0) {
      setActiveTab(tabs[i - 1]);
      playSound("tabSwitch");
    } else {
      playSound("edgeBump");
    }
  }, isOpen, GAMEPAD_PRIORITY.overlay);

  useGamepadButton("R1", () => {
    if (!isOpen || state.deleteModalOpen || state.galleryModalOpen || state.isLaunching) return;
    const i = tabs.indexOf(state.activeTab);
    if (i >= 0 && i < tabs.length - 1) {
      setActiveTab(tabs[i + 1]);
      playSound("tabSwitch");
    } else {
      playSound("edgeBump");
    }
  }, isOpen, GAMEPAD_PRIORITY.overlay);

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
  }, isOpen && !state.galleryModalOpen && !state.deleteModalOpen, GAMEPAD_PRIORITY.overlay);

  // Botão Quadrado / X para fotos
  useGamepadButton("SQUARE", () => {
    if (!isOpen || state.galleryModalOpen || state.deleteModalOpen || state.isLaunching) return;
    if (asyncData.localScreenshots.length > 0) {
      openGallery(0);
      playSound("select");
    }
  }, isOpen, GAMEPAD_PRIORITY.overlay);

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
    priority: GAMEPAD_PRIORITY.overlay,
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

  const platformLabel = React.useMemo(() => {
    if (asyncData.isSteamGame) return copy.steamLabel;
    if (asyncData.isEpicGame) return copy.epicLabel;
    return copy.localLabel;
  }, [asyncData.isSteamGame, asyncData.isEpicGame, copy]);

  const localizedCategory = React.useMemo(() => {
    const raw = String(game?.category || "").toUpperCase();
    return CATEGORY_LABELS[raw]?.[language] || game?.category || copy.library;
  }, [game?.category, language, copy.library]);

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

  const achievementsTotal = asyncData.achievements.data.length || game?.totalAchievements || 0;
  const achievementsUnlocked = asyncData.achievements.data.length
    ? asyncData.achievements.data.filter((a) => a.achieved).length
    : game?.completedAchievements || 0;


  if (!game) return null;

  // Abas que não são "Jogar": os componentes de sempre do detalhe, na coluna da esquerda.
  const tabContent =
    state.activeTab === copy.tabAchievements ? (
      <ConsoleTrophyList
        achievements={asyncData.achievements.data}
        isLoading={asyncData.achievements.loading}
        error={asyncData.achievements.error}
        filter={state.achievementFilter}
        searchQuery={state.achievementSearch}
        locale={detailLanguage}
        onFilterChange={setAchievementFilter}
        onSearchChange={setAchievementSearch}
        onRetry={asyncData.achievements.retry}
        playSound={playSound}
      />
    ) : state.activeTab !== copy.tabPlay ? (
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
    ) : null;

  return (
    <div className="fixed inset-0 z-100 overflow-hidden pointer-events-none">
      <ConsoleGameScreen
        game={game}
        isOpen={isOpen}
        heroImage={heroImage}
        platformLabel={platformLabel}
        copy={copy}
        locale={detailLanguage}
        tabs={tabs}
        activeTab={state.activeTab}
        onSelectTab={setActiveTab}
        listOpen={listOpen}
        onToggleList={setListOpen}
        lastSession={lastSession}
        friendsPlaying={friendsPlayingCount}
        achievementsUnlocked={achievementsUnlocked}
        achievementsTotal={achievementsTotal}
        achievements={asyncData.achievements}
        isLaunching={state.isLaunching}
        isRunning={asyncData.isRunning}
        launchError={state.launchError}
        onLaunch={actions.handleLaunch}
        onClose={onClose}
        onToggleFavorite={onToggleFavorite ? () => onToggleFavorite(game) : undefined}
        onEditGame={onEditGame ? () => onEditGame(game) : undefined}
        onOpenControllerPanel={() => setControllerPanelGameId(game.id)}
        tabContent={tabContent}
        scrollRef={scrollRef}
        isGamepadConnected={isGamepadConnected}
        gamepadFamily={gamepadFamily}
        playSound={playSound}
      />

      {/* Modais e intro: fixos por cima da tela; o contêiner externo não recebe cliques. */}
      <div className="pointer-events-auto">
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
              <div className="relative w-full rounded-[var(--corner-lg)] overflow-hidden">
                <FramerCarouselThumbnails items={galleryItems} initialIndex={state.currentGalleryIndex} />

                <button
                  onClick={() => {
                    closeGallery();
                    playSound("modalClose");
                  }}
                  className="absolute top-4 right-4 w-10 h-10 aspect-square rounded-full shrink-0 flex items-center justify-center p-0 bg-black/60 border border-transparent text-[var(--ink)] hover:bg-black/90 transition-colors z-50"
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
            <div className="w-full max-w-[340px] mx-auto bg-[var(--color-surface)]  rounded-[var(--corner-lg)] overflow-hidden border border-[var(--color-ui-detail)] p-8 flex flex-col items-center">

              {/* Animated Trash Icon Area */}
              <div className="relative w-32 h-32 flex items-center justify-center mb-2">
                {/* Floating Papers (Frosted Dark Glass) */}
                <motion.div
                  animate={{ y: [0, -8, 0], rotate: [10, 25, 10], opacity: [0.7, 1, 0.7] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut", delay: 0.2 }}
                  className="absolute top-6 left-2 w-5 h-6 bg-[var(--tone-3)]  border border-transparent rounded-sm shadow-sm"
                  style={{ clipPath: "polygon(0 0, 100% 15%, 85% 100%, 15% 100%)" }}
                />
                <motion.div
                  animate={{ y: [0, 12, 0], rotate: [-15, -30, -15], opacity: [0.5, 0.8, 0.5] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut", delay: 0.8 }}
                  className="absolute bottom-6 left-6 w-4 h-5 bg-[var(--color-surface)]  border border-transparent rounded-sm shadow-sm"
                  style={{ clipPath: "polygon(10% 0, 100% 0, 90% 100%, 0 85%)" }}
                />
                <motion.div
                  animate={{ y: [0, -15, 0], rotate: [45, 60, 45], opacity: [0.8, 1, 0.8] }}
                  transition={{ repeat: Infinity, duration: 3.5, ease: "easeInOut", delay: 0.5 }}
                  className="absolute top-10 right-4 w-6 h-6 bg-[var(--tone-3)]  border border-transparent rounded-sm shadow-sm"
                  style={{ clipPath: "polygon(0 15%, 100% 0, 85% 100%, 15% 85%)" }}
                />
                <motion.div
                  animate={{ y: [0, 10, 0], rotate: [-20, -5, -20], opacity: [0.6, 0.9, 0.6] }}
                  transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut", delay: 1.2 }}
                  className="absolute bottom-8 right-6 w-5 h-5 bg-[var(--color-surface)]  border border-transparent rounded-sm shadow-sm"
                  style={{ clipPath: "polygon(15% 0, 100% 15%, 85% 100%, 0 85%)" }}
                />

                {/* Trash Can Body (Dark Metal) */}
                <motion.div
                  animate={{ y: [0, -6, 0] }}
                  transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
                  className="relative z-10 flex flex-col items-center"
                >
                  <div className="w-8 h-1.5 bg-[#48484A] rounded-t-md absolute -top-1.5 z-10" />
                  <div className="w-[84px] h-3 bg-[#48484A] rounded-full border-[3px] border-[#2C2C2E] shadow-sm relative z-20" />
                  <div className="w-[68px] h-20 bg-gradient-to-b from-[#3A3A3C] to-[#1C1C1E] rounded-b-[var(--corner-md)] border-[3px] border-t-0 border-[#2C2C2E] relative -top-1 flex justify-evenly pt-2 pb-3 px-2">
                    <div className="w-1.5 h-full bg-black/40 rounded-full" />
                    <div className="w-1.5 h-full bg-black/40 rounded-full" />
                    <div className="w-1.5 h-full bg-black/40 rounded-full" />
                    <div className="w-1.5 h-full bg-black/40 rounded-full" />
                  </div>
                </motion.div>
              </div>

              {/* Text Content */}
              <h2 className="text-[length:var(--step-2)] font-semibold text-[var(--ink)] tracking-tight mb-2 text-center">
                {copy.removeGame || "Delete File"}
              </h2>
              <p className="text-[length:var(--step-0)] font-medium text-[var(--ink-muted)] text-center leading-[1.4] mb-8 px-2 max-w-[240px]">
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
                  className="flex-1 py-3 rounded-[var(--corner-sm)] bg-[var(--tone-3)] hover:bg-[var(--tone-4)] border border-transparent text-[length:var(--step-1)] font-medium text-[var(--ink)] transition-all disabled:opacity-40"
                >
                  {copy.cancel}
                </button>
                <button
                  type="button"
                  onClick={actions.handleDeleteGame}
                  disabled={state.isDeleting}
                  className="flex-1 py-3 rounded-[var(--corner-sm)] bg-[#FF453A] hover:bg-[#FF5147] border border-[#FF453A]/50 text-[length:var(--step-1)] font-medium text-[var(--ink)] hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-40"
                >
                  {state.isDeleting ? copy.removing : (copy.remove || "Delete")}
                </button>
              </div>
            </div>
          </ModalShell>

          {/* Painel rápido de controle deste jogo */}
          {game && (
            <GameControllerPanel
              isOpen={controllerPanelOpen}
              onClose={() => setControllerPanelGameId(null)}
              uid={user?.uid}
              gameId={game.id}
              gameTitle={game.title}
              onOpenAdvanced={
                onOpenControllerSettings
                  ? () => {
                      setControllerPanelGameId(null);
                      onOpenControllerSettings(game);
                    }
                  : undefined
              }
              playSound={playSound}
            />
          )}

          {/* ============================================================
              TELA CINEMATOGRÁFICA DE LAUNCH
              ============================================================ */}
          {/* Intro nova: mascote põe os fones, o hub se recolhe e ele voa até o notch (overlay) */}
          <AnimatePresence>
            {state.isLaunching && gameBootIntroEnabled && game && (
              <GameLaunchIntro
                key="launch-intro"
                title={game.title}
                heroImage={heroImage}
                launchingLabel={copy.launching}
                willHideHub={closeOnLaunch}
                soundEnabled={gameBootIntroSoundEnabled}
                effectsVolume={effectsVolume / 100}
                soundTheme={soundTheme}
                onHideHub={() => {
                  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
                    void import("@tauri-apps/api/core").then(({ invoke }) => invoke("launcher_hide_main")).catch(() => undefined);
                  }
                }}
              />
            )}
          </AnimatePresence>

          {/* Tela de lançamento antiga (intro desligada nas configurações) */}
          <AnimatePresence>
            {state.isLaunching && !gameBootIntroEnabled && (
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
                      className="absolute inset-0 rounded-full border border-transparent animate-ping"
                      style={{ animationDuration: "3s" }}
                    />
                    <div
                      className="absolute inset-4 rounded-full border-t border-transparent animate-spin"
                      style={{ animationDuration: "2s" }}
                    />
                    <div
                      className="absolute inset-8 rounded-full border-b border-transparent animate-spin"
                      style={{ animationDirection: "reverse", animationDuration: "1.5s" }}
                    />
                    <div className="w-16 h-16 rounded-full bg-[var(--tone-3)] flex items-center justify-center">
                      {game.logoImage ? (
                        <img src={game.logoImage} alt="" className="w-12 object-contain opacity-80 animate-pulse" />
                      ) : (
                        <Play className="w-8 h-8 text-[var(--ink)] animate-pulse fill-white/80" />
                      )}
                    </div>
                  </motion.div>

                  <h2 className="text-3xl md:text-4xl font-display font-semibold tracking-[-0.03em] text-[var(--ink)] mb-3">
                    {game.title}
                  </h2>
                  <p className="text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] animate-pulse">
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
