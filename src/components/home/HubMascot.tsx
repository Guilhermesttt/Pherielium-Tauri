import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { appleSprings } from "../../design-system/motion";
import { PherieMascot, getMascotBaseMood } from "../notch/PherieMascot";
import { useNotchConfig } from "../../mascot/useNotchConfig";
import { useSituationMood } from "../../mascot/useSituationMood";
import { hasTauriRuntime, useVoiceLevelRef } from "../../mascot/useVoiceLevel";
import { DIZZY_DURATION_MS, isMouseShake } from "../../mascot/cursorReactions";
import { registerPoke, resolveHubMood, shakeMetrics, type MoveSample } from "../../mascot/hubPherie";
import type { MascotMood } from "../../mascot/moods";
import {
  HUB_RETURN_DELAY_MS,
  PHERIE_NOTCH_TAURI_EVENT,
  PHERIE_NOTCH_WINDOW_EVENT,
  notchHoldsPherie,
  parsePresence,
  type PherieNotchPresence,
} from "../../mascot/pherieHandoff";
import { usePreferences } from "../../context/PreferencesContext";
import { useVoiceCallContext } from "../../context/VoiceCallContext";
import { playPherieVoice, voiceForMoodChange } from "../notch/pherieVoice";
import {
  NOTCH_EVENT_MOOD,
  NOTCH_EVENT_TAURI_EVENT,
  NOTCH_EVENT_WINDOW_EVENT,
  notchEventWaves,
  parseNotchEvent,
} from "../notch/notchEvent";

const MASCOT_SIZE = 38;
const EVENT_MOOD_MS = 2800;
const MEDIA_POLL_MS = 3000;
const SHAKE_SAMPLES = 24;

/**
 * A Pherie no topo do hub, ao lado do relógio. Tudo o que ela fazia na notch continua: os olhos e a
 * cabeça seguem o cursor, ela reage a cutucadas (e fica tonta com cliques demais ou mouse chacoalhado),
 * dança com a música, joga, atende chamada, comemora conquistas, acena para amigos e dorme quando fica
 * parada. Segue o ajuste "Mostrar a Pherie" das configurações da notch.
 */
export const HubMascot: React.FC = () => {
  const { showMascot, sounds, followCursor } = useNotchConfig();
  const heldByNotch = useNotchHoldsPherie();
  if (!showMascot) return null;
  return (
    // enquanto a notch está com ela, ela "sobe" para lá; quando a notch a dispensa, ela volta ao hub
    <AnimatePresence>
      {!heldByNotch && (
        <motion.span
          key="hub-pherie"
          className="inline-flex"
          // volta da notch com um pouco de momento (a gaveta da Apple: 0.8) e sai direto para cima, de onde veio
          initial={{ scale: 0.4, y: -14, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.4, y: -14, opacity: 0, transition: appleSprings.snap }}
          transition={appleSprings.sheet}
        >
          <HubPherie sounds={sounds} followCursor={followCursor} />
        </motion.span>
      )}
    </AnimatePresence>
  );
};

/** A notch (no overlay) está com a Pherie agora? Volta a `false` sozinho se os sinais dela pararem. */
function useNotchHoldsPherie(): boolean {
  const [held, setHeld] = useState(false);
  const presence = useRef<PherieNotchPresence | null>(null);
  const returnTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const apply = (raw: unknown) => {
      const next = parsePresence(raw, Date.now());
      if (!next) return;
      presence.current = next;
      if (next.active) {
        if (returnTimer.current) {
          clearTimeout(returnTimer.current);
          returnTimer.current = null;
        }
        setHeld(true);
      } else if (!returnTimer.current) {
        returnTimer.current = setTimeout(() => {
          returnTimer.current = null;
          setHeld(false);
        }, HUB_RETURN_DELAY_MS);
      }
    };
    const onWindow = (e: Event) => apply((e as CustomEvent).detail);
    window.addEventListener(PHERIE_NOTCH_WINDOW_EVENT, onWindow);
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    if (hasTauriRuntime()) {
      void import("@tauri-apps/api/event").then(({ listen }) =>
        listen<unknown>(PHERIE_NOTCH_TAURI_EVENT, (event) => apply(event.payload)).then((fn) => {
          if (cancelled) fn();
          else unlisten = fn;
        }),
      );
    }
    // rede de segurança: a notch parou de dar sinal (overlay fechou), a Pherie volta
    const watchdog = window.setInterval(() => {
      if (!notchHoldsPherie(presence.current, Date.now())) setHeld(false);
    }, 2000);
    return () => {
      cancelled = true;
      window.removeEventListener(PHERIE_NOTCH_WINDOW_EVENT, onWindow);
      unlisten?.();
      window.clearInterval(watchdog);
      if (returnTimer.current) clearTimeout(returnTimer.current);
    };
  }, []);

  return held;
}

