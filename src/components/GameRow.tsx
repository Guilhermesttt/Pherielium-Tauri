import React, { useCallback, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import useEmblaCarousel from "embla-carousel-react";
import ContextMenu from "./ContextMenu";
import GameCard from "./GameCard";
import type { Game } from "../types/domain";

interface GameRowProps {
  games: Game[];
  selectedIndex: number;
  onSelect: (index: number, openGame?: Game) => void;
  onContextMenu?: (action: string, game: Game) => void;
  playSound: (type: "select" | "back" | "navigate") => void;
}

const MAX_VISIBLE_DOTS = 15;
const VIRTUAL_WINDOW = 6;

const GameCardSlot = React.memo(
  ({
    game,
    index,
    isActive,
    isWithinWindow,
    onSelect,
    onContextMenu,
    playSound,
  }: {
    game: Game;
    index: number;
    isActive: boolean;
    isWithinWindow: boolean;
    onSelect: (index: number, openGame?: Game) => void;
    onContextMenu?: (action: string, game: Game) => void;
    playSound: (type: "select" | "back" | "navigate") => void;
  }) => {
    const handleClick = useCallback(() => {
      if (isActive) {
        onSelect(index, game);
      } else {
        onSelect(index);
      }
    }, [game, index, isActive, onSelect]);

    const handleMenuAction = useCallback(
      (action: string) => onContextMenu?.(action as any, game),
      [game, onContextMenu],
    );

    if (!isWithinWindow) {
      // Placeholder de virtualização: com listas grandes, dezenas/centenas destes
      // ficam montados fora da janela visível. `backdrop-filter` é uma das
      // propriedades mais caras do compositor (custa mesmo fora de tela em muitos
      // motores), então o placeholder usa apenas uma cor sólida — visualmente
      // quase idêntico já que ele só aparece de relance durante o scroll rápido.
      return (
        <div
          className="shrink-0 w-44.5 h-66 rounded-3xl pointer-events-none border border-white/8 bg-black/70"
          aria-hidden="true"
        />
      );
    }

    return (
      <div className="shrink-0">
        <ContextMenu
          gameTitle={game.title}
          onAction={handleMenuAction}
          isFavorite={game.isFavorite}
          playSound={playSound}
        >
          {({ toggleMenu, isOpen }) => (
            <GameCard
              title={game.title}
              image={game.cardImage || game.image}
              isActive={isActive}
              isSteam={game.source === "steam" || game.launcherType === "steam"}
              isEpic={game.source === "epic" || game.launcherType === "epic"}
              launcherType={game.launcherType}
              steamAppId={typeof game.steamAppId === "number" ? game.steamAppId : Number(game.steamAppId) || undefined}
              isFavorite={game.isFavorite}
              onClick={handleClick}
              onMenuClick={toggleMenu}
              isMenuOpen={isOpen}
              playSound={playSound}
            />
          )}
        </ContextMenu>
      </div>
    );
  },
  (prev, next) =>
    prev.game.id === next.game.id &&
    prev.game.title === next.game.title &&
    prev.game.cardImage === next.game.cardImage &&
    prev.game.image === next.game.image &&
    prev.game.steamAppId === next.game.steamAppId &&
    prev.game.source === next.game.source &&
    prev.game.launcherType === next.game.launcherType &&
    prev.game.isFavorite === next.game.isFavorite &&
    prev.index === next.index &&
    prev.isActive === next.isActive &&
    prev.isWithinWindow === next.isWithinWindow,
);

const GameRow: React.FC<GameRowProps> = ({
  games,
  selectedIndex,
  onSelect,
  onContextMenu,
  playSound,
}) => {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "center",
    containScroll: false,
    dragFree: false,
    loop: false,
    watchDrag: (_emblaApi, evt) => {
      const target = evt.target as HTMLElement | null;
      if (!target) return true;
      if (
        target.closest("[data-context-menu-trigger]") ||
        target.closest("[data-context-menu]")
      ) {
        return false;
      }
      return true;
    },
  });

  const canonicalIndex = Math.min(Math.max(selectedIndex, 0), games.length - 1);
  const visibleDots = useMemo(() => {
    if (games.length <= MAX_VISIBLE_DOTS) {
      return games.map((_, index) => index);
    }

    const half = Math.floor(MAX_VISIBLE_DOTS / 2);
    const start = Math.max(
      0,
      Math.min(canonicalIndex - half, games.length - MAX_VISIBLE_DOTS),
    );
    return Array.from({ length: MAX_VISIBLE_DOTS }, (_, offset) => start + offset);
  }, [canonicalIndex, games]);

  const isProgrammaticRef = React.useRef(false);
  const canonicalIndexRef = React.useRef(canonicalIndex);

  useEffect(() => {
    canonicalIndexRef.current = canonicalIndex;
  }, [canonicalIndex]);

  useEffect(() => {
    if (!emblaApi) return;
    isProgrammaticRef.current = true;
    emblaApi.scrollTo(canonicalIndex);
    const t = setTimeout(() => { isProgrammaticRef.current = false; }, 150);
    return () => clearTimeout(t);
  }, [emblaApi, canonicalIndex]);

  useEffect(() => {
    if (!emblaApi) return;
    const onSnap = () => {
      if (isProgrammaticRef.current) return;
      const idx = emblaApi.selectedScrollSnap();
      if (idx >= 0 && idx < games.length && idx !== canonicalIndexRef.current) {
        onSelect(idx);
      }
    };
    emblaApi.on("select", onSnap);
    return () => {
      emblaApi.off("select", onSnap);
    };
  }, [emblaApi, games.length, onSelect]);

  return (
    <div className="relative w-full flex flex-col" style={{ gap: 0 }}>
      <div className="overflow-visible pt-3 pb-2" ref={emblaRef}>
        <div
          className="flex items-center"
          style={{
            gap: 12,
            paddingLeft: "calc(50vw - 89px)",
            paddingRight: "calc(50vw - 89px)",
          }}
        >
          {games.map((game, idx) => (
            <GameCardSlot
              key={game.id}
              game={game}
              index={idx}
              isActive={idx === canonicalIndex}
              isWithinWindow={Math.abs(idx - canonicalIndex) <= VIRTUAL_WINDOW}
              onSelect={onSelect}
              onContextMenu={onContextMenu}
              playSound={playSound}
            />
          ))}
        </div>
      </div>

      <div className="flex justify-center mt-6 gap-1.5">
        {visibleDots.map((i) => {
          const isActive = i === canonicalIndex;
          return (
            <motion.button
            type="button"
            key={i}
            aria-label={`Ir para jogo ${i + 1}`}
            className="h-0.75 rounded-full cursor-pointer origin-center bg-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/60"
            animate={{
              scaleX: isActive ? 1 : 0.22,
              opacity: isActive ? 0.95 : 0.35,
            }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            style={{ width: 28 }}
            onClick={() => onSelect(i)}
            />
          );
        })}
      </div>
    </div>
  );
};

export default React.memo(GameRow);
