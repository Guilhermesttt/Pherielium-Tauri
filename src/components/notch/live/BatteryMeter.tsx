import React from "react";
import { motion } from "framer-motion";
import { Zap } from "../../../design-system/sf-symbols/lucideCompat";
import { batteryTone, clampBattery } from "./battery";

/**
 * Barra de carga estilo ilha dinâmica: trilho escuro, preenchimento colorido com brilho e a
 * porcentagem numa pílula na ponta (com o raio quando está carregando).
 */
export const BatteryMeter: React.FC<{ level: number; charging?: boolean; approximate?: boolean; width?: number }> = ({ level, charging = false, approximate = false, width = 74 }) => {
  const pct = clampBattery(level);
  const { rgb, critical } = batteryTone(pct, charging);
  return (
    <div className="flex shrink-0 items-center" role="img" aria-label={`Bateria ${approximate ? "aproximadamente " : ""}${pct}%`}>
      <div className="relative h-[8px] rounded-full bg-white/[0.14]" style={{ width }}>
        <motion.span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ backgroundColor: `rgb(${rgb})`, boxShadow: `0 0 10px rgba(${rgb},0.75)` }}
          initial={{ width: 0 }}
          animate={{ width: `${Math.max(6, pct)}%` }}
          transition={{ type: "spring", stiffness: 140, damping: 20, delay: 0.15 }}
        />
        <motion.span
          className="absolute top-1/2 flex h-[18px] -translate-y-1/2 items-center gap-0.5 rounded-full px-1.5 text-[10px] font-bold tabular-nums text-black"
          style={{ backgroundColor: `rgb(${rgb})`, boxShadow: `0 0 12px rgba(${rgb},0.8)` }}
          initial={{ left: 0 }}
          animate={{ left: `calc(${Math.max(6, pct)}% - 18px)`, scale: critical ? [1, 1.12, 1] : 1 }}
          transition={{ left: { type: "spring", stiffness: 140, damping: 20, delay: 0.15 }, scale: { duration: 0.7, repeat: critical ? 3 : 0 } }}
        >
          {charging && <Zap size={9} className="fill-current" />}
          {approximate ? "≈" : ""}
          {pct}
        </motion.span>
      </div>
    </div>
  );
};