const HubPherie: React.FC<{ sounds: boolean; followCursor: boolean }> = ({ sounds, followCursor }) => {
  const voiceCall = useVoiceCallContext();
  const { effectsVolume } = usePreferences();
  const volume = effectsVolume / 100;
  const hostRef = useRef<HTMLSpanElement | null>(null);

  const [hovered, setHovered] = useState(false);
  const [baseMood, setBaseMood] = useState<MascotMood | null>(() => getMascotBaseMood());
  const [pointer, setPointer] = useState({ x: -9999, y: -9999, t: 0 });
  const [dizzy, setDizzy] = useState(false);
  const [gaming, setGaming] = useState(false);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [eventMood, setEventMood] = useState<{ mood: MascotMood; at: number; kind: string } | null>(null);

  const inCall = voiceCall.callState === "active" || voiceCall.callState === "connecting" || voiceCall.callState === "ringing-out";
  const ringing = voiceCall.callState === "ringing-in";

  // Boca: o volume do microfone chega por evento (ref, sem re-render). Fora do Tauri cai no "falando" do contexto.
  const hasVoiceFeed = hasTauriRuntime();
  const mutedSpeechRef = useRef(false);
  const voiceLevelRef = useVoiceLevelRef(inCall && hasVoiceFeed, mutedSpeechRef);
  const mouthSpeaking = !hasVoiceFeed && !voiceCall.isMuted && voiceCall.isSpeakingLocal;

  // humor escolhido em "Expressões da Pherie"
  useEffect(() => {
    const sync = () => setBaseMood(getMascotBaseMood());
    window.addEventListener("pherielium:mascot-mood-changed", sync);
    return () => window.removeEventListener("pherielium:mascot-mood-changed", sync);
  }, []);

  // cursor + mouse chacoalhado (no hub só há `mousemove`; velocidade e inversões saem daqui)
  const samples = useRef<MoveSample[]>([]);
  const dizzyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      const now = Date.now();
      setPointer((prev) => (Math.abs(e.clientX - prev.x) < 4 && Math.abs(e.clientY - prev.y) < 4 ? prev : { x: e.clientX, y: e.clientY, t: now }));
      samples.current = [...samples.current.slice(-(SHAKE_SAMPLES - 1)), { x: e.clientX, y: e.clientY, t: now }];
      const rect = hostRef.current?.getBoundingClientRect();
      if (!rect) return;
      const near = Math.hypot(e.clientX - (rect.left + rect.width / 2), e.clientY - (rect.top + rect.height / 2));
      if (isMouseShake(shakeMetrics(samples.current, now), near)) {
        setDizzy(true);
        if (dizzyTimer.current) clearTimeout(dizzyTimer.current);
        dizzyTimer.current = setTimeout(() => setDizzy(false), DIZZY_DURATION_MS);
      }
    };
    window.addEventListener("mousemove", onMove, { passive: true });
    return () => {
      window.removeEventListener("mousemove", onMove);
      if (dizzyTimer.current) clearTimeout(dizzyTimer.current);
    };
  }, []);

  // jogo em andamento (o watcher do Rust avisa início e fim)
  useEffect(() => {
    if (!hasTauriRuntime()) return;
    let cancelled = false;
    const unlisten: Array<() => void> = [];
    void import("@tauri-apps/api/event").then(async ({ listen }) => {
      const started = await listen("game-watch:started", () => setGaming(true));
      const ended = await listen("game-watch:ended", () => setGaming(false));
      if (cancelled) {
        started();
        ended();
      } else {
        unlisten.push(started, ended);
      }
    });
    return () => {
      cancelled = true;
      unlisten.forEach((fn) => fn());
    };
  }, []);

  // música tocando no PC (consulta nativa, alguns ms)
  useEffect(() => {
    if (!hasTauriRuntime()) return;
    let active = true;
    const poll = async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const info = await invoke<{ hasMedia?: boolean; isPlaying?: boolean }>("system_get_media_info");
        if (active) setMusicPlaying(Boolean(info?.hasMedia && info.isPlaying));
      } catch {
        if (active) setMusicPlaying(false);
      }
    };
    void poll();
    const id = window.setInterval(poll, MEDIA_POLL_MS);
    return () => {
      active = false;
      window.clearInterval(id);
    };
  }, []);

  // avisos do ecossistema (conquista, amigo, mensagem): ela reage como reagia na notch
  useEffect(() => {
    const seen: string[] = [];
    let timer: ReturnType<typeof setTimeout> | null = null;
    const push = (raw: unknown) => {
      const event = parseNotchEvent(raw);
      if (!event || seen.includes(event.id)) return;
      seen.push(event.id);
      if (seen.length > 20) seen.shift();
      setEventMood({ mood: NOTCH_EVENT_MOOD[event.kind], at: event.at, kind: event.kind });
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => setEventMood(null), EVENT_MOOD_MS);
    };
    const onWindow = (e: Event) => push((e as CustomEvent).detail);
    window.addEventListener(NOTCH_EVENT_WINDOW_EVENT, onWindow);
    let cancelled = false;
    let unlisten: (() => void) | undefined;
    if (hasTauriRuntime()) {
      void import("@tauri-apps/api/event").then(({ listen }) =>
        listen<unknown>(NOTCH_EVENT_TAURI_EVENT, (event) => push(event.payload)).then((fn) => {
          if (cancelled) fn();
          else unlisten = fn;
        }),
      );
    }
    return () => {
      cancelled = true;
      window.removeEventListener(NOTCH_EVENT_WINDOW_EVENT, onWindow);
      unlisten?.();
      if (timer) clearTimeout(timer);
    };
  }, []);

  const situation = useSituationMood({
    isCallActive: inCall,
    callDurationSeconds: 0,
    activeGameTitle: gaming ? "game" : null,
    gameElapsedSeconds: 0,
    hasMedia: musicPlaying,
    isMediaPlaying: musicPlaying,
    isExpanded: false,
    isHovered: hovered,
    busy: inCall || ringing || gaming || musicPlaying || Boolean(eventMood),
  });

  const mood = useMemo(
    () =>
      resolveHubMood({
        dizzy,
        eventMood: ringing ? "excited" : eventMood?.mood ?? null,
        transient: situation.transient,
        inCall,
        muted: inCall && voiceCall.isMuted,
        gaming,
        musicPlaying,
        baseMood,
        hovered,
        ambient: situation.ambient,
      }),
    [dizzy, ringing, eventMood, situation.transient, situation.ambient, inCall, voiceCall.isMuted, gaming, musicPlaying, baseMood, hovered],
  );

  // voz: um gorjeio por mudança de humor (bocejo, susto, alegria...), exceto nos que já têm som próprio
  const prevMood = useRef<MascotMood | null>(null);
  const voiceMuteUntil = useRef(0);
  useEffect(() => {
    const previous = prevMood.current;
    prevMood.current = mood;
    if (!sounds || ringing || eventMood || performance.now() < voiceMuteUntil.current) return;
    const voice = voiceForMoodChange(previous, mood);
    if (voice) playPherieVoice(voice, volume);
  }, [mood, sounds, ringing, eventMood, volume]);

  // cutucada: pip mais agudo a cada clique; no terceiro seguido ela fica tonta e depois confusa
  const clicks = useRef<number[]>([]);
  const react = situation.react;
  const poke = useCallback(() => {
    if (dizzy) return;
    const result = registerPoke(clicks.current, Date.now());
    clicks.current = result.clicks;
    if (result.dizzy) {
      setDizzy(true);
      if (dizzyTimer.current) clearTimeout(dizzyTimer.current);
      dizzyTimer.current = setTimeout(() => {
        setDizzy(false);
        react("confused");
      }, DIZZY_DURATION_MS);
      return;
    }
    voiceMuteUntil.current = performance.now() + 700;
    if (sounds) playPherieVoice("poke", volume, 1 + 0.14 * (result.clicks.length - 1));
    react(result.clicks.length === 1 ? "surprised" : "annoyed");
  }, [dizzy, sounds, volume, react]);

  return (
    <span
      ref={hostRef}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="inline-flex shrink-0 cursor-pointer"
      data-tour="pherie"
      title="Pherie"
    >
      <PherieMascot
        size={MASCOT_SIZE}
        mood={mood}
        isHovered={hovered}
        inCall={inCall}
        isMusicPlaying={musicPlaying}
        ringing={ringing}
        muted={inCall && voiceCall.isMuted}
        levelRef={voiceLevelRef}
        mutedSpeechRef={mutedSpeechRef}
        isSpeaking={mouthSpeaking}
        waveAt={eventMood && notchEventWaves(eventMood.kind as Parameters<typeof notchEventWaves>[0]) ? eventMood.at : undefined}
        celebrateAt={eventMood?.kind === "achievement" ? eventMood.at : undefined}
        pointer={followCursor ? pointer : null}
        onClick={poke}
      />
    </span>
  );
};
