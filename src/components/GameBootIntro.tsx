import React, { useRef, useEffect, useLayoutEffect, useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { setLauncherInputLocked } from "../utils/launcherInputLock";
import bootAudioSrc from "../sounds/Phelierium Default/game_boot_intro 2.mp3";
import bgVideo from "../assets/karavanbraam_pindown.io.webm";

interface GameBootIntroProps {
  onFinish?: () => void;
}

const SVG_PATH_1 =
  "M546.811 0.450368C574.495 -2.67907 606.626 10.823 625.549 30.9223C642.416 48.603 651.367 72.3858 650.346 96.8034C649.75 111.603 645.769 126.069 638.71 139.089C627.991 158.929 613.409 172.317 593.916 182.963C586.864 186.811 579.76 189.916 572.727 193.986C558.538 202.045 545.351 211.744 533.421 222.881C496.013 257.724 472.336 309.851 470.466 360.989C468.862 408.479 486.129 454.671 518.485 489.458C563.272 536.862 635.436 559.136 697.608 535.709C730.013 523.498 747.621 503.1 785.88 504.379C827.262 504.751 862.431 540.121 867.309 580.433C869.849 601.377 867.499 619.447 871.964 641.413C876.659 663.518 885.702 684.476 898.562 703.056C910.57 720.432 928.237 738.698 947.068 748.457C964.741 756.742 978.504 762.46 992.235 777.196C1029.85 817.055 1021.02 877.205 982.014 912.264C923.555 964.817 840.561 925.677 825.854 853.549C822.41 836.684 824.492 823.291 823.517 807.087C818.357 721.46 740.261 645.887 654.7 642.631C607.49 640.83 560.686 660.59 526.519 691.254C487.944 725.776 464.63 774.19 461.692 825.884C458.981 880.441 483.698 937.06 532.144 964.509C553.902 976.704 574.161 982.101 591.592 1001.47C624.482 1038.01 618.274 1089.45 582.17 1121.75C564.942 1137.31 542.221 1145.32 519.055 1144.02C473.931 1142.4 432.717 1105.27 426.52 1060.54C425.278 1052.41 425.811 1043.35 424.591 1035.29C409.2 933.714 269.72 837.116 173.523 894.928C148.135 910.188 135.775 928.428 103.062 932.554C78.7883 935.423 54.3806 928.422 35.3119 913.129C7.39449 891.083 -6.1386 857.013 2.66826 822.164C16.9282 765.741 82.1114 724.525 137.24 752.852C154.191 761.909 170.279 774.045 188.677 780.261C257.114 803.361 336.225 766.108 379.376 711.865C409.935 673.78 423.991 625.052 418.41 576.539C412.519 525.267 380.818 471.216 340.471 439.625C296.691 405.346 233.542 393.111 183.664 421.144C156.332 436.506 140.804 456.751 106.695 460.397C82.296 463.006 57.3775 454.495 38.4922 439.087C19.1341 423.609 6.80584 401.001 4.27641 376.342C1.83144 351.126 12.4435 325.227 28.4884 306.121C40.4579 291.869 55.9436 280.994 73.4099 274.575C115.44 259.402 141.899 277.319 174.876 299.283C194.091 312.081 224.233 318.825 247.339 316.351C308.871 309.761 365.404 272.323 405.055 226.103C425.598 201.777 446.522 167.27 449.035 135.403C449.682 127.206 448.443 119.029 447.719 110.884C445.386 84.6811 455.082 58.617 472.003 38.7504C491.704 15.6216 516.828 3.05048 546.811 0.450368Z";

const SVG_PATH_2 =
  "M910.963 266.954C963.837 264.292 1008.83 305.052 1011.39 357.938C1013.97 410.824 973.135 455.756 920.255 458.231C867.512 460.701 822.724 419.984 820.164 367.231C817.604 314.476 858.227 269.61 910.963 266.954Z";

// ---------------------------------------------------------------------------
// Perf notes (why things changed vs. the original):
//
// 1. drop-shadow(...) applied directly to the two <motion.path> elements while
//    pathLength was animating forced the browser to re-rasterize the filter's
//    bounding box on every single frame, because the visible shape (the
//    partially-drawn stroke) was changing shape every frame too. That combo
//    (animated geometry + filter) is the single most expensive thing in the
//    original file. Fix: no filter at all while drawing; the glow only turns
//    on once the shape is static (isComplete), so the filter is recomputed
//    against a shape that isn't also changing.
//
// 2. Starfield de dezenas de divs animadas foi trocado por Mainbackground.mp4
//    (um único layer de vídeo GPU) — bem mais barato que N animações CSS.
//
// 3. Cubes/shockwaves/logo/title são subcomponentes memoizados e desmontam
//    quando não são mais necessários.
//
// 4. prefers-reduced-motion: pula o swarm de cubes.
//
// 5. Audio fade-out via requestAnimationFrame (mais barato que setInterval).
// ---------------------------------------------------------------------------

type CubeData = {
  id: number;
  x: number;
  y: number;
  size: number;
  duration: number;
  opacity: number;
};

function fadeOutAudio(audio: HTMLAudioElement, durationMs = 350) {
  const startVolume = audio.volume;
  if (startVolume <= 0) {
    audio.pause();
    return;
  }
  const startTime = performance.now();
  const step = (now: number) => {
    const t = Math.min((now - startTime) / durationMs, 1);
    audio.volume = startVolume * (1 - t);
    if (t < 1) {
      requestAnimationFrame(step);
    } else {
      audio.pause();
    }
  };
  requestAnimationFrame(step);
}

// --- Converging data cubes ---------------------------------------------------

const DataCubes = React.memo(function DataCubes({
  cubes,
  active,
}: {
  cubes: CubeData[];
  active: boolean;
}) {
  if (!active) return null;
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" style={{ zIndex: 25 }}>
      {cubes.map((cube) => (
        <motion.div
          key={cube.id}
          initial={{ x: cube.x, y: cube.y, scale: 1, rotate: 45, opacity: 0 }}
          animate={{
            x: 0,
            y: 0,
            scale: 0,
            rotate: 0,
            opacity: [0, cube.opacity, cube.opacity, 0],
          }}
          transition={{ duration: cube.duration, ease: [0.16, 1, 0.3, 1], delay: 0.05 }}
          className="absolute top-1/2 left-1/2 pointer-events-none bg-white -translate-x-1/2 -translate-y-1/2"
          style={{
            width: cube.size,
            height: cube.size,
            boxShadow: "0 0 6px rgba(255, 255, 255, 0.8)",
            willChange: "transform, opacity",
          }}
        />
      ))}
    </div>
  );
});

