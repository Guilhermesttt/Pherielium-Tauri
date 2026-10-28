import React from "react";
import { AnimatePresence, motion, useReducedMotion, type Transition } from "framer-motion";
import { ArrowLeft, ChevronDown, Gamepad2, Lock, MoreHorizontal, Pencil, Play, Star } from "lucide-react";
import { TopBarClock } from "../../home/TopBarClock";
import { screenSprings } from "../../../design-system/motion";
import { FlipBlock } from "./FlipBlock";
import { GAMEPAD_PRIORITY } from "../../../context/gamepadSubscribers";
import { useGamepadButton } from "../../../context/GamepadContext";
import { PlatformGlyph } from "../../home/console/PlatformGlyph";
import type { Game } from "../../../types/domain";
import type { GameDetailCopy } from "../../../types/gameDetail";
import type { SteamAchievement } from "../../../services/steam";
import type { SoundEffectType } from "../../../hooks/useSoundEffects";
import type { GamepadFamily } from "../../../context/GamepadContext";
import { ControllerButtonGlyph } from "../../ui/ControllerButtonGlyph";
import { useSlidingPill } from "../../../hooks/useSlidingPill";
import { useHoldToLaunch } from "../../../hooks/useHoldToLaunch";
import { formatRarity, formatUnlockDate, pickRecentAchievements, splitPlaytime, trophyPercent } from "./consoleScreen";

/** Textos desta tela que não existem no copy do painel (pt-BR, en-US, es-ES). */
const SCREEN_COPY = {
  "pt-BR": {
    back: "Voltar",
    playedFor: "Jogado por",
    achievements: "Conquistas",
    lastSession: "Última vez",
    friendsPlaying: "Amigos jogando",
    trophyProgress: "Progresso de troféus",
    start: "Iniciar o jogo",
    holdToStart: "Segure para iniciar",
    recent: "Conquistas recentes",
    seeAll: "Ver todas",
    next: "dos jogadores têm",
    noAchievements: "Este jogo não tem conquistas registradas.",
    loading: "Carregando conquistas…",
    options: "Opções",
    select: "Selecionar",
    favorite: "Favoritar",
    unfavorite: "Tirar dos favoritos",
    edit: "Editar jogo",
    controller: "Controle deste jogo",
  },
  "en-US": {
    back: "Back",
    playedFor: "Played for",
    achievements: "Achievements",
    lastSession: "Last played",
    friendsPlaying: "Friends playing",
    trophyProgress: "Trophy progress",
    start: "Start the game",
    holdToStart: "Hold to start",
    recent: "Recent achievements",
    seeAll: "See all",
    next: "of players have it",
    noAchievements: "This game has no achievements on record.",
    loading: "Loading achievements…",
    options: "Options",
    select: "Select",
    favorite: "Add to favorites",
    unfavorite: "Remove from favorites",
    edit: "Edit game",
    controller: "Controller for this game",
  },
  "es-ES": {
    back: "Volver",
    playedFor: "Jugado",
    achievements: "Logros",
    lastSession: "Última vez",
    friendsPlaying: "Amigos jugando",
    trophyProgress: "Progreso de trofeos",
    start: "Iniciar el juego",
    holdToStart: "Mantén para iniciar",
    recent: "Logros recientes",
    seeAll: "Ver todos",
    next: "de los jugadores lo tienen",
    noAchievements: "Este juego no tiene logros registrados.",
    loading: "Cargando logros…",
    options: "Opciones",
    select: "Seleccionar",
    favorite: "Añadir a favoritos",
    unfavorite: "Quitar de favoritos",
    edit: "Editar juego",
    controller: "Mando de este juego",
  },
} as const;

export type ConsoleScreenLocale = keyof typeof SCREEN_COPY;

