import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { subscribeTicker } from "../../../mascot/ticker";
import { currentPosition, type MediaTimeline } from "../live/progressMath";
import { monthGrid, monthTitle, WEEKDAY_INITIALS } from "./calendarGrid";
import { activeLineIndex, type Lyrics } from "./lyricsMath";
import { useNotchLyrics, useNotchWeather, type LyricsState, type WeatherData, type WeatherState } from "./useNotchWidgetData";
import { CloudIcon, FogIcon, MoonIcon, PartlyCloudyIcon, PinIcon, RainIcon, SnowIcon, StormIcon, SunIcon } from "./WeatherIcons";

const SURFACE =
  "overflow-hidden rounded-[24px] bg-[#171717] p-4 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]";

/* ───────────────────────────── Letras ───────────────────────────── */

interface LyricsWidgetProps {
  title: string;
  artist: string;
  timelineRef: { current: MediaTimeline | null };
  enabled: boolean;
  /** capa e cor ("r, g, b") da música: o cartão herda o degradê da capa */
  cover?: string;
  rgb?: string | null;
  /** letra de exemplo (o tutorial mostra o widget sem buscar nada na internet) */
  demoLyrics?: Lyrics;
}

/** Quanto cada linha se apaga e desfoca conforme se afasta da linha em curso. */
export function lineLook(distance: number): { opacity: number; blur: number } {
  if (distance === 0) return { opacity: 1, blur: 0 };
  if (distance === 1) return { opacity: 0.5, blur: 0.6 };
  if (distance === 2) return { opacity: 0.32, blur: 1.2 };
  if (distance <= 5) return { opacity: 0.18, blur: 2 };
  return { opacity: 0, blur: 0 };
}

const SCROLL_TRANSITION = "transform 500ms var(--ease-out-strong)";
const FADE_MASK = "linear-gradient(to bottom, transparent 0%, #000 24%, #000 76%, transparent 100%)";

/**
 * Letra sincronizada: a faixa inteira desliza para manter a linha em curso no centro, com as
 * vizinhas apagando e desfocando e uma máscara que dissolve o topo e o rodapé.
 */
