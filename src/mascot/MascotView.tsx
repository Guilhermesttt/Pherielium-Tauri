import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { deriveBodyPalette, type BodyPalette } from "./mascotColor";
import { mouthShape, smoothLevel } from "./mouth";
import type { MascotMood } from "./moods";
import { MOOD_SPECS, type BounceKind, type MoodSpec } from "./pherieStates";
import { subscribeTicker } from "./ticker";
import { headbangPose, headbangTransform, isAudioLive, nextBeatEnvelope, type AudioReactive } from "./headbang";
import type { EarsId, ItemId } from "./notchConfig";
import { PherieEngine } from "./pherie/engine";
import { drawPherie, type DrawStyle } from "./pherie/draw";

export interface MascotPointer {
  x: number;
  y: number;
  /** Date.now() do último movimento — após ~4s o olhar volta ao humor. */
  t: number;
}

export interface MascotViewProps {
  mood?: MascotMood;
  size?: number;
  /** Cor dos olhos/boca (a cor do mascote nas configs). */
  /** Acento do rosto (microfone, anéis do "tonto"). Padrão: derivado do corpo. */
  color?: string;
  /** Cor do corpo (`#rrggbb`). `null`/ausente = grafite padrão. O rosto se ajusta por contraste. */
  bodyColor?: string | null;
  /** Forma do corpo (ids do bloub: cercle, galet, squircle, capsule, triangle, hexagone, nuage, goutte). */
  shape?: string;
  /** Orelhas: gato (padrão), urso, robô ou demônio. */
  ears?: EarsId;
  /** Itens vestidos: óculos escuros, halo neon, fones RGB. */
  items?: ItemId[];
  /** Cor de destaque das orelhas de robô/demônio (acento do tema). */
  earAccent?: string;
  /** Volume da voz 0..1 (estado do React). Para volume ao vivo sem re-render use `levelRef`. */
  level?: number;
  levelRef?: { current: number };
  /** Áudio do PC (nível/bandas/batida): a cabeça faz headbang no ritmo. */
  audioRef?: { current: AudioReactive };
  /** Sem `level`/`levelRef`, falando = boca oscilando sozinha. */
  isSpeaking?: boolean;
  /** Em chamada: fone com haste de microfone, independente do humor. */
  inCall?: boolean;
  isMusicPlaying?: boolean;
  /** Microfone mutado: X na boca. */
  muted?: boolean;
  /** Muda a cada vez que ela deve fazer "tcharam!" (mãos para cima, revelando uma conquista). */
  celebrateAt?: number;
  /** Muda a cada vez que ela deve acenar (ex.: timestamp de um evento). */
  waveAt?: number;
  /** `true` enquanto a pessoa fala com o microfone mutado: a Pherie tenta falar e se irrita. */
  mutedSpeechRef?: { current: boolean };
  /** Fones sempre vestidos (ex.: intro de jogo), independente do humor. */
  forceHeadphones?: boolean;
  /**
   * Animação de "colocar os fones": `false` = fones fora de cena (acima da cabeça);
   * `true` = descem e encaixam com mola. `undefined` = comportamento normal (sem animação).
   */
  headphonesDrop?: boolean;
  isHovered?: boolean;
  /** Cursor global (coordenadas client); os olhos/cabeça seguem. */
  pointer?: MascotPointer | null;
  paused?: boolean;
  className?: string;
  onClick?: () => void;
}

type LiveState = MascotViewProps & { spec: MoodSpec; effectiveMood: MascotMood; palette: BodyPalette; faceColor: string };

const POINTER_IDLE_MS = 4000;

/** Balanço do corpo por humor (carregado do mascote antigo, aplicado ao wrapper). */
function bounceAnimation(bounce: BounceKind, poked: boolean, speaking: boolean) {
  const animate = poked
    ? { y: [0, -6, 0], rotate: [0, -8, 8, 0] }
    : speaking
    ? { scale: [1, 1.05, 1] }
    : bounce === "bouncy"
    ? { y: [0, -3.5, -1, -2.5, 0], rotate: [-6, 6, -4, 4, 0] }
    : bounce === "tremble"
    ? { x: [0, -0.8, 0.8, 0] }
    : bounce === "sway"
    ? { rotate: [-3, 3, -3] }
    : bounce === "wobble"
    ? { rotate: [-14, 14, -10, 10, 0], y: [0, -2, 0, -2, 0] }
    : { y: [0, -1, 0] };
  const transition = poked
    ? { type: "spring" as const, stiffness: 450, damping: 14 }
    : speaking
    ? { repeat: Infinity, duration: 0.28, ease: "easeInOut" as const }
    : bounce === "bouncy"
    ? { repeat: Infinity, duration: 0.9, ease: "easeInOut" as const }
    : bounce === "tremble"
    ? { repeat: Infinity, duration: 0.32, ease: "easeInOut" as const }
    : bounce === "sway"
    ? { repeat: Infinity, duration: 2.8, ease: "easeInOut" as const }
    : bounce === "wobble"
    ? { repeat: Infinity, duration: 1.1, ease: "easeInOut" as const }
    : { repeat: Infinity, duration: 3.5, ease: "easeInOut" as const };
  return { animate, transition };
}