export interface ConsoleGameScreenProps {
  game: Game;
  isOpen: boolean;
  heroImage: string;
  platformLabel: string;
  copy: GameDetailCopy;
  locale: ConsoleScreenLocale;
  tabs: readonly string[];
  activeTab: string;
  onSelectTab: (tab: string) => void;
  /** Modo lista: a arte recua para a direita e a coluna da esquerda mostra conteúdo. */
  listOpen: boolean;
  onToggleList: (open: boolean) => void;
  lastSession: string;
  friendsPlaying: number;
  achievementsUnlocked: number;
  achievementsTotal: number;
  achievements: { data: SteamAchievement[]; loading: boolean; error: string | null; retry: () => void };
  isLaunching: boolean;
  isRunning: boolean;
  launchError: string | null;
  onLaunch: () => void;
  onClose: () => void;
  onToggleFavorite?: () => void;
  onEditGame?: () => void;
  onOpenControllerPanel?: () => void;
  /** Conteúdo das abas que não são "Jogar" (os componentes de sempre do detalhe). */
  tabContent: React.ReactNode;
  scrollRef: React.RefObject<HTMLDivElement | null>;
  isGamepadConnected: boolean;
  gamepadFamily: GamepadFamily;
  playSound: (type: SoundEffectType) => void;
}

/** Curva das trocas de conteúdo (fade): sai rápido, entra assentando. O que se move usa as molas. */
const EASE_OUT = [0.32, 0.72, 0, 1] as const;

/** As abas descem de cima e o resto sobe de baixo quando a tela abre (as molas, em `screenSprings`). */
const DROP_IN = { out: { opacity: 0, y: -18 }, in: { opacity: 1, y: 0 } } as const;
const RISE_IN = { out: { opacity: 0, y: 28 }, in: { opacity: 1, y: 0 } } as const;

/**
 * Tela do jogo estilo console: a arte do jogo ocupa a tela; título e números grandes embaixo à
 * esquerda; progresso de troféus e "Iniciar o jogo" embaixo à direita. No modo lista (descer na
 * aba Jogar, ou qualquer outra aba) a arte recua para a coluna da direita e a esquerda mostra a
 * lista. Ver docs/game-screen-console.md.
 */
