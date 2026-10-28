
export interface CustomLibraryFilter {
  id: string;
  name: string;
  gameIds: string[];
  createdAt: number;
}

const STORAGE_KEY = "checkpoint_custom_library_filters";
const CHANGED_EVENT = "checkpoint:custom-filters-changed";

/** O texto guardado dos filtros: serve de "versão" para quem precisa refazer a conta quando eles mudam. */
export const readCustomFiltersRaw = (): string | null => {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
};

/** Avisa quando os filtros mudam (nesta janela, pelo evento, ou em outra, pelo `storage`). */
export const subscribeCustomFilters = (onChange: () => void): (() => void) => {
  window.addEventListener(CHANGED_EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(CHANGED_EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
};

/** Os jogos de um filtro personalizado, a partir do texto guardado; `null` se o filtro não existe. */
export const gameIdsOfCustomFilter = (raw: string | null, filterId: string): Set<string> | null => {
  if (!raw) return null;
  try {
    const filters: unknown = JSON.parse(raw);
    if (!Array.isArray(filters)) return null;
    const found = filters.find((f): f is CustomLibraryFilter => Boolean(f) && (f as CustomLibraryFilter).id === filterId);
    return found && Array.isArray(found.gameIds) ? new Set(found.gameIds) : null;
  } catch {
    return null;
  }
};

export const getCustomLibraryFilters = (): CustomLibraryFilter[] => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export const saveCustomLibraryFilters = (filters: CustomLibraryFilter[]) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filters));
    window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
  } catch {
    // ignore local storage errors
  }
};

export const addCustomLibraryFilter = (
  name: string,
  gameIds: string[]
): CustomLibraryFilter => {
  const filters = getCustomLibraryFilters();
  const newFilter: CustomLibraryFilter = {
    id: `custom_${Date.now()}`,
    name: name.trim(),
    gameIds,
    createdAt: Date.now(),
  };
  saveCustomLibraryFilters([...filters, newFilter]);
  return newFilter;
};

export const updateCustomLibraryFilter = (
  id: string,
  name: string,
  gameIds: string[]
) => {
  const filters = getCustomLibraryFilters();
  const updated = filters.map((f) =>
    f.id === id ? { ...f, name: name.trim(), gameIds } : f
  );
  saveCustomLibraryFilters(updated);
};

export const deleteCustomLibraryFilter = (id: string) => {
  const filters = getCustomLibraryFilters();
  const updated = filters.filter((f) => f.id !== id);
  saveCustomLibraryFilters(updated);
};
