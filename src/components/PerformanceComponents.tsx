import React from "react";
import {
  motion,
  AnimatePresence,
  useReducedMotion,
  type AnimatePresenceProps,
  type MotionValue,
} from "framer-motion";
import { usePreferences } from "../context/PreferencesContext";
import { VIDEO_HOLD_EVENT, isBackgroundVideoDegraded, subscribeVideoDegraded } from "../utils/videoHold";

export function useLowPerf() {
  // Seguro fora do PreferencesProvider (ex: fallback do Suspense no main.tsx):
  // sem provider, assume efeitos ligados.
  try {
    return usePreferences().lowPerformanceMode;
  } catch {
    return false;
  }
}

export const PAnimatePresence: React.FC<AnimatePresenceProps & { children: React.ReactNode }> = ({
  children,
  ...props
}) => {
  const low = useLowPerf();
  if (low) return <>{children}</>;
  return <AnimatePresence {...props}>{children}</AnimatePresence>;
};

interface PBackdropProps {
  children: React.ReactNode;
  className?: string;
  fallbackBg?: string;
  style?: React.CSSProperties;
}

export const PBackdrop: React.FC<PBackdropProps> = ({
  children,
  className = "",
  fallbackBg = "rgba(10,10,14,0.96)",
  style,
}) => {
  const low = useLowPerf();
  return (
    <div
      className={className}
      style={{
        backdropFilter: low ? "none" : undefined,
        WebkitBackdropFilter: low ? "none" : undefined,
        background: low ? fallbackBg : undefined,
        ...style,
      }}
    >
      {children}
    </div>
  );
};

interface PGlowProps {
  className?: string;
  style?: React.CSSProperties;
  color?: string;
  size?: number | string;
  opacity?: number;
}

export const PGlow: React.FC<PGlowProps> = ({ className, style, color, size = 400, opacity = 0.25 }) => {
  const low = useLowPerf();
  if (low) return null;

  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute rounded-full blur-[80px] ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: color ?? "rgb(var(--launcher-accent))",
        opacity,
        ...style,
      }}
    />
  );
};

interface PVideoBackgroundProps {
  src: string;
  className?: string;
  opacity?: number;
}

export const PVideoBackground: React.FC<PVideoBackgroundProps> = ({ src, className, opacity = 0.18 }) => {
  const low = useLowPerf();
  const degraded = React.useSyncExternalStore(subscribeVideoDegraded, isBackgroundVideoDegraded);
  // movimento reduzido: o fundo fica estático (sem vídeo), em vez de rodar em loop
  const prefersReducedMotion = useReducedMotion();
  const off = low || degraded || Boolean(prefersReducedMotion);
  const videoRef = React.useRef<HTMLVideoElement | null>(null);

  React.useEffect(() => {
    if (off) return;
    const video = videoRef.current;
    if (!video) return;

    let isGameRunning = false;
    let holdCount = 0;

    const pauseVideo = () => {
      if (video && !video.paused) {
        video.pause();
      }
    };

    const playVideo = () => {
      if (
        video &&
        video.paused &&
        !document.hidden &&
        document.hasFocus() &&
        !isGameRunning &&
        holdCount === 0
      ) {
        video.play().catch(() => undefined);
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) pauseVideo();
      else playVideo();
    };

    const handleGameLaunch = () => {
      isGameRunning = true;
      pauseVideo();
    };

    const handleGameStop = () => {
      isGameRunning = false;
      playVideo();
    };

    // O vídeo é o fundo da plataforma e fica em loop contínuo: não congela mais enquanto há mouse,
    // teclado ou controle. Só pausa com a janela sem foco/oculta, com um jogo rodando ou num pedido
    // explícito de quem anima algo pesado (VIDEO_HOLD_EVENT).
    // Seguro explícito (ex.: animação de lançamento) até quem pediu soltar.
    const handleHold = (e: Event) => {
      const hold = Boolean((e as CustomEvent<{ hold?: boolean }>).detail?.hold);
      holdCount = Math.max(0, holdCount + (hold ? 1 : -1));
      if (holdCount > 0) pauseVideo();
      else playVideo();
    };

    window.addEventListener("focus", playVideo);
    window.addEventListener("blur", pauseVideo);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("checkpoint:game-launch", handleGameLaunch);
    window.addEventListener("checkpoint:game-stop", handleGameStop);
    window.addEventListener(VIDEO_HOLD_EVENT, handleHold);

    return () => {
      window.removeEventListener("focus", playVideo);
      window.removeEventListener("blur", pauseVideo);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("checkpoint:game-launch", handleGameLaunch);
      window.removeEventListener("checkpoint:game-stop", handleGameStop);
      window.removeEventListener(VIDEO_HOLD_EVENT, handleHold);
    };
  }, [off]);

  if (off) return null;

  const mimeType = src.endsWith(".webm") ? "video/webm" : "video/mp4";

  return (
    <video
      ref={videoRef}
      autoPlay
      loop
      muted
      playsInline
      className={className}
      style={{ opacity }}
    >
      <source src={src} type={mimeType} />
    </video>
  );
};

interface PCard3DProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  rotateX?: number | MotionValue<number> | MotionValue<string>;
  rotateY?: number | MotionValue<number> | MotionValue<string>;
  scale?: number;
  isActive?: boolean;
}

export const PCard3D: React.FC<PCard3DProps> = ({
  children,
  className,
  style,
  rotateX,
  rotateY,
  scale = 1,
  isActive = false,
}) => {
  const low = useLowPerf();

  if (low) {
    return (
      <div
        className={className}
        style={{
          transform: isActive ? "scale(1.03)" : "scale(0.92)",
          transition: "transform 0.15s ease",
          ...style,
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <motion.div
      className={className}
      style={{ rotateX, rotateY, scale, transformStyle: "preserve-3d", ...style }}
      transition={{ type: "spring", stiffness: 350, damping: 25 }}
    >
      {children}
    </motion.div>
  );
};

interface PShadowProps {
  children: React.ReactNode;
  shadow: string;
  className?: string;
  style?: React.CSSProperties;
}

export const PShadow: React.FC<PShadowProps> = ({ children, shadow, className, style }) => {
  const low = useLowPerf();
  return (
    <div
      className={className}
      style={{ boxShadow: low ? "none" : shadow, ...style }}
    >
      {children}
    </div>
  );
};

interface PTransitionProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
  transition?: string;
}

export const PTransition: React.FC<PTransitionProps> = ({ children, className, style, transition = "transition-all duration-300 ease-out" }) => {
  const low = useLowPerf();
  return (
    <div
      className={`${low ? "" : transition} ${className ?? ""}`}
      style={style}
    >
      {children}
    </div>
  );
};
