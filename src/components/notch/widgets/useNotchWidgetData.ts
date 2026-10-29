import { useEffect, useState } from "react";
import type { Lyrics } from "./lyricsMath";

export type LyricsState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; lyrics: Lyrics }
  | { status: "none" };

export interface WeatherData {
  city: string;
  temperatureC: number;
  label: string;
  kind: "clear" | "partly" | "cloud" | "fog" | "rain" | "snow" | "storm";
  isDay: boolean;
}

export type WeatherState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; weather: WeatherData }
  | { status: "unknown-city" }
  | { status: "error" };

const lyricsCache = new Map<string, Lyrics | null>();
const MAX_CACHED_TRACKS = 40;

const lyricsKey = (title: string, artist: string) => `${artist.trim().toLowerCase()}::${title.trim().toLowerCase()}`;

async function invokeCommand<T>(command: string, args: Record<string, unknown>): Promise<T> {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(command, args);
}

/** Letra da faixa em reprodução. Falhas de rede viram "sem letra": é um enfeite, não pode incomodar. */
export function useNotchLyrics(title: string, artist: string, durationSeconds: number | null, enabled: boolean): LyricsState {
  const [state, setState] = useState<LyricsState>({ status: "idle" });

  useEffect(() => {
    if (!enabled || !title.trim()) {
      setState({ status: "idle" });
      return;
    }
    const key = lyricsKey(title, artist);
    if (lyricsCache.has(key)) {
      const cached = lyricsCache.get(key) ?? null;
      setState(cached ? { status: "ready", lyrics: cached } : { status: "none" });
      return;
    }
    let cancelled = false;
    setState({ status: "loading" });
    invokeCommand<Lyrics | null>("lyrics_lookup", { title, artist, durationSeconds })
      .then((lyrics) => {
        if (lyricsCache.size >= MAX_CACHED_TRACKS) lyricsCache.delete(lyricsCache.keys().next().value as string);
        lyricsCache.set(key, lyrics);
        if (!cancelled) setState(lyrics ? { status: "ready", lyrics } : { status: "none" });
      })
      .catch(() => {
        // erro de rede: não guarda no cache, a próxima abertura tenta de novo
        if (!cancelled) setState({ status: "none" });
      });
    return () => {
      cancelled = true;
    };
    // a duração chega depois do título em alguns players; não deve refazer a busca
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, artist, enabled]);

  return state;
}

const WEATHER_REFRESH_MS = 15 * 60 * 1000;

/** Clima atual da cidade escolhida; atualiza a cada 15 min enquanto o widget está montado. */
export function useNotchWeather(city: string, enabled: boolean): WeatherState {
  const [state, setState] = useState<WeatherState>({ status: "idle" });

  useEffect(() => {
    const name = city.trim();
    if (!enabled || !name) {
      setState({ status: "idle" });
      return;
    }
    let cancelled = false;
    const load = () => {
      invokeCommand<WeatherData | null>("weather_lookup", { city: name })
        .then((weather) => {
          if (!cancelled) setState(weather ? { status: "ready", weather } : { status: "unknown-city" });
        })
        .catch(() => {
          // mantém o último valor bom se já havia um
          if (!cancelled) setState((prev) => (prev.status === "ready" ? prev : { status: "error" }));
        });
    };
    setState((prev) => (prev.status === "ready" ? prev : { status: "loading" }));
    load();
    const timer = window.setInterval(load, WEATHER_REFRESH_MS);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [city, enabled]);

  return state;
}
