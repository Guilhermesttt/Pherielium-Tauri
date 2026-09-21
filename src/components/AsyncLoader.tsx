import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import LoadingState from "./ui/loading-state";
import { ThinkingOrbLoader } from "./ThinkingOrbLoader";
import bgVideo from "../assets/karavanbraam_pindown.io.webm";

const loadingMsgs = [
  "Iniciando sistemas...",
  "Conectando ao banco de dados...",
  "Sincronizando biblioteca...",
  "Preparando interface...",
  "Quase pronto...",
];

interface AsyncLoaderProps {
  onFinish?: () => void;
  minDurationMs?: number;
  /**
   * Tarefas extras de pré-carregamento (ex: chunks lazy da interface).
   * O loader só termina após o tempo mínimo E todas as tarefas
   * (com teto de `preloadTimeoutMs` cada, sem travar o boot).
   */
  preload?: Array<() => Promise<unknown>>;
  preloadTimeoutMs?: number;
}

const delay = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

/**
 * Pré-carregamento da interface enquanto o boot é exibido:
 * fontes (evita FOUT/travada na primeira pintura) + logo + 2 yields
 * para a thread principal respirar antes da Home montar.
 */
function warmInterface(): Promise<void> {
  const tasks: Array<Promise<unknown>> = [];

  try {
    const fontsReady =
      typeof document !== "undefined" && document.fonts
        ? document.fonts.ready.catch(() => {})
        : Promise.resolve();
    tasks.push(Promise.race([fontsReady, delay(3000)]));
  } catch {
    /* ambiente sem FontFaceSet — segue o boot */
  }

  tasks.push(
    (async () => {
      try {
        const { PHERIELIUM_LOGO_PATH } = await import("../constants/assets");
        if (!PHERIELIUM_LOGO_PATH) return;
        const img = new Image();
        img.decoding = "async";
        img.src = PHERIELIUM_LOGO_PATH;
        await Promise.race([
          img.decode().catch(() => {}),
          delay(3000),
        ]);
      } catch {
        /* logo opcional — segue o boot */
      }
    })(),
  );

  // 2 frames de respiro: a Home monta sem disputar a thread com o loader
  tasks.push(
    (async () => {
      await new Promise<void>((res) => requestAnimationFrame(() => res()));
      await new Promise<void>((res) => requestAnimationFrame(() => res()));
    })().catch(() => {}),
  );

  return Promise.allSettled(tasks).then(() => {});
}

const AsyncLoader: React.FC<AsyncLoaderProps> = ({
  onFinish,
  minDurationMs = 2400,
  preload,
  preloadTimeoutMs = 8000,
}) => {
  const [msgIndex, setMsgIndex] = useState(0);
  // Ref para não reiniciar o gate se o array inline mudar de identidade
  const preloadRef = React.useRef(preload);
  preloadRef.current = preload;

  useEffect(() => {
    let cancelled = false;
    const msgInterval = setInterval(() => {
      setMsgIndex((prev) => (prev + 1) % loadingMsgs.length);
    }, 1800);

    if (onFinish) {
      const tasks: Array<Promise<unknown>> = [delay(minDurationMs), warmInterface()];
      for (const fn of preloadRef.current ?? []) {
        tasks.push(
          Promise.race([
            Promise.resolve().then(fn).catch(() => {}),
            delay(preloadTimeoutMs),
          ]),
        );
      }
      void Promise.allSettled(tasks).then(() => {
        if (!cancelled) onFinish();
      });
    }

    const handleSkip = () => {
      onFinish?.();
    };

    window.addEventListener("keydown", handleSkip, { once: true });

    return () => {
      cancelled = true;
      clearInterval(msgInterval);
      window.removeEventListener("keydown", handleSkip);
    };
  }, [onFinish, minDurationMs, preloadTimeoutMs]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.6, ease: "easeInOut" }}
      onClick={() => onFinish?.()}
      className="fixed inset-0 z-[1000] bg-black flex flex-col items-center justify-center overflow-hidden select-none cursor-default"
    >
      {/* Fundo via Mainbackground.mp4 — um único layer de vídeo em vez de N partículas */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
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
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "radial-gradient(circle 800px at 50% 50%, rgba(210,210,210,0.04) 0%, rgba(0,0,0,0.72) 80%)",
          }}
        />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-14">
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1, y: [-8, 8, -8] }}
          transition={{
            opacity: { duration: 0.8, ease: "easeOut" },
            scale: { duration: 0.8, ease: "easeOut" },
            y: { duration: 6, repeat: Infinity, ease: "easeInOut" },
          }}
          className="relative flex items-center justify-center"
        >
          <div className="absolute rounded-full w-[220%] h-[220%] bg-white/[0.04] blur-3xl animate-pulse pointer-events-none" />

          <ThinkingOrbLoader preset="ai" size={64} label="Carregando Pherielium" />
        </motion.div>

        <div className="flex flex-col items-center h-12 justify-center">
          <AnimatePresence mode="wait">
            <motion.div
              key={msgIndex}
              initial={{ opacity: 0, y: 8, filter: "blur(6px)", scale: 0.95 }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }}
              exit={{ opacity: 0, y: -8, filter: "blur(6px)", scale: 1.05 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            >
              <LoadingState
                label={loadingMsgs[msgIndex]}
                variant="searching"
                showTimer={false}
                showIcon={false}
                className="py-2.5 px-6 rounded-full bg-transparent font-medium tracking-wide text-[#D2D2D2]"
              />
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  );
};

export default AsyncLoader;
