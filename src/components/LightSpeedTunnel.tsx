import React, { useEffect, useRef } from "react";

/**
 * LightSpeedTunnel Component
 * Inspired by @rahil1202/light-speed (21st.dev).
 * A lightweight, GPU-accelerated 3D starfield / warp-drive tunnel.
 * 
 * Features:
 *   - Idle mode: gentle, ambient deep-space particle drift.
 *   - Warp mode (on hover / interaction with logo): stars accelerate into relativistic
 *     light-speed streaks radiating outward from the logo's exact position.
 *   - Dynamic origin (cx, cy) following the logo.
 */

export interface LightSpeedTunnelProps {
  className?: string;
  isWarping?: boolean; // Set to true on logo hover/interaction
  originX?: number; // Center of the warp tunnel (default: screen center or logo pos)
  originY?: number;
  starCount?: number;
  baseSpeed?: number;
  warpSpeed?: number;
  color?: string; // Streak tint
}

interface Star {
  x: number;
  y: number;
  z: number;
  prevZ: number;
  size: number;
  color: string;
}

const STAR_COLORS = [
  "rgba(255, 255, 255, 0.95)",
  "rgba(224, 242, 254, 0.9)", // Light cyan
  "rgba(216, 180, 254, 0.85)", // Light violet
  "rgba(254, 240, 138, 0.8)",  // Stellar gold
];

export const LightSpeedTunnel: React.FC<LightSpeedTunnelProps> = ({
  className = "",
  isWarping = false,
  originX,
  originY,
  starCount = 420,
  baseSpeed = 2.0,
  warpSpeed = 38.0,
  color,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const currentSpeedRef = useRef(baseSpeed);
  const targetSpeedRef = useRef(baseSpeed);

  useEffect(() => {
    targetSpeedRef.current = isWarping ? warpSpeed : baseSpeed;
  }, [isWarping, warpSpeed, baseSpeed]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    let animId = 0;
    let running = true;
    const maxDepth = 1200;
    const fov = 340;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    // Initialize 3D stars
    const stars: Star[] = Array.from({ length: starCount }).map(() => {
      const z = Math.random() * maxDepth + 1;
      return {
        x: (Math.random() - 0.5) * 2000,
        y: (Math.random() - 0.5) * 2000,
        z,
        prevZ: z,
        size: 0.6 + Math.random() * 1.6,
        color: color || STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
      };
    });

    const render = () => {
      if (!running) return;

      const w = canvas.clientWidth || window.innerWidth;
      const h = canvas.clientHeight || window.innerHeight;
      const cx = originX !== undefined ? originX : w * 0.25;
      const cy = originY !== undefined ? originY : h * 0.5;

      // Smooth acceleration / deceleration toward target speed
      currentSpeedRef.current += (targetSpeedRef.current - currentSpeedRef.current) * 0.08;
      const speed = currentSpeedRef.current;

      ctx.clearRect(0, 0, w, h);

      // Radial warp glow around origin when speed is high
      if (speed > 8) {
        const glowOpacity = Math.min((speed - 8) / 30, 0.35);
        const warpGlow = ctx.createRadialGradient(cx, cy, 10, cx, cy, 320);
        warpGlow.addColorStop(0, `rgba(255, 255, 255, ${glowOpacity * 0.8})`);
        warpGlow.addColorStop(0.3, `rgba(168, 85, 247, ${glowOpacity * 0.4})`);
        warpGlow.addColorStop(0.7, `rgba(59, 130, 246, ${glowOpacity * 0.15})`);
        warpGlow.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = warpGlow;
        ctx.beginPath();
        ctx.arc(cx, cy, 320, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.lineCap = "round";

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        star.prevZ = star.z;
        star.z -= speed;

        // Reset star when it passes the camera or goes out of view
        if (star.z <= 0) {
          star.z = maxDepth;
          star.prevZ = maxDepth;
          star.x = (Math.random() - 0.5) * 2000;
          star.y = (Math.random() - 0.5) * 2000;
        }

        // Project 3D to 2D screen coordinates
        const kCurr = fov / star.z;
        const xCurr = cx + star.x * kCurr;
        const yCurr = cy + star.y * kCurr;

        const kPrev = fov / star.prevZ;
        const xPrev = cx + star.x * kPrev;
        const yPrev = cy + star.y * kPrev;

        // Check bounds
        if (xCurr < -100 || xCurr > w + 100 || yCurr < -100 || yCurr > h + 100) {
          star.z = maxDepth;
          star.prevZ = maxDepth;
          continue;
        }

        // Opacity increases as star gets closer
        const depthFactor = 1 - star.z / maxDepth;
        const alpha = Math.min(Math.max(depthFactor * 1.2, 0.1), 1);

        if (speed > 4) {
          // Relativistic warp streak line
          ctx.beginPath();
          ctx.moveTo(xPrev, yPrev);
          ctx.lineTo(xCurr, yCurr);
          ctx.strokeStyle = star.color.replace(/[\d.]+\)$/, `${alpha})`);
          ctx.lineWidth = Math.max(star.size * kCurr * 0.8, 1);
          ctx.stroke();
        } else {
          // Gentle ambient dot
          ctx.beginPath();
          ctx.arc(xCurr, yCurr, Math.max(star.size * kCurr * 0.6, 0.75), 0, Math.PI * 2);
          ctx.fillStyle = star.color.replace(/[\d.]+\)$/, `${alpha * 0.8})`);
          ctx.fill();
        }
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    return () => {
      running = false;
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, [originX, originY, starCount, color]);

  return (
    <canvas
      ref={canvasRef}
      className={`absolute inset-0 w-full h-full pointer-events-none ${className}`}
    />
  );
};

export default LightSpeedTunnel;
