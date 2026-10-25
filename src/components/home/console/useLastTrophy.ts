import { useEffect, useRef, useState } from "react";
import { useAuth } from "../../../auth/AuthProvider";
import { usePreferences } from "../../../context/PreferencesContext";
import { loadGameAchievements } from "../../../services/gameAchievements";
import type { Game } from "../../../types/domain";
import { pickLastUnlocked, type LastTrophy } from "./consoleInfo";

/** Espera depois do foco assentar, para passar rápido pelas capas não disparar uma carga por capa. */
const SETTLE_MS = 450;

/** Por jogo: o último troféu, ou null quando não há nenhum. Vale até fechar o app. */
const cache = new Map<string, LastTrophy | null>();

/**
 * O último troféu desbloqueado do jogo em foco na Home. Carrega sob demanda (com o mesmo carregador
 * da tela do jogo, que também alimenta o cache de conquistas) e guarda o resultado.
 * `undefined` = ainda não se sabe (carregando ou falhou); `null` = o jogo não tem troféu desbloqueado.
 * Falha de rede não vira erro na Home: o bloco só não mostra a linha do troféu.
 */
export function useLastTrophy(game: Game | undefined): LastTrophy | null | undefined {
  const { user, userProfile } = useAuth();
  const { language } = usePreferences();
  const [loaded, setLoaded] = useState<{ gameId: string; value: LastTrophy | null } | null>(null);
  const gameRef = useRef(game);
  useEffect(() => {
    gameRef.current = game;
  });
  const gameId = game?.id;
  const steamId = userProfile?.steamId;
  const userUid = user?.uid;

  useEffect(() => {
    if (!gameId) return;
    let cancelled = false;
    const cached = cache.has(gameId);
    const timer = window.setTimeout(
      async () => {
        const target = gameRef.current;
        if (!target || target.id !== gameId) return;
        if (cache.has(gameId)) {
          if (!cancelled) setLoaded({ gameId, value: cache.get(gameId) ?? null });
          return;
        }
        try {
          const result = await loadGameAchievements(target, { language, steamId, persistLibrary: false, userUid });
          const value = pickLastUnlocked(result.items);
          // sem itens e com erro = não sabemos; não guarda "sem troféu" por engano
          if (result.items.length > 0 || !result.error) cache.set(gameId, value);
          if (!cancelled) setLoaded({ gameId, value });
        } catch {
          if (!cancelled) setLoaded(null);
        }
      },
      cached ? 0 : SETTLE_MS,
    );
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [gameId, language, steamId, userUid]);

  return loaded && loaded.gameId === gameId ? loaded.value : undefined;
}

/**
 * Instante em que a Home viu o jogo rodando (por jogo, enquanto o app está aberto). Alimenta a
 * duração da sessão; sem observação, `resolveSessionStart` cai no `lastPlayedAt`.
 */
export function useRunningSince(gameId: string | undefined, isRunning: boolean): number | undefined {
  const [since, setSince] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!gameId) return;
    // setState só quando muda: entra ao começar a rodar, sai ao parar
    setSince((current) => {
      if (isRunning && current[gameId] === undefined) return { ...current, [gameId]: Date.now() };
      if (!isRunning && current[gameId] !== undefined) {
        const next = { ...current };
        delete next[gameId];
        return next;
      }
      return current;
    });
  }, [gameId, isRunning]);
  return gameId ? since[gameId] : undefined;
}
