import React, { useEffect, useRef, useState } from "react";
import { useSpring, animated, config as springConfig } from "@react-spring/web";
import { useReducedMotion } from "framer-motion";
import { ChevronLeft, ChevronRight, Trophy } from "lucide-react";
import ContextMenu from "../../ContextMenu";
import type { Game } from "../../../types/domain";
import type { SoundEffectType } from "../../../hooks/useSoundEffects";
import { platformLabel, type WallFocus, type WallRow } from "./consoleRows";
import { PlatformGlyph } from "./PlatformGlyph";
import { FavoriteBadge } from "./FavoriteBadge";
import { formatAgo, formatSession, type LastTrophy } from "./consoleInfo";
import { formatPlayedHours, getGamePlayedHours } from "../../../utils/playtime";

export interface ConsoleHomeProps {
  rows: WallRow[];
  focus: WallFocus;
  /** O jogo em foco esta rodando: aparece o ponto verde ao lado do nome. */
  focusedIsRunning?: boolean;
  onFocus: (row: number, game: Game) => void;
  onOpenDetails: (game: Game) => void;
  onMenuAction: (action: string, game: Game) => void;
  /** Setas laterais (mouse): anda uma capa. */
  onStep: (delta: number) => void;
  /** Último troféu do jogo em foco: undefined = ainda não se sabe, null = nenhum desbloqueado. */
  lastTrophy?: LastTrophy | null;
  /** Início da sessão do jogo em foco (ms), quando ele está rodando e dá para medir. */
  sessionStartedAt?: number | null;
  /** A tela do jogo está abrindo por cima: a fileira some em fade (como no conceito). */
  hidden?: boolean;
  playSound: (type: SoundEffectType) => void;
}

// Configuracoes de mola para as animacoes — replicam a sensacao do PS5:
// rapido, preciso, com amortecimento natural sem quique excessivo.
const SPRING_TILE  = { tension: 560, friction: 38, mass: 1   } as const;

/**
 * Home estilo tela inicial de console (PS5): a arte do jogo em foco ocupa a tela (vem do
 * GameEnvironment nitido, atras de tudo) e a interface fica embaixo: uma fileira de capas, a
 * focada maior com fisica de mola (React Spring), e o nome do jogo com transicao spring.
 */
