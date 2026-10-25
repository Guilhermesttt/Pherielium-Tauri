import React from "react";
import { useTransition, animated, config as springConfig } from "@react-spring/web";
import { PVideoBackground, useLowPerf } from "./PerformanceComponents";
import bgVideo from "../assets/karavanbraam_pindown.io.webm";

interface DynamicBackgroundProps {
  backgroundImage: string;
  videoUrl?: string;
  reducedEffects?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

// Mola para a transicao da arte do jogo: entrada suave e cinematografica
const SPRING_BG = { tension: 60, friction: 20, mass: 2 } as const;

const DynamicBackground: React.FC<DynamicBackgroundProps> = ({
  backgroundImage,
  videoUrl,
  reducedEffects = false,
  className,
  style,
}) => {
  const low = useLowPerf();
  const noFx = reducedEffects || low;

  // useTransition do React Spring: cada nova imagem entra com mola suave (scale + opacity)
  // e a anterior sai por fadein rapido — igual ao parallax cinematografico do PS5
  const transitions = useTransition(backgroundImage || null, {
    key: backgroundImage || "empty",
    from:  noFx ? { opacity: 0, scale: 1.02 }  : { opacity: 0, scale: 1.08 },
    enter: noFx ? { opacity: 0.25, scale: 1.02 } : { opacity: 0.65, scale: 1.04 },
    leave: noFx ? { opacity: 0, scale: 1.02 }  : { opacity: 0, scale: 1.04 },
    config: noFx ? springConfig.default : SPRING_BG,
  });

  return (
    <div
      className={`fixed inset-0 z-0 overflow-hidden pointer-events-none isolate ${className || ""}`}
      style={{
        background: "var(--color-bg-main, #0F0F0F)",
        transform: "translateZ(0)",
        ...style,
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

      {/* Imagem hero do jogo com Spring: entrada cinematografica (scale + fade com mola).
          Repousa em scale 1.04 para o blur nunca expor as bordas. */}
      {transitions((springStyle, src) =>
        src ? (
          <animated.img
            key={src}
            src={src}
            alt=""
            loading="eager"
            decoding="async"
            style={{
              ...springStyle,
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              ...(noFx ? {} : { filter: "blur(24px)" }),
              willChange: "transform, opacity",
            }}
          />
        ) : null,
      )}

      {/* Overlays cinematicos full-bleed (cobrem a tela toda, inclusive atras da sidebar) */}
      <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/80 via-transparent to-transparent" />

      {/* Camada atmosferica do console ativo (transicao suave sem loop ou custo de render) */}
      <div
        className="absolute inset-0 pointer-events-none transition-all duration-700 ease-out"
        style={{ background: "var(--theme-ambient-bg, none)" }}
      />

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