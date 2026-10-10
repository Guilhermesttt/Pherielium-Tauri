import { useEffect, useRef } from "react";
import type { Game } from "../types/domain";
import {
  AFTER_GAME_SYNC_DELAY_MS,
  AUTO_SYNC_MIN_INTERVAL_MS,
  FOCUS_SYNC_MIN_INTERVAL_MS,
  isSyncDue,
  platformOfGame,
  readLastSync,
  writeLastSync,
  type SyncPlatform,
} from "./autoLibrarySync";

interface Options {
  uid?: string | null;
  steamConnected: boolean;
  epicConnected: boolean;
  /** sincroniza uma plataforma sem avisos nem mexer na seleção (o app já tem os dois botões manuais) */
  syncSilently: (platform: SyncPlatform) => Promise<unknown>;
  /** jogo em andamento (título), para sincronizar a plataforma dele quando fechar */
  currentGameTitle?: string | null;
  games: Game[];
}

/**
 * Mantém a biblioteca atualizada sem o usuário sincronizar à mão:
 * - ao abrir o app (se faz mais de 30 min);
 * - ao voltar para a janela (se faz mais de 10 min);
 * - a cada 30 min com o app aberto;
 * - ~45 s depois de fechar um jogo (Steam/Epic registram as horas e as conquistas nesse tempo).
 */
export function useAutoLibrarySync({ uid, steamConnected, epicConnected, syncSilently, currentGameTitle, games }: Options) {
  const syncRef = useRef(syncSilently);
  syncRef.current = syncSilently;
  const gamesRef = useRef(games);
  gamesRef.current = games;
  const connectedRef = useRef({ steam: steamConnected, epic: epicConnected });
  connectedRef.current = { steam: steamConnected, epic: epicConnected };

  const run = useRef<(platform: SyncPlatform, minInterval: number) => void>(() => undefined);
  run.current = (platform, minInterval) => {
    if (!uid || !connectedRef.current[platform]) return;
    const now = Date.now();
    if (!isSyncDue(readLastSync(uid, platform, localStorage), now, minInterval)) return;
    writeLastSync(uid, platform, now, localStorage);
    void syncRef.current(platform).catch((err) => console.warn(`[auto-sync] ${platform} falhou:`, err));
  };

  // abertura e a cada 30 min
  useEffect(() => {
    if (!uid) return;
    const both = (min: number) => {
      run.current("steam", min);
      run.current("epic", min);
    };
    const first = window.setTimeout(() => both(AUTO_SYNC_MIN_INTERVAL_MS), 8_000);
    const every = window.setInterval(() => both(AUTO_SYNC_MIN_INTERVAL_MS), AUTO_SYNC_MIN_INTERVAL_MS);
    const onFocus = () => both(FOCUS_SYNC_MIN_INTERVAL_MS);
    window.addEventListener("focus", onFocus);
    return () => {
      window.clearTimeout(first);
      window.clearInterval(every);
      window.removeEventListener("focus", onFocus);
    };
  }, [uid, steamConnected, epicConnected]);

  // fechou um jogo: sincroniza a plataforma dele depois de um tempo
  const lastGameRef = useRef<string | null>(null);
  useEffect(() => {
    const previous = lastGameRef.current;
    lastGameRef.current = currentGameTitle ?? null;
    if (!previous || currentGameTitle) return;
    const game = gamesRef.current.find((g) => g.title.trim().toLowerCase() === previous.trim().toLowerCase());
    const platform = game ? platformOfGame(game) : null;
    if (!platform) return;
    const id = window.setTimeout(() => run.current(platform, 0), AFTER_GAME_SYNC_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [currentGameTitle]);
}