export const ConsoleHome: React.FC<ConsoleHomeProps> = ({
  rows,
  focus,
  focusedIsRunning = false,
  onFocus,
  onOpenDetails,
  onMenuAction,
  onStep,
  lastTrophy,
  sessionStartedAt = null,
  hidden = false,
  playSound,
}) => {
  const reducedMotion = useReducedMotion();
  const focusedRef = useRef<HTMLButtonElement | null>(null);
  const row = rows[focus.row];
  const focused = row?.games[focus.col];

  // A capa em foco fica perto da esquerda, com uma vizinha visivel antes dela. Ela cresce com
  // transicao, entao o alinhamento roda ja e de novo quando o crescimento termina.
  useEffect(() => {
    const tile = focusedRef.current;
    if (!tile) return;
    const behavior: ScrollBehavior = reducedMotion ? "auto" : "smooth";
    const align = () => {
      const track = tile.closest<HTMLElement>(".console-track");
      if (!track) return;
      // O menu de contexto envolve a capa num conteiner: o item da trilha e esse conteiner.
      let item: HTMLElement = tile;
      while (item.parentElement && item.parentElement !== track) item = item.parentElement;
      const previous = item.previousElementSibling as HTMLElement | null;
      const styles = getComputedStyle(track);
      const lead = previous ? previous.offsetWidth + parseFloat(styles.columnGap || "0") : 0;
      // a trilha e "relative": offsetLeft do item ja e medido dentro dela, padding incluso
      const padding = parseFloat(styles.paddingLeft || "0");
      track.scrollTo({ left: Math.max(0, item.offsetLeft - padding - lead), behavior });
    };
    align();
    // a capa cresce com mola (sem evento de fim): realinha enquanto ela assenta
    const timers = [120, 280, 520].map((ms) => window.setTimeout(align, ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [focused?.id, reducedMotion]);

  if (!row || !focused) return null;


  return (
    <div
      className="console-home flex min-h-0 flex-1 flex-col justify-end pb-[var(--safe-y)]"
      data-hidden={hidden}
      aria-hidden={hidden || undefined}
    >
      <FocusedGameInfo
        game={focused}
        isRunning={focusedIsRunning}
        lastTrophy={lastTrophy}
        sessionStartedAt={sessionStartedAt}
      />

      <section aria-label={row.title} className="console-row relative">
        {/* Seta esquerda */}
        <button
          type="button"
          tabIndex={-1}
          aria-label="Jogo anterior"
          disabled={focus.col === 0}
          onClick={() => onStep(-1)}
          className="console-step ctl-circle !absolute left-[calc(var(--safe-x)*0.25)] top-1/2 z-10 -translate-y-1/2"
        >
          <ChevronLeft className="ctl-icon" />
        </button>

        {/* Seta direita */}
        <button
          type="button"
          tabIndex={-1}
          aria-label="Proximo jogo"
          disabled={focus.col >= row.games.length - 1}
          onClick={() => onStep(1)}
          className="console-step ctl-circle !absolute right-[calc(var(--safe-x)*0.25)] top-1/2 z-10 -translate-y-1/2"
        >
          <ChevronRight className="ctl-icon" />
        </button>

        {/* Trilha de capas */}
        <div
          role="group"
          aria-label={row.title}
          className="console-track no-scrollbar relative flex items-end gap-[var(--console-gap)] overflow-hidden px-[var(--safe-x)] pb-[var(--console-shadow-room)] pt-4"
        >
          {row.games.map((game, col) => {
            const isFocused = col === focus.col;
            return (
              <SpringConsoleTile
                key={game.id}
                game={game}
                isFocused={isFocused}
                reducedMotion={reducedMotion ?? false}
                buttonRef={isFocused ? focusedRef : undefined}
                onSelect={() => {
                  if (isFocused) {
                    playSound("select");
                    onOpenDetails(game);
                  } else {
                    playSound("navigate");
                    onFocus(focus.row, game);
                  }
                }}
                onMenuAction={(action) => onMenuAction(action, game)}
                playSound={playSound}
              />
            );
          })}
        </div>
      </section>

      {/* O nome do jogo está na capa; leitores de tela ouvem a troca de foco aqui. */}
      <p className="sr-only" aria-live="polite">
        {focused.title}, {platformLabel(focused)}
        {focusedIsRunning ? ", em execução" : ""}
        {lastTrophy ? `, último troféu ${lastTrophy.name}` : ""}
      </p>

    </div>
  );
};

// ---------------------------------------------------------------------------
// FocusedGameInfo: nome, horas, último troféu e sessão do jogo em foco
// ---------------------------------------------------------------------------

/** Relógio que anda de 30 em 30s, só para as durações relativas ("há 5 min", "1h12") não ficarem velhas. */
function useNow(intervalMs: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

const FocusedGameInfo: React.FC<{
  game: Game;
  isRunning: boolean;
  lastTrophy?: LastTrophy | null;
  sessionStartedAt: number | null;
}> = ({ game, isRunning, lastTrophy, sessionStartedAt }) => {
  const now = useNow(30_000);
  const hours = getGamePlayedHours(game);
  return (
    // key = jogo: a troca de foco reinicia a entrada em fade (.console-info)
    <div key={game.id} className="console-info px-[var(--safe-x)]">
      <h1 className="console-info-title truncate" title={game.title}>
        {game.title}
      </h1>
      <p className="console-info-meta">
        {isRunning && (
          <span className="console-info-live">
            <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--live)]" aria-hidden="true" />
            Em sessão{sessionStartedAt ? ` há ${formatSession(now - sessionStartedAt)}` : ""}
          </span>
        )}
        <span className="font-metric">{hours > 0 ? `${formatPlayedHours(hours)} h jogadas` : "Ainda não jogado"}</span>
        {lastTrophy && (
          <span className="console-info-trophy" title={lastTrophy.name}>
            <Trophy className="h-[1.05em] w-[1.05em] shrink-0" aria-hidden="true" />
            <span className="truncate">{lastTrophy.name}</span>
            <span className="text-[var(--ink-faint)]">{formatAgo(lastTrophy.unlockedAtMs, now)}</span>
          </span>
        )}
      </p>
    </div>
  );
};

// ---------------------------------------------------------------------------
// SpringConsoleTile — tile individual com mola no crescimento (React Spring)
// ---------------------------------------------------------------------------

interface SpringConsoleTileProps {
  game: Game;
  isFocused: boolean;
  reducedMotion: boolean;
  buttonRef?: React.MutableRefObject<HTMLButtonElement | null>;
  onSelect: () => void;
  onMenuAction: (action: string) => void;
  playSound: (type: SoundEffectType) => void;
}

const SpringConsoleTile = React.memo<SpringConsoleTileProps>(
  ({ game, isFocused, reducedMotion, buttonRef, onSelect, onMenuAction, playSound }) => {
    const poster = game.cardImage || game.image;
    // capa que não carrega (link quebrado): mostra o nome do jogo em vez do ícone de imagem quebrada
    const [posterFailed, setPosterFailed] = useState(false);

    // useSpring: height/width animados com fisica de mola
    // A trilha usa items-end entao o crescimento vai naturalmente para cima
    const spring = useSpring({
      scale: isFocused ? 1.2 : 1,
      shadowAlpha: isFocused ? 1 : 0,
      config: reducedMotion ? springConfig.default : SPRING_TILE,
      immediate: reducedMotion,
    });

    return (
      <ContextMenu
        gameTitle={game.title}
        onAction={onMenuAction}
        isFavorite={game.isFavorite}
        playSound={playSound}
      >
        {({ openMenu }) => (
          <span className="relative block shrink-0">
          <animated.button
            ref={buttonRef as any}
            type="button"
            aria-label={`${game.title}, ${platformLabel(game)}`}
            aria-current={isFocused || undefined}
            tabIndex={isFocused ? 0 : -1}
            data-focused={isFocused}
            data-console-focused={isFocused || undefined}
            onClick={onSelect}
            onContextMenu={(event) => {
              event.preventDefault();
              openMenu(event as any);
            }}
            style={{
              height: spring.scale.to((s) => `calc(var(--console-tile-h) * ${s})`),
              width:  spring.scale.to((s) => `calc(var(--console-tile-h) * var(--console-tile-ratio) * ${s})`),
              borderRadius: "var(--console-tile-radius)",
              boxShadow: spring.shadowAlpha.to(
                (sh) => (sh > 0.01 ? `0 0 0 ${(1.5 * sh).toFixed(2)}px color-mix(in srgb, var(--ink) 70%, transparent), 0 ${Math.round(14 * sh)}px ${Math.round(30 * sh)}px -${Math.round(8 * sh)}px rgba(0,0,0,0.85)` : "none"),
              ),
              willChange: "height, width, box-shadow",
            }}
            className="relative block shrink-0 cursor-pointer overflow-hidden bg-[var(--tone-2)] p-0"
          >
            {poster && !posterFailed ? (
              <img
                onError={() => setPosterFailed(true)}
                src={poster}
                alt=""
                loading="lazy"
                draggable={false}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="flex h-full w-full items-end p-3 text-left text-[length:var(--fs-caption)] font-semibold text-[var(--ink-muted)]">
                {game.title}
              </span>
            )}
            <FavoriteBadge isFavorite={Boolean(game.isFavorite)} />
          </animated.button>
          {isFocused && (
            <span className="console-store-label" aria-hidden="true">
              <PlatformGlyph game={game} />
              {platformLabel(game)}
            </span>
          )}
          </span>
        )}
      </ContextMenu>
    );
  },
);
SpringConsoleTile.displayName = "SpringConsoleTile";

export default ConsoleHome;