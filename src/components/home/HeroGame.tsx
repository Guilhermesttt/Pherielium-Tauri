import React from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Play } from "lucide-react";
import type { Game } from "../../types/domain";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import { formatPlayedHours, getGamePlayedHours } from "../../utils/playtime";

export interface HeroGameProps {
  game?: Game | null;
  isRunning?: boolean;
  platformInfo?: {
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  } | null;
  onOpenDetails: (game: Game) => void;
  /** Jogar/Continuar: o Home abre o detalhe e inicia o lançamento pelo fluxo de sempre. */
  onPlay?: (game: Game) => void;
  playSound?: (type: SoundEffectType) => void;
  runningLabel?: string;
}

export const HeroGame: React.FC<HeroGameProps> = React.memo(({
  game,
  isRunning = false,
  platformInfo,
  onOpenDetails,
  onPlay,
  playSound,
  runningLabel = "Em execução",
}) => {
  const reducedMotion = useReducedMotion();

  // (antes do retorno antecipado: hooks não podem ser condicionais)
  // Escala óptica para títulos longos caberem integralmente em uma única linha
  // sem quebra: fator aplicado sobre --fs-hero, que já é fluido por resolução.
  const titleFontSize = React.useMemo(() => {
    const len = game?.title?.length || 0;
    const factor = len > 28 ? 0.52 : len > 18 ? 0.68 : 1;
    return `calc(var(--fs-hero) * ${factor})`;
  }, [game?.title]);

  if (!game) return null;

  const hours = getGamePlayedHours(game);
  const formattedHours = hours > 0 ? `${formatPlayedHours(hours)}h` : "0h";

  // "Continuar" quando já há história com o jogo; "Jogar" na primeira vez
  const playLabel = hours > 0 || game.lastPlayedAt ? "Continuar" : "Jogar";

  const handlePlayClick = () => {
    if (isRunning) return;
    onPlay?.(game);
  };

  const handleDetailsClick = () => {
    playSound?.("select");
    onOpenDetails(game);
  };

  // O título abre o detalhe com o mouse; teclado precisa do mesmo caminho (Enter/Espaço).
  const handleTitleKeyDown = (event: React.KeyboardEvent) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleDetailsClick();
  };

  // Uma linha de metadados em texto: plataforma, tempo de jogo, conquistas e favorito.
  const meta: string[] = [];
  if (platformInfo) meta.push(platformInfo.label);
  if (hours > 0) meta.push(`${formattedHours} jogadas`);
  if (game.totalAchievements && game.totalAchievements > 0)
    meta.push(`${game.completedAchievements || 0}/${game.totalAchievements} conquistas`);
  if (game.isFavorite) meta.push("Favorito");

  return (
    <div className="relative w-full flex-1 px-[var(--safe-x)] select-none flex flex-col justify-end min-h-[var(--hero-min-h)] pb-[var(--gap-section)]">
      <AnimatePresence mode="wait">
        <motion.div
          key={game.id}
          // Troca de jogo: o título novo "entra em foco" (desfoque curto, só nesta região) e o antigo
          // sai bem mais rápido do que o novo chega. Com a navegação rápida entre capas, o modo
          // "wait" somaria saída + entrada; saída curta mantém a resposta imediata. Sem movimento
          // (preferência do sistema), só a opacidade muda.
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 18, filter: "blur(8px)" }}
          animate={reducedMotion ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
          exit={
            reducedMotion
              ? { opacity: 0, transition: { duration: 0.1 } }
              : { opacity: 0, y: -6, filter: "blur(4px)", transition: { duration: 0.2, ease: [0.4, 0, 1, 1] } }
          }
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="flex flex-col gap-[var(--gap-section)] w-full max-w-[92vw] lg:max-w-[85vw]"
        >
          {/* 1. Título. Jogar e detalhes ficam no controle (A / clique no título) e nos cards. */}
          <div className="flex w-full items-end">
            <h1
              onClick={handleDetailsClick}
              onKeyDown={handleTitleKeyDown}
              role="button"
              tabIndex={0}
              title={game.title}
              style={{ fontSize: titleFontSize }}
              className="min-w-0 flex-1 cursor-pointer tracking-[-0.04em] font-display font-semibold text-[var(--ink)] leading-[1.05] whitespace-nowrap truncate hover:opacity-95 transition-opacity"
            >
              {game.title}
            </h1>
          </div>

          {/* 2. Ação principal, estatísticas e plataforma */}
          <div className="flex items-center gap-[var(--gap-section)] flex-wrap text-[length:var(--fs-caption)] text-[var(--ink)] font-medium">
            {onPlay && (
              <button
                type="button"
                onClick={handlePlayClick}
                disabled={isRunning}
                aria-label={isRunning ? `${game.title}: ${runningLabel}` : `${playLabel} ${game.title}`}
                className="inline-flex h-[var(--cta-h)] shrink-0 cursor-pointer items-center gap-2.5 rounded-[var(--node)] bg-[var(--ink)] px-[calc(var(--cta-h)*0.55)] text-[length:var(--fs-body)] font-semibold text-[var(--tone-0)] transition-[transform,opacity] duration-150 ease-[var(--ease-mech)] hover:scale-[1.03] active:scale-[0.97] disabled:cursor-default disabled:opacity-40 disabled:hover:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--surface-base)]"
              >
                {isRunning ? (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-[var(--live)]" aria-hidden="true" />
                ) : (
                  <Play className="h-[1.1em] w-[1.1em] fill-current" aria-hidden="true" />
                )}
                {isRunning ? runningLabel : playLabel}
              </button>
            )}
            {meta.length > 0 && (
              <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[var(--ink-muted)]">
                {meta.map((item, i) => (
                  <React.Fragment key={item}>
                    {i > 0 && <span aria-hidden="true">·</span>}
                    <span>{item}</span>
                  </React.Fragment>
                ))}
              </p>
            )}
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
});

HeroGame.displayName = "HeroGame";
export default HeroGame;
