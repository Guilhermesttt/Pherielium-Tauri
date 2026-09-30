import React, { useEffect, useRef } from "react";

export type SingularityState = "dormant" | "feeding" | "critical" | "collapse";

interface SingularityHorizonProps {
  originX?: number;
  originY?: number;
  state?: SingularityState;
  scale?: number;
  className?: string;
}

/**
 * SingularityHorizon Component
 * Inspired by @kedhareswer/singularity-horizon (21st.dev) & VoXelo.
 * A black hole hero featuring:
 *   - Relativistic Doppler-shifted accretion disk in raw WebGL/Canvas
 *   - Einstein photon ring with gravitational light bending
 *   - State machine: "dormant" -> "feeding" -> "critical" -> "collapse"
 *   - Dual polar relativistic light jets during high energy states
 *   - Keplerian matter streams accelerating towards the event horizon
 */
export const SingularityHorizon: React.FC<SingularityHorizonProps> = ({
  originX,
  originY,
  state = "feeding",
  scale = 1.0,
  className = "",
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

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

    // Relativistic accretion particle filaments
    const PARTICLE_COUNT = state === "collapse" ? 180 : state === "critical" ? 140 : 90;
    const particles = Array.from({ length: PARTICLE_COUNT }).map(() => ({
      angle: Math.random() * Math.PI * 2,
      dist: 100 + Math.random() * 320,
      speed: (0.015 + Math.random() * 0.035) * (state === "critical" ? 1.6 : state === "collapse" ? 2.4 : 1.0),
      size: 1 + Math.random() * 2.8,
      alpha: 0.3 + Math.random() * 0.7,
      colorOffset: Math.random(),
    }));

    const render = (now: number) => {
      if (!running) return;

      const w = window.innerWidth;
      const h = window.innerHeight;
      const cx = originX !== undefined ? originX : w / 2;
      const cy = originY !== undefined ? originY : h / 2;

      ctx.clearRect(0, 0, w, h);

      const elapsed = (now - startTime) / 1000;
      const baseScale = scale * Math.min(w, h) * 0.0016;

      ctx.save();
      ctx.translate(cx, cy);

      // State-specific multipliers
      const spinSpeed = state === "collapse" ? 2.8 : state === "critical" ? 1.9 : 1.0;
      const jetLength = state === "collapse" ? 480 : state === "critical" ? 360 : 180;
      const jetAlpha = state === "collapse" ? 0.75 : state === "critical" ? 0.5 : 0.2;

      // ─── 1. POLAR RELATIVISTIC LIGHT JETS (HIGH ENERGY STATES) ───────
      if (jetAlpha > 0) {
        ctx.save();
        // Top and bottom jet cones
        [-1, 1].forEach((dir) => {
          const jetGrad = ctx.createLinearGradient(0, 0, 0, dir * jetLength * baseScale);
          jetGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
          jetGrad.addColorStop(0.2, "rgba(192, 132, 252, 0.7)");
          jetGrad.addColorStop(0.6, "rgba(147, 51, 234, 0.3)");
          jetGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

          ctx.fillStyle = jetGrad;
          ctx.beginPath();
          ctx.moveTo(-12 * baseScale, 0);
          ctx.lineTo(12 * baseScale, 0);
          ctx.lineTo(34 * baseScale, dir * jetLength * baseScale);
          ctx.lineTo(-34 * baseScale, dir * jetLength * baseScale);
          ctx.closePath();
          ctx.fill();
        });
        ctx.restore();
      }

      // ─── 2. GRAVITATIONAL LENSING BACKGROUND GLOW ───────────────────
      const glowRadius = (state === "collapse" ? 380 : 300) * baseScale;
      const outerGlow = ctx.createRadialGradient(0, 0, 40 * baseScale, 0, 0, glowRadius);
      outerGlow.addColorStop(0, "rgba(192, 132, 252, 0.55)");
      outerGlow.addColorStop(0.3, "rgba(147, 51, 234, 0.3)");
      outerGlow.addColorStop(0.7, "rgba(59, 130, 246, 0.12)");
      outerGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = outerGlow;
      ctx.beginPath();
      ctx.arc(0, 0, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      // ─── 3. GRAVITATIONALLY BENT REAR ACCRETION HALO ────────────────
      // In general relativity, photons from behind the black hole curve over the top and bottom
      ctx.save();
      ctx.scale(1, 0.72);
      const rearRadius = 90 * baseScale;
      const rearHalo = ctx.createRadialGradient(0, 0, 50 * baseScale, 0, 0, 180 * baseScale);
      rearHalo.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      rearHalo.addColorStop(0.18, "rgba(216, 180, 254, 0.85)");
      rearHalo.addColorStop(0.48, "rgba(147, 51, 234, 0.45)");
      rearHalo.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.strokeStyle = rearHalo;
      ctx.lineWidth = (state === "collapse" ? 28 : 20) * baseScale;

      // Top arc (bent over horizon)
      ctx.beginPath();
      ctx.arc(0, 0, rearRadius, Math.PI * 0.88, Math.PI * 2.12);
      ctx.stroke();

      // Bottom arc (bent under horizon)
      ctx.beginPath();
      ctx.arc(0, 0, rearRadius, Math.PI * -0.12, Math.PI * 1.12);
      ctx.stroke();
      ctx.restore();

      // ─── 4. PRIMARY ACCRETION DISK (DOPPLER BEAMING ASYMMETRY) ──────
      ctx.save();
      ctx.rotate(-0.28); // Inclination angle
      ctx.scale(2.1, 0.44); // 3D perspective flattening

      // Concentric rings with rotating noise phase
      const ringSteps = state === "collapse" ? 14 : 9;
      for (let i = 0; i < ringSteps; i++) {
        const r = (55 + i * 14) * baseScale;
        const ringGrad = ctx.createLinearGradient(-220 * baseScale, 0, 220 * baseScale, 0);

        // Relativistic Doppler Beaming:
        // Left side moves TOWARDS the observer -> blue-shifted, blazing intense
        // Right side moves AWAY -> red-shifted, dimmer
        ringGrad.addColorStop(0, "rgba(255, 255, 255, 0.98)");
        ringGrad.addColorStop(0.2, "rgba(192, 132, 252, 0.85)");
        ringGrad.addColorStop(0.5, "rgba(147, 51, 234, 0.6)");
        ringGrad.addColorStop(0.75, "rgba(107, 33, 168, 0.35)");
        ringGrad.addColorStop(1, "rgba(59, 7, 100, 0.1)");

        ctx.strokeStyle = ringGrad;
        ctx.lineWidth = (state === "collapse" ? 10 : 7) * baseScale;
        ctx.beginPath();
        ctx.arc(0, 0, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // ─── 5. SWIRLING KEPLERIAN ACCRETION PARTICLES ───────────────────
      for (const p of particles) {
        p.dist -= p.speed * 26 * baseScale * spinSpeed;
        p.angle += (160 / (p.dist + 12)) * 0.045 * spinSpeed;

        if (p.dist < 34 * baseScale) {
          p.dist = (240 + Math.random() * 100) * baseScale;
          p.angle = Math.random() * Math.PI * 2;
        }

        const px = Math.cos(p.angle) * p.dist;
        const py = Math.sin(p.angle) * p.dist * 0.44; // Project onto disk plane

        ctx.beginPath();
        ctx.arc(px, py, p.size * baseScale, 0, Math.PI * 2);
        const pAlpha = Math.min(1, (p.dist / (80 * baseScale)) * p.alpha);
        ctx.fillStyle = p.colorOffset > 0.5
          ? `rgba(240, 245, 255, ${pAlpha})`
          : `rgba(216, 180, 254, ${pAlpha})`;
        ctx.fill();
      }

      // ─── 6. EINSTEIN PHOTON SPHERE RING (INFINITE LIGHT DEFLECTION) ──
      const horizonRadius = (state === "collapse" ? 42 : 36) * baseScale;
      ctx.beginPath();
      ctx.arc(0, 0, horizonRadius + 3.5 * baseScale, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
      ctx.lineWidth = 2.5 * baseScale;
      ctx.shadowColor = "#ffffff";
      ctx.shadowBlur = 24 * baseScale;
      ctx.stroke();
      ctx.shadowBlur = 0;

      // ─── 7. PITCH BLACK EVENT HORIZON (POINT OF NO RETURN) ───────────
      ctx.beginPath();
      ctx.arc(0, 0, horizonRadius, 0, Math.PI * 2);
      ctx.fillStyle = "#000000";
      ctx.fill();

      ctx.restore();

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      running = false;
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [originX, originY, state, scale]);

  return (
    <canvas
      ref={canvasRef}
      className={`pointer-events-none absolute inset-0 z-10 ${className}`}
    />
  );
};

export default SingularityHorizon;
