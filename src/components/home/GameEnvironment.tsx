import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { PVideoBackground, useLowPerf } from "../PerformanceComponents";
import bgVideo from "../../assets/karavanbraam_pindown.io.webm";

export interface GameEnvironmentProps {
  artwork?: string;
  dominantColor?: { hex: string; isDark: boolean } | null;
  videoUrl?: string;
  intensity?: number;
  reducedEffects?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const GameEnvironment: React.FC<GameEnvironmentProps> = ({
  artwork,
  dominantColor,
  videoUrl,
  intensity = 0.35,
  reducedEffects = false,
  className = "",
  style,
}) => {
  const low = useLowPerf();
  const prefersReducedMotion = useReducedMotion();
  const noFx = reducedEffects || low || Boolean(prefersReducedMotion);

  const ambientColorHex =
    dominantColor?.hex &&
    dominantColor.hex !== "#ffffff" &&
    dominantColor.hex !== "rgba(255,255,255,1)"
      ? dominantColor.hex
      : null;

  return (
    <div
      className={`fixed inset-0 z-0 overflow-hidden pointer-events-none select-none isolate ${className}`}
      style={{
        background: "var(--color-bg-main, #070707)",
        transform: "translateZ(0)",
        ...style,
      }}
      aria-hidden="true"
    >
      {/* 1. Base Subtle Ambient Video (Optional) */}
      <div className="absolute inset-0 transform-gpu will-change-transform opacity-30">
        <PVideoBackground
          src={videoUrl || bgVideo}
          className="absolute inset-0 w-full h-full object-cover"
          opacity={0.35}
        />
      </div>

      {/* 2. Artwork Atmospheric Canvas (Game as Environment) */}
      <AnimatePresence mode="sync" initial={false}>
        {artwork && (
          <motion.div
            key={artwork}
            // só opacidade: animar escala sobre uma imagem com blur de 22px obriga a re-rasterizar o blur a cada frame
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.65 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: "easeOut" }}
            className="absolute inset-0 w-full h-full transform-gpu will-change-transform"
          >
            <img
              src={artwork}
              alt=""
              loading="eager"
              decoding="async"
              className="absolute inset-0 w-full h-full object-cover blur-[22px] scale-[1.05]"
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Reactive Ambient Lighting (Derived from game artwork dominant color) */}
      <AnimatePresence>
        {ambientColorHex && !noFx && (
          <motion.div
            key={ambientColorHex}
            initial={{ opacity: 0, scale: 0.85 }}
            animate={{ opacity: intensity, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
            className="absolute -top-32 left-1/4 w-[80vw] h-[75vh] rounded-full pointer-events-none transform-gpu"
            style={{
              background: `radial-gradient(circle, ${ambientColorHex} 0%, transparent 72%)`,
            }}
          />
        )}
      </AnimatePresence>

      {/* 4. Second Subtle Glow for Depth (Lower Right) */}
      {ambientColorHex && !noFx && (
        <div
          className="absolute bottom-0 right-10 w-[50vw] h-[45vh] rounded-full pointer-events-none opacity-20 transform-gpu"
          style={{
            background: `radial-gradient(circle, ${ambientColorHex} 0%, transparent 70%)`,
          }}
        />
      )}

      {/* 5. Cinematic Vignettes & Contrast Overlays */}
      {/* Top fade (preserves top navigation contrast) */}
      <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-[#070707]/90 via-[#070707]/40 to-transparent" />

      {/* Bottom fade (blends smoothly into the shelves and shelves background) */}
      <div className="absolute inset-x-0 bottom-0 h-[65vh] bg-gradient-to-t from-[#070707] via-[#070707]/85 to-transparent" />

      {/* Lateral fade for content focus */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#070707]/75 via-transparent to-[#070707]/50" />

      {/* Radial vignette for cinema feel */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background:
            "radial-gradient(ellipse at center, transparent 45%, rgba(7,7,7,0.7) 100%)",
        }}
      />

      {/* Subtle Micro-lattice texture */}
      {!low && (
        <div
          className="absolute inset-0 opacity-[0.025] pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
      )}
    </div>
  );
};

export default React.memo(GameEnvironment);
