import React, { useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Gamepad2, ArrowRight, ArrowLeft } from "lucide-react";
import type { Game } from "../types/domain";
import type { SoundEffectType } from "../hooks/useSoundEffects";
import { formatPlayedHours, getGamePlayedHours } from "../utils/playtime";
import {
  SteamBrandIcon,
  EpicBrandIcon,
  XboxBrandIcon,
  EaBrandIcon,
  UbisoftBrandIcon,
  GogBrandIcon,
  RiotBrandIcon,
  BattlenetBrandIcon,
  RockstarBrandIcon,
} from "./Sidebar";

interface DashboardContinuePlayingProps {
  continuePlayingGames: Game[];
  selectedGameId?: string;
  onSelectGame?: (game: Game) => void;
  onPlayGame: (game: Game) => void;
  onOpenDetails?: (game: Game) => void;
  playSound?: (sound: SoundEffectType) => void;
}

const STANDARD_SPRING = {
  type: "spring" as const,
  bounce: 0,
  duration: 0.6,
};

// Faixa de retomada compacta: capa pequena e texto, sobre um degrau de tom (sem borda nem brilho).
const CARD_HEIGHT = 88;
const COVER_WIDTH = 56;

const getPlatformInfo = (launcherType?: string) => {
  const iconClass = "h-3.5 w-3.5 text-[var(--ink-muted)]";

  switch (launcherType?.toLowerCase()) {
    case "steam":
      return { label: "Steam", icon: <SteamBrandIcon className={iconClass} /> };
    case "epic":
      return { label: "Epic", icon: <EpicBrandIcon className={iconClass} /> };
    case "ea":
      return { label: "EA App", icon: <EaBrandIcon className={iconClass} /> };
    case "ubisoft":
      return { label: "Ubisoft", icon: <UbisoftBrandIcon className={iconClass} /> };
    case "gog":
      return { label: "GOG", icon: <GogBrandIcon className={iconClass} /> };
    case "xbox":
      return { label: "Xbox", icon: <XboxBrandIcon className={iconClass} /> };
    case "riot":
      return { label: "Riot", icon: <RiotBrandIcon className={iconClass} /> };
    case "battlenet":
      return { label: "Battle.net", icon: <BattlenetBrandIcon className={iconClass} /> };
    case "rockstar":
      return { label: "Rockstar", icon: <RockstarBrandIcon className={iconClass} /> };
    default:
      return { label: "Local", icon: <Gamepad2 className={iconClass} /> };
  }
};

interface ContinueCardProps {
  game: Game;
  index: number;
  cardWidthClass: string;
  isSelected?: boolean;
  onSelectGame?: () => void;
  onPlay: () => void;
  onOpenDetails: () => void;
  playSound?: (sound: SoundEffectType) => void;
}