export const LyricsWidget: React.FC<LyricsWidgetProps> = ({ title, artist, timelineRef, enabled, cover, rgb, demoLyrics }) => {
  const durationSeconds = timelineRef.current?.durationSeconds ?? null;
  const lookup = useNotchLyrics(title, artist, durationSeconds, enabled && !demoLyrics);
  const state: LyricsState = useMemo(
    () => (demoLyrics ? { status: "ready", lyrics: demoLyrics } : lookup),
    [demoLyrics, lookup],
  );
  const lines = useMemo(() => (state.status === "ready" ? state.lyrics.synced : []), [state]);
  const [index, setIndex] = useState(-1);
  const indexRef = useRef(-1);
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const lineRefs = useRef<(HTMLParagraphElement | null)[]>([]);
  const [offset, setOffset] = useState(0);

  // Só re-renderiza quando a linha em curso muda (o relógio compartilhado roda a cada frame).
  useEffect(() => {
    indexRef.current = -1;
    setIndex(-1);
    if (lines.length === 0) return;
    return subscribeTicker(() => {
      const t = timelineRef.current;
      if (!t) return;
      const next = activeLineIndex(lines, currentPosition(t, Date.now()) * 1000);
      if (next !== indexRef.current) {
        indexRef.current = next;
        setIndex(next);
      }
    });
  }, [lines, timelineRef]);

  // Centraliza a linha em curso; antes da primeira linha, deixa a primeira mais acima do centro.
  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    const target = lineRefs.current[Math.max(index, 0)];
    if (!viewport || !target) return;
    // o cabeçalho (capa + título) ocupa o topo: o centro da letra fica um pouco abaixo do meio
    const anchor = index < 0 ? viewport.clientHeight * 0.45 : viewport.clientHeight * 0.58;
    setOffset(anchor - (target.offsetTop + target.offsetHeight / 2));
  }, [index, lines]);

  const message =
    state.status === "loading"
      ? "Buscando a letra…"
      : state.status === "ready" && lines.length === 0
        ? null
        : lines.length === 0
          ? "Nenhuma letra sincronizada para esta música"
          : null;

  return (
    <section
      className={`${SURFACE} relative min-h-[148px] p-0`}
      aria-label="Letra da música"
      style={{
        backgroundImage: rgb ? `linear-gradient(150deg, rgba(${rgb}, 0.95) 0%, rgba(${rgb}, 0.5) 100%)` : undefined,
        transition: "background-image 400ms ease",
      }}
    >
      {lines.length > 0 && (
        <header className="absolute inset-x-0 top-0 z-10 flex items-center gap-2 px-3.5 pt-3">
          {cover && <img src={cover} alt="" draggable={false} className="h-7 w-7 shrink-0 rounded-md object-cover" />}
          <span className="min-w-0 leading-tight">
            <span className="block truncate text-[12px] font-bold text-white">{title}</span>
            <span className="block truncate text-[10.5px] font-medium text-white/70">{artist}</span>
          </span>
        </header>
      )}
      {message && <p className="absolute inset-0 flex items-center justify-center px-4 text-center text-[12px] leading-snug text-white/40">{message}</p>}
      {state.status === "ready" && lines.length === 0 && (
        <p className="line-clamp-6 whitespace-pre-line p-4 text-center text-[12px] leading-relaxed text-white/60">{state.lyrics.plain}</p>
      )}
      {lines.length > 0 && (
        <div
          ref={viewportRef}
          className="absolute inset-0 overflow-hidden"
          style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}
          aria-live="off"
        >
          <div className="absolute inset-x-0 top-0 px-4" style={{ transform: `translateY(${offset}px)`, transition: SCROLL_TRANSITION }}>
            {lines.map((line, i) => {
              const { opacity, blur } = lineLook(Math.abs(i - index));
              const active = i === index;
              return (
                <p
                  key={`${line.timeMs}-${i}`}
                  ref={(el) => {
                    lineRefs.current[i] = el;
                  }}
                  className={`py-[5px] text-left font-bold leading-snug text-white transition-[opacity,filter,font-size] duration-500 ${
                    active ? "text-[16px]" : "text-[14px]"
                  }`}
                  style={{ opacity, filter: blur ? `blur(${blur}px)` : undefined }}
                >
                  {line.text || "♪"}
                </p>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
};

/* ───────────────────────────── Calendário ───────────────────────────── */

/** Mês atual com o dia de hoje em destaque; vira o dia sozinho à meia-noite. */
export const CalendarWidget: React.FC = () => {
  const [today, setToday] = useState(() => new Date());
  useEffect(() => {
    const timer = window.setInterval(() => setToday(new Date()), 60_000);
    return () => window.clearInterval(timer);
  }, []);
  const weeks = useMemo(() => monthGrid(today, today), [today]);

  return (
    <section className={`${SURFACE} p-3.5`} aria-label="Calendário">
      <p className="mb-2 text-[12px] font-semibold capitalize text-white/80">{monthTitle(today)}</p>
      <div className="grid grid-cols-7 gap-y-0.5 text-center text-[11px] tabular-nums">
        {WEEKDAY_INITIALS.map((initial, i) => (
          <span key={i} className="pb-1 text-[10px] font-semibold text-white/35">
            {initial}
          </span>
        ))}
        {weeks.flat().map((cell, i) => (
          <span
            key={i}
            className={`mx-auto flex h-[22px] w-[22px] items-center justify-center rounded-full ${
              cell.isToday
                ? "bg-white font-bold text-black"
                : cell.inMonth
                  ? "text-white/85"
                  : "text-white/20"
            }`}
          >
            {cell.day}
          </span>
        ))}
      </div>
    </section>
  );
};

/* ───────────────────────────── Clima ───────────────────────────── */

const WEATHER_ICON: Record<WeatherData["kind"], React.ComponentType<{ size?: number; className?: string }>> = {
  clear: SunIcon,
  partly: PartlyCloudyIcon,
  cloud: CloudIcon,
  fog: FogIcon,
  rain: RainIcon,
  snow: SnowIcon,
  storm: StormIcon,
};

export const WeatherWidget: React.FC<{ city: string; enabled: boolean; demo?: WeatherData }> = ({ city, enabled, demo }) => {
  const live = useNotchWeather(city, enabled && !demo);
  const state: WeatherState = demo ? { status: "ready", weather: demo } : live;

  let body: React.ReactNode;
  if (!demo && !city.trim()) {
    body = <p className="text-[12px] leading-snug text-white/45">Escolha a cidade em Configurações → Notch.</p>;
  } else if (state.status === "ready") {
    const { weather } = state;
    const Icon = weather.kind === "clear" && !weather.isDay ? MoonIcon : WEATHER_ICON[weather.kind];
    body = (
      <>
        <p className="flex items-center gap-1.5 text-[12px] font-semibold text-white/80">
          <PinIcon size={12} className="shrink-0" aria-hidden />
          <span className="truncate">{weather.city}</span>
        </p>
        <p className="mt-0.5 text-[12px] text-white/50">{weather.label}</p>
        <div className="mt-auto flex items-end justify-between">
          <p className="text-[34px] font-light leading-none tabular-nums text-white">{Math.round(weather.temperatureC)}°C</p>
          <Icon size={38} className="text-white/55" />
        </div>
      </>
    );
  } else if (state.status === "unknown-city") {
    body = <p className="text-[12px] leading-snug text-white/45">Não encontrei “{city.trim()}”. Confira o nome em Configurações.</p>;
  } else if (state.status === "error") {
    body = <p className="text-[12px] leading-snug text-white/45">Clima indisponível agora.</p>;
  } else {
    body = <p className="text-[12px] text-white/40">Carregando…</p>;
  }

  return (
    <section className={`${SURFACE} flex min-h-[148px] flex-col p-3.5`} aria-label="Clima">
      {body}
    </section>
  );
};
