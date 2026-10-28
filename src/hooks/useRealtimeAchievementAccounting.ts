import { useEffect, useRef } from "react";
import type { Game } from "../types/domain";
import { achievementUnlockBelongsToGame } from "../services/gameAchievements";
import { updateLibraryGame } from "../services/localLibrary";
import { awardHubAchievement, tierIndexFromName } from "../utils/hubTrophies";

/**
 * Conta a conquista no hub assim que ela é desbloqueada (Steam, Epic ou emulador), mesmo com a tela
 * do jogo fechada: troféu do tier, XP e o total de conquistas do jogo na biblioteca.
 *
 * Antes isso só acontecia dentro da tela do jogo (`useGameDetailAsync`): quem jogava sem ela aberta
 * via o overlay de conquista, mas o troféu e o XP não eram somados. `awardHubAchievement` garante que
 * a tela do jogo e este ouvinte não contem a mesma conquista duas vezes.
 */
export function useRealtimeAchievementAccounting(
  userId: string | undefined,
  games: Game[],
  onLibraryChanged: () => Promise<void> | void,
): void {
  const gamesRef = useRef(games);
  gamesRef.current = games;
  const onChangedRef = useRef(onLibraryChanged);
  onChangedRef.current = onLibraryChanged;

  useEffect(() => {
    const api = window.electronAPI;
    if (!userId || !api?.onRealtimeAchievementUnlock) return;

    const handler = api.onRealtimeAchievementUnlock((payload) => {
      const tierIndex = tierIndexFromName(payload.tier);
      if (tierIndex === null || !payload.achievementId) return;
      const game = gamesRef.current.find((candidate) => achievementUnlockBelongsToGame(candidate, payload));
      if (!game) return;
      if (!awardHubAchievement(userId, game.id, payload.achievementId, tierIndex)) return;

      void updateLibraryGame(userId, game.id, {
        completedAchievements: (game.completedAchievements ?? 0) + 1,
        updatedAt: new Date().toISOString(),
      })
        .then(() => onChangedRef.current())
        .catch((error) => console.warn("[achievements] não foi possível atualizar o total da biblioteca", error));
    });

    return () => api.removeRealtimeAchievementUnlock?.(handler);
  }, [userId]);
}
