import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import lottie, { type AnimationItem } from "lottie-web";
import { setLauncherInputLocked } from "../utils/launcherInputLock";
import type { SoundTheme } from "../context/PreferencesContext";
import { resolveBootIntro } from "./boot-intro/bootIntroTheme";
import { backdropOpacity } from "./boot-intro/bootIntroBackdrop";
import backdropVideoSrc from "../assets/karavanbraam_pindown.io.webm";
import { SCENE_FPS, SCENE_TIMING, STARTUP_SOUNDS, loadBootScene, type SceneSoundId } from "./boot-intro/bootIntroScenes";
import swooshSoftSrc from "../sounds/Pherielium Intro/swoosh-soft.mp3";
import swooshAir1Src from "../sounds/Pherielium Intro/swoosh-air-1.mp3";
import swooshAir2Src from "../sounds/Pherielium Intro/swoosh-air-2.mp3";
import defaultLeadSrc from "../sounds/Phelierium Default/Intro_Music.mp3";

/**
 * Intro de abertura: uma cena Lottie (logo que se forma, atravessa a tela e vira o nome da marca)
 * escolhida pelo tema sonoro. O tema do Xbox tem a sua cena (versão em verde); os demais usam a
 * padrão. O som de partida é o som de abertura do console do tema, se o arquivo existir em
 * `src/sounds/<pasta do tema>/startup.*`, ou a música de abertura padrão. Os efeitos entram nos
 * momentos-chave da cena (`SCENE_TIMING`).
 *
 * O fundo de pontos que antes era uma imagem estática dentro da cena é o vídeo de fundo padrão
 * (campo de estrelas), por cima da cena com opacidade baixa e o mesmo ritmo de aparecer/sumir.
 *
 * A animação não carrega áudio: toda a parte sonora é tocada por aqui.
 * Qualquer tecla ou clique pula; com "reduzir movimento", mostra só o quadro final.
 */

interface GameBootIntroProps {
  onFinish?: () => void;
  /** Toca o áudio da intro (preferência `gameBootIntroSoundEnabled`). */
  soundEnabled?: boolean;
  /** Tema sonoro escolhido: decide a cena e o som de partida. */
  soundTheme?: SoundTheme;
}

const BG = "#000000";
const FADE_OUT_MS = 500;
const END_HOLD_MS = 300;
const REDUCED_MOTION_HOLD_MS = 1200;
const SKIP_HINT_DELAY_MS = 1200;

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
  const timing = SCENE_TIMING[choice.scene];

  const containerRef = useRef<HTMLDivElement | null>(null);
  const animationRef = useRef<AnimationItem | null>(null);
  const backdropRef = useRef<HTMLVideoElement | null>(null);
  const audioRef = useRef<Partial<Record<SceneSoundId, HTMLAudioElement>>>({});
  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  const [sceneData, setSceneData] = useState<unknown>(null);
  const [isExiting, setIsExiting] = useState(false);
  const [showSkipHint, setShowSkipHint] = useState(false);
  const reducedMotion = useMemo(() => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false, []);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  // Estável de propósito: o efeito de animação não pode reiniciar se `onFinish` mudar.
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

  // A cena já deve estar no cache (carregada na tela de carregamento); se não, baixa agora.
  // Se falhar, a intro é pulada em vez de travar o boot.
  useEffect(() => {
    let cancelled = false;
    loadBootScene(choice.scene)
      .then((data) => {
        // O lottie-web altera o objeto que recebe; cada exibição usa a sua cópia.
        if (!cancelled) setSceneData(structuredClone(data));
      })
      .catch((err: unknown) => {
        console.warn("Cena de abertura não carregou; pulando a intro.", err);
        if (!cancelled) handleFinish();
      });
    return () => {
      cancelled = true;
    };
  }, [choice.scene, handleFinish]);

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

  // Cria o player quando a cena chega. Usa o lottie-web direto (o componente de `lottie-react`
  // não expõe o quadro atual e tem problema de importação com o empacotador).
  useEffect(() => {
    const container = containerRef.current;
    if (!sceneData || !container) return;
    const animation = lottie.loadAnimation({
      container,
      renderer: "svg",
      loop: false,
      autoplay: !reducedMotion,
      animationData: sceneData,
      rendererSettings: { preserveAspectRatio: "xMidYMid slice" },
    });
    animationRef.current = animation;
    return () => {
      animationRef.current = null;
      animation.destroy();
    };
  }, [sceneData, reducedMotion]);

  // Relógio da intro: acompanha o quadro atual da animação para disparar os sons e encerrar.
  useEffect(() => {
    if (!sceneData) return;

    if (reducedMotion) {
      // Sem movimento (e sem som): mostra só o quadro mais completo e segue.
      animationRef.current?.goToAndStop(timing.restFrame * SCENE_FPS, true);
      if (backdropRef.current) backdropRef.current.style.opacity = String(backdropOpacity(timing.restFrame));
      const timer = window.setTimeout(handleFinish, REDUCED_MOTION_HOLD_MS);
      return () => window.clearTimeout(timer);
    }

    let rafId = 0;
    let nextCue = 0;
    let endTimer: number | null = null;
    const tick = (): void => {
      const item = animationRef.current;
      if (item) {
        const t = item.currentFrame / SCENE_FPS;
        if (backdropRef.current) backdropRef.current.style.opacity = String(backdropOpacity(t));
        while (nextCue < timing.cues.length && timing.cues[nextCue].at <= t) {
          const audio = audioRef.current[timing.cues[nextCue].sound];
          if (audio) audio.currentTime = 0;
          audio?.play().catch((err: unknown) => {
            console.warn("Som da intro bloqueado ou pendente de interação:", err);
          });
          nextCue += 1;
        }
        if (t >= timing.endAt && endTimer === null) {
          endTimer = window.setTimeout(handleFinish, END_HOLD_MS);
        }
      }
      rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafId);
      if (endTimer !== null) window.clearTimeout(endTimer);
    };
  }, [sceneData, reducedMotion, timing, handleFinish]);

  const onSkipClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      handleFinish();
    },
    [handleFinish],
  );

  return (
    <div
      className="fixed inset-0 z-500 overflow-hidden select-none cursor-default"
      style={{
        backgroundColor: BG,
        opacity: isExiting ? 0 : 1,
        transition: `opacity ${FADE_OUT_MS}ms cubic-bezier(0.65, 0, 0.25, 1)`,
      }}
      role="presentation"
      onClick={handleFinish}
    >
      <div ref={containerRef} className="pointer-events-none absolute inset-0 h-full w-full" />
      {/* Fica acima da cena para não depender do fundo opaco dela; com 15% de opacidade e "screen"
          só acrescenta os pontos de luz, inclusive sobre o logo, sem escurecer nada. */}
      <video
        ref={backdropRef}
        src={backdropVideoSrc}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        disablePictureInPicture
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 h-full w-full object-cover mix-blend-screen"
        style={{ opacity: 0 }}
      />

      {showSkipHint && !isExiting && (
        <button
          type="button"
          onClick={onSkipClick}
          className="absolute bottom-8 right-8 md:bottom-10 md:right-12 z-30 group flex items-center gap-2.5 px-4 py-2 rounded-[var(--corner-sm)] border border-white/20 bg-white/4 hover:bg-white/10 hover:border-white/40 transition-all duration-200 cursor-pointer backdrop-blur-md active:scale-95"
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
