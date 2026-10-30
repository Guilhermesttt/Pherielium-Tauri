import React, { useEffect, useMemo, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Pause, SkipBack, SkipForward } from "lucide-react";
import { MascotView } from "../mascot/MascotView";
import { STAGGER_MS, appleSprings } from "../design-system/motion";
import type { NotchConfig } from "../mascot/notchConfig";
import { NotchCard } from "../components/notch/DesktopNotch";
import { MediaProgress } from "../components/notch/live/MediaProgress";
import type { MediaTimeline } from "../components/notch/live/progressMath";
import { CalendarWidget, LyricsWidget, WeatherWidget } from "../components/notch/widgets/NotchWidgets";
import type { Lyrics } from "../components/notch/widgets/lyricsMath";
import type { WeatherData } from "../components/notch/widgets/useNotchWidgetData";

/** Qual item acabou de ser mexido no painel de ajustes (ganha um destaque na prévia). */
export type PreviewFocus = "notch" | "lyrics" | "calendar" | "weather" | "pherie" | null;

/** Música de mentira: a prévia usa os MESMOS componentes da notch, só com dados de exemplo. */
const DEMO_TRACK = { title: "Southtown", artist: "P.O.D.", rgb: "214, 120, 52" };
const DEMO_LOOP_SECONDS = 24;
const DEMO_LYRICS: Lyrics = {
  plain: null,
  synced: [
    "Welcome to hard times,",
    "back again like it's never been",
    "For the first time,",
    "it seems to mess with my head",
    "So when I realize what it takes,",
    "can I relate?",
    "With whatever, but never will it",
    "drive me to the edge",
  ].map((text, i) => ({ timeMs: 1500 + i * 2800, text })),
};
const DEMO_WEATHER: WeatherData = { city: "Recife", temperatureC: 27, label: "Parcialmente nublado", kind: "partly", isDay: true };

/** Relógio de mentira da faixa: recomeça a cada volta para a letra e a barra nunca pararem. */
function useDemoTimeline() {
  const timeline = useRef<MediaTimeline | null>(null);
  useEffect(() => {
    const restart = () => {
      timeline.current = { positionSeconds: 0, durationSeconds: 3600, sampledAtMs: Date.now(), playing: true };
    };
    restart();
    const id = window.setInterval(restart, DEMO_LOOP_SECONDS * 1000);
    return () => window.clearInterval(id);
  }, []);
  return timeline;
}

const Focused: React.FC<{ on: boolean; children: React.ReactNode }> = ({ on, children }) => (
  <div className={`rounded-[24px] transition-shadow duration-300 ${on ? "tour-preview-focus" : ""}`}>{children}</div>
);

/** Entrada de cada widget: mola sem sobra e um pequeno atraso por posição (stagger de 40 ms). */
const block = (order: number) =>
  ({
    initial: { opacity: 0, scale: 0.96, y: 8 },
    animate: { opacity: 1, scale: 1, y: 0 },
    exit: { opacity: 0, scale: 0.96, y: -8 },
    transition: { ...appleSprings.snap, delay: (order * STAGGER_MS) / 1000 },
  }) as const;

/**
 * Prévia ao vivo da notch para o passo de configuração: reflete cada interruptor na hora, com os
 * mesmos widgets que ela usa de verdade (música, letra, calendário, clima) e a Pherie no hub.
 */
export const NotchPreview: React.FC<{ config: NotchConfig; focus: PreviewFocus }> = ({ config, focus }) => {
  const timelineRef = useDemoTimeline();
  const showLyrics = config.widgets.includes("lyrics");
  const showCalendar = config.widgets.includes("calendar");
  const showWeather = config.widgets.includes("weather");
  const weather = useMemo(() => ({ ...DEMO_WEATHER, city: config.weatherCity.trim() || DEMO_WEATHER.city }), [config.weatherCity]);

  return (
    <div className="mx-auto w-full" style={{ zoom: 0.74 }} aria-label="Prévia da notch" role="img">
      {/* barra do hub: é onde a Pherie mora */}
      <div className="mx-auto mb-2 flex w-[560px] items-center justify-between rounded-2xl bg-white/[0.04] px-4 py-2 text-[13px] text-white/60">
        <span className="font-semibold tabular-nums">14:32</span>
        <AnimatePresence>
          {config.showMascot && (
            <motion.span key="pherie" {...block(0)} className={`rounded-full p-0.5 ${focus === "pherie" ? "tour-preview-focus" : ""}`}>
              <MascotView size={30} mood="happy" isHovered />
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="mx-auto w-[560px] rounded-b-[40px] bg-black p-4 pt-3 shadow-[0_18px_50px_rgba(0,0,0,0.6)]">
        {!config.enabled ? (
          <p className="py-16 text-center text-[14px] text-white/40">Notch desligada. O resto continua funcionando normalmente.</p>
        ) : (
          <div className="flex flex-col gap-3.5">
            <div className={showLyrics ? "grid grid-cols-2 items-stretch gap-3.5" : ""}>
              <Focused on={focus === "notch"}>
                <NotchCard tone="pink" rgb={DEMO_TRACK.rgb}>
                  <p className="mb-2 text-[11px] font-semibold text-[#9398a1]">Tocando no PC</p>
                  <div className="flex items-center gap-3">
                    <span className="h-[64px] w-[64px] shrink-0 rounded-2xl bg-gradient-to-br from-amber-300/80 via-orange-500/70 to-rose-500/70" />
                    <span className="min-w-0">
                      <span className="block truncate text-[14px] font-semibold text-white">{DEMO_TRACK.title}</span>
                      <span className="block truncate text-[11px] text-white/60">{DEMO_TRACK.artist}</span>
                    </span>
                  </div>
                  <div className="mt-3">
                    <MediaProgress timelineRef={timelineRef} rgb={DEMO_TRACK.rgb} />
                  </div>
                  <div className="mt-2 flex items-center justify-center gap-6 text-white/80">
                    <SkipBack size={16} className="fill-current" />
                    <span className="grid h-9 w-9 place-items-center rounded-full bg-white text-black">
                      <Pause size={15} className="fill-current" />
                    </span>
                    <SkipForward size={16} className="fill-current" />
                  </div>
                </NotchCard>
              </Focused>
              <AnimatePresence>
                {showLyrics && (
                  <motion.div key="lyrics" {...block(1)}>
                    <Focused on={focus === "lyrics"}>
                      <LyricsWidget
                        title={DEMO_TRACK.title}
                        artist={DEMO_TRACK.artist}
                        timelineRef={timelineRef}
                        enabled
                        rgb={DEMO_TRACK.rgb}
                        demoLyrics={DEMO_LYRICS}
                      />
                    </Focused>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {(showCalendar || showWeather) && (
              <div className={`grid items-stretch gap-3.5 ${showCalendar && showWeather ? "grid-cols-2" : "grid-cols-1"}`}>
                <AnimatePresence>
                  {showCalendar && (
                    <motion.div key="calendar" {...block(2)}>
                      <Focused on={focus === "calendar"}>
                        <CalendarWidget />
                      </Focused>
                    </motion.div>
                  )}
                  {showWeather && (
                    <motion.div key="weather" {...block(3)}>
                      <Focused on={focus === "weather"}>
                        <WeatherWidget city={weather.city} enabled demo={weather} />
                      </Focused>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
