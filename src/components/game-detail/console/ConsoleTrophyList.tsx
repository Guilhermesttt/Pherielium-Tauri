import React from "react";
import { Lock, RotateCw, Search } from "lucide-react";
import type { SteamAchievement } from "../../../services/steam";
import type { AchievementFilter } from "../../../types/gameDetail";
import type { SoundEffectType } from "../../../hooks/useSoundEffects";
import { buildGameTierMap } from "../../../utils/trophyTiers";
import { ACHIEVEMENT_TIER_CONFIGS } from "../GameDetailAchievements";
import { filterTrophies, formatPercent, formatUnlockDate, rarityLabel } from "./consoleScreen";

/** Textos da lista (pt-BR, en-US, es-ES). */
const COPY = {
  "pt-BR": {
    title: "Troféus",
    all: "Todos",
    unlocked: "Desbloqueados",
    locked: "Bloqueados",
    search: "Buscar troféu…",
    empty: "Nenhum troféu encontrado.",
    none: "Este jogo não tem conquistas registradas.",
    loading: "Carregando troféus…",
    retry: "Tentar de novo",
    rarity: { ultra: "Ultra rara", veryRare: "Muito rara", rare: "Rara", common: "Comum" },
    haveIt: "dos jogadores têm",
  },
  "en-US": {
    title: "Trophies",
    all: "All",
    unlocked: "Unlocked",
    locked: "Locked",
    search: "Search trophies…",
    empty: "No trophies found.",
    none: "This game has no achievements on record.",
    loading: "Loading trophies…",
    retry: "Try again",
    rarity: { ultra: "Ultra rare", veryRare: "Very rare", rare: "Rare", common: "Common" },
    haveIt: "of players have it",
  },
  "es-ES": {
    title: "Trofeos",
    all: "Todos",
    unlocked: "Desbloqueados",
    locked: "Bloqueados",
    search: "Buscar trofeo…",
    empty: "Ningún trofeo encontrado.",
    none: "Este juego no tiene logros registrados.",
    loading: "Cargando trofeos…",
    retry: "Reintentar",
    rarity: { ultra: "Ultra raro", veryRare: "Muy raro", rare: "Raro", common: "Común" },
    haveIt: "de los jugadores lo tienen",
  },
} as const;

export interface ConsoleTrophyListProps {
  achievements: SteamAchievement[];
  isLoading: boolean;
  error: string | null;
  filter: AchievementFilter;
  searchQuery: string;
  locale: keyof typeof COPY;
  onFilterChange: (filter: AchievementFilter) => void;
  onSearchChange: (query: string) => void;
  onRetry: () => void;
  playSound: (type: SoundEffectType) => void;
}

const TIER_BY_ID = new Map<string, (typeof ACHIEVEMENT_TIER_CONFIGS)[number]>(
  ACHIEVEMENT_TIER_CONFIGS.map((cfg) => [cfg.id as string, cfg]),
);

/**
 * Lista de troféus no formato da tela de troféus de um console: ícone, nome, descrição e data à
 * esquerda; raridade (% e rótulo) e o troféu do tier à direita. Desbloqueados primeiro, do mais
 * recente para o mais antigo; os bloqueados depois, dos mais fáceis para os mais raros.
 */