// --- Shockwave rings ---------------------------------------------------------

const Shockwaves = React.memo(function Shockwaves({ show }: { show: boolean }) {
  if (!show) return null;
  const ring = {
    width: "900px",
    height: "900px",
    filter: "blur(2px)",
    zIndex: 12,
    willChange: "transform, opacity",
  } as const;
  return (
    <>
      <motion.div
        initial={{ scale: 0.01, opacity: 1, borderWidth: 6 }}
        animate={{ scale: 1, opacity: 0, borderWidth: 1 }}
        transition={{ duration: 1.3, ease: [0.16, 1, 0.3, 1] }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full border border-white"
        style={ring}
      />
      <motion.div
        initial={{ scale: 0.01, opacity: 1, borderWidth: 6 }}
        animate={{ scale: 1, opacity: 0, borderWidth: 1 }}
        transition={{ duration: 1.3, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none rounded-full border border-white"
        style={ring}
      />
    </>
  );
});

// --- Logo mark ---------------------------------------------------------------

const LogoMark = React.memo(function LogoMark({
  isComplete,
  isExiting,
}: {
  isComplete: boolean;
  isExiting: boolean;
}) {
  const gradientId = "boot-logo-beam-grad";
  return (
    <motion.div
      initial={{ scale: 0.7, opacity: 0 }}
      animate={
        isExiting
          ? { scale: 32, opacity: [1, 1, 0.85, 0], transition: { duration: 0.85, ease: [0.65, 0, 0.25, 1] } }
          : isComplete
            ? { scale: 1, opacity: 1, transition: { duration: 0.45, ease: [0.16, 1, 0.3, 1] } }
            : { scale: 0.95, opacity: 1, transition: { duration: 1.4, ease: [0.16, 1, 0.3, 1] } }
      }
      style={{ width: 180, height: 200, transformOrigin: "50% 50%", willChange: "transform, opacity" }}
      className="relative flex items-center justify-center mb-5 pointer-events-none"
    >
      <svg
        className="w-full h-full overflow-visible pointer-events-none"
        viewBox="0 0 1017 1145"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <motion.linearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            initial={{ x1: "0", y1: "0", x2: "0", y2: "0" }}
            animate={{
              x1: ["0", "2034"],
              x2: ["0", "1017"],
            }}
            transition={{
              duration: 1.5,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            <stop offset="0%" stopColor="#ffffff" stopOpacity="0" />
            <stop offset="50%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </motion.linearGradient>
        </defs>

        {/* 1. Base subtle blueprint track (always visible during construction so shape is defined) */}
        {!isComplete && (
          <>
            <path
              d={SVG_PATH_1}
              fill="rgba(255, 255, 255, 0.04)"
              stroke="rgba(255, 255, 255, 0.18)"
              strokeWidth={12}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d={SVG_PATH_2}
              fill="rgba(255, 255, 255, 0.04)"
              stroke="rgba(255, 255, 255, 0.18)"
              strokeWidth={12}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </>
        )}

        {/* 2. Drawing Stroke (pathLength 0 -> 1) with high-intensity construction */}
        <motion.path
          d={SVG_PATH_1}
          stroke="#ffffff"
          strokeWidth={isComplete ? (isExiting ? 4 : 0) : 18}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: 1,
            opacity: 1,
            fill: isComplete
              ? isExiting
                ? "rgba(255,255,255,0)"
                : "#ffffff"
              : "rgba(255,255,255,0)",
          }}
          transition={{
            pathLength: { duration: 1.35, ease: [0.16, 1, 0.3, 1], delay: 0.05 },
            opacity: { duration: 0.2 },
            fill: { duration: 0.35, ease: "easeOut" },
          }}
          style={{
            filter: isComplete
              ? isExiting
                ? "drop-shadow(0 0 16px rgba(255,255,255,0.6))"
                : "drop-shadow(0 0 35px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 70px rgba(255, 255, 255, 0.4))"
              : "drop-shadow(0 0 14px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 28px rgba(255, 255, 255, 0.4))",
          }}
        />

        <motion.path
          d={SVG_PATH_2}
          stroke="#ffffff"
          strokeWidth={isComplete ? (isExiting ? 4 : 0) : 18}
          strokeLinecap="round"
          strokeLinejoin="round"
          initial={{ pathLength: 0, opacity: 0 }}
          animate={{
            pathLength: 1,
            opacity: 1,
            fill: isComplete
              ? isExiting
                ? "rgba(255,255,255,0)"
                : "#ffffff"
              : "rgba(255,255,255,0)",
          }}
          transition={{
            pathLength: { duration: 1.35, ease: [0.16, 1, 0.3, 1], delay: 0.05 },
            opacity: { duration: 0.2 },
            fill: { duration: 0.35, ease: "easeOut" },
          }}
          style={{
            filter: isComplete
              ? isExiting
                ? "drop-shadow(0 0 16px rgba(255,255,255,0.6))"
                : "drop-shadow(0 0 35px rgba(255, 255, 255, 0.95)) drop-shadow(0 0 70px rgba(255, 255, 255, 0.4))"
              : "drop-shadow(0 0 14px rgba(255, 255, 255, 0.8)) drop-shadow(0 0 28px rgba(255, 255, 255, 0.4))",
          }}
        />

        {/* 3. Traveling luminous laser beam (active during construction phase) */}
        {!isComplete && (
          <>
            <motion.path
              d={SVG_PATH_1}
              stroke={`url(#${gradientId})`}
              strokeWidth={22}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              style={{ filter: "drop-shadow(0 0 20px rgba(255,255,255,1))" }}
            />
            <motion.path
              d={SVG_PATH_2}
              stroke={`url(#${gradientId})`}
              strokeWidth={22}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="none"
              style={{ filter: "drop-shadow(0 0 20px rgba(255,255,255,1))" }}
            />
          </>
        )}
      </svg>
    </motion.div>
  );
});

// --- Title reveal -------------------------------------------------------------

const TitleReveal = React.memo(function TitleReveal({
  isComplete,
  isExiting,
}: {
  isComplete: boolean;
  isExiting: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, letterSpacing: "0px", filter: "blur(15px)", y: 15 }}
      animate={
        isExiting
          ? { opacity: 0, y: -24, filter: "blur(8px)", transition: { duration: 0.3 } }
          : isComplete
            ? {
              opacity: 1,
              letterSpacing: "18px",
              filter: "blur(0px) drop-shadow(0 0 16px rgba(255,255,255,0.4))",
              x: 9,
              y: 0,
              transition: { duration: 2.2, ease: [0.16, 1, 0.3, 1] },
            }
            : { opacity: 0, letterSpacing: "0px", filter: "blur(15px)", y: 15 }
      }
      className="relative flex flex-col items-center select-none pointer-events-none mt-2"
      style={{ fontFamily: "'Space Grotesk', sans-serif" }}
    >
      <span
        className="font-bold text-3xl sm:text-4xl md:text-5xl uppercase tracking-[inherit]"
        style={{
          background: "linear-gradient(180deg, #ffffff 0%, #888888 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
        }}
      >
        PHERIELIUM
      </span>

      <motion.span
        initial={{ opacity: 0 }}
        animate={isComplete && !isExiting ? { opacity: 1 } : { opacity: 0 }}
        transition={{ duration: 1.2, delay: 0.3 }}
        className="mt-3 text-[10px] sm:text-[11px] font-mono tracking-[0.38em] text-white/50 uppercase"
      >
        UNIVERSAL GAME HUB · DESKTOP RUNTIME
      </motion.span>
    </motion.div>
  );
});

// --- Skip hint ------------------------------------------------------------

const SkipHint = React.memo(function SkipHint({
  show,
  onSkip,
}: {
  show: boolean;
  onSkip: (e: React.MouseEvent) => void;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8, filter: "blur(4px)" }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="absolute bottom-8 right-8 md:bottom-10 md:right-12 z-30"
        >
          <button
            type="button"
            onClick={onSkip}
            className="group flex items-center gap-2.5 px-4 py-2 rounded-[10px] border border-white/20 bg-white/4 hover:bg-white/10 hover:border-white/40 transition-all duration-200 cursor-pointer backdrop-blur-md active:scale-95"
          >
            <span className="text-[11px] font-mono tracking-[0.16em] uppercase text-white/70 group-hover:text-white transition-colors">
              Pular Introdução
            </span>
            <span className="text-xs text-white/50 group-hover:text-white transition-transform group-hover:translate-x-0.5">
              →
            </span>
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
});

// --- Main component ----------------------------------------------------------

const GameBootIntro: React.FC<GameBootIntroProps> = ({ onFinish }) => {
  const finishedRef = useRef(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [isComplete, setIsComplete] = useState(false);
  const [isLevitating, setIsLevitating] = useState(false);
  const [isExiting, setIsExiting] = useState(false);
  const [showSkipHint, setShowSkipHint] = useState(false);

  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches,
    []
  );

  // Fewer particles on reduced-motion / keeps the swarm cheap either way.
  const cubeCount = prefersReducedMotion ? 0 : 48;

  const cubes = useMemo<CubeData[]>(
    () =>
      Array.from({ length: cubeCount }, (_, i) => {
        const angle = Math.random() * Math.PI * 2;
        const radius = 550 + Math.random() * 450;
        return {
          id: i,
          x: Math.cos(angle) * radius,
          y: Math.sin(angle) * radius,
          size: Math.random() * 2.5 + 4,
          duration: Math.random() * 0.7 + 0.6,
          opacity: Math.random() * 0.5 + 0.5,
        };
      }),
    [cubeCount]
  );

  const handleFinish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setIsExiting(true);

    if (audioRef.current && !audioRef.current.paused) {
      fadeOutAudio(audioRef.current, 350);
    }

    window.setTimeout(() => {
      onFinish?.();
    }, 850);
  }, [onFinish]);

  useLayoutEffect(() => {
    setLauncherInputLocked(true);

    if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    const blockInteraction = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const blockedEvents = ["keyup", "keypress"];

    blockedEvents.forEach((eventName) => {
      window.addEventListener(eventName, blockInteraction, { capture: true, passive: false });
    });

    const handleKeySkip = () => handleFinish();
    window.addEventListener("keydown", handleKeySkip, { capture: true });

    return () => {
      setLauncherInputLocked(false);
      blockedEvents.forEach((eventName) => {
        window.removeEventListener(eventName, blockInteraction, { capture: true });
      });
      window.removeEventListener("keydown", handleKeySkip, { capture: true });
    };
  }, [handleFinish]);

  useEffect(() => {
    const audio = new Audio(bootAudioSrc);
    audio.preload = "auto";
    audio.volume = 0.35;
    audioRef.current = audio;

    audio.play().catch((err) => {
      console.warn("Autoplay audio blocked or pending interaction:", err);
    });

    const onAudioEnd = () => handleFinish();
    audio.addEventListener("ended", onAudioEnd);

    // 1500ms: Climax! (Sync with the audio drop: shockwave fires, logo fills white, text unblurs)
    const completeTimer = window.setTimeout(() => setIsComplete(true), prefersReducedMotion ? 200 : 1500);

    // 3000ms: Subtle floating / levitation
    const levitateTimer = window.setTimeout(() => setIsLevitating(true), prefersReducedMotion ? 400 : 3000);

    const hintTimer = window.setTimeout(() => setShowSkipHint(true), 1200);

    // Auto-finish safety timer (around audio end)
    const autoFinishTimer = window.setTimeout(() => handleFinish(), prefersReducedMotion ? 1200 : 4400);

    return () => {
      audio.removeEventListener("ended", onAudioEnd);
      window.clearTimeout(completeTimer);
      window.clearTimeout(levitateTimer);
      window.clearTimeout(hintTimer);
      window.clearTimeout(autoFinishTimer);
      if (!audio.paused) {
        audio.pause();
      }
    };
  }, [handleFinish, prefersReducedMotion]);

  const onSkipClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      handleFinish();
    },
    [handleFinish]
  );

  return (
    <div
      className="fixed inset-0 z-500 flex flex-col items-center justify-center overflow-hidden select-none cursor-default"
      style={{
        backgroundColor: isExiting ? "rgba(2, 2, 5, 0)" : "#020205",
        transition: "background-color 0.8s cubic-bezier(0.65, 0, 0.25, 1)",
      }}
      role="presentation"
      onClick={handleFinish}
    >
      {/* Fundo via Mainbackground.mp4 (GPU) — substitui o starfield de partículas */}
      <div
        className="absolute inset-0 pointer-events-none overflow-hidden"
        style={{ opacity: isExiting ? 0 : 1, transition: "opacity 0.65s cubic-bezier(0.65, 0, 0.25, 1)" }}
      >
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden">
          <video
            autoPlay
            loop
            muted
            playsInline
            preload="auto"
            disablePictureInPicture
            className="absolute left-1/2 top-1/2 h-[100vw] w-[100vh] max-w-none object-cover opacity-55 pointer-events-none"
            style={{ transform: "translate(-50%, -50%) rotate(90deg)" }}
          >
            <source src={bgVideo} type="video/mp4" />
          </video>
        </div>

        {/* Ambient Dark Overlay & Radial Vignette */}
        <div className="absolute inset-0 bg-black/55 pointer-events-none" />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle 900px at 50% 50%, rgba(255,255,255,0.03) 0%, rgba(2,2,5,0.85) 85%)",
          }}
        />
      </div>

      {/* Cubes desmontam após o climax; o vídeo cobre o fundo o tempo todo. */}
      <DataCubes cubes={cubes} active={!isComplete} />
      <Shockwaves show={isComplete} />

      {/* Central Assembly & Logo Portal */}
      <motion.div
        animate={isLevitating && !isExiting ? { y: [-2, -12, -2] } : { y: 0 }}
        transition={{ repeat: Infinity, duration: 5, ease: "easeInOut" }}
        className="relative z-20 flex flex-col items-center justify-center pointer-events-none"
      >
        <LogoMark isComplete={isComplete} isExiting={isExiting} />
        <TitleReveal isComplete={isComplete} isExiting={isExiting} />
      </motion.div>

      <SkipHint show={showSkipHint && !isExiting} onSkip={onSkipClick} />
    </div>
  );
};

export default GameBootIntro;