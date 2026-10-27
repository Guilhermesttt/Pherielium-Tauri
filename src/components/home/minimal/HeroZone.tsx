import React from "react";
import type { Game } from "../../../types/domain";
import { SfSymbol } from "../../../design-system/sf-symbols";
import { formatResumeAge } from "../../commandPaletteLogic";
import { formatPlayedHours, getGamePlayedHours } from "../../../utils/playtime";

export interface HeroZoneProps {
  game: Game;
  isRunning?: boolean;
  /** Plataforma do jogo, quando conhecida (ex.: "Steam"). */
  platformLabel?: string;
  onPlay: (game: Game) => void;
  onOpenDetails: (game: Game) => void;
  onHover?: () => void;
}

/** Linha de metadados em fonte monoespaçada: horas jogadas, plataforma e última sessão. */
function heroMeta(game: Game, platformLabel?: string): string[] {
  const hours = getGamePlayedHours(game);
  const parts: string[] = [];
  if (hours > 0) parts.push(`${formatPlayedHours(hours)} h jogadas`);
  if (platformLabel) parts.push(platformLabel);
  const age = formatResumeAge(game.lastPlayedAt);
  if (age) parts.push(`jogado ${age}`);
  return parts;
}

/**
 * Zona 1: o jogo em foco (o último jogado), num card panorâmico flutuante de altura controlada
 * (a biblioteca aparece logo abaixo, sem rolar). A capa fica DENTRO do card, escurecida e acendendo
 * no hover, com degradê até o preto na base; título, metadados em mono e pílulas ficam compactos
 * no canto inferior esquerdo. Sem sombras: a separação vem do contraste e da borda fina.
 */
export const HeroZone: React.FC<HeroZoneProps> = React.memo(
  ({ game, isRunning = false, platformLabel, onPlay, onOpenDetails, onHover }) => {
    const art = game.backgroundImage || game.image || game.cardImage;
    const meta = heroMeta(game, platformLabel);
    const hasHistory = getGamePlayedHours(game) > 0 || Boolean(game.lastPlayedAt);
    const playLabel = isRunning ? "Em execução" : hasHistory ? "Continuar" : "Jogar";

    return (
      <section
        aria-label="Jogo em foco"
        onPointerEnter={onHover}
        className="group relative isolate flex h-[clamp(280px,34vh,320px)] w-full shrink-0 flex-col justify-end overflow-hidden rounded-3xl border border-[var(--tone-3)] bg-[var(--tone-0)]"
      >
        {art && (
          <img
            src={art}
            alt=""
            draggable={false}
            className="absolute inset-0 -z-20 h-full w-full object-cover object-center brightness-[0.7] transition-[filter,transform] duration-700 ease-out group-hover:brightness-100 motion-safe:group-hover:scale-[1.015]"
          />
        )}
        {/* degradê para o preto absoluto da base, sem sombra */}
        <div
          aria-hidden="true"
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(to top, var(--gray-0) 0%, color-mix(in srgb, var(--gray-0) 40%, transparent) 45%, transparent 100%)",
          }}
        />

        <div className="flex flex-col gap-4 p-6 sm:p-8">
          <div className="flex flex-col gap-1.5">
            <h1
              title={game.title}
              className="font-display text-2xl font-bold leading-tight tracking-[-0.02em] text-[var(--ink)] truncate"
            >
              {game.title}
            </h1>
            {meta.length > 0 && (
              <p className="font-metric text-[length:var(--step-0)] text-[var(--ink-muted)]">
                {meta.join("  ·  ")}
              </p>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={isRunning}
              onClick={() => onPlay(game)}
              className="flex h-10 cursor-pointer items-center gap-2 rounded-full bg-[var(--ink)] px-6 text-[length:var(--step-0)] font-semibold text-[var(--tone-0)] transition-[transform,opacity] duration-150 hover:scale-[1.03] active:scale-[0.97] disabled:cursor-default disabled:opacity-60 disabled:hover:scale-100"
            >
              {!isRunning && <SfSymbol name="play" size={12} fill />}
              {playLabel}
            </button>
            <button
              type="button"
              onClick={() => onOpenDetails(game)}
              className="flex h-10 cursor-pointer items-center rounded-full border border-[var(--tone-3)] bg-[var(--tone-2)] px-5 text-[length:var(--step-0)] font-semibold text-[var(--ink)] transition-colors duration-150 hover:bg-[var(--tone-3)]"
            >
              Detalhes
            </button>
          </div>
        </div>
      </section>
    );
  },
);
HeroZone.displayName = "HeroZone";
