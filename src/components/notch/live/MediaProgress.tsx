import React, { useEffect, useRef } from "react";
import { subscribeTicker } from "../../../mascot/ticker";
import { currentPosition, formatClock, progressFraction, type MediaTimeline } from "./progressMath";

/**
 * Barra de progresso da música (como o Now Playing da ilha dinâmica): tempo decorrido à esquerda,
 * restante (−m:ss) à direita. Lê a linha do tempo de uma ref e anda sozinha entre as consultas
 * (sem re-render do notch).
 */
export const MediaProgress: React.FC<{
  timelineRef: { current: MediaTimeline | null };
  /** "r, g, b" do preenchimento */
  rgb?: string;
}> = ({ timelineRef, rgb = "244,114,182" }) => {
  const fillRef = useRef<HTMLSpanElement | null>(null);
  const leftRef = useRef<HTMLSpanElement | null>(null);
  const rightRef = useRef<HTMLSpanElement | null>(null);
  const lastText = useRef("");

  useEffect(
    () =>
      subscribeTicker((_dt, _now) => {
        const t = timelineRef.current;
        const now = Date.now();
        const frac = t ? progressFraction(t, now) : 0;
        if (fillRef.current) fillRef.current.style.width = `${(frac * 100).toFixed(2)}%`;
        const pos = t ? currentPosition(t, now) : 0;
        const left = t ? formatClock(pos) : "--:--";
        const right = t ? `−${formatClock(t.durationSeconds - pos)}` : "--:--";
        const key = left + right;
        if (key !== lastText.current) {
          lastText.current = key;
          if (leftRef.current) leftRef.current.textContent = left;
          if (rightRef.current) rightRef.current.textContent = right;
        }
      }),
    [timelineRef],
  );

  return (
    <div className="w-full" aria-hidden>
      <div className="h-[5px] w-full overflow-hidden rounded-full bg-white/[0.12]">
        <span ref={fillRef} className="block h-full rounded-full" style={{ width: "0%", backgroundColor: `rgb(${rgb})` }} />
      </div>
      <div className="mt-1.5 flex justify-between text-[10.5px] font-medium tabular-nums text-white/45">
        <span ref={leftRef}>--:--</span>
        <span ref={rightRef}>--:--</span>
      </div>
    </div>
  );
};