export const ConsoleGameScreen: React.FC<ConsoleGameScreenProps> = (props) => {
  const {
    game,
    isOpen,
    heroImage,
    platformLabel,
    copy,
    locale,
    tabs,
    activeTab,
    onSelectTab,
    listOpen,
    onToggleList,
    lastSession,
    friendsPlaying,
    achievementsUnlocked,
    achievementsTotal,
    achievements,
    isLaunching,
    isRunning,
    launchError,
    onLaunch,
    onClose,
    onToggleFavorite,
    onEditGame,
    onOpenControllerPanel,
    tabContent,
    scrollRef,
    isGamepadConnected,
    gamepadFamily,
    playSound,
  } = props;
  const reducedMotion = useReducedMotion();
  const t = SCREEN_COPY[locale];
  const isPlayTab = activeTab === copy.tabPlay;
  const split = listOpen || !isPlayTab;
  const playtime = splitPlaytime(game.hoursPlayed);
  const percent = trophyPercent(achievementsUnlocked, achievementsTotal);
  const recent = React.useMemo(() => pickRecentAchievements(achievements.data), [achievements.data]);
  /** Com "reduzir movimento" nada desliza: troca seca. */
  const spring = <T extends object>(value: T): T | { duration: 0 } => (reducedMotion ? { duration: 0 } : value);
  /** Entrada dos blocos: mola ao abrir (com um pequeno atraso por bloco), saída curta ao fechar. */
  const enterTransition = (delay: number) => ({
    y: isOpen ? spring({ ...screenSprings.enter, delay }) : { duration: 0.15, ease: EASE_OUT },
    opacity: { duration: isOpen ? 0.22 : 0.15, delay: isOpen ? delay : 0 },
  });
  const [optionsOpen, setOptionsOpen] = React.useState(false);
  const optionsRef = React.useRef<HTMLDivElement>(null);
  const tabsTrackRef = React.useRef<HTMLDivElement>(null);
  const tabsPillRef = React.useRef<HTMLSpanElement>(null);
  useSlidingPill(tabsTrackRef, tabsPillRef, activeTab);

  // Controle: o botão Opções abre e fecha o menu; com ele aberto, o D-pad anda pelos itens, X
  // escolhe e O fecha só o menu (prioridade acima do painel, que senão fecharia a tela inteira).
  const menuItems = () => Array.from(optionsRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? []);
  const moveMenuFocus = (delta: 1 | -1) => {
    const items = menuItems();
    if (items.length === 0) return;
    const index = items.indexOf(document.activeElement as HTMLElement);
    items[(index + delta + items.length) % items.length]?.focus();
    playSound("navigate");
  };
  useGamepadButton("OPTIONS", () => setOptionsOpen((open) => !open), isOpen, GAMEPAD_PRIORITY.overlay);
  useGamepadButton("DPAD_UP", () => moveMenuFocus(-1), isOpen && optionsOpen, GAMEPAD_PRIORITY.overlayMenu);
  useGamepadButton("DPAD_DOWN", () => moveMenuFocus(1), isOpen && optionsOpen, GAMEPAD_PRIORITY.overlayMenu);
  useGamepadButton("X", () => {
    const items = menuItems();
    const focused = items.find((item) => item === document.activeElement) ?? items[0];
    focused?.click();
  }, isOpen && optionsOpen, GAMEPAD_PRIORITY.overlayMenu);
  useGamepadButton("O", () => setOptionsOpen(false), isOpen && optionsOpen, GAMEPAD_PRIORITY.overlayMenu);

  React.useEffect(() => {
    if (!optionsOpen) return;
    const timer = window.setTimeout(() => menuItems()[0]?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [optionsOpen]);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName))) return;
      if (event.key.toLowerCase() === "o") {
        event.preventDefault();
        setOptionsOpen((open) => !open);
      } else if (event.key === "Escape") {
        setOptionsOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen]);

  // Iniciar exige segurar (mouse, Enter/Espaço ou X no controle) para não abrir o jogo sem querer.
  const hold = useHoldToLaunch({
    onComplete: onLaunch,
    enabled: isOpen && isPlayTab && !optionsOpen && !isLaunching && !isRunning,
    // com foco em outro controle da tela, X é "ativar esse controle" e não o início do jogo
    canStartFromGamepad: () => {
      const focused = document.activeElement;
      return !(focused instanceof HTMLElement && focused !== document.body && scrollRef.current?.contains(focused));
    },
  });
  const startLabel = isRunning ? copy.running : isLaunching ? copy.launching : t.holdToStart;

  return (
    <div
      className="console-screen fixed inset-0 overflow-hidden bg-[var(--tone-0)] select-none"
      data-open={isOpen ? "true" : "false"}
      role="dialog"
      aria-modal="true"
      aria-label={`Detalhes de ${game.title}`}
    >
      {/* Arte do jogo. No modo lista ela desliza para a direita e se amplia, com mola, enquanto um
          painel escuro sobe de baixo e cobre a coluna da esquerda (como no vídeo de referência). */}
      <div className="absolute inset-0 overflow-hidden" aria-hidden="true">
        <motion.div
          className="absolute inset-0 origin-right"
          initial={false}
          animate={{ x: split ? "18%" : "0%", scale: split ? 1.12 : 1 }}
          transition={spring(screenSprings.art)}
        >
          {heroImage && <img src={heroImage} alt="" draggable={false} className="h-full w-full object-cover" />}
        </motion.div>
        <div className="console-screen-scrim absolute inset-0" data-split={split} />
      </div>
      <motion.div
        aria-hidden="true"
        className="console-list-panel absolute bottom-0 left-0 top-0 w-[56%] origin-bottom"
        initial={false}
        animate={{ scaleY: split ? 1 : 0 }}
        transition={spring(screenSprings.panel)}
      />

      <div className="console-screen-ui relative z-10 flex h-full flex-col">
        {/* Topo: voltar e hora, como a linha de status de um console */}
        <header className="flex items-center gap-[var(--gap-section)] px-[var(--safe-x)] pt-[var(--header-pt-safe)] pb-[var(--gap-stack)]">
          <button
            type="button"
            onClick={() => {
              playSound("back");
              onClose();
            }}
            aria-label={t.back}
            className="console-chip inline-flex h-[var(--control-h)] w-[var(--control-h)] shrink-0 items-center justify-center rounded-[var(--corner-sm)]"
          >
            <ArrowLeft className="ctl-icon" />
          </button>
          <TopBarClock />
        </header>

        <div className="relative flex min-h-0 flex-1">
          {/* Coluna da esquerda: no modo lista ocupa 56% e rola; senão o bloco do título fica embaixo. */}
          <motion.div
            ref={scrollRef}
            className={`detail-panel-scrollbar flex min-h-0 w-[56%] flex-col px-[var(--safe-x)] ${
              split ? "overflow-y-auto pb-[var(--safe-y)] pt-[var(--gap-section)]" : "justify-end overflow-hidden pb-[calc(var(--safe-y)+8px)]"
            }`}
          >
            <FlipBlock dep={split} spring={spring(screenSprings.layout)} className="mb-[calc(var(--gap-section)*1.4)]">
            <motion.div
              variants={DROP_IN}
              initial="out"
              animate={isOpen ? "in" : "out"}
              transition={enterTransition(0.02)}
              className="console-tabs-row flex min-w-0 items-center gap-2"
            >
              {isGamepadConnected && (
                <span className="console-bumper" title="Aba anterior" aria-hidden="true">
                  <ControllerButtonGlyph button="LB" gamepadFamily={gamepadFamily} size={16} />
                </span>
              )}
              <div ref={tabsTrackRef} role="tablist" aria-label="Seções do jogo" className="no-scrollbar relative flex min-w-0 items-center gap-1.5 overflow-x-auto">
                <span ref={tabsPillRef} className="console-tab-pill" aria-hidden="true" />
                {tabs.map((tab) => {
                  const active = tab === activeTab;
                  return (
                    <button
                      key={tab}
                      type="button"
                      role="tab"
                      aria-selected={active}
                      onClick={() => {
                        onSelectTab(tab);
                        playSound("navigate");
                      }}
                      className="console-tab-item relative flex h-[calc(var(--control-h)-8px)] shrink-0 cursor-pointer items-center px-4 whitespace-nowrap"
                      data-active={active}
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>
              {isGamepadConnected && (
                <span className="console-bumper" title="Próxima aba" aria-hidden="true">
                  <ControllerButtonGlyph button="RB" gamepadFamily={gamepadFamily} size={16} />
                </span>
              )}
            </motion.div>
            </FlipBlock>

            <TitleBlock
              isOpen={isOpen}
              flipDep={split}
              flipSpring={spring(screenSprings.layout)}
              enterTransition={enterTransition(0.06)}
              game={game}
              platformLabel={platformLabel}
              t={t}
              playtime={playtime}
              achievementsUnlocked={achievementsUnlocked}
              achievementsTotal={achievementsTotal}
              lastSession={lastSession}
              friendsPlaying={friendsPlaying}
            />

            {isPlayTab && !listOpen && (recent.length > 0 || achievements.loading) && (
              <button
                type="button"
                onClick={() => {
                  playSound("navigate");
                  onToggleList(true);
                }}
                className="console-more mt-[var(--gap-section)] inline-flex w-max items-center gap-2 text-[length:var(--fs-label)] font-semibold text-[var(--ink-muted)]"
              >
                <ChevronDown className="h-4 w-4" aria-hidden="true" />
                {t.recent}
              </button>
            )}

            <AnimatePresence mode="wait" initial={false}>
              {split && (
                <motion.div
                  key={isPlayTab ? "recent" : activeTab}
                  initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, transition: { duration: 0.14 } }}
                  transition={{ duration: reducedMotion ? 0.12 : 0.22, ease: EASE_OUT, delay: reducedMotion ? 0 : 0.05 }}
                  className="mt-[var(--gap-section)] min-w-0"
                  role="tabpanel"
                >
                  {isPlayTab ? (
                    <RecentList
                      recent={recent}
                      loading={achievements.loading}
                      error={achievements.error}
                      onRetry={achievements.retry}
                      locale={locale}
                      t={t}
                      gameTitle={game.title}
                      onExit={() => {
                        onToggleList(false);
                        playSound("navigate");
                      }}
                      playSound={playSound}
                      onSeeAll={() => {
                        onSelectTab(copy.tabAchievements);
                        playSound("navigate");
                      }}
                    />
                  ) : (
                    tabContent
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>

          {/* Embaixo à direita, sobre a arte: progresso de troféus e Iniciar o jogo (sempre à mão). */}
          <motion.div
            variants={RISE_IN}
            initial="out"
            animate={isOpen ? "in" : "out"}
            transition={enterTransition(0.1)}
            className="pointer-events-none absolute bottom-[var(--safe-y)] right-[var(--safe-x)] flex w-[min(380px,34%)] flex-col gap-[var(--gap-stack)]"
          >
            {achievementsTotal > 0 && (
              <div className="pointer-events-auto">
                <div className="mb-2 flex items-baseline justify-between text-[length:var(--fs-label)] font-semibold">
                  <span className="text-[var(--ink-muted)]">{t.trophyProgress}</span>
                  <span className="font-metric text-[var(--ink)]">{percent}%</span>
                </div>
                <div className="console-progress" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={t.trophyProgress}>
                  <span style={{ width: `${percent}%` }} />
                </div>
              </div>
            )}
            <button
              type="button"
              disabled={isLaunching || isRunning}
              data-holding={hold.holding || undefined}
              aria-label={`${startLabel} (${t.start})`}
              {...hold.pointerHandlers}
              className="console-start pointer-events-auto relative flex h-[calc(var(--cta-h)*1.2)] touch-none select-none items-center justify-between gap-4 overflow-hidden px-[calc(var(--cta-h)*0.4)] text-left"
            >
              <span
                className="console-start-fill"
                style={{ transform: `scaleX(${hold.progress})` }}
                aria-hidden="true"
              />
              <span className="relative flex items-center gap-2 text-[length:var(--fs-label)] font-bold uppercase tracking-[0.06em]">
                {isRunning && <span className="h-2.5 w-2.5 rounded-full bg-[var(--live)]" aria-hidden="true" />}
                {startLabel}
              </span>
              {isGamepadConnected ? (
                <span className="relative flex">
                  <ControllerButtonGlyph button="A" gamepadFamily={gamepadFamily} size={22} />
                </span>
              ) : (
                <span className="console-start-icon relative flex h-8 w-8 items-center justify-center" aria-hidden="true">
                  <Play className="h-3 w-3 fill-current" />
                </span>
              )}
            </button>
            {launchError && (
              <p role="alert" className="pointer-events-auto text-[length:var(--fs-label)] text-[var(--screen-error)]">
                {launchError}
              </p>
            )}

            <AnimatePresence>
            {optionsOpen && (
              <motion.div
                ref={optionsRef}
                key="options"
                initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
                style={{ transformOrigin: "top right" }}
                className="console-options pointer-events-auto flex flex-col"
                role="menu"
                aria-label={t.options}
                // o mouse move o mesmo destaque que o D-pad: um item ativo por vez
                onPointerOver={(event) => {
                  const item = (event.target as HTMLElement).closest<HTMLElement>('[role="menuitem"]');
                  if (item && item !== document.activeElement) item.focus({ preventScroll: true });
                }}
              >
                {onToggleFavorite && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOptionsOpen(false);
                      onToggleFavorite();
                    }}
                  >
                    <Star className={`h-4 w-4 ${game.isFavorite ? "fill-current" : ""}`} aria-hidden="true" />
                    {game.isFavorite ? t.unfavorite : t.favorite}
                  </button>
                )}
                {onEditGame && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOptionsOpen(false);
                      onEditGame();
                    }}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    {t.edit}
                  </button>
                )}
                {onOpenControllerPanel && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setOptionsOpen(false);
                      onOpenControllerPanel();
                    }}
                  >
                    <Gamepad2 className="h-4 w-4" aria-hidden="true" />
                    {t.controller}
                  </button>
                )}
              </motion.div>
            )}
            </AnimatePresence>

            {/* Legendas só com controle; com mouse e teclado fica um botão de opções discreto (ou a tecla O) */}
            {isGamepadConnected ? (
              <ul className="console-hints pointer-events-auto flex items-center justify-end gap-[var(--gap-section)]" aria-label="Atalhos do controle">
                <li>
                  <button type="button" aria-expanded={optionsOpen} onClick={() => setOptionsOpen((v) => !v)} className="inline-flex items-center gap-1.5 uppercase">
                    <ControllerButtonGlyph button="OPTIONS" gamepadFamily={gamepadFamily} size={16} />
                    {t.options}
                  </button>
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <ControllerButtonGlyph button="A" gamepadFamily={gamepadFamily} size={16} />
                  {t.select}
                </li>
                <li className="inline-flex items-center gap-1.5">
                  <ControllerButtonGlyph button="B" gamepadFamily={gamepadFamily} size={16} />
                  {t.back}
                </li>
              </ul>
            ) : (
              <button
                type="button"
                aria-expanded={optionsOpen}
                aria-label={t.options}
                title={t.options}
                onClick={() => setOptionsOpen((v) => !v)}
                className="console-chip pointer-events-auto ml-auto inline-flex h-[var(--control-h)] w-[var(--control-h)] items-center justify-center rounded-[var(--corner-sm)]"
              >
                <MoreHorizontal className="ctl-icon" />
              </button>
            )}
          </motion.div>
        </div>

      </div>
    </div>
  );
};

