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
  /**
   * Arte nítida em tela cheia (Home estilo console): sem desfoque, sem brilhos de cor, a arte
   * com opacidade cheia e só os escurecimentos onde há interface (esquerda e base).
   */
  sharp?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const GameEnvironment: React.FC<GameEnvironmentProps> = ({
  artwork,
  dominantColor,
  videoUrl,
  intensity = 0.2,
  reducedEffects = false,
  sharp = false,
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
        background: "var(--surface-base)",
        transform: "translateZ(0)",
        ...style,
      }}
      aria-hidden="true"
    >
      {/* 1. Vídeo ambiente: só textura de movimento, bem abaixo da arte do jogo */}
      <div className="absolute inset-0 transform-gpu will-change-transform opacity-20">
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
            initial={sharp ? { opacity: 0, scale: prefersReducedMotion ? 1 : 1.015 } : { opacity: 0 }}
            animate={sharp ? { opacity: 1, scale: 1 } : { opacity: 0.5 }}
            exit={{ opacity: 0 }}
            // nítida: a arte nova entra assentando (escala curta) enquanto a anterior apaga
            transition={sharp ? { duration: prefersReducedMotion ? 0.12 : 0.35, ease: [0.32, 0.72, 0, 1] } : { duration: 0.45, ease: "easeOut" }}
            className="absolute inset-0 w-full h-full transform-gpu will-change-transform"
          >
            <img
              src={artwork}
              alt=""
              loading="eager"
              decoding="async"
              className={`absolute inset-0 w-full h-full object-cover ${sharp ? "" : "blur-[22px] scale-[1.05]"}`}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3. Reactive Ambient Lighting (Derived from game artwork dominant color) */}
      <AnimatePresence>
        {ambientColorHex && !noFx && !sharp && (
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

      {/* 4. Escurecimento para o conteúdo (tokens do tema, sem cores fixas) */}
      {sharp ? (
        <>
          {/* nítida: topo leve para a barra, esquerda para o texto, base para a fileira */}
          <div
            className="absolute inset-x-0 top-0 h-40"
            style={{
              background:
                "linear-gradient(to bottom, color-mix(in srgb, var(--surface-base) 70%, transparent), transparent)",
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to right, color-mix(in srgb, var(--surface-base) 80%, transparent) 0%, color-mix(in srgb, var(--surface-base) 35%, transparent) 45%, transparent 70%)",
            }}
          />
          <div
            className="absolute inset-x-0 bottom-0 h-[55vh]"
            style={{
              background:
                "linear-gradient(to top, color-mix(in srgb, var(--surface-base) 92%, transparent), color-mix(in srgb, var(--surface-base) 45%, transparent) 55%, transparent)",
            }}
          />
        </>
      ) : (
        <>
          {/* Topo: preserva o contraste da navegação */}
          <div
            className="absolute inset-x-0 top-0 h-44"
            style={{
              background:
                "linear-gradient(to bottom, color-mix(in srgb, var(--surface-base) 90%, transparent), color-mix(in srgb, var(--surface-base) 40%, transparent) 50%, transparent)",
            }}
          />
          {/* Base: funde a arte com as prateleiras */}
          <div
            className="absolute inset-x-0 bottom-0 h-[65vh]"
            style={{
              background:
                "linear-gradient(to top, var(--surface-base), color-mix(in srgb, var(--surface-base) 85%, transparent) 50%, transparent)",
            }}
          />
          {/* Lateral esquerda: foco no título do hero */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "linear-gradient(to right, color-mix(in srgb, var(--surface-base) 75%, transparent), transparent 50%, color-mix(in srgb, var(--surface-base) 50%, transparent))",
            }}
          />
        </>
      )}
    </div>
  );
};

export default React.memo(GameEnvironment);
