import React, { useEffect, useRef } from "react";
import { subscribeTicker } from "../../mascot/ticker";

const BARS = 56;
const REST = 0.07;

/** Nível sintético da barra `i` no tempo `t` (s): ondas que rolam, sem depender do som. */
export function waveLevel(i: number, t: number): number {
  const v =
    0.5 +
    0.28 * Math.sin(i * 0.38 - t * 2.6) +
    0.16 * Math.sin(i * 0.93 + t * 3.7) +
    0.1 * Math.sin(i * 1.7 - t * 5.1);
  return Math.max(REST, Math.min(1, v));
}

/**
 * Forma de onda do rodapé do cartão de música: só animação (não segue o som). Tocando, as barras
 * ondulam; pausado, recolhem para pontinhos.
 */
export const MusicWaveform: React.FC<{
  playing: boolean;
  /** "r, g, b" da cor das barras */
  rgb?: string;
  height?: number;
}> = ({ playing, rgb = "244,114,182", height = 34 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const shown = useRef<number[]>(new Array(BARS).fill(REST));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    let w = 0;
    const fit = () => {
      w = canvas.clientWidth;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.round(height * dpr);
    };
    fit();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(fit) : null;
    ro?.observe(canvas);

    const unsubscribe = subscribeTicker((dt, now) => {
      const t = now / 1000;
      const k = 1 - Math.exp(-14 * Math.max(0.001, dt));
      const cur = shown.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, height);
      const slot = w / BARS;
      const bw = Math.max(2, slot * 0.46);
      for (let i = 0; i < BARS; i++) {
        cur[i] += ((playing ? waveLevel(i, t) : REST) - cur[i]) * k;
        // mais forte no meio, esmaecendo nas pontas (como a referência)
        const edge = Math.sin((Math.PI * (i + 0.5)) / BARS);
        const bh = Math.max(3, cur[i] * (height - 4));
        const x = i * slot + (slot - bw) / 2;
        ctx.fillStyle = `rgba(${rgb}, ${(0.28 + 0.62 * edge).toFixed(3)})`;
        ctx.beginPath();
        ctx.roundRect(x, height - bh, bw, bh, bw / 2);
        ctx.fill();
      }
    });
    return () => {
      unsubscribe();
      ro?.disconnect();
    };
  }, [height, playing, rgb]);

  return <canvas ref={canvasRef} aria-hidden className="block w-full" style={{ height }} />;
};
