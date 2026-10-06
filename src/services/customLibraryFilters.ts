import type { Game } from "../types/domain";

export interface CustomLibraryFilter {
  id: string;
  name: string;
  gameIds: string[];
  createdAt: number;
}

const STORAGE_KEY = "checkpoint_custom_library_filters";

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
    window.dispatchEvent(new CustomEvent("checkpoint:custom-filters-changed"));
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
