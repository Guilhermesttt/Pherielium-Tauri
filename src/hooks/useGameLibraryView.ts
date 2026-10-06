import { useMemo } from "react";
import type { Game, SocialFriend } from "../types/domain";
import { CATEGORIES } from "../components/Sidebar";
import type { usePreferences } from "../context/PreferencesContext";
import { formatPlayedHours, getGamePlayedHours } from "../utils/playtime";
import type { LibraryFilters } from "../components/LibraryFilterModal";

export const normalizeCategory = (v?: string) =>
  v?.toUpperCase().replace(/[^A-Z0-9]/g, "") ?? "";

const safeTimestamp = (val?: string | number | null) => {
  if (!val) return 0;
  const t = new Date(val).getTime();
  return Number.isNaN(t) ? 0 : t;
};

export function useGameLibraryView({
  games,
  activeCategory,
  searchTerm,
  socialFriends,
  libraryFilters,
  t,
}: {
  games: Game[];
  activeCategory: string;
  searchTerm: string;
  socialFriends: SocialFriend[];
  libraryFilters?: LibraryFilters;
  t: ReturnType<typeof usePreferences>["t"];
}) {
  const displayGames = useMemo(() => {
    const s = searchTerm.trim().toLowerCase();

    // Deduplicate games by id and unique launcher identity
    const seenIds = new Set<string>();
    const seenPlatforms = new Set<string>();
    const uniqueGames: Game[] = [];

    for (const g of games) {
      if (!g || !g.id) continue;
      if (seenIds.has(g.id)) continue;
      seenIds.add(g.id);

      const launcher = g.launcherType || "local";
      let platformKey = "";
      if (launcher === "steam" && g.steamAppId) {
        platformKey = `steam_${g.steamAppId}`;
      } else if (launcher === "epic" && (g.epicLaunchId || g.epicCatalogId)) {
        platformKey = `epic_${(g.epicLaunchId || g.epicCatalogId || "").toLowerCase()}`;
      } else if (launcher !== "local") {
        platformKey = `${launcher}_${(g.title || "").toLowerCase().trim()}`;
      }

      if (platformKey && seenPlatforms.has(platformKey)) {
        continue;
      }
      if (platformKey) seenPlatforms.add(platformKey);

      uniqueGames.push(g);
    }

    const ordered = [...uniqueGames].sort((a, b) => {
      if (Boolean(a.isFavorite) === Boolean(b.isFavorite)) return 0;
      return a.isFavorite ? -1 : 1;
    });

    const categoryConfig = CATEGORIES.find((c) => c.id === activeCategory);
    const categoryLabel = categoryConfig?.label;

    const filtered =
      activeCategory === "ALL"
        ? ordered
        : activeCategory === "FAVORITES"
          ? ordered.filter((g) => g.isFavorite)
          : activeCategory.startsWith("custom_")
            ? (() => {
                try {
                  const stored = localStorage.getItem("checkpoint_custom_library_filters");
                  if (stored) {
                    const filters = JSON.parse(stored);
                    const found = Array.isArray(filters) ? filters.find((f: any) => f.id === activeCategory) : null;
                    if (found && Array.isArray(found.gameIds)) {
                      const idSet = new Set(found.gameIds);
                      return ordered.filter((g) => idSet.has(g.id));
                    }
                  }
                } catch {
                  // ignore
                }
                return ordered;
              })()
          : activeCategory === "RECENT"
            ? (() => {
                const playedGames = [...ordered].filter((g) => Boolean(
                  g.lastPlayedAt ||
                  g.steamLastPlayedAt ||
                  (g as any).lastPlayed ||
                  (g.hoursPlayed && g.hoursPlayed > 0) ||
                  (g.steamPlaytimeMinutes && g.steamPlaytimeMinutes > 0) ||
                  (g.locallyTrackedMinutes && g.locallyTrackedMinutes > 0)
                ));
                const pool = playedGames.length > 0 ? playedGames : ordered;
                return pool.sort((a, b) => {
                  const aPlayed = safeTimestamp(a.lastPlayedAt || a.steamLastPlayedAt || (a as any).lastPlayed || a.updatedAt || a.createdAt);
                  const bPlayed = safeTimestamp(b.lastPlayedAt || b.steamLastPlayedAt || (b as any).lastPlayed || b.updatedAt || b.createdAt);
                  if (aPlayed !== bPlayed) return bPlayed - aPlayed;
                  return getGamePlayedHours(b) - getGamePlayedHours(a);
                });
              })()
              : activeCategory === "STEAM"
                ? ordered.filter((g) => g.launcherType === "steam")
            : activeCategory === "LOCAL"
              ? ordered.filter(
                (g) => g.launcherType === "local" || !g.launcherType,
              )
              : activeCategory === "EPIC"
                ? ordered.filter((g) => g.launcherType === "epic")
                : activeCategory === "EA"
                  ? ordered.filter((g) => g.launcherType === "ea")
                  : activeCategory === "UBISOFT"
                    ? ordered.filter((g) => g.launcherType === "ubisoft")
                    : activeCategory === "GOG"
                      ? ordered.filter((g) => g.launcherType === "gog")
                      : activeCategory === "XBOX"
                        ? ordered.filter((g) => g.launcherType === "xbox")
                        : activeCategory === "RIOT"
                          ? ordered.filter((g) => g.launcherType === "riot")
                          : activeCategory === "BATTLENET"
                            ? ordered.filter((g) => g.launcherType === "battlenet")
                            : activeCategory === "ROCKSTAR"
                              ? ordered.filter((g) => g.launcherType === "rockstar")
                              : ordered.filter((g) => {
                            const gCat = normalizeCategory(g.category);
                            return (
                              gCat === normalizeCategory(activeCategory) ||
                              gCat === normalizeCategory(categoryLabel)
                            );
                              });
    
    // Apply additional library filters
    let result = filtered;
    if (libraryFilters) {
      if (libraryFilters.launchers.length > 0) {
        result = result.filter((g) => libraryFilters.launchers.includes(g.launcherType || "local"));
      }
      if (libraryFilters.categories.length > 0) {
        result = result.filter((g) => g.category && libraryFilters.categories.includes(g.category));
      }
      if (libraryFilters.favoritesOnly) {
        result = result.filter((g) => g.isFavorite);
      }
      if (libraryFilters.withAchievements) {
        result = result.filter((g) => (g.totalAchievements || 0) > 0);
      }
      if (libraryFilters.minHours > 0) {
        result = result.filter((g) => getGamePlayedHours(g) >= libraryFilters.minHours);
      }
      if (libraryFilters.maxHours > 0) {
        result = result.filter((g) => getGamePlayedHours(g) <= libraryFilters.maxHours);
      }
    }

    const textFiltered = s
      ? result.filter(
        (g) =>
          g.title.toLowerCase().includes(s) ||
          (g.category ?? "").toLowerCase().includes(s),
      )
      : result;

    // Apply sort
    if (libraryFilters?.sortBy) {
      const sorted = [...textFiltered];
      sorted.sort((a, b) => {
        let cmp = 0;
        switch (libraryFilters.sortBy) {
          case "title":
            cmp = a.title.localeCompare(b.title);
            break;
          case "hours":
            cmp = getGamePlayedHours(b) - getGamePlayedHours(a);
            break;
          case "recent": {
            const aTime = safeTimestamp(a.lastPlayedAt || a.steamLastPlayedAt);
            const bTime = safeTimestamp(b.lastPlayedAt || b.steamLastPlayedAt);
            cmp = bTime - aTime;
            break;
          }
          case "achievements":
            cmp = (b.completedAchievements || 0) - (a.completedAchievements || 0);
            break;
        }
        return libraryFilters.sortDir === "desc" ? -cmp : cmp;
      });
      return sorted;
    }

    return textFiltered;
  }, [activeCategory, games, searchTerm, libraryFilters]);

  const continuePlayingGames = useMemo(
    () => {
      const played = games
        .filter((game) => Boolean(
          game.lastPlayedAt ||
          game.steamLastPlayedAt ||
          (game as any).lastPlayed ||
          (game.hoursPlayed && game.hoursPlayed > 0) ||
          (game.steamPlaytimeMinutes && game.steamPlaytimeMinutes > 0) ||
          (game.locallyTrackedMinutes && game.locallyTrackedMinutes > 0)
        ))
        .sort((a, b) => {
          const aPlayed = safeTimestamp(a.lastPlayedAt || a.steamLastPlayedAt || (a as any).lastPlayed);
          const bPlayed = safeTimestamp(b.lastPlayedAt || b.steamLastPlayedAt || (b as any).lastPlayed);
          if (aPlayed !== bPlayed) return bPlayed - aPlayed;
          return getGamePlayedHours(b) - getGamePlayedHours(a);
        });

      if (played.length > 0) {
        return played.slice(0, 10);
      }

      return [...games]
        .sort((a, b) => {
          const aTime = safeTimestamp(a.updatedAt || a.createdAt);
          const bTime = safeTimestamp(b.updatedAt || b.createdAt);
          return bTime - aTime;
        })
        .slice(0, 6);
    },
    [games],
  );

  const favoriteShowcaseGames = useMemo(
    () =>
      games
        .filter((game) => game.isFavorite)
        .sort((a, b) => getGamePlayedHours(b) - getGamePlayedHours(a))
        .slice(0, 4),
    [games],
  );

  const friendsPlayingNow = useMemo(
    () => socialFriends.filter((friend) => friend.status === "playing").slice(0, 4),
    [socialFriends],
  );

  const recentOverviewActivity = useMemo(() => {
    const items: Array<{ id: string; title: string; detail: string; tone: "accent" | "success" | "muted" }> = [];

    friendsPlayingNow.forEach((friend) => {
      items.push({
        id: `friend-${friend.id}`,
        title: `${friend.name} ${t("activityFriendPlaying")}`,
        detail: friend.playing
          ? `${t("activityFriendPlayingDetail")} ${friend.playing}.`
          : t("activityFriendOnlineDetail"),
        tone: "success",
      });
    });

    continuePlayingGames.forEach((game) => {
      items.push({
        id: `game-${game.id}`,
        title: `${t("activityReturnedTo")} ${game.title}`,
        detail: `${formatPlayedHours(getGamePlayedHours(game))}${t("activityLibraryHours")}`,
        tone: "accent",
      });
    });

    favoriteShowcaseGames.slice(0, 2).forEach((game) => {
      items.push({
        id: `favorite-${game.id}`,
        title: `${game.title} ${t("activityFavoriteStill")}`,
        detail: t("activityFavoriteHint"),
        tone: "muted",
      });
    });

    return items.slice(0, 5);
  }, [continuePlayingGames, favoriteShowcaseGames, friendsPlayingNow, t]);

  return {
    displayGames,
    continuePlayingGames,
    favoriteShowcaseGames,
    friendsPlayingNow,
    recentOverviewActivity,
  };
}
