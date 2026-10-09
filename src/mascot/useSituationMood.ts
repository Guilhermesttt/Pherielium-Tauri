import { useCallback, useEffect, useRef, useState } from "react";
import type { MascotMood } from "./moods";
import { TRANSIENT_MS, callEndMood, gameEndMood, idleMood } from "./situationMood";

export interface SituationInput {
  isCallActive: boolean;
  callDurationSeconds: number;
  activeGameTitle: string | null;
  gameElapsedSeconds: number;
  hasMedia: boolean;
  isMediaPlaying: boolean;
  isExpanded: boolean;
  isHovered: boolean;
  /** algo já ocupa a Pherie (chamada, jogo, música, aviso): não conta como "parada" */
  busy: boolean;
}

export interface SituationMood {
  /** reação curta a algo que acabou de acontecer (tem prioridade sobre o resto) */
  transient: MascotMood | null;
  /** humor pelo tempo parada: entediada → sonolenta → dormindo */
  ambient: MascotMood | null;
  /** dispara uma reação curta (clique, fim da tontura...) */
  react: (mood: MascotMood, ms?: number) => void;
}

/**
 * Faz a Pherie reagir ao que acontece em volta: começo/fim de chamada e jogo, música pausada,
 * painel aberto (uma piscadela) e o tempo parada (de madrugada ela dorme mais cedo).
 */
export function useSituationMood(input: SituationInput): SituationMood {
  const [transient, setTransient] = useState<MascotMood | null>(null);
  const [ambient, setAmbient] = useState<MascotMood | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const react = useCallback((mood: MascotMood, ms?: number) => {
    setTransient(mood);
    if (timer.current) clearTimeout(timer.current);
    const dur = ms ?? (TRANSIENT_MS as Record<string, number>)[mood] ?? 1800;
    timer.current = setTimeout(() => setTransient(null), dur);
  }, []);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  // chamada: começar anima, terminar dá saudade
  const prevCall = useRef(input.isCallActive);
  const lastCallSecs = useRef(0);
  lastCallSecs.current = input.callDurationSeconds;
  useEffect(() => {
    if (!prevCall.current && input.isCallActive) react("excited");
    if (prevCall.current && !input.isCallActive) {
      const m = callEndMood(lastCallSecs.current);
      if (m) react(m);
    }
    prevCall.current = input.isCallActive;
  }, [input.isCallActive, react]);

  // jogo: fim de sessão longa dá orgulho
  const prevGame = useRef(input.activeGameTitle);
  const lastGameSecs = useRef(0);
  lastGameSecs.current = input.gameElapsedSeconds;
  useEffect(() => {
    if (prevGame.current && !input.activeGameTitle) {
      const m = gameEndMood(lastGameSecs.current);
      if (m) react(m);
    }
    prevGame.current = input.activeGameTitle;
  }, [input.activeGameTitle, react]);

  // música pausada: ela entedia
  const prevPlaying = useRef(input.isMediaPlaying);
  useEffect(() => {
    if (prevPlaying.current && !input.isMediaPlaying && input.hasMedia) react("bored");
    prevPlaying.current = input.isMediaPlaying;
  }, [input.isMediaPlaying, input.hasMedia, react]);

  // painel aberto e quieto: uma piscadela
  useEffect(() => {
    if (!input.isExpanded || input.busy) return;
    const id = window.setTimeout(() => react("wink"), 2800);
    return () => window.clearTimeout(id);
  }, [input.isExpanded, input.busy, react]);

  // tempo parada: qualquer atividade zera a contagem
  const lastActivity = useRef(Date.now());
  useEffect(() => {
    lastActivity.current = Date.now();
    setAmbient(null);
  }, [input.busy, input.isHovered, input.isExpanded]);
  useEffect(() => {
    const id = window.setInterval(() => {
      if (input.busy) return;
      setAmbient(idleMood(Date.now() - lastActivity.current, new Date().getHours()));
    }, 5000);
    return () => window.clearInterval(id);
  }, [input.busy]);

  return { transient, ambient, react };
}
