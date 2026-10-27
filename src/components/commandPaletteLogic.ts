/**
 * Regras da paleta de comandos, sem React: filtros por chip, ordenação por relevância,
 * recentes e o jogo de "Retomar". Separadas da tela para serem testadas à parte.
 */

export type PaletteChip = "all" | "games" | "people" | "mods" | "actions";

/** O que cada item é; decide em qual chip ele aparece. */
export type PaletteKind = "game" | "person" | "mod" | "action";

export const PALETTE_CHIPS: readonly { id: PaletteChip; label: string }[] = [
  { id: "all", label: "Tudo" },
  { id: "games", label: "Jogos" },
  { id: "people", label: "Pessoas" },
  { id: "mods", label: "Mods" },
  { id: "actions", label: "Ações" },
];

const CHIP_KIND: Record<Exclude<PaletteChip, "all">, PaletteKind> = {
  games: "game",
  people: "person",
  mods: "mod",
  actions: "action",
};

export interface SearchableItem {
  id: string;
  title: string;
  subtitle?: string;
  kind: PaletteKind;
}

const normalize = (text: string) =>
  text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");

/**
 * Pontuação de relevância: começo do título vale mais que começo de palavra, que vale mais
 * que um trecho do título; o subtítulo só desempata. 0 = não corresponde.
 */
export function scoreItem(item: SearchableItem, query: string): number {
  const q = normalize(query.trim());
  if (!q) return 1;
  const title = normalize(item.title);
  if (title.startsWith(q)) return 4;
  if (title.split(/[^a-z0-9]+/).some((word) => word.startsWith(q))) return 3;
  if (title.includes(q)) return 2;
  if (item.subtitle && normalize(item.subtitle).includes(q)) return 1;
  return 0;
}

export function filterByChip<T extends SearchableItem>(items: readonly T[], chip: PaletteChip): T[] {
  if (chip === "all") return [...items];
  const kind = CHIP_KIND[chip];
  return items.filter((item) => item.kind === kind);
}

/** Quantos itens cada chip teria com a busca atual (mostrado no chip). */
export function chipCounts(items: readonly SearchableItem[], query: string): Record<PaletteChip, number> {
  const matching = items.filter((item) => scoreItem(item, query) > 0);
  return {
    all: matching.length,
    games: matching.filter((i) => i.kind === "game").length,
    people: matching.filter((i) => i.kind === "person").length,
    mods: matching.filter((i) => i.kind === "mod").length,
    actions: matching.filter((i) => i.kind === "action").length,
  };
}

/** Itens do chip que casam com a busca, do mais ao menos relevante (estável no empate). */
export function searchItems<T extends SearchableItem>(
  items: readonly T[],
  query: string,
  chip: PaletteChip,
  limit = 30,
): T[] {
  return filterByChip(items, chip)
    .map((item, index) => ({ item, index, score: scoreItem(item, query) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, limit)
    .map((entry) => entry.item);
}

// ── Recentes ─────────────────────────────────────────────────────────────────

export const RECENTS_LIMIT = 5;

/** Põe o item no começo, sem repetir, até `RECENTS_LIMIT`. */
export function pushRecent(ids: readonly string[], id: string): string[] {
  return [id, ...ids.filter((existing) => existing !== id)].slice(0, RECENTS_LIMIT);
}

/** Aceita só uma lista de strings; qualquer outra coisa gravada no disco vira vazio. */
export function parseRecents(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((value): value is string => typeof value === "string").slice(0, RECENTS_LIMIT);
}

// ── Retomar ──────────────────────────────────────────────────────────────────

/** O jogo jogado por último: o de `lastPlayedAt` mais recente; sem nenhum, não há o que retomar. */
export function pickResumeGame<G extends { lastPlayedAt?: string | null }>(games: readonly G[]): G | null {
  let best: G | null = null;
  let bestTime = 0;
  for (const game of games) {
    const time = game.lastPlayedAt ? new Date(game.lastPlayedAt).getTime() : 0;
    if (Number.isFinite(time) && time > bestTime) {
      best = game;
      bestTime = time;
    }
  }
  return best;
}

/** "há 5 min", "há 3 h", "há 2 d": quando foi a última sessão. Vazio sem data válida. */
export function formatResumeAge(lastPlayedAt: string | null | undefined, now = Date.now()): string {
  if (!lastPlayedAt) return "";
  const time = new Date(lastPlayedAt).getTime();
  if (!Number.isFinite(time)) return "";
  const minutes = Math.max(0, Math.round((now - time) / 60000));
  if (minutes < 1) return "agora há pouco";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.round(hours / 24)} d`;
}
