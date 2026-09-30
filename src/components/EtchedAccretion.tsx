import React, { useEffect, useRef } from "react";

interface EtchedAccretionProps {
  className?: string;
  originX?: number;
  originY?: number;
  scale?: number;
  crimsonIntensity?: number;
  interactive?: boolean;
}

/**
 * EtchedAccretion Component
 * Inspired by @kedhareswer/etched-accretion (21st.dev).
 * Features:
 *   - Engraved black hole aesthetic with banded accretion disc
 *   - Crimson and silver line work with topographic contour nebulae
 *   - Relativistic light jets etched along the vertical axis
 *   - Mouse-responsive orbital drift and subtle breathing flare
 */
export const EtchedAccretion: React.FC<EtchedAccretionProps> = ({
  className = "",
  originX,
  originY,
  scale = 1.0,
  crimsonIntensity = 0.85,
  interactive = true,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animId = 0;
    let running = true;
    const startTime = performance.now();

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

    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      const w = window.innerWidth;
      const h = window.innerHeight;
      mouseRef.current.targetX = (e.clientX - w / 2) * 0.05;
      mouseRef.current.targetY = (e.clientY - h / 2) * 0.05;
    };

    if (interactive) {
      window.addEventListener("mousemove", handleMouseMove);
    }

    // Pre-generate topographic contour waves
    const CONTOUR_COUNT = 18;
    const contours = Array.from({ length: CONTOUR_COUNT }).map((_, i) => ({
      radius: 90 + i * 22,
      baseSpeed: (i % 2 === 0 ? 1 : -1) * (0.003 + (i / CONTOUR_COUNT) * 0.004),
      eccentricity: 0.35 + (i / CONTOUR_COUNT) * 0.25,
      tilt: -0.3 + (i * 0.02),
      dashPattern: i % 3 === 0 ? [8, 6, 2, 6] : i % 2 === 0 ? [14, 8] : [],
      isCrimson: i % 2 === 0,
      opacity: 0.25 + (1 - i / CONTOUR_COUNT) * 0.65,
    }));

    const render = (now: number) => {
      if (!running) return;

      const w = window.innerWidth;
      const h = window.innerHeight;
      const cx = (originX !== undefined ? originX : w / 2) + mouseRef.current.x;
      const cy = (originY !== undefined ? originY : h / 2) + mouseRef.current.y;

      // Smooth pointer interpolation
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.04;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.04;

      ctx.clearRect(0, 0, w, h);

      const elapsed = (now - startTime) / 1000;
      const baseScale = scale * Math.min(w, h) * 0.0015;

      ctx.save();
      ctx.translate(cx, cy);

      // ─── 1. CRIMSON CORE RADIANCE ──────────────────────────────────
      const coreGlow = ctx.createRadialGradient(0, 0, 20 * baseScale, 0, 0, 260 * baseScale);
      coreGlow.addColorStop(0, `rgba(239, 68, 68, ${0.45 * crimsonIntensity})`);
      coreGlow.addColorStop(0.35, `rgba(185, 28, 28, ${0.2 * crimsonIntensity})`);
      coreGlow.addColorStop(0.7, "rgba(20, 20, 25, 0.05)");
      coreGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = coreGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 260 * baseScale, 0, Math.PI * 2);
      ctx.fill();

      // ─── 2. ETCHED VERTICAL LIGHT JETS (SILVER & CRIMSON) ───────────
      [-1, 1].forEach((dir) => {
        const jetLength = 340 * baseScale;
        const jetGrad = ctx.createLinearGradient(0, 0, 0, dir * jetLength);
        jetGrad.addColorStop(0, "rgba(255, 255, 255, 0.85)");
        jetGrad.addColorStop(0.3, `rgba(239, 68, 68, ${0.5 * crimsonIntensity})`);
        jetGrad.addColorStop(0.7, "rgba(212, 212, 216, 0.15)");
        jetGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.strokeStyle = jetGrad;
        ctx.lineWidth = 1.5 * baseScale;
        ctx.setLineDash([12, 6]);

        // Central jet needle
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(0, dir * jetLength);
        ctx.stroke();

        // Flanking contour lines for relativistic ray fan
        [-1, 1].forEach((sign) => {
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(sign * 28 * baseScale, dir * jetLength);
          ctx.stroke();
        });
        ctx.setLineDash([]);
      });

      // ─── 3. BANDED ETCHED ACCRETION DISC (CONTOURS) ─────────────────
      contours.forEach((c) => {
        const currentRot = elapsed * c.baseSpeed;
        const r = c.radius * baseScale;

        ctx.save();
        ctx.rotate(c.tilt + currentRot * 0.1);
        ctx.scale(1.8, c.eccentricity);

        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);

        if (c.isCrimson) {
          ctx.strokeStyle = `rgba(239, 68, 68, ${c.opacity * crimsonIntensity})`;
          ctx.shadowColor = "#ef4444";
          ctx.shadowBlur = 6 * baseScale;
        } else {
          ctx.strokeStyle = `rgba(255, 255, 255, ${c.opacity * 0.75})`;
          ctx.shadowColor = "#ffffff";
          ctx.shadowBlur = 4 * baseScale;
        }

        ctx.lineWidth = 1.2 * baseScale;
        if (c.dashPattern.length > 0) {
          ctx.setLineDash(c.dashPattern.map((v) => v * baseScale));
        } else {
          ctx.setLineDash([]);
        }

        ctx.stroke();
        ctx.restore();
      });

      // ─── 4. ETCHED TOPOGRAPHIC NEBULA CONTOURS ──────────────────────
      const waveCount = 8;
      for (let wIdx = 0; wIdx < waveCount; wIdx++) {
        const angleOffset = (wIdx / waveCount) * Math.PI * 2 + elapsed * 0.08;
        const dist = (140 + Math.sin(elapsed * 0.4 + wIdx) * 35) * baseScale;
        const nx = Math.cos(angleOffset) * dist * 1.6;
        const ny = Math.sin(angleOffset) * dist * 0.55;

        ctx.beginPath();
        ctx.arc(nx, ny, (4 + Math.sin(elapsed + wIdx) * 2) * baseScale, 0, Math.PI * 2);
        ctx.fillStyle = wIdx % 2 === 0
          ? `rgba(239, 68, 68, ${0.7 * crimsonIntensity})`
          : "rgba(255, 255, 255, 0.65)";
        ctx.fill();
      }

      // ─── 5. INNER PHOTON SPHERE & BLACK VOID CORE ───────────────────
      const innerCoreRadius = 38 * baseScale;

      // Radiant white Einstein photon ring
      ctx.beginPath();
      ctx.arc(0, 0, innerCoreRadius + 2.5 * baseScale, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
      ctx.lineWidth = 2 * baseScale;
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 16 * baseScale;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // Event horizon void
      ctx.beginPath();
      ctx.arc(0, 0, innerCoreRadius, 0, Math.PI * 2);
      ctx.fillStyle = "#060608";
      ctx.fill();

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      running = false;
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
      if (interactive) {
        window.removeEventListener("mousemove", handleMouseMove);
      }
    };
  }, [originX, originY, scale, crimsonIntensity, interactive]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 z-0 ${className}`}
    />
  );
};

export default EtchedAccretion;
