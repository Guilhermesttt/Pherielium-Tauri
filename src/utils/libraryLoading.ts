export const resolveLibraryLoadingState = (hasUsableSnapshot: boolean) => ({
  showSkeleton: !hasUsableSnapshot,
  backgroundRefreshing: hasUsableSnapshot,
});

const LIBRARY_CATEGORIES = new Set([
  "ALL", "FAVORITES", "FRIENDS",
  "STEAM", "EPIC", "EA", "UBISOFT", "GOG", "XBOX", "RIOT", "BATTLENET", "ROCKSTAR", "LOCAL",
]);

export const shouldShowLibraryFooter = (activeCategory?: string) =>
  !!activeCategory && LIBRARY_CATEGORIES.has(activeCategory);
