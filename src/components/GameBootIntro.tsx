import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { animated, to, useSpring, useTrail } from "@react-spring/web";
import { setLauncherInputLocked } from "../utils/launcherInputLock";
import type { SoundTheme } from "../context/PreferencesContext";
import { resolveBootIntro } from "./boot-intro/bootIntroTheme";
import backdropVideoSrc from "../assets/karavanbraam_pindown.io.webm";
import logoSrc from "../assets/Pherielium_logo.png";
import { SCENE_TIMING, STARTUP_SOUNDS, type SceneSoundId, type SceneStage } from "./boot-intro/bootIntroScenes";
import swooshSoftSrc from "../sounds/Pherielium Intro/swoosh-soft.mp3";
import swooshAir1Src from "../sounds/Pherielium Intro/swoosh-air-1.mp3";
import swooshAir2Src from "../sounds/Pherielium Intro/swoosh-air-2.mp3";
import defaultLeadSrc from "../sounds/Phelierium Default/Intro_Music.mp3";

/**
 * Intro de abertura (12,6 s), feita com molas reais do `@react-spring/web`: um brilho acende e o logo
 * surge pequeno, girando e desfocado, e assenta com overshoot; faíscas e duas ondas de choque abrem, uma
 * faixa de luz atravessa o logo, ele se contrai e dispara 25×
 * para a câmera (devagar, com inércia), e o nome "Pherielium" entra letra a
 * letra (`useTrail`) e sai subindo e desfocando. Sobre o fundo radial, o vídeo de pontos de luz sobe
 * junto do logo. Os sons são tocados nos marcos de `SCENE_TIMING`. Qualquer tecla (Esc, Enter, Espaço…)
 * ou clique pula; com "reduzir movimento", mostra só o nome completo, sem molas.
 */

interface GameBootIntroProps {
  onFinish?: () => void;
  /** Toca o áudio da intro (preferência `gameBootIntroSoundEnabled`). */
  soundEnabled?: boolean;
  /** Tema sonoro escolhido: decide o som de partida e se os efeitos tocam. */
  soundTheme?: SoundTheme;
}

const FADE_OUT_MS = 400;
const REDUCED_MOTION_HOLD_MS = 1200;
const SKIP_HINT_DELAY_MS = 1200;
const BRAND = "Pherielium";

const LOGO_SPRING = { tension: 120, friction: 15, mass: 1.2 }; // subamortecida: passa um pouco do ponto e assenta
const BLOOM_SPRING = { tension: 90, friction: 20 };
const BURST_SPRING = { tension: 55, friction: 22 };
const SHINE_SPRING = { tension: 60, friction: 26 };

/** Faíscas que saem do logo na onda de choque: ângulo, distância e tamanho fixos (sem aleatório). */
const SPARKS = Array.from({ length: 14 }, (_, i) => {
  const angle = (i / 14) * Math.PI * 2 + (i % 2 ? 0.18 : -0.12);
  return { angle, distance: 230 + ((i * 53) % 170), size: 4 + ((i * 7) % 5) };
});
const ANTICIPATE_SPRING = { tension: 160, friction: 26, mass: 1.4 };
// Hiper-zoom: uma mola de progresso 0 → 1 (pesada e sem quique). A escala cresce de forma
// exponencial com ele (zoom de câmera) e o logo some junto, atrelado ao mesmo progresso.
const ZOOM_SPRING = { tension: 46, friction: 24, mass: 2 };
const ZOOM_FACTOR = 25;
const LETTER_SPRING = { tension: 140, friction: 24 };
const LETTER_OUT_SPRING = { tension: 120, friction: 26 };
const SHOCK_SPRING = { tension: 70, friction: 20 };

/** Opacidade do logo durante o zoom: some entre 35% e 85% do trajeto (suave nas duas pontas). */
function zoomFade(progress: number): number {
  const t = Math.min(Math.max((progress - 0.35) / 0.5, 0), 1);
  return 1 - t * t * (3 - 2 * t);
}

const EFFECT_SOUNDS: Record<Exclude<SceneSoundId, "lead">, { src: string; volume: number }> = {
  swooshSoft: { src: swooshSoftSrc, volume: 0.9 },
  swooshAir1: { src: swooshAir1Src, volume: 0.5 },
  swooshAir2: { src: swooshAir2Src, volume: 0.5 },
};

