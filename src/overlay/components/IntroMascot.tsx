import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MascotView } from "../../mascot/MascotView";
import type { NotchConfig } from "../../mascot/notchConfig";
import { announceNotchEvent } from "../../components/notch/notchEvent";

/** Tamanho da Pherie na barra do notch (igual ao FlyingMascot). */
const NOTCH_MASCOT_SIZE = 26;
const SIZE = 170;

type Phase = "hello" | "moving" | "arrived";

/** Centro do mascote do notch (ou, sem ele, o topo central da tela). */
function resolveTarget(): { x: number; y: number } {
  const mascot = document.querySelector<HTMLElement>("[data-notch-mascot]")?.getBoundingClientRect();
  if (mascot && mascot.width > 0) return { x: mascot.left + mascot.width / 2, y: mascot.top + mascot.height / 2 };
  const notch = document.querySelector<HTMLElement>("[data-notch-root]")?.getBoundingClientRect();
  if (notch && notch.width > 0) return { x: notch.left + 24, y: notch.top + 20 };
  return { x: window.innerWidth / 2, y: 20 };
}

/**
 * Abertura da primeira vez: a Pherie aparece na área de trabalho, dá oi, voa até o notch e dá as
 * boas-vindas por lá. A janela do overlay não captura cliques, então é só para assistir.
 */
export const IntroMascot: React.FC<{
  config: NotchConfig;
  notchEnabled: boolean;
  onDone: () => void;
}> = ({ config, notchEnabled, onDone }) => {
  const reduce = useReducedMotion();
  const [phase, setPhase] = useState<Phase>("hello");
  const [waveAt] = useState(() => Date.now() + 700);
  const doneRef = useRef(false);
  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    onDone();
  };

  const start = useMemo(() => ({ x: window.innerWidth / 2, y: window.innerHeight * 0.52 }), []);
  const [target, setTarget] = useState(() => resolveTarget());

  useEffect(() => {
    const t1 = window.setTimeout(() => {
      setTarget(resolveTarget());
      setPhase("moving");
    }, 3000);
    // rede de segurança: nunca prende a abertura
    const t2 = window.setTimeout(finish, 11_000);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const half = SIZE / 2;
  const moving = phase !== "hello";

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0" style={{ zIndex: 10032 }}>
      <motion.div
        className="absolute left-0 top-0"
        style={{ width: SIZE, height: SIZE, transformOrigin: "50% 50%" }}
        initial={{ x: start.x - half, y: start.y - half + 40, scale: reduce ? 1 : 0.2, opacity: 0 }}
        animate={
          moving
            ? { x: target.x - half, y: target.y - half, scale: NOTCH_MASCOT_SIZE / SIZE, opacity: 1 }
            : { x: start.x - half, y: start.y - half, scale: 1, opacity: 1 }
        }
        transition={
          moving
            ? { type: "spring", stiffness: 70, damping: 14, mass: 1.1 }
            : { type: "spring", stiffness: 260, damping: 15 }
        }
        onAnimationComplete={() => {
          if (!moving || phase === "arrived") return;
          setPhase("arrived");
          if (notchEnabled) {
            announceNotchEvent({
              kind: "welcome",
              title: "Bem-vindo ao Pherielium",
              subtitle: "Vou te mostrar como tudo funciona",
            });
          }
          window.setTimeout(finish, notchEnabled ? 1400 : 2600);
        }}
      >
        <MascotView
          size={SIZE}
          mood={moving ? "excited" : "happy"}
          bodyColor={config.bodyColor}
          hat={config.hat}
          items={config.items}
          waveAt={waveAt}
        />
      </motion.div>

      <AnimatePresence>
        {phase === "hello" && (
          <motion.div
            key="hello"
            className="absolute rounded-[22px] rounded-bl-md border border-white/10 bg-[#141416]/95 px-5 py-3 text-white shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl"
            style={{ left: start.x + half - 10, top: start.y - half - 4 }}
            initial={{ opacity: 0, scale: 0.8, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 340, damping: 22, delay: 0.5 }}
          >
            <p className="text-[18px] font-semibold leading-tight">Oi! Eu sou a Pherie</p>
            <p className="mt-0.5 text-[13px] text-white/60">Vou morar aqui em cima, no notch.</p>
          </motion.div>
        )}
        {phase === "arrived" && !notchEnabled && (
          <motion.div
            key="welcome"
            className="absolute left-1/2 top-16 -translate-x-1/2 rounded-full border border-white/10 bg-[#141416]/95 px-5 py-2.5 text-[14px] font-semibold text-white shadow-lg backdrop-blur-xl"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            Bem-vindo ao Pherielium!
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