type ScreenText = (typeof SCREEN_COPY)[ConsoleScreenLocale];

const TitleBlock: React.FC<{
  isOpen: boolean;
  /** O que faz o bloco mudar de lugar (modo lista) e a mola com que ele vai até o novo lugar. */
  flipDep: boolean;
  flipSpring: Transition;
  enterTransition: object;
  game: Game;
  platformLabel: string;
  t: ScreenText;
  playtime: { hours: number; minutes: number };
  achievementsUnlocked: number;
  achievementsTotal: number;
  lastSession: string;
  friendsPlaying: number;
}> = ({ isOpen, flipDep, flipSpring, enterTransition, game, platformLabel, t, playtime, achievementsUnlocked, achievementsTotal, lastSession, friendsPlaying }) => (
  <FlipBlock dep={flipDep} spring={flipSpring}>
  <motion.div
    variants={RISE_IN}
    initial="out"
    animate={isOpen ? "in" : "out"}
    transition={enterTransition}
    className="flex min-w-0 flex-col gap-[var(--gap-stack)]"
  >
    <span className="inline-flex items-center gap-1.5 text-[length:var(--fs-label)] font-bold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
      <PlatformGlyph game={game} />
      {platformLabel}
    </span>
    <h1
      className={`min-w-0 truncate font-display font-semibold leading-[1.04] tracking-[-0.04em] text-[var(--ink)] ${
        "text-[length:calc(var(--fs-hero)*0.5)]"
      }`}
      title={game.title}
    >
      {game.title}
    </h1>
    <dl className="console-stats mt-[var(--gap-stack)] flex flex-wrap gap-x-[calc(var(--gap-section)*1.5)] gap-y-3">
      <div>
        <dt>{t.playedFor}</dt>
        <dd className="font-metric">
          {playtime.hours}
          <small>h</small>
          {playtime.minutes > 0 && (
            <>
              {" "}
              {playtime.minutes}
              <small>m</small>
            </>
          )}
        </dd>
      </div>
      {achievementsTotal > 0 && (
        <div>
          <dt>{t.achievements}</dt>
          <dd className="font-metric">
            {achievementsUnlocked}
            <small>/{achievementsTotal}</small>
          </dd>
        </div>
      )}
      <div>
        <dt>{t.lastSession}</dt>
        <dd className="console-stats-text">{lastSession}</dd>
      </div>
      {friendsPlaying > 0 && (
        <div>
          <dt>{t.friendsPlaying}</dt>
          <dd className="font-metric text-[var(--live)]">{friendsPlaying}</dd>
        </div>
      )}
    </dl>
  </motion.div>
  </FlipBlock>
);

