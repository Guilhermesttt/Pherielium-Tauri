import React, { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { MascotView } from "../../mascot/MascotView";
import { useNotchConfig } from "../../mascot/useNotchConfig";
import { hasTauriRuntime } from "../../mascot/useVoiceLevel";
import { playNotchSound, type NotchSoundId } from "../notch/notchSounds";

/** Marcos da sequência (ms desde a montagem). Cabem folgados nos 3s mínimos da tela de lançamento. */
export const LAUNCH_INTRO_TIMELINE = {
  /** os fones começam a descer */
  headphonesDrop: 750,
  /** som do encaixe (a mola assenta ~250ms depois da queda) */
  headphonesSnap: 1000,
  /** o hub começa a se recolher e o mascote é entregue ao overlay */
  fold: 1900,
  /** o jogo só é iniciado aqui: antes disso ele tomaria o primeiro plano e cortaria a intro */
  launch: 2500,
  /** o launcher esconde (depois do mascote já estar voando no overlay) */
  hideHub: 2600,
} as const;

export interface GameLaunchIntroProps {
  title: string;
  heroImage?: string | null;
  launchingLabel: string;
  /** O launcher vai esconder depois da intro (preferência "fechar ao iniciar"). */
  willHideHub: boolean;
  soundEnabled: boolean;
  /** volume dos efeitos 0..1 */
  effectsVolume: number;
  /** Esconde a janela principal (chamado só quando `willHideHub`). */
  onHideHub: () => void;
}

/**
 * Tela de lançamento do jogo: o mascote aparece, COLOCA OS FONES (descem e encaixam com
 * um clique), o hub se recolhe em direção ao topo e o mascote é entregue ao overlay, que
 * o faz voar até o notch. Clique para pular. Roda na janela principal; o voo acontece no
 * overlay (outra janela, transparente e por cima do jogo) via `overlay_launch_handoff`.
 */
export const GameLaunchIntro: React.FC<GameLaunchIntroProps> = ({
  title,
  heroImage,
  launchingLabel,
  willHideHub,
  soundEnabled,
  effectsVolume,
  onHideHub,
}) => {
  const config = useNotchConfig();
  const [dropped, setDropped] = useState(false);
  const [folding, setFolding] = useState(false);
  const [mascotHidden, setMascotHidden] = useState(false);
  const mascotRef = useRef<HTMLDivElement>(null);
  const handedOff = useRef(false);

  // valores mais recentes sem reiniciar a linha do tempo
  const live = useRef({ willHideHub, soundEnabled, effectsVolume, onHideHub });
  live.current = { willHideHub, soundEnabled, effectsVolume, onHideHub };

  const sound = useCallback((id: NotchSoundId) => {
    if (live.current.soundEnabled) playNotchSound(id, live.current.effectsVolume);
  }, []);

  const startFold = useCallback(() => {
    if (handedOff.current) return;
    handedOff.current = true;
    setFolding(true);
    sound("hubFold");

    if (!live.current.willHideHub) return; // o hub fica: a intro só esmaece

    const rect = mascotRef.current?.getBoundingClientRect();
    if (rect && hasTauriRuntime()) {
      void import("@tauri-apps/api/core")
        .then(({ invoke }) =>
          invoke("overlay_launch_handoff", {
            payload: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, size: rect.width },
          }),
        )
        // o overlay já está desenhando o mascote no mesmo ponto: some o daqui
        .then(() => window.setTimeout(() => setMascotHidden(true), 120))
        .catch(() => undefined);
    }
    window.setTimeout(() => live.current.onHideHub(), LAUNCH_INTRO_TIMELINE.hideHub - LAUNCH_INTRO_TIMELINE.fold);
  }, [sound]);

  useEffect(() => {
    const timers = [
      window.setTimeout(() => setDropped(true), LAUNCH_INTRO_TIMELINE.headphonesDrop),
      window.setTimeout(() => sound("headphonesSnap"), LAUNCH_INTRO_TIMELINE.headphonesSnap),
      window.setTimeout(startFold, LAUNCH_INTRO_TIMELINE.fold),
    ];
    return () => timers.forEach(window.clearTimeout);
  }, [sound, startFold]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={folding ? { opacity: 0, scale: 0.04, y: "-47vh" } : { opacity: 1, scale: 1, y: 0 }}
      transition={folding ? { duration: 0.62, ease: [0.65, 0, 0.35, 1] } : { duration: 0.3 }}
      onClick={startFold}
      className="fixed inset-0 z-[200] flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-black"
      role="alert"
      aria-label="Iniciando o jogo"
    >
      {heroImage ? (
        <motion.div
          initial={{ scale: 1.05 }}
          animate={{ scale: 1.15 }}
          transition={{ duration: 8, ease: "easeOut" }}
          className="absolute inset-0"
        >
          <img src={heroImage} alt="" className="h-full w-full object-cover blur-[12px] brightness-[0.22]" loading="eager" />
        </motion.div>
      ) : null}

      <div className="relative z-10 flex flex-col items-center text-center">
        <motion.div
          ref={mascotRef}
          initial={{ scale: 0.5, opacity: 0, y: 24 }}
          animate={{ scale: 1, opacity: mascotHidden ? 0 : 1, y: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 18, opacity: { duration: mascotHidden ? 0.05 : 0.3 } }}
          className="mb-8"
          style={{ width: 176, height: 176 }}
        >
          <MascotView
            size={176}
            mood="gaming"
            forceHeadphones
            headphonesDrop={dropped}
            bodyColor={config.bodyColor}
            shape={config.shape}
            ears={config.ears}
            items={config.items}
          />
        </motion.div>

        <h2 className="mb-3 font-display text-3xl font-light uppercase tracking-[0.25em] text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.4)] md:text-4xl">
          {title}
        </h2>
        <p className="animate-pulse text-[10px] font-bold uppercase tracking-[0.4em] text-white/40">{launchingLabel}</p>
        <p className="mt-8 text-[10px] uppercase tracking-[0.3em] text-white/25">Clique para pular</p>
      </div>
    </motion.div>
  );
};
