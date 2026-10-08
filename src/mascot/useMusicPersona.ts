import { useEffect, useRef, useState } from "react";
import { mapGenreToPersona, type Persona } from "./genrePersona";
import { getCachedPersona, setCachedPersona, trackKey } from "./personaCache";
import { hasTauriRuntime } from "./useVoiceLevel";

export interface MusicPersonaInput {
  /** liga a identificação (opt-in nas configurações) */
  enabled: boolean;
  apiKey: string;
  title: string;
  artist: string;
  playing: boolean;
  /** não identifica durante chamada/jogo: o loopback pegaria a conversa */
  blocked: boolean;
}

export interface MusicPersonaState {
  /** `null` = sem persona (recurso desligado ou sem música): vale o analisador por frequência */
  persona: Persona | null;
  /** esperando a AudD responder: a Pherie fica pensativa */
  identifying: boolean;
}

/** Espera antes de gravar: o áudio da faixa nova precisa assentar e trocas rápidas de faixa não gastam cota. */
export const SETTLE_MS = 2500;
/** Intervalo mínimo entre duas identificações. */
export const MIN_GAP_MS = 20_000;

interface IdentifyResult {
  title: string;
  artist: string;
  genres: string[];
}

/**
 * Descobre o gênero da música que toca no PC com a AudD (via comando Rust `music_identify`, que grava
 * ~5 s do loopback do Windows) e devolve a persona da Pherie. Uma chamada por faixa (cache), com
 * espera para assentar e intervalo mínimo; qualquer falha cai na persona padrão sem gastar de novo.
 */
export function useMusicPersona(input: MusicPersonaInput): MusicPersonaState {
  const { enabled, apiKey, title, artist, playing, blocked } = input;
  const [state, setState] = useState<MusicPersonaState>({ persona: null, identifying: false });
  const lastCallAt = useRef(0);
  const key = title ? trackKey(title, artist) : "";
  const active = enabled && Boolean(apiKey) && playing && !blocked && Boolean(key) && hasTauriRuntime();

  useEffect(() => {
    if (!active) {
      setState((s) => (s.persona === null && !s.identifying ? s : { persona: null, identifying: false }));
      return;
    }
    const cached = getCachedPersona(key);
    if (cached) {
      setState({ persona: cached, identifying: false });
      return;
    }

    let cancelled = false;
    setState({ persona: null, identifying: true });
    const wait = Math.max(SETTLE_MS, lastCallAt.current + MIN_GAP_MS - Date.now());
    const timer = window.setTimeout(async () => {
      if (cancelled) return;
      lastCallAt.current = Date.now();
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const result = await invoke<IdentifyResult | null>("music_identify", { apiKey, seconds: 5 });
        if (cancelled) return;
        if (result) {
          const persona = mapGenreToPersona(result.genres);
          setCachedPersona(key, persona);
          setState({ persona, identifying: false });
        } else {
          // não reconheceu (ou silêncio): padrão seguro, e guarda para não reenviar a mesma faixa
          setCachedPersona(key, "padrao");
          setState({ persona: "padrao", identifying: false });
        }
      } catch {
        // falha de rede/chave/timeout: padrão, sem cache (tenta de novo numa próxima faixa)
        if (!cancelled) setState({ persona: "padrao", identifying: false });
      }
    }, wait);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [active, key, apiKey]);

  return state;
}
