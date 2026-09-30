import React, { useEffect, useRef } from "react";

/**
 * BlackHoleEffect Component
 * Inspired by @vgpu/black-hole (21st.dev).
 * Features:
 *   - Relativistic gravitational lensing (warped accretion disk above/below event horizon)
 *   - Keplerian accretion disk with Doppler beaming (approaching side is blazingly bright, receding side is redshifted)
 *   - Sharp photon sphere / Einstein ring
 *   - Swirling gravitational accretion dust particles being sucked into the singularity
 *   - Dynamic origin coordinates (originX, originY)
 */

interface BlackHoleEffectProps {
  className?: string;
  originX?: number;
  originY?: number;
  scale?: number;
}

export const BlackHoleEffect: React.FC<BlackHoleEffectProps> = ({
  className = "",
  originX,
  originY,
  scale = 1.0,
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

    // Particle accretion dust
    const PARTICLE_COUNT = 90;
    const particles = Array.from({ length: PARTICLE_COUNT }).map(() => ({
      angle: Math.random() * Math.PI * 2,
      dist: 120 + Math.random() * 260,
      speed: 0.02 + Math.random() * 0.03,
      size: 1 + Math.random() * 2.2,
      alpha: 0.3 + Math.random() * 0.7,
    }));

    const render = (now: number) => {
      if (!running) return;

      const w = window.innerWidth;
      const h = window.innerHeight;
      const cx = originX !== undefined ? originX : w / 2;
      const cy = originY !== undefined ? originY : h / 2;

      ctx.clearRect(0, 0, w, h);

      const elapsed = (now - startTime) / 1000;
      const rScale = scale * Math.min(w, h) * 0.0016;

      ctx.save();
      ctx.translate(cx, cy);

      // ─── 1. GRAVITATIONAL LENSING BACKGROUND GLOW ───────────────────
      const outerGlow = ctx.createRadialGradient(0, 0, 40 * rScale, 0, 0, 280 * rScale);
      outerGlow.addColorStop(0, "rgba(168, 85, 247, 0.45)");
      outerGlow.addColorStop(0.35, "rgba(139, 92, 246, 0.22)");
      outerGlow.addColorStop(0.7, "rgba(59, 130, 246, 0.08)");
      outerGlow.addColorStop(1, "rgba(0, 0, 0, 0)");
      ctx.fillStyle = outerGlow;
      ctx.beginPath();
      ctx.arc(0, 0, 280 * rScale, 0, Math.PI * 2);
      ctx.fill();

      // ─── 2. WARPED REAR ACCRETION DISK (GRAVITATIONAL LENSING HALO) ──
      // In GR, the back of the disk bends upward and downward over the black hole
      ctx.save();
      ctx.scale(1, 0.75); // Slight perspective tilt
      const haloGrad = ctx.createRadialGradient(0, 0, 55 * rScale, 0, 0, 160 * rScale);
      haloGrad.addColorStop(0, "rgba(255, 255, 255, 0.95)");
      haloGrad.addColorStop(0.2, "rgba(192, 132, 252, 0.85)");
      haloGrad.addColorStop(0.5, "rgba(147, 51, 234, 0.4)");
      haloGrad.addColorStop(1, "rgba(0, 0, 0, 0)");

      ctx.strokeStyle = haloGrad;
      ctx.lineWidth = 18 * rScale;
      ctx.beginPath();
      ctx.arc(0, 0, 85 * rScale, Math.PI * 0.9, Math.PI * 2.1);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(0, 0, 85 * rScale, Math.PI * -0.1, Math.PI * 1.1);
      ctx.stroke();
      ctx.restore();

      // ─── 3. PRIMARY ACCRETION DISK WITH DOPPLER BEAMING ─────────────
      // Approaching side (left) is blueshifted / bright, receding side (right) is dimmer
      ctx.save();
      ctx.rotate(-0.25); // Slight tilt angle
      ctx.scale(1.9, 0.45); // Elliptical disk in 3D perspective

      // Swirling multi-layered accretion ring
      for (let r = 50; r <= 140; r += 12) {
        const ringGrad = ctx.createLinearGradient(-160 * rScale, 0, 160 * rScale, 0);
        // Doppler Beaming asymmetry:
        ringGrad.addColorStop(0, "rgba(240, 245, 255, 0.95)"); // Blazing blue-white approaching side
        ringGrad.addColorStop(0.25, "rgba(192, 132, 252, 0.8)");
        ringGrad.addColorStop(0.5, "rgba(147, 51, 234, 0.65)");
        ringGrad.addColorStop(0.8, "rgba(126, 34, 206, 0.35)"); // Redshifted dimmer receding side
        ringGrad.addColorStop(1, "rgba(88, 28, 135, 0.15)");

        ctx.strokeStyle = ringGrad;
        ctx.lineWidth = 7 * rScale;
        ctx.beginPath();
        ctx.arc(0, 0, r * rScale, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();

      // ─── 4. SWIRLING ACCRETION PARTICLES SPIRALING INWARD ─────────────
      for (const p of particles) {
        // Decrease distance towards event horizon
        p.dist -= p.speed * 25 * rScale;
        p.angle += (140 / (p.dist + 10)) * 0.04; // Faster near center (Keplerian)

        if (p.dist < 32 * rScale) {
          p.dist = 220 * rScale + Math.random() * 80 * rScale;
          p.angle = Math.random() * Math.PI * 2;
        }

        const px = Math.cos(p.angle) * p.dist;
        const py = Math.sin(p.angle) * p.dist * 0.45; // Flattened into disk plane

        ctx.beginPath();
        ctx.arc(px, py, p.size * rScale, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(220, 200, 255, ${p.alpha * 0.85})`;
        ctx.shadowColor = "#c084fc";
        ctx.shadowBlur = 6;
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // ─── 5. PHOTON SPHERE (EINSTEIN RING) ────────────────────────────
      const photonRing = ctx.createRadialGradient(0, 0, 36 * rScale, 0, 0, 48 * rScale);
      photonRing.addColorStop(0, "rgba(0, 0, 0, 1)");
      photonRing.addColorStop(0.4, "rgba(255, 255, 255, 0.98)");
      photonRing.addColorStop(0.7, "rgba(216, 180, 254, 0.85)");
      photonRing.addColorStop(1, "rgba(147, 51, 234, 0)");

      ctx.fillStyle = photonRing;
      ctx.beginPath();
      ctx.arc(0, 0, 48 * rScale, 0, Math.PI * 2);
      ctx.fill();

      // ─── 6. EVENT HORIZON (PITCH BLACK SINGULARITY) ──────────────────
      ctx.fillStyle = "#000000";
      ctx.beginPath();
      ctx.arc(0, 0, 38 * rScale, 0, Math.PI * 2);
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
  }, [originX, originY, scale]);

  return (
    <canvas
      ref={canvasRef}
      className={`fixed inset-0 pointer-events-none z-10 ${className}`}
    />
  );
};

export default BlackHoleEffect;
