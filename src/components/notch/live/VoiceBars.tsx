import React, { useEffect, useRef } from "react";
import { subscribeTicker } from "../../../mascot/ticker";

const BARS = 18;
const SAMPLE_EVERY_S = 0.06;

/**
 * Ondas da voz na barra da chamada (como a gravação da ilha dinâmica): cada barra é uma amostra
 * recente do volume do microfone; rolam da direita para a esquerda. `speaking` cobre o navegador,
 * onde o volume real não chega (ondulação sintética enquanto fala).
 */
export const VoiceBars: React.FC<{
  levelRef: { current: number };
  speaking?: boolean;
  /** "r, g, b" das barras */
  rgb?: string;
  height?: number;
}> = ({ levelRef, speaking = false, rgb = "52,211,153", height = 20 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const history = useRef<number[]>(new Array(BARS).fill(0));
  const acc = useRef(0);
  const speakingRef = useRef(speaking);
  speakingRef.current = speaking;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.round(height * dpr);

    return subscribeTicker((dt, now) => {
      acc.current += dt;
      while (acc.current >= SAMPLE_EVERY_S) {
        acc.current -= SAMPLE_EVERY_S;
        const real = levelRef.current;
        const synthetic = speakingRef.current ? 0.35 + 0.35 * Math.abs(Math.sin(now * 0.011) * Math.cos(now * 0.0063)) : 0;
        history.current.push(Math.min(1, Math.max(real * 1.6, synthetic)));
        history.current.shift();
      }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, height);
      const slot = w / BARS;
      const bw = Math.max(2, slot * 0.5);
      for (let i = 0; i < BARS; i++) {
        const level = history.current[i];
        const bh = Math.max(3, level * (height - 2));
        const x = i * slot + (slot - bw) / 2;
        // as mais recentes (direita) brilham mais
        ctx.fillStyle = `rgba(${rgb}, ${(0.35 + 0.6 * (i / BARS)).toFixed(3)})`;
        ctx.beginPath();
        ctx.roundRect(x, (height - bh) / 2, bw, bh, bw / 2);
        ctx.fill();
      }
    });
  }, [levelRef, height, rgb]);

  return <canvas ref={canvasRef} aria-hidden className="block h-5 w-[78px] shrink-0" style={{ height }} />;
};