function fadeOutAudio(audio: HTMLAudioElement, durationMs = 450): void {
  const startVolume = audio.volume;
  if (audio.paused || startVolume <= 0) {
    audio.pause();
    return;
  }
  const startTime = performance.now();
  const step = (now: number): void => {
    const t = Math.min((now - startTime) / durationMs, 1);
    audio.volume = startVolume * (1 - t);
    if (t < 1) requestAnimationFrame(step);
    else audio.pause();
  };
  requestAnimationFrame(step);
}

const GameBootIntro: React.FC<GameBootIntroProps> = ({ onFinish, soundEnabled = true, soundTheme = "default" }) => {
  const choice = useMemo(() => resolveBootIntro(soundTheme, STARTUP_SOUNDS), [soundTheme]);
  const reducedMotion = useMemo(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false, []);

  const audioRef = useRef<Partial<Record<SceneSoundId, HTMLAudioElement>>>({});
  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  const [stage, setStage] = useState<SceneStage>("idle");
  const [isExiting, setIsExiting] = useState(false);
  const [showSkipHint, setShowSkipHint] = useState(false);

  // Placa e selo (o conjunto que se contrai e dispara): começam pequenos e ocultos.
  const [logo, logoApi] = useSpring(() => ({ scale: 0, rotateZ: -45, opacity: 0, blur: 14, config: LOGO_SPRING }));
  const [bloom, bloomApi] = useSpring(() => ({ scale: 0.3, opacity: 0, config: BLOOM_SPRING }));
  const [burst, burstApi] = useSpring(() => ({ progress: 0, config: BURST_SPRING }));
  const [shine, shineApi] = useSpring(() => ({ x: -130, config: SHINE_SPRING }));
  const [zoom, zoomApi] = useSpring(() => ({ progress: 0, config: ZOOM_SPRING }));
  const [shock, shockApi] = useSpring(() => ({ scale: 0.6, opacity: 0, config: SHOCK_SPRING }));
  const [shock2, shock2Api] = useSpring(() => ({ scale: 0.6, opacity: 0, config: SHOCK_SPRING }));
  // Uma mola por letra; cada uma segue a anterior (cascata).
  const [letters, lettersApi] = useTrail(BRAND.length, () => ({
    opacity: reducedMotion ? 1 : 0,
    y: reducedMotion ? 0 : 16,
    scale: reducedMotion ? 1 : 0.92,
    blur: reducedMotion ? 0 : 6,
    config: LETTER_SPRING,
  }));

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  // Estável de propósito: os relógios abaixo não podem reiniciar se `onFinish` mudar.
  const handleFinish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setIsExiting(true);
    Object.values(audioRef.current).forEach((audio) => fadeOutAudio(audio));
    window.setTimeout(() => onFinishRef.current?.(), FADE_OUT_MS);
  }, []);

  // Bloqueia o launcher enquanto a intro roda; qualquer tecla pula.
  useLayoutEffect(() => {
    setLauncherInputLocked(true);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

    const blockInteraction = (event: Event): void => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const blockedEvents = ["keyup", "keypress"];
    blockedEvents.forEach((name) => {
      window.addEventListener(name, blockInteraction, { capture: true, passive: false });
    });
    const handleKeySkip = (): void => handleFinish();
    window.addEventListener("keydown", handleKeySkip, { capture: true });

    return () => {
      setLauncherInputLocked(false);
      blockedEvents.forEach((name) => {
        window.removeEventListener(name, blockInteraction, { capture: true });
      });
      window.removeEventListener("keydown", handleKeySkip, { capture: true });
    };
  }, [handleFinish]);

  // Sons: criados já na abertura para estarem carregados quando chegar o momento.
  useEffect(() => {
    const created: Partial<Record<SceneSoundId, HTMLAudioElement>> = {};
    const make = (src: string, volume: number): HTMLAudioElement => {
      const audio = new Audio(src);
      audio.preload = "auto";
      audio.volume = volume;
      audio.muted = !soundEnabled;
      return audio;
    };
    created.lead = make(choice.startupSound ?? defaultLeadSrc, choice.leadVolume);
    if (choice.playEffects) {
      (Object.keys(EFFECT_SOUNDS) as Array<keyof typeof EFFECT_SOUNDS>).forEach((id) => {
        created[id] = make(EFFECT_SOUNDS[id].src, EFFECT_SOUNDS[id].volume);
      });
    }
    audioRef.current = created;
    return () => {
      Object.values(created).forEach((audio) => audio.pause());
      audioRef.current = {};
    };
  }, [choice.startupSound, choice.leadVolume, choice.playEffects, soundEnabled]);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSkipHint(true), SKIP_HINT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // Relógio da intro: avança as fases, dispara os sons e encerra nos instantes da coreografia.
  useEffect(() => {
    if (reducedMotion) {
      // Sem movimento (e sem som): mostra só o nome completo e segue.
      const timer = window.setTimeout(handleFinish, REDUCED_MOTION_HOLD_MS);
      return () => window.clearTimeout(timer);
    }
    const timers = SCENE_TIMING.cues.map((cue) =>
      window.setTimeout(() => {
        const audio = audioRef.current[cue.sound];
        if (audio) audio.currentTime = 0;
        audio?.play().catch((err: unknown) => {
          console.warn("Som da intro bloqueado ou pendente de interação:", err);
        });
      }, cue.at * 1000),
    );
    SCENE_TIMING.stages.forEach(({ at, stage: next }) => {
      timers.push(window.setTimeout(() => setStage(next), at * 1000));
    });
    timers.push(window.setTimeout(handleFinish, SCENE_TIMING.endAt * 1000));
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [reducedMotion, handleFinish]);

  // Cada fase dispara as molas correspondentes.
  useEffect(() => {
    if (reducedMotion) return;
    switch (stage) {
      case "plate":
        // brilho que acende e se espalha atrás do logo, enquanto ele sai do desfoque girando
        logoApi.start({ scale: 1, rotateZ: 0, opacity: 1, blur: 0, config: LOGO_SPRING });
        bloomApi.start({
          from: { scale: 0.3, opacity: 0 },
          to: async (next) => {
            await next({ scale: 0.9, opacity: 0.55, config: BLOOM_SPRING });
            await next({ scale: 1.6, opacity: 0, config: { tension: 40, friction: 18 } });
          },
        });
        break;
      case "shock":
        shockApi.start({
          from: { scale: 0.6, opacity: 0.4 },
          to: { scale: 1.4, opacity: 0 },
          config: SHOCK_SPRING,
        });
        // segunda onda, um pouco atrás e mais larga
        shock2Api.start({
          from: { scale: 0.5, opacity: 0.28 },
          to: { scale: 1.9, opacity: 0 },
          delay: 220,
          config: SHOCK_SPRING,
        });
        burstApi.start({ from: { progress: 0 }, to: { progress: 1 }, config: BURST_SPRING });
        break;
      case "shine":
        shineApi.start({ from: { x: -130 }, to: { x: 130 }, config: SHINE_SPRING });
        break;
      case "anticipate":
        // Contração rápida antes do disparo.
        logoApi.start({ scale: 0.94, config: ANTICIPATE_SPRING });
        break;
      case "launch":
        zoomApi.start({ progress: 1, config: ZOOM_SPRING });
        break;
      case "name":
        lettersApi.start({ opacity: 1, y: 0, scale: 1, blur: 0, config: LETTER_SPRING });
        break;
      case "nameOut":
        lettersApi.start({ opacity: 0, y: -10, blur: 4, config: LETTER_OUT_SPRING });
        break;
      default:
        break;
    }
  }, [stage, reducedMotion, logoApi, zoomApi, shockApi, shock2Api, bloomApi, burstApi, shineApi, lettersApi]);

  const onSkipClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      handleFinish();
    },
    [handleFinish],
  );

  return (
    <div
      className="boot-intro fixed inset-0 z-500 overflow-hidden select-none cursor-default"
      data-reduced={reducedMotion ? "true" : undefined}
      data-exiting={isExiting ? "true" : undefined}
      style={{ "--boot-fade-out": `${FADE_OUT_MS}ms` } as React.CSSProperties}
      role="presentation"
      onClick={handleFinish}
    >
      <div className="boot-stage pointer-events-none absolute inset-0 flex items-center justify-center">
        {/* Luz ambiente que se move desde o primeiro quadro (gira e respira devagar) */}
        <div className="boot-glow absolute inset-0" aria-hidden="true" />
        {/* Pontos de luz: sobem quando a logo aparece. Com "screen" só acrescentam luz, sem escurecer. */}
        <video
          src={backdropVideoSrc}
          autoPlay
          loop
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          aria-hidden="true"
          data-playing={reducedMotion ? undefined : "true"}
          className="boot-backdrop absolute inset-0 h-full w-full object-cover mix-blend-screen"
        />

        {/* Brilho atrás do logo: acende quando ele surge e se espalha */}
        <animated.div
          aria-hidden="true"
          className="absolute h-[520px] w-[520px] rounded-full will-change-transform"
          style={{
            opacity: bloom.opacity,
            scale: bloom.scale,
            background: "radial-gradient(closest-side, rgba(255,255,255,0.5), rgba(255,255,255,0.12) 55%, transparent)",
          }}
        />

        {/* Ondas de choque: anéis de borda difusa que abrem e somem (a segunda vem um pouco depois) */}
        <animated.div
          aria-hidden="true"
          className="absolute h-[360px] w-[360px] rounded-full border-2 border-white/60 blur-[6px] will-change-transform"
          style={{ opacity: shock.opacity, scale: shock.scale }}
        />
        <animated.div
          aria-hidden="true"
          className="absolute h-[360px] w-[360px] rounded-full border border-white/40 blur-[4px] will-change-transform"
          style={{ opacity: shock2.opacity, scale: shock2.scale }}
        />

        {/* Faíscas: saem do logo junto da primeira onda e apagam no caminho */}
        {SPARKS.map((spark, i) => (
          <animated.span
            key={i}
            aria-hidden="true"
            className="absolute rounded-full bg-white shadow-[0_0_10px_2px_rgba(255,255,255,0.55)] will-change-transform"
            style={{
              width: spark.size,
              height: spark.size,
              opacity: burst.progress.to((p) => (p < 0.12 ? p / 0.12 : Math.max(0, 1 - (p - 0.12) / 0.75))),
              transform: burst.progress.to((p) => {
                const e = 1 - Math.pow(1 - p, 3);
                return `translate3d(${Math.cos(spark.angle) * spark.distance * e}px, ${Math.sin(spark.angle) * spark.distance * e}px, 0) scale(${1 - 0.6 * p})`;
              }),
            }}
          />
        ))}

        {/* Logo da marca, sem placa: sai do desfoque girando, assenta com overshoot, recebe uma faixa de luz e dispara para a câmera */}
        <animated.div
          aria-hidden="true"
          className="absolute w-[min(22vw,200px)] will-change-transform"
          style={{
            opacity: to([logo.opacity, zoom.progress], (o, p) => o * zoomFade(p)),
            scale: to([logo.scale, zoom.progress], (sc, p) => sc * Math.pow(ZOOM_FACTOR, p)),
            rotateZ: logo.rotateZ,
            filter: logo.blur.to((b) => `blur(${b}px)`),
          }}
        >
          <img
            src={logoSrc}
            alt=""
            draggable={false}
            className="block w-full drop-shadow-[0_12px_28px_rgba(0,0,0,0.6)]"
          />
          {/* faixa de luz: recortada pelo próprio desenho do logo */}
          <div
            className="absolute inset-0 overflow-hidden"
            style={{
              WebkitMask: `url(${logoSrc}) center / contain no-repeat`,
              mask: `url(${logoSrc}) center / contain no-repeat`,
            }}
          >
            <animated.div
              className="absolute inset-y-0 left-0 w-[55%] will-change-transform"
              style={{
                transform: shine.x.to((x) => `translateX(${x}%) skewX(-18deg)`),
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.95), transparent)",
              }}
            />
          </div>
        </animated.div>

        {/* Nome em cascata */}
        <h1
          aria-label={BRAND}
          className="absolute m-0 flex font-bold text-white text-[clamp(3rem,9vw,8rem)] leading-none tracking-[0.14em] antialiased"
          style={{ fontFamily: "'Inter Variable', 'Inter', system-ui, sans-serif" }}
        >
          {letters.map((style, index) => (
            <animated.span
              key={index}
              aria-hidden="true"
              className="inline-block will-change-transform"
              style={{
                opacity: style.opacity,
                y: style.y,
                scale: style.scale,
                filter: style.blur.to((b) => `blur(${b}px)`),
              }}
            >
              {BRAND[index]}
            </animated.span>
          ))}
        </h1>
      </div>

      {showSkipHint && !isExiting && (
        <button
          type="button"
          onClick={onSkipClick}
          className="absolute bottom-8 right-8 md:bottom-10 md:right-12 z-30 group flex items-center gap-2.5 px-4 py-2 rounded-[var(--corner-sm)] border border-white/20 bg-white/4 hover:bg-white/10 hover:border-white/40 transition-[transform,background-color,border-color] duration-[180ms] ease-[var(--ease-out-strong)] active:duration-75 cursor-pointer backdrop-blur-md active:scale-[0.97]"
        >
          <span className="text-[length:var(--step-0)] font-mono tracking-[0.16em] uppercase text-[var(--ink-muted)] group-hover:text-white transition-colors">
            Pular Introdução
          </span>
          <span className="text-xs text-[var(--ink-muted)] group-hover:text-white transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </button>
      )}
    </div>
  );
};

export default GameBootIntro;