export const ConsoleTrophyList: React.FC<ConsoleTrophyListProps> = ({
  achievements,
  isLoading,
  error,
  filter,
  searchQuery,
  locale,
  onFilterChange,
  onSearchChange,
  onRetry,
  playSound,
}) => {
  const t = COPY[locale];
  const tierMap = React.useMemo(() => buildGameTierMap(achievements), [achievements]);
  const visible = React.useMemo(() => filterTrophies(achievements, filter, searchQuery), [achievements, filter, searchQuery]);

  // Item selecionado: o mesmo contorno único da lista de recentes, que salta de um item para o outro.
  const [selected, setSelected] = React.useState(0);
  const itemRefs = React.useRef<Array<HTMLLIElement | null>>([]);
  const [cursor, setCursor] = React.useState({ top: 0, height: 0 });
  const count = visible.length;

  React.useLayoutEffect(() => {
    const element = itemRefs.current[Math.min(selected, Math.max(count - 1, 0))];
    if (!element) return;
    setCursor({ top: element.offsetTop, height: element.offsetHeight });
    element.scrollIntoView({ block: "nearest" });
  }, [selected, count]);

  // outro filtro ou outra busca: a seleção volta ao primeiro item
  React.useEffect(() => setSelected(0), [filter, searchQuery]);

  React.useEffect(() => {
    if (count === 0) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      if (target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName))) return;
      if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
      event.preventDefault();
      setSelected((index) => {
        const next = Math.min(Math.max(index + (event.key === "ArrowDown" ? 1 : -1), 0), count - 1);
        if (next !== index) playSound("navigate");
        return next;
      });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [count, playSound]);

  if (isLoading && achievements.length === 0) {
    return <p className="text-[length:var(--fs-caption)] text-[var(--ink-muted)]">{t.loading}</p>;
  }
  if (error && achievements.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3">
        <p className="text-[length:var(--fs-caption)] text-[var(--ink-muted)]">{error}</p>
        <button
          type="button"
          onClick={onRetry}
          className="console-chip inline-flex h-[var(--control-h)] items-center gap-2 rounded-[var(--node)] px-4 text-[length:var(--fs-label)] font-semibold"
        >
          <RotateCw className="h-4 w-4" aria-hidden="true" />
          {t.retry}
        </button>
      </div>
    );
  }
  if (achievements.length === 0) {
    return <p className="text-[length:var(--fs-caption)] text-[var(--ink-muted)]">{t.none}</p>;
  }

  const filters: Array<{ id: AchievementFilter; label: string }> = [
    { id: "all", label: t.all },
    { id: "unlocked", label: t.unlocked },
    { id: "locked", label: t.locked },
  ];

  return (
    <section aria-label={t.title}>
      <header className="mb-[var(--gap-stack)] flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-[length:var(--fs-label)] font-bold uppercase tracking-[0.08em] text-[var(--ink-muted)]">{t.title}</h2>
        <div className="flex items-center gap-2">
          <div role="group" aria-label="Filtro" className="flex items-center gap-2.5 px-1">
            {filters.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={filter === item.id}
                onClick={() => {
                  onFilterChange(item.id);
                  playSound("navigate");
                }}
                className="console-tab-item neon-chip flex h-[calc(var(--control-h)-14px)] items-center rounded-full px-3.5"
                data-active={filter === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
          <label className="console-search flex h-[calc(var(--control-h)-14px)] items-center gap-2 rounded-full px-3">
            <Search className="h-3.5 w-3.5 shrink-0 text-[var(--ink-muted)]" aria-hidden="true" />
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder={t.search}
              aria-label={t.search}
              className="w-[11ch] bg-transparent text-[length:var(--fs-label)] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus:w-[18ch]"
            />
          </label>
        </div>
      </header>

      {visible.length === 0 ? (
        <p className="text-[length:var(--fs-caption)] text-[var(--ink-muted)]">{t.empty}</p>
      ) : (
        <ul className="relative flex flex-col">
          <span
            aria-hidden="true"
            className="console-ach-cursor"
            style={{ transform: `translateY(${cursor.top}px)`, height: cursor.height }}
          />
          {visible.map((achievement, index) => {
            const tier = TIER_BY_ID.get(tierMap.get(achievement.apiName)?.tierId ?? "bronze") ?? TIER_BY_ID.get("bronze");
            const date = achievement.achieved ? formatUnlockDate(achievement.unlockTime, locale) : null;
            const rarity = rarityLabel(achievement.percent);
            const percent = formatPercent(achievement.percent, locale);
            return (
              <li
                key={achievement.apiName}
                ref={(element) => { itemRefs.current[index] = element; }}
                tabIndex={0}
                onMouseEnter={() => setSelected(index)}
                onFocus={() => setSelected(index)}
                className="console-trophy flex items-center gap-4 px-3 py-3 outline-none"
                data-achieved={achievement.achieved}
              >
                <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[6px] bg-[var(--tone-3)]">
                  {(achievement.achieved ? achievement.icon : achievement.iconGray || achievement.icon) && (
                    <img
                      src={achievement.achieved ? achievement.icon : achievement.iconGray || achievement.icon}
                      alt=""
                      loading="lazy"
                      draggable={false}
                      className="h-full w-full object-cover"
                    />
                  )}
                  {!achievement.achieved && (
                    <span className="absolute inset-0 flex items-center justify-center bg-black/40" aria-hidden="true">
                      <Lock className="h-4 w-4 text-[var(--ink-muted)]" />
                    </span>
                  )}
                </span>
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[length:var(--fs-body)] font-semibold text-[var(--ink)]">
                    {achievement.hidden && !achievement.achieved ? "???" : achievement.name}
                  </span>
                  {!(achievement.hidden && !achievement.achieved) && achievement.description && (
                    <span className="truncate text-[length:var(--fs-label)] text-[var(--ink-muted)]">{achievement.description}</span>
                  )}
                  {date && <span className="font-metric text-[length:var(--fs-label)] text-[var(--ink-faint)]">{date}</span>}
                </span>
                <span className="flex shrink-0 flex-col items-end text-right">
                  {percent && <span className="font-metric text-[length:var(--fs-caption)] text-[var(--ink)]">{percent}</span>}
                  {rarity && (
                    <span className="text-[length:var(--fs-label)] font-bold uppercase tracking-[0.06em] text-[var(--ink-muted)]">
                      {t.rarity[rarity]}
                    </span>
                  )}
                </span>
                {tier?.logo && (
                  <img
                    src={tier.logo}
                    alt={tier.label ?? ""}
                    draggable={false}
                    className={`h-8 w-8 shrink-0 object-contain ${achievement.achieved ? "" : "opacity-35 grayscale"}`}
                  />
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default ConsoleTrophyList;