const ContinueCard = React.memo<ContinueCardProps>(({
  game,
  index,
  cardWidthClass,
  isSelected = false,
  onSelectGame,
  onPlay,
  playSound,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const hours = getGamePlayedHours(game);
  const platform = useMemo(() => getPlatformInfo(game.launcherType), [game.launcherType]);
  const coverArt = game.cardImage || game.image;

  const enterTransition = prefersReducedMotion
    ? { duration: 0.12 }
    : { ...STANDARD_SPRING, delay: Math.min(index * 0.06, 0.3) };

  const activate = () => {
    if (isSelected) {
      onPlay();
    } else {
      onSelectGame?.();
      playSound?.("select");
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    activate();
  };

  // O cartão é um botão: precisa de foco e de Enter/Espaço, não só de clique.
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    e.preventDefault();
    e.stopPropagation();
    activate();
  };

  return (
    <motion.article
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      whileTap={{ scale: 0.98 }}
      transition={enterTransition}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="button"
      tabIndex={0}
      onPointerEnter={() => playSound?.("hover")}
      className={`group relative flex shrink-0 cursor-pointer items-center gap-4 overflow-hidden rounded-[var(--radius-card)] bg-[var(--tone-2)] p-3 transition-colors hover:bg-[var(--tone-3)] ${cardWidthClass}`}
      style={{
        height: CARD_HEIGHT,
        scrollSnapAlign: "start",
        // Selecionado = o mesmo anel de tinta dos cartões da biblioteca; em repouso, nada
        boxShadow: isSelected ? "0 0 0 2px var(--ink)" : "none",
      }}
      aria-label={`Continuar jogando ${game.title}`}
      aria-current={isSelected ? "true" : undefined}
    >
      <div
        className="h-full shrink-0 overflow-hidden rounded-[var(--corner-sm,10px)] bg-[var(--surface-base)]"
        style={{ width: COVER_WIDTH }}
      >
        {coverArt ? (
          <img src={coverArt} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Gamepad2 className="h-5 w-5 text-[var(--ink-faint)]" />
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
        <h3 className="truncate text-[length:var(--fs-body)] font-semibold leading-tight tracking-tight text-[var(--ink)]">
          {game.title}
        </h3>
        <p className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[length:var(--fs-label)] font-medium text-[var(--ink-muted)]">
          <span className="shrink-0 font-metric">{hours > 0 ? `${formatPlayedHours(hours)}h` : "Recente"}</span>
          <span aria-hidden="true">·</span>
          <span className="truncate">{platform.label}</span>
          {index === 0 && (
            <>
              <span aria-hidden="true">·</span>
              <span className="shrink-0 text-[var(--ink)]">Último jogo</span>
            </>
          )}
        </p>
      </div>
    </motion.article>
  );
});

export const DashboardContinuePlaying: React.FC<DashboardContinuePlayingProps> = ({
  continuePlayingGames,
  selectedGameId,
  onSelectGame,
  onPlayGame,
  onOpenDetails,
  playSound,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = React.useState(false);
  const [canScrollRight, setCanScrollRight] = React.useState(false);

  const checkScroll = React.useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollLeft, scrollWidth, clientWidth } = el;
    setCanScrollLeft(scrollLeft > 12);
    setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 12);
  }, []);

  React.useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScroll();

    el.addEventListener("scroll", checkScroll, { passive: true });
    window.addEventListener("resize", checkScroll);

    const ro = new ResizeObserver(() => checkScroll());
    ro.observe(el);

    return () => {
      el.removeEventListener("scroll", checkScroll);
      window.removeEventListener("resize", checkScroll);
      ro.disconnect();
    };
  }, [checkScroll, continuePlayingGames]);

  const handleScrollRight = () => {
    if (scrollRef.current) {
      playSound?.("navigate");
      const step = scrollRef.current.clientWidth;
      scrollRef.current.scrollBy({ left: step, behavior: "smooth" });
      setTimeout(checkScroll, 400);
    }
  };

  const handleScrollLeft = () => {
    if (scrollRef.current) {
      playSound?.("navigate");
      const step = scrollRef.current.clientWidth;
      scrollRef.current.scrollBy({ left: -step, behavior: "smooth" });
      setTimeout(checkScroll, 400);
    }
  };

  const cardWidthClass =
    continuePlayingGames.length >= 5
      ? "w-[calc((100%-80px)/5)] min-w-[240px] max-w-[320px]"
      : "w-[280px]";

  // O corte seco nas pontas do trilho e resolvido so com mascara: o conteudo
  // some para transparente e quem aparece atras e o fundo real da tela, entao
  // nao ha cor cravada para destoar em outro tema. A rampa tem tres paradas
  // para o fade ser suave em vez de um corte em dois passos.
  const maskStyle = React.useMemo(() => {
    if (!canScrollLeft && !canScrollRight) return {};
    const w = "var(--rail-fade-w)";
    const head = canScrollLeft
      ? `transparent 0%, rgba(0,0,0,0.45) calc(${w} * 0.45), black ${w}`
      : "black 0%";
    const tail = canScrollRight
      ? `black calc(100% - ${w}), rgba(0,0,0,0.45) calc(100% - ${w} * 0.45), transparent 100%`
      : "black 100%";
    const gradient = `linear-gradient(to right, ${head}, ${tail})`;
    return { maskImage: gradient, WebkitMaskImage: gradient };
  }, [canScrollLeft, canScrollRight]);

  if (continuePlayingGames.length === 0) return null;

  return (
    <section aria-label="Continuar jogando" className="px-[var(--safe-x)] pt-[calc(var(--gap-section)*1.25)] relative group/section">
      <div className="mb-[var(--gap-section)] flex items-baseline gap-3">
        <h2 className="text-[length:var(--fs-heading)] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--ink)]">
          Continuar jogando
        </h2>
        <span className="text-[length:var(--fs-label)] font-medium text-[var(--ink-faint)]">
          <span className="font-metric">{continuePlayingGames.length}</span> {continuePlayingGames.length === 1 ? "jogo" : "jogos"}
        </span>
      </div>

      <div className="relative w-full">
        {/* Seta Voltar (Esquerda) */}
        <AnimatePresence>
          {canScrollLeft && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.8, x: -8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: -8 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
              onClick={handleScrollLeft}
              aria-label="Voltar aos jogos anteriores"
              className="absolute -left-3 sm:-left-4 top-1/2 -translate-y-1/2 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--surface-raised)_90%,transparent)] hover:bg-[color:var(--surface-overlay)] border border-[color:var(--edge-subtle)] hover:border-[color:var(--edge-strong)] text-white transition-colors cursor-pointer"
            >
              <ArrowLeft className="h-5 w-5" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Seta Avançar (Direita) */}
        <AnimatePresence>
          {canScrollRight && (
            <motion.button
              type="button"
              initial={{ opacity: 0, scale: 0.8, x: 8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.8, x: 8 }}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
              onClick={handleScrollRight}
              aria-label="Ver mais jogos recentes"
              className="absolute -right-3 sm:-right-4 top-1/2 -translate-y-1/2 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--surface-raised)_90%,transparent)] hover:bg-[color:var(--surface-overlay)] border border-[color:var(--edge-subtle)] hover:border-[color:var(--edge-strong)] text-white transition-colors cursor-pointer"
            >
              <ArrowRight className="h-5 w-5" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Container Horizontal com Scroll Suave e Snap */}
        <motion.div
          ref={scrollRef}
          className="no-scrollbar flex gap-5 overflow-x-auto overscroll-x-contain py-2 px-1"
          style={{
            scrollSnapType: "x mandatory",
            ...maskStyle,
          }}
          initial={false}
          animate={{ opacity: 1 }}
          transition={prefersReducedMotion ? { duration: 0.12 } : STANDARD_SPRING}
        >
          {continuePlayingGames.map((game, index) => (
            <ContinueCard
              key={game.id}
              game={game}
              index={index}
              cardWidthClass={cardWidthClass}
              isSelected={Boolean(selectedGameId && selectedGameId === game.id)}
              onSelectGame={() => onSelectGame?.(game)}
              onPlay={() => onPlayGame(game)}
              onOpenDetails={() => onOpenDetails?.(game) ?? onPlayGame(game)}
              playSound={playSound}
            />
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default React.memo(DashboardContinuePlaying);