export const MascotView: React.FC<MascotViewProps> = (props) => {
  const {
    mood = "idle",
    size = 32,
    color,
    bodyColor = null,
    shape,
    ears = "cat",
    items,
    earAccent = "#e8483f",
    isSpeaking = false,
    inCall = false,
    isMusicPlaying = false,
    forceHeadphones = false,
    headphonesDrop,
    isHovered = false,
    className = "",
    onClick,
  } = props;

  // ── humor efetivo (prioridade: interação > saudação > hover > chamada > música > humor) ──
  const [poked, setPoked] = useState(true);
  const [squish, setSquish] = useState(false);
  const [moodOverride, setMoodOverride] = useState<MascotMood | null>(null);
  const clicksRef = useRef<number[]>([]);
  const interactGen = useRef(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const t = setTimeout(() => setPoked(false), 650);
    timers.current.push(t);
    return () => timers.current.forEach(clearTimeout);
  }, []);

  const effectiveMood: MascotMood =
    moodOverride ??
    (poked
      ? "happy"
      : isHovered && mood === "sleeping"
      ? "idle"
      : isHovered && mood === "idle"
      ? "happy"
      : mood === "calling"
      ? "calling"
      : isMusicPlaying
      ? "music"
      : mood);
  const spec = MOOD_SPECS[effectiveMood] ?? MOOD_SPECS.idle;
  const itemSet = useMemo(() => new Set<ItemId>(items ?? []), [items]);
  // fones RGB: item do usuário (sempre vestidos) ou automático quando está jogando
  const rgbHeadphones = itemSet.has("rgbHeadphones") || effectiveMood === "gaming";
  const showHeadphones =
    inCall || Boolean(spec.headphones) || isMusicPlaying || forceHeadphones || itemSet.has("rgbHeadphones");
  const showMic = inCall || effectiveMood === "calling";
  const speakingNow = isSpeaking || (props.level ?? 0) > 0.06;

  const flashMood = (m: MascotMood, ms: number) => {
    const gen = ++interactGen.current;
    setMoodOverride(m);
    timers.current.push(
      setTimeout(() => {
        if (interactGen.current === gen) setMoodOverride(null);
      }, ms),
    );
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = Date.now();
    const recent = [...clicksRef.current.filter((t) => now - t < 800), now];
    clicksRef.current = recent;
    setSquish(true);
    timers.current.push(setTimeout(() => setSquish(false), 200));
    if (recent.length >= 3) {
      clicksRef.current = [];
      flashMood("dizzy", 3000);
    } else {
      flashMood("annoyed", 1500);
    }
    onClick?.();
  };

  // ── engine (molas, olhos, partículas) + loop de desenho em canvas ──
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<PherieEngine | null>(null);
  if (!engineRef.current) engineRef.current = new PherieEngine(effectiveMood, shape);
  const levelSmooth = useRef(0);
  const palette = useMemo(() => deriveBodyPalette(bodyColor), [bodyColor]);
  const faceColor = color ?? palette.face;
  const accentColor = color ?? palette.accent;
  const live = useRef<LiveState>({ ...props, spec, effectiveMood, palette, faceColor });
  live.current = { ...props, spec, effectiveMood, palette, faceColor };
  const styleRef = useRef({ accentColor, rgbHeadphones, showMic, earAccent, ears, itemSet });
  styleRef.current = { accentColor, rgbHeadphones, showMic, earAccent, ears, itemSet };

  useEffect(() => {
    engineRef.current!.setShape(shape);
  }, [shape]);
  useEffect(() => {
    engineRef.current!.setMood(effectiveMood);
  }, [effectiveMood]);
  // tcharam! sempre que `celebrateAt` mudar
  useEffect(() => {
    if (props.celebrateAt !== undefined) engineRef.current!.celebrate(2.4);
  }, [props.celebrateAt]);
  // olá! ao aparecer e sempre que `waveAt` mudar
  useEffect(() => {
    engineRef.current!.wave(1.8);
  }, [props.waveAt]);
  useEffect(() => {
    engineRef.current!.setHeadphones(showHeadphones, headphonesDrop);
  }, [showHeadphones, headphonesDrop]);
  useEffect(() => {
    if (poked) engineRef.current!.poke();
  }, [poked]);

  useEffect(() => {
    const engine = engineRef.current!;
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * dpr);
    canvas.height = Math.round(size * dpr);

    let aiming = false;
    let rect: DOMRect | null = null;
    let rectAt = 0;
    let acc = 0;
    let beatEnv = 0;
    let beatCount = 0;
    let lastBeatAt = 0;
    let nodding = false;
    let clock = 0;
    let fumeUntil = 0;
    // instâncias pequenas (barra do notch, grade das configs) não precisam de 60 fps
    const divisor = size <= 48 ? 2 : 1;
    let frameNo = 0;

    const aim = (now: number) => {
      const cur = live.current;
      const pointer = cur.pointer;
      const active = Boolean(pointer && Date.now() - pointer.t < POINTER_IDLE_MS);
      if (!active || !pointer) {
        if (aiming) {
          engine.setLook(null, null);
          aiming = false;
        }
        return;
      }
      if (!rect || now - rectAt > 400) {
        rect = canvas.getBoundingClientRect();
        rectAt = now;
      }
      if (!rect || rect.width === 0 || rect.height === 0) return;
      const half = Math.max(240, window.innerWidth / 2);
      const nx = Math.max(-1, Math.min(1, (pointer.x - (rect.left + rect.width / 2)) / half));
      const ny = Math.max(-1, Math.min(1, (pointer.y - (rect.top + rect.height / 2)) / half));
      engine.setLook(nx, ny * 0.8);
      aiming = true;
    };

    const render = (level: number) => {
      const cur = live.current;
      const st = styleRef.current;
      const style: DrawStyle = {
        palette: cur.palette,
        faceColor: cur.faceColor,
        accentColor: st.accentColor,
        ears: st.ears,
        earAccent: st.earAccent,
        items: st.itemSet,
        rgbHeadphones: st.rgbHeadphones,
        showMic: st.showMic,
        mouth: mouthShape(cur.spec.mouth, level),
        blush: cur.spec.blush,
        extras: cur.spec.extras ?? [],
      };
      drawPherie(ctx, engine, style, size, dpr);
    };

    render(0);

    const unsubscribe = subscribeTicker((dt, now) => {
      const cur = live.current;
      if (cur.paused) return;
      clock += dt;
      acc += dt;
      if (++frameNo % divisor !== 0) return;
      const step = acc;
      acc = 0;

      aim(now);

      // cenas dos braços: jogar (controle), música (dança), mutado (X) e irritada ao falar mutada
      const muteX = Boolean(cur.muted) || cur.effectiveMood === "muted";
      if (muteX && cur.mutedSpeechRef?.current) fumeUntil = now + 1300;
      const fume = muteX && now < fumeUntil;
      engine.setMood(fume ? "angry" : cur.effectiveMood);
      engine.setScene({
        muteX,
        fume,
        gaming: cur.effectiveMood === "gaming",
        dancing: Boolean(cur.isMusicPlaying) || cur.effectiveMood === "music",
        beat: beatEnv,
      });

      // headbang: o envelope da batida vira queda/inclinação da cabeça (só com áudio ao vivo)
      const audio = cur.audioRef?.current;
      if (audio && isAudioLive(audio, performance.now())) {
        const isNewBeat = audio.beatAt > 0 && audio.beatAt !== lastBeatAt;
        if (isNewBeat) {
          lastBeatAt = audio.beatAt;
          beatCount += 1;
        }
        beatEnv = nextBeatEnvelope(beatEnv, step, isNewBeat);
        canvas.style.transformOrigin = "50% 85%";
        canvas.style.transform = headbangTransform(headbangPose(beatEnv, beatCount, audio.rms));
        nodding = true;
      } else if (nodding) {
        beatEnv = 0;
        canvas.style.transform = "";
        nodding = false;
      }

      const explicit = Math.max(cur.level ?? 0, cur.levelRef?.current ?? 0);
      const synthetic = cur.isSpeaking && explicit <= 0 ? 0.45 + 0.4 * Math.sin(clock * 18) : 0;
      levelSmooth.current = smoothLevel(levelSmooth.current, Math.max(explicit, synthetic), step);
      engine.update(step);
      render(levelSmooth.current);
    });
    return unsubscribe;
    // o loop lê o estado mais recente via `live`/`styleRef`; reinicia só se o tamanho mudar
  }, [size]);

  const bounce = bounceAnimation(spec.bounce, poked, speakingNow);

  return (
    <motion.div
      className={`relative select-none cursor-pointer flex items-center justify-center ${className}`}
      style={{ width: size, height: size, rotate: spec.tilt ?? 0 }}
      onClick={handleClick}
      whileHover={{ scale: 1.08 }}
      whileTap={{ scale: 0.92 }}
      animate={squish ? { scaleX: 1.22, scaleY: 0.78 } : { scaleX: 1, scaleY: 1 }}
      transition={{ type: "spring", stiffness: 600, damping: 16 }}
      title="Pherie — Seu companheiro Pherielium"
    >
      <motion.div animate={bounce.animate} transition={bounce.transition} style={{ width: size, height: size }}>
        <canvas
          ref={canvasRef}
          role="img"
          aria-label="Pherie"
          style={{ width: size, height: size, display: "block" }}
        />
      </motion.div>
    </motion.div>
  );
};
