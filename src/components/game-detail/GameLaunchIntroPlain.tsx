import React from "react";
import { motion, useReducedMotion } from "framer-motion";

/** Quanto a intro simples toca antes do jogo abrir (ms). */
export const PLAIN_LAUNCH_INTRO_MS = 1800;

interface GameLaunchIntroPlainProps {
  title: string;
  heroImage?: string | null;
  launchingLabel: string;
}

/**
 * Intro de lançamento para quem desligou o notch: o mascote só existe junto do notch (ele voa até
 * o overlay no fim), então aqui a arte do jogo desfoca ao fundo, o título entra e uma linha enche
 * até o jogo abrir. Sem handoff para o overlay.
 */
export const GameLaunchIntroPlain: React.FC<GameLaunchIntroPlainProps> = ({ title, heroImage, launchingLabel }) => {
  const reducedMotion = useReducedMotion();
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden bg-[var(--tone-0)]"
      role="alert"
      aria-label={launchingLabel}
    >
      {heroImage && (
        <motion.img
          src={heroImage}
          alt=""
          initial={{ scale: reducedMotion ? 1.08 : 1.02 }}
          animate={{ scale: 1.1 }}
          transition={{ duration: PLAIN_LAUNCH_INTRO_MS / 1000 + 1, ease: "easeOut" }}
          className="absolute inset-0 h-full w-full object-cover opacity-30 blur-[14px]"
        />
      )}

      <div className="relative z-10 flex w-full max-w-[min(720px,80vw)] flex-col items-center gap-6 text-center">
        <motion.h2
          initial={reducedMotion ? { opacity: 0 } : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="font-display text-[length:var(--step-4)] font-semibold tracking-[-0.03em] text-[var(--ink)]"
        >
          {title}
        </motion.h2>

        <div className="h-[3px] w-full max-w-[320px] overflow-hidden rounded-full bg-[var(--tone-3)]" aria-hidden="true">
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: PLAIN_LAUNCH_INTRO_MS / 1000, ease: "linear" }}
            className="h-full origin-left rounded-full bg-[var(--ink)]"
          />
        </div>

        <p className="text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)]">{launchingLabel}</p>
      </div>
    </motion.div>
  );
};
