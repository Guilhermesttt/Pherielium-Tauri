import React, { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { MascotView } from "../../mascot/MascotView";
import type { NotchConfig } from "../../mascot/notchConfig";

export interface LaunchHandoff {
  /** centro do mascote, em px CSS do overlay */
  x: number;
  y: number;
  /** tamanho em px CSS do overlay */
  size: number;
  id: string;
}

/** Duração máxima do voo: se a animação travar, o mascote some e o notch assume do mesmo jeito. */
const MAX_FLIGHT_MS = 2400;
/** Tamanho do mascote na barra do notch. */
const NOTCH_MASCOT_SIZE = 26;

/** Centro do mascote da barra do notch (ou, sem ele, o topo central da tela). */
function resolveTarget(): { x: number; y: number } {
  const mascot = document.querySelector<HTMLElement>("[data-notch-mascot]")?.getBoundingClientRect();
  if (mascot && mascot.width > 0) return { x: mascot.left + mascot.width / 2, y: mascot.top + mascot.height / 2 };
  const notch = document.querySelector<HTMLElement>("[data-notch-root]")?.getBoundingClientRect();
  if (notch && notch.width > 0) return { x: notch.left + 24, y: notch.top + 20 };
  return { x: window.innerWidth / 2, y: 20 };
}

/**
 * Intro de lançamento, lado do overlay: a janela principal entrega a posição do mascote
 * (já de fone) e ele continua daqui, voando por mola até o lugar dele na barra do notch.
 * Fica por cima de tudo, sem capturar cliques.
 */
export const FlyingMascot: React.FC<{
  handoff: LaunchHandoff;
  config: NotchConfig;
  onDone: () => void;
}> = ({ handoff, config, onDone }) => {
  const doneRef = useRef(false);
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  const target = useMemo(resolveTarget, [handoff.id]);

  useEffect(() => {
    const t = window.setTimeout(finish, MAX_FLIGHT_MS);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [handoff.id]);

  const half = handoff.size / 2;
  return (
    <motion.div
      aria-hidden
      className="pointer-events-none fixed left-0 top-0"
      style={{ zIndex: 10031, width: handoff.size, height: handoff.size, transformOrigin: "50% 50%" }}
      initial={{ x: handoff.x - half, y: handoff.y - half, scale: 1, opacity: 1 }}
      animate={{
        x: target.x - half,
        y: target.y - half,
        scale: NOTCH_MASCOT_SIZE / handoff.size,
        opacity: 1,
      }}
      transition={{ type: "spring", stiffness: 90, damping: 15, mass: 1 }}
      onAnimationComplete={finish}
    >
      <MascotView
        size={handoff.size}
        mood="gaming"
        forceHeadphones
        bodyColor={config.bodyColor}
        shape={config.shape}
        hat={config.hat}
        items={config.items}
      />
    </motion.div>
  );
};
