import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Gamepad2, Users, type LucideIcon } from "lucide-react";
import { useLowPerf } from "../PerformanceComponents";

interface EmptyStateGraphicProps {
  variant?: "library" | "friends";
  icon?: LucideIcon;
  className?: string;
}

const FLOAT_DOTS = [
  { left: "12%", top: "22%", size: 5, depth: 14, delay: 0, duration: 4.2 },
  { left: "84%", top: "18%", size: 4, depth: 20, delay: 0.6, duration: 5 },
  { left: "78%", top: "74%", size: 6, depth: 10, delay: 1.1, duration: 4.6 },
  { left: "16%", top: "70%", size: 4, depth: 18, delay: 0.3, duration: 5.4 },
  { left: "50%", top: "8%", size: 3, depth: 24, delay: 1.4, duration: 3.8 },
];

/**
 * Empty state 2D interativo (ideia Basedash, sem 3D/WebGL):
 * anéis orbitais + tile central + pontos flutuantes com
 * parallax de mouse em camadas (rAF, transform direto, sem re-render).
 * Congela em low-perf / prefers-reduced-motion.
 */
export const EmptyStateGraphic: React.FC<EmptyStateGraphicProps> = ({
  variant = "library",
  icon,
  className = "",
}) => {
  const low = useLowPerf();
  const reduceMotion = useReducedMotion();
  const staticFx = low || reduceMotion;
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const rafRef = React.useRef<number>(0);
  const targetRef = React.useRef({ x: 0, y: 0 });
  const layerRefs = React.useRef<Array<HTMLDivElement | null>>([]);

  const Icon = icon ?? (variant === "friends" ? Users : Gamepad2);

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent) => {
      if (staticFx) return;
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;
      targetRef.current = {
        x: (e.clientX - rect.left) / rect.width - 0.5,
        y: (e.clientY - rect.top) / rect.height - 0.5,
      };
      if (rafRef.current) return;
      rafRef.current = requestAnimationFrame(function tick() {
        rafRef.current = 0;
        const { x, y } = targetRef.current;
        layerRefs.current.forEach((layer, i) => {
          if (!layer) return;
          const depth = [10, 18, 28][i] ?? 12;
          layer.style.transform = `translate3d(${(x * depth).toFixed(1)}px, ${(y * depth).toFixed(1)}px, 0)`;
        });
      });
    },
    [staticFx],
  );

  React.useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const setLayerRef = (i: number) => (el: HTMLDivElement | null) => {
    layerRefs.current[i] = el;
  };

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        targetRef.current = { x: 0, y: 0 };
        layerRefs.current.forEach((layer) => {
          if (layer) layer.style.transform = "translate3d(0,0,0)";
        });
      }}
      aria-hidden
      className={`relative mx-auto flex h-36 w-full max-w-xs items-center justify-center overflow-visible ${className}`}
    >
      {/* Camada 1: anel externo tracejado */}
      <div ref={setLayerRef(0)} className="absolute inset-0 flex items-center justify-center will-change-transform">
        {staticFx ? (
          <div className="h-32 w-32 rounded-full border border-dashed border-white/10" />
        ) : (
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 36, repeat: Infinity, ease: "linear" }}
            className="h-32 w-32 rounded-full border border-dashed border-white/10"
          />
        )}
      </div>

      {/* Camada 2: anel interno + tile central */}
      <div ref={setLayerRef(1)} className="absolute inset-0 flex items-center justify-center will-change-transform">
        <div className="relative flex items-center justify-center">
          <div className="absolute h-24 w-24 rounded-full border border-[#2A2A2A]" />
          <div className="absolute h-24 w-24 rounded-full bg-[#D2D2D2]/[0.04] blur-xl" />
          {staticFx ? (
            <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[#2A2A2A] bg-[#161616] shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
              <Icon className="h-6 w-6 text-[#6C6C6C]" />
            </div>
          ) : (
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-[#2A2A2A] bg-[#161616] shadow-[0_12px_32px_rgba(0,0,0,0.5)]"
            >
              <Icon className="h-6 w-6 text-[#6C6C6C]" />
            </motion.div>
          )}
        </div>
      </div>

      {/* Camada 3: pontos flutuantes */}
      <div ref={setLayerRef(2)} className="pointer-events-none absolute inset-0 will-change-transform">
        {FLOAT_DOTS.map((dot, i) =>
          staticFx ? (
            <span
              key={i}
              className="absolute rounded-full bg-white/15"
              style={{ left: dot.left, top: dot.top, width: dot.size, height: dot.size }}
            />
          ) : (
            <motion.span
              key={i}
              className="absolute rounded-full bg-white/20"
              style={{ left: dot.left, top: dot.top, width: dot.size, height: dot.size }}
              animate={{ y: [0, -8, 0], opacity: [0.5, 1, 0.5] }}
              transition={{ duration: dot.duration, repeat: Infinity, ease: "easeInOut", delay: dot.delay }}
            />
          ),
        )}
      </div>
    </div>
  );
};

export default EmptyStateGraphic;
