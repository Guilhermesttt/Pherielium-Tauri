import React from "react";
import { ChevronRight, Trophy } from "lucide-react";
import type { GameTrophyCounts } from "../../utils/trophyTiers";

/**
 * Troféus do jogo por tier, na aba Jogar. É o diferencial do Pherielium (conquistas também para
 * jogos com emulador Steam), então aparece sem precisar abrir a aba Conquistas.
 *
 * Nível 1: quantos já saíram. Nível 2: os 4 tiers, cada um na cor do tier. Nível 3: contagens (mono).
 */
export interface GameDetailTrophiesProps {
  counts: GameTrophyCounts;
  /** Conquistas do jogo desbloqueadas e totais (as mesmas da aba Conquistas; a Platina não entra). */
  unlocked: number;
  total: number;
  /** Leva à aba de conquistas completa. */
  onOpenAll?: () => void;
}

type TierKey = "platinum" | "gold" | "silver" | "bronze";

const TIERS: { key: TierKey; label: string }[] = [
  { key: "platinum", label: "Platina" },
  { key: "gold", label: "Ouro" },
  { key: "silver", label: "Prata" },
  { key: "bronze", label: "Bronze" },
];

const unlockedOf = (counts: GameTrophyCounts, key: TierKey) => counts[key];
const totalOf = (counts: GameTrophyCounts, key: TierKey) => {
  if (key === "platinum") return counts.totalPlatinum ?? 1;
  if (key === "gold") return counts.totalGold ?? 0;
  if (key === "silver") return counts.totalSilver ?? 0;
  return counts.totalBronze ?? 0;
};

export const GameDetailTrophies: React.FC<GameDetailTrophiesProps> = React.memo(({ counts, unlocked, total, onOpenAll }) => {
  if (total <= 0) return null;
  const percent = Math.min(100, Math.round((unlocked / total) * 100));

  return (
    <section aria-label="Troféus do jogo" className="flex flex-col gap-5 rounded-[var(--corner-lg)] bg-[var(--tone-2)] p-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-[length:var(--step-0)] font-medium text-[var(--ink-muted)]">
            <Trophy className="h-4 w-4" aria-hidden="true" />
            Troféus
          </p>
          <p className="mt-1 text-[length:var(--step-4)] font-semibold leading-none tracking-[-0.02em] text-[var(--ink)]">
            <span className="font-metric">{unlocked}</span>
            <span className="font-metric text-[length:var(--step-2)] text-[var(--ink-muted)]"> / {total}</span>
          </p>
        </div>
        <span className="font-metric text-[length:var(--step-3)] font-semibold text-[var(--ink)]">{percent}%</span>
      </header>

      <div
        role="progressbar"
        aria-label="Progresso de conquistas"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        className="h-1.5 w-full overflow-hidden rounded-[var(--node)] bg-[var(--tone-4)]"
      >
        <div
          className="h-full rounded-[var(--node)]"
          style={{ width: `${percent}%`, backgroundColor: percent >= 100 ? "rgb(var(--tier-platinum))" : "var(--ink)" }}
        />
      </div>

      <ul className="grid grid-cols-4 gap-2">
        {TIERS.map(({ key, label }) => {
          const unlocked = unlockedOf(counts, key);
          const total = totalOf(counts, key);
          const has = unlocked > 0;
          return (
            <li
              key={key}
              className="flex flex-col items-center gap-1 rounded-[var(--corner-sm)] bg-[var(--tone-1)] px-2 py-3"
              title={`${label}: ${unlocked} de ${total}`}
            >
              <Trophy
                className="h-5 w-5"
                aria-hidden="true"
                style={{ color: `rgb(var(--tier-${key}))`, opacity: has ? 1 : 0.35 }}
              />
              <span className="font-metric text-[length:var(--step-2)] font-semibold text-[var(--ink)]">{unlocked}</span>
              <span className="text-[length:var(--step-0)] text-[var(--ink-muted)]">
                {label}
                {total > 0 && <span className="font-metric text-[var(--ink-faint)]"> /{total}</span>}
              </span>
            </li>
          );
        })}
      </ul>

      {onOpenAll && (
        <button
          type="button"
          onClick={onOpenAll}
          className="group flex h-11 cursor-pointer items-center justify-between rounded-[var(--node)] bg-[var(--tone-3)] px-4 text-[length:var(--step-1)] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--tone-4)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--ink)]"
        >
          Ver todas as conquistas
          <ChevronRight className="h-5 w-5 text-[var(--ink-muted)] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </button>
      )}
    </section>
  );
});

GameDetailTrophies.displayName = "GameDetailTrophies";
export default GameDetailTrophies;
