import React, { useMemo } from "react";
import { motion, useReducedMotion, useMotionValue, useMotionTemplate } from "framer-motion";
import { Gamepad2, ArrowRight } from "lucide-react";
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
// The article's total height (COVER_HEIGHT) already accounts for the overhang,
// so nothing here ever exceeds the row's scroll box and gets clipped.
const CARD_HEIGHT = 130;
const OVERHANG = 46;
const COVER_WIDTH = 122;
const COVER_HEIGHT = CARD_HEIGHT + OVERHANG; // 176
const COVER_LEFT = 18;
const TEXT_OFFSET = COVER_LEFT + COVER_WIDTH + 18; // reserved space so text never sits under the cover

const getPlatformInfo = (launcherType?: string) => {
  const iconClass = "h-3.5 w-3.5 text-white/78";

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

const ContinueCard: React.FC<{
  game: Game;
  index: number;
  onPlay: () => void;
  onOpenDetails: () => void;
  playSound?: (sound: any) => void;
}> = ({ game, index, onPlay, playSound }) => {
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
    ? `linear-gradient(145deg, color-mix(in srgb, ${accentColor} 26%, #242424) 0%, #0A0A0A 100%)`
    : "linear-gradient(145deg, #242424 0%, #0A0A0A 100%)";
  const cardBorderColor = accentColor
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

  return (
    <motion.article
      initial={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, x: 15 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={prefersReducedMotion ? undefined : { x: 4 }}
      whileTap={{ scale: 0.98 }}
      transition={enterTransition}
      onClick={onPlay}
      onMouseMove={handleCardGlow}
      onPointerEnter={() => playSound?.("hover")}
      className="group relative w-[400px] shrink-0 cursor-pointer"
      style={{ height: COVER_HEIGHT }}
      aria-label={`Continuar jogando ${game.title}`}
    >
      {/* Card background — cor do jogo + spotlight segue o cursor */}
      <motion.div
        className="absolute inset-x-0 bottom-0 overflow-hidden border shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
        style={{
          height: CARD_HEIGHT,
          background: cardBackground,
          borderRadius: 32, /* Squircle */
          borderColor: cardBorderColor,
        }}
      >
        <motion.div
          className="pointer-events-none absolute -inset-px rounded-[32px] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{
            background: useMotionTemplate`
              radial-gradient(
                400px circle at ${mouseX}px ${mouseY}px,
                rgba(255,255,255,0.1),
                transparent 80%
              )
            `,
          }}
        />
      </motion.div>

      {/* Text — reserved offset guarantees it never sits under the cover and never truncates */}
      <div
        className="absolute bottom-0 right-4 flex flex-col justify-center gap-1.5"
        style={{ height: CARD_HEIGHT, left: TEXT_OFFSET }}
      >
        <h3 className="truncate text-[22px] font-bold leading-tight tracking-tight text-white/90 drop-shadow-sm transition-colors group-hover:text-white">
          {game.title}
        </h3>
        <p className="flex min-w-0 items-center gap-1.5 whitespace-nowrap text-[12px] font-medium text-white/50">
          <span className="shrink-0">{hours > 0 ? `${formatPlayedHours(hours)}h` : "Recente"}</span>
          <span className="h-1 w-1 shrink-0 rounded-full bg-white/20" />
          <span className="flex shrink-0 items-center gap-1">{platform.label}</span>
          <span className="h-1 w-1 shrink-0 rounded-full bg-white/20" />
          <span
            className="shrink-0 text-[rgb(var(--launcher-accent))]"
            style={accentColor ? { color: accentColor } : undefined}
          >
            Último Jogo
          </span>
        </p>
      </div>

      {/* Cover — pops above the card, but stays inside the article's own box,
          so the scroll container's overflow-x never clips it */}
      <motion.div
        className="absolute top-0 z-10 overflow-hidden rounded-[16px] border border-white/10 bg-[#0f1115] shadow-[0_16px_32px_rgba(0,0,0,0.6)]"
        style={{ left: COVER_LEFT, width: COVER_WIDTH, height: COVER_HEIGHT - 12 }}
      >
        {coverArt ? (
          <img src={coverArt} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Gamepad2 className="h-8 w-8 text-white/20" />
          </div>
        )}
      </motion.div>
    </motion.article>
  );
};

export const DashboardContinuePlaying: React.FC<DashboardContinuePlayingProps> = ({
  continuePlayingGames,
  onPlayGame,
  onOpenDetails,
  playSound,
}) => {
  const prefersReducedMotion = useReducedMotion();
  const scrollRef = React.useRef<HTMLDivElement>(null);

  if (continuePlayingGames.length === 0) return null;

  const handleScrollRight = () => {
    if (scrollRef.current) {
      playSound?.("hover");
      scrollRef.current.scrollBy({ left: 850, behavior: "smooth" });
    }
  };

  return (
    <section aria-label="Continuar jogando" className="px-10 pb-6 mb-16 relative group/section">
      <div className="mb-4 flex flex-col">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/34">
          Retomar
        </p>
        <div className="mt-1 flex items-baseline gap-3">
          <h2 className="text-[18px] font-semibold leading-[1.1] tracking-[-0.02em] text-white/88">
            Continuar jogando
          </h2>
          <span className="text-[10.5px] font-medium text-white/34">
            {continuePlayingGames.length} {continuePlayingGames.length === 1 ? "jogo" : "jogos"}
          </span>
        </div>
      </div>

      {/* No pt- hack needed: the cover's overhang is inside each article's own
          height, so overflow-x-auto here never clips it top or bottom. */}
      <motion.div
        ref={scrollRef}
        className="no-scrollbar -ml-[12px] flex gap-[24px] overflow-x-auto overscroll-x-contain pb-4 pl-[12px] pr-10"
        style={{ scrollSnapType: "x proximity" }}
        initial={false}
        animate={{ opacity: 1 }}
        transition={prefersReducedMotion ? { duration: 0.12 } : STANDARD_SPRING}
      >
        {continuePlayingGames.map((game, index) => (
          <ContinueCard
            key={game.id}
            game={game}
            index={index}
            onPlay={() => onPlayGame(game)}
            onOpenDetails={() => onOpenDetails?.(game) ?? onPlayGame(game)}
            playSound={playSound}
          />
        ))}

      </motion.div>

      {continuePlayingGames.length > 5 && (
        <button
          onClick={handleScrollRight}
          className="absolute right-8 top-[60%] z-10 flex h-12 w-12 items-center justify-center rounded-full bg-[#1A1A1A]/90 border border-white/[0.1] text-white/70 backdrop-blur-xl shadow-2xl transition-all hover:bg-white/[0.1] hover:scale-105 hover:text-white"
        >
          <ArrowRight className="h-6 w-6" />
        </button>
      )}
    </section>
  );
};

export default React.memo(DashboardContinuePlaying);