import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useLowPerf } from "../PerformanceComponents";

interface LinearProgressProps {
  /** 0–100. `null`/`undefined` = indeterminado (varredura Linear). */
  value?: number | null;
  className?: string;
  trackClassName?: string;
  barClassName?: string;
  label?: string;
}

/**
 * Barra de progresso fina estilo Linear: preenchimento com spring,
 * ponta com glow e modo indeterminado com segmento deslizante.
 * Paleta Orbloom (#D2D2D2 sobre trilha #2A2A2A).
 */
export const LinearProgress: React.FC<LinearProgressProps> = ({
  value = null,
  className = "",
  trackClassName = "",
  barClassName = "",
  label = "Carregando",
}) => {
  const low = useLowPerf();
  const reduceMotion = useReducedMotion();
  const staticFx = low || reduceMotion;
  const determinate = typeof value === "number";
  const pct = determinate ? Math.max(0, Math.min(100, value)) : 0;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={determinate ? Math.round(pct) : undefined}
      className={`h-1 w-full overflow-hidden rounded-full bg-[#2A2A2A] ${trackClassName} ${className}`}
    >
      {determinate ? (
        <motion.div
          className={`h-full rounded-full bg-gradient-to-r from-[#6C6C6C] to-[#D2D2D2] shadow-[0_0_8px_rgba(210,210,210,0.55)] ${barClassName}`}
          initial={false}
          animate={{ width: `${pct}%` }}
          transition={
            staticFx
              ? { duration: 0 }
              : { type: "spring", stiffness: 90, damping: 22 }
          }
        />
      ) : staticFx ? (
        <div className={`h-full w-2/5 rounded-full bg-[#6C6C6C] ${barClassName}`} />
      ) : (
        <motion.div
          className={`h-full w-1/3 rounded-full bg-gradient-to-r from-transparent via-[#D2D2D2] to-transparent shadow-[0_0_10px_rgba(210,210,210,0.5)] ${barClassName}`}
          animate={{ x: ["-110%", "320%"] }}
          transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
};

export default LinearProgress;
