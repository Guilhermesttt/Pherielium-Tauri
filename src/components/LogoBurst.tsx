import React, { useEffect, useRef } from "react";

/**
 * LogoBurst Component
 * Adapted from @radiumcoders/logo-burst (23rd.dev / 21st.dev).
 * Exploding hair-line filament tentacles with tip sparks, mid-glow particles,
 * and idle breathing motion.
 * Enhanced with dynamic origin coordinates (originX, originY).
 */

export interface LogoBurstProps {
  className?: string;
  tentacleCount?: number;
  color?: string; // Hex color or rgba (e.g. "#ff8c42" for Supernova)
  radius?: number; // Outer reach fraction, default 0.65
  duration?: number; // Burst duration in seconds, default 1.4
  originX?: number; // X coordinate on canvas (default: center)
  originY?: number; // Y coordinate on canvas (default: center)
  particleRatio?: number;
  breathe?: boolean;
}

type Tentacle = {
  angle: number;
  length: number;
  width: number;
  alpha: number;
  delay: number;
  grow: number;
  phase: number;
  tip: boolean;
  tipSize: number;
  tipOvershoot: number;
  mids: Array<{ t: number; size: number; alpha: number }>;
};

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function easeOutQuart(t: number) {
  const p = 1 - clamp(t, 0, 1);
  return 1 - p * p * p * p;
}