const RecentList: React.FC<{
  recent: ReturnType<typeof pickRecentAchievements>;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  locale: ConsoleScreenLocale;
  t: ScreenText;
  gameTitle: string;
  onSeeAll: () => void;
  /** Seta para cima no primeiro item: fecha a lista. */
  onExit: () => void;
  playSound: (type: SoundEffectType) => void;
}> = ({ recent, loading, error, onRetry, locale, t, gameTitle, onSeeAll, onExit, playSound }) => {
  // Item selecionado: um contorno único que salta de um item para o outro (como no conceito).
  const [selected, setSelected] = React.useState(0);
  const itemRefs = React.useRef<Array<HTMLLIElement | null>>([]);
  const [cursor, setCursor] = React.useState({ top: 0, height: 0 });
  const count = recent.length;

  React.useLayoutEffect(() => {
    const el = itemRefs.current[Math.min(selected, Math.max(count - 1, 0))];
    if (!el) return;
    setCursor({ top: el.offsetTop, height: el.offsetHeight });
    el.scrollIntoView({ block: "nearest" });
  }, [selected, count]);

  React.useEffect(() => {
    if (count === 0) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName))) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelected((i) => {
          const next = Math.min(i + 1, count - 1);
          if (next !== i) playSound("navigate");
          return next;
        });
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        if (selected === 0) onExit();
        else {
          setSelected((i) => Math.max(i - 1, 0));
          playSound("navigate");
        }
      } else if (event.key === "Enter") {
        event.preventDefault();
        onSeeAll();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, selected, onExit, onSeeAll, playSound]);

  if (loading && recent.length === 0) {
    return <p className="text-[length:var(--fs-caption)] text-[var(--ink-muted)]">{t.loading}</p>;
  }
  if (error && recent.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-[length:var(--fs-caption)] text-[var(--ink-muted)]">{error}</p>
        <button type="button" onClick={onRetry} className="console-chip h-[var(--control-h)] rounded-[var(--corner-sm)] px-4 text-[length:var(--fs-label)] font-semibold">
          Tentar de novo
        </button>
      </div>
    );
  }
  if (recent.length === 0) {
    return <p className="text-[length:var(--fs-caption)] text-[var(--ink-muted)]">{t.noAchievements}</p>;
  }
  return (
    <section aria-label={t.recent}>
      <header className="mb-[var(--gap-stack)] flex items-baseline justify-between">
        <h2 className="text-[length:var(--fs-label)] font-bold uppercase tracking-[0.08em] text-[var(--ink-muted)]">{t.recent}</h2>
        <button type="button" onClick={onSeeAll} className="text-[length:var(--fs-label)] font-semibold text-[var(--ink)] hover:underline">
          {t.seeAll}
        </button>
      </header>
      <ul className="relative flex flex-col gap-2">
        <span
          aria-hidden="true"
          className="console-ach-cursor"
          style={{ transform: `translateY(${cursor.top}px)`, height: cursor.height }}
        />
        {recent.map(({ achievement, state }, index) => {
          const date = state === "unlocked" ? formatUnlockDate(achievement.unlockTime, locale) : null;
          const icon = state === "unlocked" ? achievement.icon : achievement.iconGray || achievement.icon;
          return (
            <li key={achievement.apiName} ref={(el) => { itemRefs.current[index] = el; }} onMouseEnter={() => setSelected(index)}>
            <button type="button" onClick={onSeeAll} onFocus={() => setSelected(index)} className="console-ach flex w-full items-center gap-4 p-3 text-left" data-state={state}>
              <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[6px] bg-[var(--tone-3)]">
                {icon && <img src={icon} alt="" loading="lazy" draggable={false} className="h-full w-full object-cover" />}
                {state === "next" && (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/40" aria-hidden="true">
                    <Lock className="h-4 w-4 text-[var(--ink-muted)]" />
                  </span>
                )}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[length:var(--fs-label)] text-[var(--ink-faint)]">{gameTitle}</span>
                <span className="truncate text-[length:var(--fs-body)] font-semibold text-[var(--ink)]">{achievement.name}</span>
                {achievement.description && (
                  <span className="truncate text-[length:var(--fs-label)] text-[var(--ink-muted)]">{achievement.description}</span>
                )}
              </span>
              <span className="shrink-0 text-right font-metric text-[length:var(--fs-label)] text-[var(--ink-muted)]">
                {state === "unlocked" ? date : formatRarity(achievement.percent, t.next, locale)}
              </span>
            </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
};

export default ConsoleGameScreen;
