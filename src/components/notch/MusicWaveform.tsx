import React, { useEffect, useRef } from "react";
import { isAudioLive, type AudioReactive } from "../../mascot/headbang";
import { subscribeTicker } from "../../mascot/ticker";

const BARS = 56;
/** Uma amostra nova a cada tanto: o desenho rola da direita para a esquerda. */
const SAMPLE_EVERY_S = 0.05;
/** O pico de referência esquece em ~4 s: o volume do player não achata as barras. */
const PEAK_DECAY_S = 4;
const REST = 0.07;

/**
 * Forma de onda do áudio do PC para o rodapé do cartão de música. Cada barra é uma amostra recente
 * do nível, medida contra o pico recente (independe do volume). Sem áudio ao vivo, as barras
 * recolhem para pontinhos.
 */
export const MusicWaveform: React.FC<{
  playing: boolean;
  audioRef?: { current: AudioReactive };
  /** "r, g, b" da cor das barras */
  rgb?: string;
  height?: number;
}> = ({ playing, audioRef, rgb = "244,114,182", height = 34 }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const history = useRef<number[]>(new Array(BARS).fill(REST));
  const shown = useRef<number[]>(new Array(BARS).fill(REST));
  const peak = useRef(0.02);
  const acc = useRef(0);

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
      const audio = audioRef?.current;
      const live = Boolean(playing && audio && isAudioLive(audio, now));
      acc.current += dt;
      while (acc.current >= SAMPLE_EVERY_S) {
        acc.current -= SAMPLE_EVERY_S;
        let level = REST;
        if (live && audio) {
          const raw = audio.rms * 0.55 + ((audio.low + audio.mid + audio.high) / 3) * 0.45;
          peak.current = Math.max(peak.current * Math.exp(-SAMPLE_EVERY_S / PEAK_DECAY_S), raw, 0.02);
          level = Math.max(REST, Math.min(1, Math.pow(raw / peak.current, 1.25)));
        }
        history.current.push(level);
        history.current.shift();
      }
      const k = 1 - Math.exp(-26 * Math.max(0.001, dt));
      const hist = history.current;
      const cur = shown.current;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, height);
      const slot = w / BARS;
      const bw = Math.max(2, slot * 0.46);
      for (let i = 0; i < BARS; i++) {
        cur[i] += (hist[i] - cur[i]) * k;
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
  }, [audioRef, height, playing, rgb]);

  return <canvas ref={canvasRef} aria-hidden className="block w-full" style={{ height }} />;
};
