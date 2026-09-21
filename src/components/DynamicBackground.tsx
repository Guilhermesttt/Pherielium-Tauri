import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PVideoBackground, useLowPerf } from "./PerformanceComponents";
import bgVideo from "../assets/karavanbraam_pindown.io.webm";

interface DynamicBackgroundProps {
  backgroundImage: string;
  videoUrl?: string;
  reducedEffects?: boolean;
}

const DynamicBackground: React.FC<DynamicBackgroundProps> = ({ backgroundImage, videoUrl, reducedEffects = false }) => {
  const low = useLowPerf();
  const noFx = reducedEffects || low;

  return (
    <div
      className="fixed inset-0 z-0 overflow-hidden pointer-events-none isolate"
      style={{
        background: "var(--color-bg-main, #0F0F0F)",
        transform: "translateZ(0)",
      }}
    >
      {/* Video de fundo nitido com baixa opacidade e aceleracao GPU */}
      <div className="absolute inset-0 transform-gpu will-change-transform">
        <PVideoBackground
          src={videoUrl || bgVideo}
          className="absolute inset-0 w-full h-full object-cover"
          opacity={0.38}
        />
      </div>

      {/* Imagem hero do jogo — tratamento cinematografico (scale + fade + blur atmosferico).
          Repousa em scale 1.06 para o blur nunca expor as bordas. */}
      <AnimatePresence mode="popLayout">
        {backgroundImage ? (
          noFx ? (
            <img
              key={backgroundImage}
              src={backgroundImage}
              alt=""
              loading="eager"
              decoding="async"
              className="absolute inset-0 w-full h-full scale-[1.02] object-cover opacity-25"
            />
          ) : (
            <motion.img
              key={backgroundImage}
              initial={{ scale: 1.1, opacity: 0 }}
              animate={{ scale: 1.06, opacity: 0.65 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeOut" }}
              src={backgroundImage}
              alt=""
              loading="eager"
              decoding="async"
              className="absolute inset-0 h-full w-full object-cover blur-[24px] will-change-transform"
            />
          )
        ) : null}
      </AnimatePresence>

      {/* Overlays cinematicos full-bleed (cobrem a tela toda, inclusive atras da sidebar) */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-transparent" />

      {/* Vinheta lateral para leitura do conteudo */}
      <div className="absolute inset-0 opacity-45" style={{ background: "linear-gradient(to right, color-mix(in srgb, var(--color-bg-main, #0F0F0F) 45%, transparent) 0%, transparent 55%)" }} />

      {/* Edge vignette for screen-in-a-dark-room feel */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at center, transparent 55%, rgba(0,0,0,0.55) 100%)",
        }}
      />

      {!low && (
        <div
          className="absolute inset-0 opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage: "radial-gradient(rgba(255, 255, 255, 0.15) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        />
      )}
    </div>
  );
};

export default DynamicBackground;