function parseRgb(color: string): [number, number, number] {
  const raw = color.trim();
  if (raw.startsWith("#")) {
    const hex = raw.slice(1);
    const full =
      hex.length === 3
        ? hex
            .split("")
            .map((c) => c + c)
            .join("")
        : hex.padEnd(6, "0").slice(0, 6);
    const n = Number.parseInt(full, 16);
    if (Number.isNaN(n)) return [255, 140, 66];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }
  const rgb = raw.match(/rgba?\(\s*([.\d]+)\s*,\s*([.\d]+)\s*,\s*([.\d]+)/i);
  if (rgb) {
    return [
      Number.parseFloat(rgb[1]),
      Number.parseFloat(rgb[2]),
      Number.parseFloat(rgb[3]),
    ];
  }
  return [255, 140, 66];
}

function rgba(rgb: [number, number, number], alpha: number) {
  return `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${clamp(alpha, 0, 1)})`;
}

function createTentacles(count: number, seed: number, particleRatio: number): Tentacle[] {
  const rand = mulberry32(seed);
  const tentacles: Tentacle[] = [];

  for (let i = 0; i < count; i++) {
    const base = (i / count) * Math.PI * 2;
    const angle = base + (rand() - 0.5) * (Math.PI * 2 * 0.024);
    const roll = rand();
    const length =
      roll < 0.15
        ? 0.25 + rand() * 0.2
        : roll < 0.75
        ? 0.52 + rand() * 0.35
        : 0.85 + rand() * 0.25;

    const tip = rand() < particleRatio;
    const midCount = rand() < 0.25 ? 2 : rand() < 0.5 ? 1 : 0;
    const mids: Tentacle["mids"] = [];
    for (let m = 0; m < midCount; m++) {
      mids.push({
        t: 0.25 + rand() * 0.55,
        size: 0.6 + rand() * 0.8,
        alpha: 0.35 + rand() * 0.45,
      });
    }

    tentacles.push({
      angle,
      length: clamp(length, 0.18, 1.1),
      width: 0.4 + rand() * 0.9,
      alpha: 0.28 + rand() * 0.6,
      delay: rand() * 0.35 + (i / count) * 0.06,
      grow: 0.6 + rand() * 0.65,
      phase: rand() * Math.PI * 2,
      tip,
      tipSize: 1.0 + rand() * 1.5,
      tipOvershoot: tip && rand() < 0.4 ? 0.025 + rand() * 0.06 : 0,
      mids,
    });
  }

  return tentacles;
}

export const LogoBurst: React.FC<LogoBurstProps> = ({
  className = "",
  tentacleCount = 320,
  color = "#ff8c42",
  radius = 0.65,
  duration = 1.35,
  originX,
  originY,
  particleRatio = 0.7,
  breathe = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let running = true;
    let raf = 0;
    const startedAt = performance.now();
    let settled = false;

    const rgb = parseRgb(color);
    const tentacles = createTentacles(tentacleCount, 42, particleRatio);

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = window.innerWidth;
      const h = window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const paint = (now: number) => {
      if (!running) return;

      const w = window.innerWidth;
      const h = window.innerHeight;
      if (w === 0 || h === 0) {
        raf = requestAnimationFrame(paint);
        return;
      }

      const cx = originX !== undefined ? originX : w / 2;
      const cy = originY !== undefined ? originY : h / 2;
      const maxR = Math.min(w, h) * radius;
      const inner = 30; // Leave space for core logo

      const elapsed = (now - startedAt) / 1000;
      const seconds = now / 1000;
      const breathing = settled && breathe;
      const field = breathing ? Math.sin(seconds * 0.95) * 0.02 : 0;

      ctx.clearRect(0, 0, w, h);
      ctx.lineCap = "round";

      let allDone = true;

      for (let i = 0; i < tentacles.length; i++) {
        const tentacle = tentacles[i];
        const span = duration * tentacle.grow;
        const t = (elapsed - tentacle.delay * duration) / span;
        const p = easeOutQuart(t);

        if (p < 1) allDone = false;

        const line = breathing ? Math.sin(seconds * 1.3 + tentacle.phase) * 0.02 : 0;
        const scale = 1 + field + line;
        const reach = inner + (maxR - inner) * tentacle.length * p * scale;

        if (reach <= inner + 1) continue;

        const fade = breathing
          ? 0.88 + 0.12 * Math.sin(seconds * 0.95 + tentacle.phase * 0.4)
          : 1;

        const cos = Math.cos(tentacle.angle);
        const sin = Math.sin(tentacle.angle);
        const x0 = cx + cos * inner;
        const y0 = cy + sin * inner;
        const x1 = cx + cos * reach;
        const y1 = cy + sin * reach;

        // Filament line
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.strokeStyle = rgba(rgb, tentacle.alpha * (0.6 + p * 0.4) * fade);
        ctx.lineWidth = tentacle.width;
        ctx.stroke();

        // Midpoint energy sparks
        for (const mid of tentacle.mids) {
          if (p < mid.t) continue;
          const mr = inner + (maxR - inner) * tentacle.length * mid.t * scale;
          ctx.beginPath();
          ctx.arc(cx + cos * mr, cy + sin * mr, mid.size, 0, Math.PI * 2);
          ctx.fillStyle = rgba(rgb, mid.alpha * fade);
          ctx.fill();
        }

        // Tip spark
        if (tentacle.tip && p > 0.88) {
          const tipR =
            inner + (maxR - inner) * tentacle.length * (1 + tentacle.tipOvershoot) * scale;
          const appear = clamp((p - 0.88) / 0.12, 0, 1);
          const tipPulse = breathing
            ? 1 + 0.12 * Math.sin(seconds * 1.3 + tentacle.phase)
            : 1;
          ctx.beginPath();
          ctx.arc(cx + cos * tipR, cy + sin * tipR, tentacle.tipSize * tipPulse, 0, Math.PI * 2);
          ctx.fillStyle = rgba([255, 240, 220], 0.85 * appear * fade);
          ctx.shadowColor = rgba(rgb, 0.8);
          ctx.shadowBlur = 6;
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      if (allDone) settled = true;

      raf = requestAnimationFrame(paint);
    };

    raf = requestAnimationFrame(paint);

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [tentacleCount, color, radius, duration, originX, originY, particleRatio, breathe]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none z-10 ${className}`}
    />
  );
};

export default LogoBurst;
