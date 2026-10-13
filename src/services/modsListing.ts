/**
 * Filtro e ordenação da lista de jogos da janela de Mods. Puro (testado); `ModsPage` só guarda as escolhas.
 *
 * O filtro de categoria antes não fazia nada (só existia a opção "Todas"); agora as categorias vêm dos próprios jogos.
 */

export type ModsStatusFilter = "ALL" | "WITH_FOLDER" | "NO_FOLDER" | "WITH_MODS" | "WITH_ACTIVE_MODS" | "NO_MODS";
export type ModsSortOrder = "AZ" | "ZA" | "MODS" | "ACTIVE_MODS" | "FOLDER_FIRST";

export const MODS_STATUS_OPTIONS: { value: ModsStatusFilter; label: string }[] = [
  { value: "ALL", label: "Todos os Jogos" },
  { value: "WITH_FOLDER", label: "Com Pasta Vinculada" },
  { value: "NO_FOLDER", label: "Sem Pasta Vinculada" },
  { value: "WITH_MODS", label: "Com Mods" },
  { value: "WITH_ACTIVE_MODS", label: "Com Mods Ativos" },
  { value: "NO_MODS", label: "Sem Mods" },
];

export const MODS_SORT_OPTIONS: { value: ModsSortOrder; label: string }[] = [
  { value: "AZ", label: "Ordenar: A - Z" },
  { value: "ZA", label: "Ordenar: Z - A" },
  { value: "MODS", label: "Mais Mods" },
  { value: "ACTIVE_MODS", label: "Mais Mods Ativos" },
  { value: "FOLDER_FIRST", label: "Pasta Vinculada Primeiro" },
];

export interface ModsListItem {
  game: { title: string; category?: string | null; launcherType?: string | null };
  gameModsCount: number;
  activeModsCount: number;
  hasFolder: boolean;
}

export interface ModsListOptions {
  query: string;
  status: ModsStatusFilter;
  /** "ALL" ou o nome exato de uma categoria dos jogos. */
  category: string;
  sort: ModsSortOrder;
}

export const ALL_CATEGORIES = "ALL";

const STATUS_VALUES = new Set<string>(MODS_STATUS_OPTIONS.map((o) => o.value));
const SORT_VALUES = new Set<string>(MODS_SORT_OPTIONS.map((o) => o.value));

export const asStatusFilter = (value: unknown): ModsStatusFilter =>
  typeof value === "string" && STATUS_VALUES.has(value) ? (value as ModsStatusFilter) : "ALL";

export const asSortOrder = (value: unknown): ModsSortOrder =>
  typeof value === "string" && SORT_VALUES.has(value) ? (value as ModsSortOrder) : "AZ";

/** Categorias distintas dos jogos, em ordem alfabética (sem vazias). */
export function distinctCategories(items: readonly ModsListItem[]): string[] {
  const set = new Set<string>();
  for (const { game } of items) {
    const category = String(game.category ?? "").trim();
    if (category) set.add(category);
  }
  return [...set].sort((a, b) => a.localeCompare(b));
}

export function filterAndSortMods<T extends ModsListItem>(items: readonly T[], options: ModsListOptions): T[] {
  const query = options.query.trim().toLowerCase();
  let list = items.filter((item) => {
    if (query) {
      const haystack = [item.game.title, item.game.category, item.game.launcherType].join(" ").toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (options.category !== ALL_CATEGORIES && String(item.game.category ?? "").trim() !== options.category) return false;
    switch (options.status) {
      case "WITH_FOLDER":
        return item.hasFolder;
      case "NO_FOLDER":
        return !item.hasFolder;
      case "WITH_MODS":
        return item.gameModsCount > 0;
      case "WITH_ACTIVE_MODS":
        return item.activeModsCount > 0;
      case "NO_MODS":
        return item.gameModsCount === 0;
      default:
        return true;
    }
  });
  const byTitle = (a: T, b: T) => a.game.title.localeCompare(b.game.title);
  list = [...list];
  switch (options.sort) {
    case "ZA":
      list.sort((a, b) => byTitle(b, a));
      break;
    case "MODS":
      list.sort((a, b) => b.gameModsCount - a.gameModsCount || byTitle(a, b));
      break;
    case "ACTIVE_MODS":
      list.sort((a, b) => b.activeModsCount - a.activeModsCount || byTitle(a, b));
      break;
    case "FOLDER_FIRST":
      list.sort((a, b) => Number(b.hasFolder) - Number(a.hasFolder) || byTitle(a, b));
      break;
    default:
      list.sort(byTitle);
  }
  return list;
}
