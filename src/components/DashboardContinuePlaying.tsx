import React, { useMemo } from "react";
import { motion, AnimatePresence, useReducedMotion, useMotionValue, useMotionTemplate } from "framer-motion";
import { Gamepad2, ArrowRight, ArrowLeft } from "lucide-react";
import type { Game } from "../types/domain";
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
import { useGameColor } from "../hooks/useGameColor";

interface DashboardContinuePlayingProps {
  continuePlayingGames: Game[];
  selectedGameId?: string;
  onSelectGame?: (game: Game) => void;
  onPlayGame: (game: Game) => void;
  onOpenDetails?: (game: Game) => void;
  playSound?: (sound: any) => void;
}

const STANDARD_SPRING = {
  type: "spring" as const,
  bounce: 0,
  duration: 0.4,
};

// How far the cover pops above the card's top edge, and the card's own height.
// Compact proportions so it acts as a fast-resume strip without overpowering the hero.
const CARD_HEIGHT = 104;
const OVERHANG = 32;
const COVER_WIDTH = 96;
const COVER_HEIGHT = CARD_HEIGHT + OVERHANG; // 136
const COVER_LEFT = 14;
const TEXT_OFFSET = COVER_LEFT + COVER_WIDTH + 14; // reserved space so text never sits under the cover

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
  playSound?: (sound: any) => void;
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
  const dominantColor = useGameColor(coverArt);

  const enterTransition = prefersReducedMotion
    ? { duration: 0.12 }
    : { ...STANDARD_SPRING, delay: Math.min(index * 0.035, 0.14) };

  const accentColor =
    dominantColor?.hex && dominantColor.hex !== "#ffffff" && dominantColor.hex !== "rgba(255,255,255,1)"
      ? dominantColor.hex
      : null;

  // A barra horizontal segue a cor dominante do jogo (color-mix mantém
  // tudo escuro: 26% da cor sobre a base + borda tingida a 35%).
  const cardBackground = accentColor
    ? `linear-gradient(145deg, color-mix(in srgb, ${accentColor} 26%, var(--surface-overlay)) 0%, var(--surface-base) 100%)`
    : "linear-gradient(145deg, var(--surface-overlay) 0%, var(--surface-base) 100%)";
  const cardBorderColor = isSelected
    ? "rgba(255, 255, 255, 0.45)"
    : accentColor
      ? `color-mix(in srgb, ${accentColor} 35%, rgba(255, 255, 255, 0.08))`
      : "rgba(255, 255, 255, 0.08)";

  // Glow no card todo, com coordenadas da superfície visual (a barra
  // horizontal): o handler resolve o alvo, então pairar sobre texto
  // ou capa atualiza o spotlight no lugar certo, sem saltos.
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  const handleCardGlow = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    mouseX.set(e.clientX - rect.left);
    mouseY.set(e.clientY - rect.top);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isSelected) {
      onPlay();
    } else {
      onSelectGame?.();
      playSound?.("select");
    }
  };

  return (
    <motion.article
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={prefersReducedMotion ? undefined : { y: -2 }}
      whileTap={{ scale: 0.98 }}
      transition={enterTransition}
      onClick={handleClick}
      onMouseMove={handleCardGlow}
      onPointerEnter={() => playSound?.("hover")}
      className={`group relative shrink-0 cursor-pointer ${cardWidthClass}`}
      style={{ height: COVER_HEIGHT, scrollSnapAlign: "start" }}
      aria-label={`Continuar jogando ${game.title}`}
    >
      {/* Card background — cor do jogo + spotlight segue o cursor */}
      <motion.div
        className="absolute inset-x-0 bottom-0 overflow-hidden border shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
        style={{
          height: CARD_HEIGHT,
          background: cardBackground,
          borderRadius: 22, /* Squircle */
          borderColor: cardBorderColor,
          boxShadow: isSelected
            ? "0 0 24px rgba(255,255,255,0.12), inset 0 1px 0 rgba(255,255,255,0.25)"
            : "inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        <motion.div
          className="pointer-events-none absolute -inset-px rounded-[22px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: useMotionTemplate`
              radial-gradient(
                320px circle at ${mouseX}px ${mouseY}px,
                rgba(255,255,255,0.1),
                transparent 80%
              )
            `,
          }}
        />
      </motion.div>

      {/* Text — reserved offset guarantees it never sits under the cover and never truncates */}
      <div
        className="absolute bottom-0 right-4 flex flex-col justify-center gap-1 overflow-hidden"
        style={{ height: CARD_HEIGHT, left: TEXT_OFFSET }}
      >
        <h3 className="truncate text-[length:var(--fs-title)] font-semibold leading-tight tracking-tight text-[var(--ink)] drop-shadow-sm transition-colors group-hover:text-white">
          {game.title}
        </h3>
        <p className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[length:var(--fs-label)] font-medium text-[var(--ink-muted)]">
          <span className="shrink-0">{hours > 0 ? `${formatPlayedHours(hours)}h` : "Recente"}</span>
          <span className="h-1 w-1 shrink-0 rounded-full bg-white/20" />
          <span className="flex shrink-0 items-center gap-1 truncate max-w-[80px]">{platform.label}</span>
          <span className="h-1 w-1 shrink-0 rounded-full bg-white/20" />
          <span
            className="shrink-0 text-[rgb(var(--launcher-accent))]"
            style={accentColor ? { color: accentColor } : undefined}
          >
            Último Jogo
          </span>
        </p>
      </div>

      {/* Cover — pops above the card, but stays inside the article's own box */}
      <motion.div
        className="absolute top-0 z-10 overflow-hidden rounded-[calc(var(--radius-card)-3px)] border border-[color:var(--edge-subtle)] bg-[color:var(--surface-base)] shadow-[var(--elev-card)]"
        style={{ left: COVER_LEFT, width: COVER_WIDTH, height: COVER_HEIGHT - 10 }}
      >
        {coverArt ? (
          <img src={coverArt} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Gamepad2 className="h-7 w-7 text-[var(--ink-faint)]" />
          </div>
        )}
      </motion.div>
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
      ? "w-[calc((100%-80px)/5)] min-w-[270px] max-w-[350px]"
      : "w-[300px]";

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
    <section aria-label="Continuar jogando" className="px-[var(--safe-x)] pt-[var(--gap-section)] relative group/section">
      <div className="mb-3 flex flex-col">
        <p className="text-[length:var(--fs-label)] font-medium text-[var(--ink-faint)]">
          Retomar
        </p>
        <div className="mt-1 flex items-baseline gap-3">
          <h2 className="text-[length:var(--fs-heading)] font-semibold leading-[1.1] tracking-[-0.02em] text-[var(--ink)]">
            Continuar jogando
          </h2>
          <span className="text-[length:var(--fs-label)] font-medium text-[var(--ink-faint)]">
            {continuePlayingGames.length} {continuePlayingGames.length === 1 ? "jogo" : "jogos"}
          </span>
        </div>
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
              className="absolute -left-3 sm:-left-4 top-[56%] -translate-y-1/2 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--surface-raised)_90%,transparent)] hover:bg-[color:var(--surface-overlay)] border border-[color:var(--edge-subtle)] hover:border-[color:var(--edge-strong)] text-white shadow-[var(--elev-pill)] backdrop-blur-2xl transition-colors cursor-pointer"
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
              className="absolute -right-3 sm:-right-4 top-[56%] -translate-y-1/2 z-20 flex h-11 w-11 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--surface-raised)_90%,transparent)] hover:bg-[color:var(--surface-overlay)] border border-[color:var(--edge-subtle)] hover:border-[color:var(--edge-strong)] text-white shadow-[var(--elev-pill)] backdrop-blur-2xl transition-colors cursor-pointer"
            >
              <ArrowRight className="h-5 w-5" />
            </motion.button>
          )}
        </AnimatePresence>

        {/* Container Horizontal com Scroll Suave e Snap */}
        <motion.div
          ref={scrollRef}
          className="no-scrollbar flex gap-5 overflow-x-auto overscroll-x-contain pt-2 pb-4 px-1"
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