import React, { useState, useCallback, useEffect } from "react";
import {
  X,
  ChevronRight,
  ChevronLeft,
  Gamepad2,
  RefreshCw,
  Users,
  Sparkles,
  Plus,
  Monitor,
  Mic,
  Check,
  Layers,
  RotateCcw,
  Volume2,
} from "lucide-react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import ModalShell from "./ui/ModalShell";
import { useGamepadButton } from "../context/GamepadContext";
import { usePreferences, type SoundTheme } from "../context/PreferencesContext";
import desktopIcon from "../assets/Pherielium_Desktop_icon.png";
import platinaLogo from "../assets/Pherielium_Logo_Platina.png";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  playSound?: (sound: any) => void;
  onOpenAddGame?: () => void;
  onConnectPlatform?: () => void;
}

interface StepContent {
  stepNumber: number;
  category: string;
  title: string;
  subtitle: string;
  isActionStep?: boolean;
  items?: {
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    title: string;
    description: string;
  }[];
}

/* ──────────────────────────────────────────────────────────────────────────
   Microanimação 1: Boas-vindas
   "A logo surge suavemente, aproximando-se de 96% para 100% do tamanho.
    Uma iluminação discreta se estabelece atrás dela."
   ────────────────────────────────────────────────────────────────────────── */
const WelcomeLogoPreview: React.FC<{ shouldReduceMotion?: boolean | null }> = ({
  shouldReduceMotion,
}) => (
  <div className="relative flex items-center justify-center">
    <motion.div
      initial={{ opacity: 0, scale: 0.88 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={
        shouldReduceMotion ? { duration: 0.2 } : { duration: 0.6, ease: "easeOut" }
      }
      className="pointer-events-none absolute h-36 w-36 rounded-full bg-white/[0.08] blur-2xl"
    />

    <motion.div
      initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={
        shouldReduceMotion
          ? { duration: 0.2 }
          : { type: "spring", bounce: 0, duration: 0.4 }
      }
      className="relative z-10"
    >
      <img
        src={desktopIcon}
        alt="Símbolo Pherielium"
        className="h-24 w-24 sm:h-28 sm:w-28 rounded-[24px] object-cover border border-white/15 shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_18px_40px_rgba(0,0,0,0.7)]"
        draggable={false}
      />
    </motion.div>
  </div>
);

/* ──────────────────────────────────────────────────────────────────────────
   Microanimação 2: Biblioteca
   "Duas pequenas capas se acomodam atrás da principal.
    O “+ Novo” responde com uma breve mudança de luminosidade, simulando a adição."
   ────────────────────────────────────────────────────────────────────────── */
const LibraryPreview: React.FC<{ shouldReduceMotion?: boolean | null }> = ({
  shouldReduceMotion,
}) => {
  return (
    <div className="relative flex items-center justify-center">
      <div className="pointer-events-none absolute h-36 w-36 rounded-full bg-white/[0.06] blur-2xl" />

      <div className="relative z-10 flex items-center justify-center">
        {/* Capa da esquerda (acomoda atrás) */}
        <motion.div
          initial={
            shouldReduceMotion
              ? { opacity: 0.45 }
              : { opacity: 0, x: -36, rotate: -7, scale: 0.82 }
          }
          animate={{ opacity: 0.5, x: -28, rotate: -5, scale: 0.88 }}
          transition={
            shouldReduceMotion
              ? { duration: 0.2 }
              : { type: "spring", bounce: 0.1, duration: 0.45, delay: 0.05 }
          }
          className="absolute flex h-[76px] w-[54px] flex-col items-center justify-center rounded-xl border border-white/10 bg-gradient-to-b from-[#252525] to-[#121212] shadow-[0_10px_24px_rgba(0,0,0,0.6)]"
        >
          <div className="h-4 w-4 rounded-full bg-white/10" />
        </motion.div>

        {/* Capa da direita (acomoda atrás) */}
        <motion.div
          initial={
            shouldReduceMotion
              ? { opacity: 0.45 }
              : { opacity: 0, x: 36, rotate: 7, scale: 0.82 }
          }
          animate={{ opacity: 0.5, x: 28, rotate: 5, scale: 0.88 }}
          transition={
            shouldReduceMotion
              ? { duration: 0.2 }
              : { type: "spring", bounce: 0.1, duration: 0.45, delay: 0.08 }
          }
          className="absolute flex h-[76px] w-[54px] flex-col items-center justify-center rounded-xl border border-white/10 bg-gradient-to-b from-[#252525] to-[#121212] shadow-[0_10px_24px_rgba(0,0,0,0.6)]"
        >
          <div className="h-4 w-4 rounded-full bg-white/10" />
        </motion.div>

        {/* Capa principal no centro */}
        <motion.div
          initial={
            shouldReduceMotion
              ? { opacity: 1 }
              : { opacity: 0, scale: 0.94, y: 4 }
          }
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={
            shouldReduceMotion
              ? { duration: 0.2 }
              : { type: "spring", bounce: 0.15, duration: 0.4 }
          }
          className="relative z-20 flex h-[94px] w-[68px] flex-col items-center justify-center rounded-[18px] border border-white/20 bg-gradient-to-b from-[#2D2D2D] via-[#1C1C1C] to-[#111111] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_16px_36px_rgba(0,0,0,0.75)]"
        >
          <Gamepad2 className="h-7 w-7 text-white/95" strokeWidth={1.75} />

          {/* O "+ Novo" responde com uma breve mudança de luminosidade simulando a adição */}
          <motion.div
            initial={
              shouldReduceMotion
                ? { opacity: 1 }
                : { opacity: 0.75, filter: "brightness(1)" }
            }
            animate={
              shouldReduceMotion
                ? { opacity: 1 }
                : {
                    opacity: [0.75, 1, 1, 0.9],
                    filter: [
                      "brightness(1)",
                      "brightness(1.5)",
                      "brightness(1)",
                    ],
                  }
            }
            transition={
              shouldReduceMotion
                ? { duration: 0.2 }
                : { delay: 0.42, duration: 0.65, ease: "easeInOut" }
            }
            className="mt-2 flex items-center gap-1 rounded-full border border-white/20 bg-white/15 px-2 py-0.5 shadow-sm"
          >
            <Plus className="h-2.5 w-2.5 text-white" strokeWidth={2.5} />
            <span className="text-[8.5px] font-bold uppercase tracking-wider text-white">
              Novo
            </span>
          </motion.div>
        </motion.div>
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
   Microanimação 3: Troféus e XP (O momento mais marcante!)
   "1. O emblema entra com opacidade e deslocamento vertical de aproximadamente 6 px, em 350 ms.
    2. Um reflexo suave percorre apenas sua superfície em 700–900 ms.
    3. Abaixo, aparece “Conquista desbloqueada” e uma pequena demonstração de progresso de XP.
    4. A cena repousa. Um botão discreto “Rever animação” permite repetir."
   ────────────────────────────────────────────────────────────────────────── */
const THEME_NAMES: Record<SoundTheme, string> = {
  default: "Pherielium",
  ps5: "PlayStation 5",
  ps4: "PlayStation 4",
  psp: "PSP",
  ps2: "PlayStation 2",
  gamecube: "GameCube",
  xbox360: "Xbox 360",
  cyberpunk: "Cyberpunk",
};

const THEME_SHORT_NAMES: Record<SoundTheme, string> = {
  default: "Pherielium",
  ps5: "PS5",
  ps4: "PS4",
  psp: "PSP",
  ps2: "PS2",
  gamecube: "GC",
  xbox360: "Xbox 360",
  cyberpunk: "Cyberpunk",
};

interface TrophyXPPreviewProps {
  shouldReduceMotion?: boolean | null;
  playSound?: (sound: any) => void;
  soundTheme?: SoundTheme;
}

const TrophyXPPreview: React.FC<TrophyXPPreviewProps> = ({
  shouldReduceMotion,
  playSound,
  soundTheme = "default",
}) => {
  const [replayKey, setReplayKey] = useState(0);

  const handleReplay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setReplayKey((k) => k + 1);
  };

  const handlePlaySound = (e: React.MouseEvent) => {
    e.stopPropagation();
    playSound?.("overlayAchievementPlatinum");
  };

  return (
    <div
      key={replayKey}
      className="relative flex w-full flex-col items-center justify-center pt-1"
    >
      {/* Luz ambiente prateada/platina suave */}
      <div className="pointer-events-none absolute h-36 w-36 rounded-full bg-slate-200/[0.08] blur-2xl" />

      {/* 1. O emblema entra com opacidade e deslocamento vertical de ~6px em 350ms */}
      <motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          shouldReduceMotion
            ? { duration: 0.2 }
            : { duration: 0.35, ease: [0.16, 1, 0.3, 1] }
        }
        className="relative z-10"
      >
        {/* Acabamento uniforme para eliminar ruído da textura azul */}
        <div className="relative flex h-20 w-20 sm:h-22 sm:w-22 items-center justify-center overflow-hidden rounded-[20px] border border-white/20 bg-gradient-to-b from-[#2A2A2A] via-[#1E1E1E] to-[#121212] shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_14px_32px_rgba(0,0,0,0.7)]">
          <img
            src={platinaLogo}
            alt="Emblema Platina Pherielium"
            className="h-16 w-16 object-contain filter contrast-[1.05] brightness-[0.98] drop-shadow-[0_4px_10px_rgba(0,0,0,0.5)]"
            draggable={false}
          />

          {/* 2. Um reflexo suave percorre apenas sua superfície em 700–900 ms */}
          {!shouldReduceMotion && (
            <motion.div
              initial={{ x: "-130%", opacity: 0 }}
              animate={{
                x: "140%",
                opacity: [0, 0.7, 0.7, 0],
              }}
              transition={{
                delay: 0.35,
                duration: 0.8,
                ease: "easeInOut",
              }}
              className="pointer-events-none absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent"
            />
          )}
        </div>
      </motion.div>

      {/* 3. Abaixo, aparece “Conquista desbloqueada” e pequena demonstração de progresso de XP */}
      <motion.div
        initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={
          shouldReduceMotion
            ? { duration: 0.2 }
            : { delay: 0.72, duration: 0.35, ease: [0.16, 1, 0.3, 1] }
        }
        className="mt-2.5 flex flex-col items-center gap-1.5"
      >
        <div className="flex items-center gap-1.5">
          <span className="rounded border border-white/10 bg-white/10 px-1.5 py-0.5 text-[8.5px] font-bold uppercase tracking-widest text-white/50">
            Demonstração
          </span>
          <span className="text-[11.5px] font-semibold tracking-tight text-white/95">
            Conquista Desbloqueada
          </span>
        </div>

        {/* Barra de XP e pontuação */}
        <div className="flex items-center gap-2">
          <div className="h-1.5 w-28 overflow-hidden rounded-full bg-white/15">
            <motion.div
              initial={shouldReduceMotion ? { width: "75%" } : { width: "0%" }}
              animate={{ width: "75%" }}
              transition={
                shouldReduceMotion
                  ? { duration: 0 }
                  : { delay: 0.95, duration: 0.6, ease: [0.16, 1, 0.3, 1] }
              }
              className="h-full rounded-full bg-gradient-to-r from-white/70 via-white/90 to-white shadow-[0_0_8px_rgba(255,255,255,0.6)]"
            />
          </div>
          <span className="text-[10px] font-bold tabular-nums text-white/80">
            +150 XP
          </span>
        </div>
      </motion.div>

      {/* 4. A cena repousa. Botão discreto "Rever animação" e ouvir som */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.15, duration: 0.3 }}
        className="absolute bottom-1 right-2 flex items-center gap-1.5"
      >
        <button
          type="button"
          onClick={handlePlaySound}
          title={`Ouvir som do troféu (${THEME_NAMES[soundTheme] || "Pherielium"})`}
          className="flex cursor-pointer items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/60 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
        >
          <Volume2 className="h-2.5 w-2.5" />
          <span>Som ({THEME_SHORT_NAMES[soundTheme] || "Tema"})</span>
        </button>

        <button
          type="button"
          onClick={handleReplay}
          className="flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] font-medium text-white/60 transition-colors hover:border-white/20 hover:bg-white/10 hover:text-white"
        >
          <RotateCcw className="h-2.5 w-2.5" />
          <span>Rever</span>
        </button>
      </motion.div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
   Microanimação 4: Amigos e voz
   "O indicador de presença acende; dois arcos discretos ao redor do avatar
    reagem por um instante, sugerindo atividade de voz."
   ────────────────────────────────────────────────────────────────────────── */
const FriendsVoicePreview: React.FC<{ shouldReduceMotion?: boolean | null }> = ({
  shouldReduceMotion,
}) => {
  return (
    <div className="relative flex items-center justify-center">
      {/* Luz ambiente verde esmeralda sutil */}
      <div className="pointer-events-none absolute h-36 w-36 rounded-full bg-emerald-500/[0.08] blur-2xl" />

      <div className="relative z-10 flex items-center justify-center">
        {/* Dois arcos discretos ao redor do avatar reagindo por um instante */}
        {!shouldReduceMotion && (
          <>
            <motion.div
              initial={{ scale: 1, opacity: 0 }}
              animate={{
                scale: [1, 1.18, 1.24],
                opacity: [0, 0.45, 0],
              }}
              transition={{
                delay: 0.35,
                duration: 0.75,
                ease: "easeOut",
              }}
              className="pointer-events-none absolute h-24 w-24 rounded-full border border-[#30D158]/50"
            />
            <motion.div
              initial={{ scale: 1, opacity: 0 }}
              animate={{
                scale: [1, 1.34, 1.42],
                opacity: [0, 0.3, 0],
              }}
              transition={{
                delay: 0.48,
                duration: 0.8,
                ease: "easeOut",
              }}
              className="pointer-events-none absolute h-24 w-24 rounded-full border border-[#30D158]/30"
            />
          </>
        )}

        {/* Avatar central */}
        <motion.div
          initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={
            shouldReduceMotion
              ? { duration: 0.2 }
              : { type: "spring", bounce: 0.1, duration: 0.4 }
          }
          className="relative flex h-20 w-20 sm:h-22 sm:w-22 items-center justify-center rounded-full border border-white/20 bg-gradient-to-b from-[#252525] via-[#1A1A1A] to-[#101010] shadow-[inset_0_2px_4px_rgba(255,255,255,0.22),0_16px_36px_rgba(0,0,0,0.7)]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/90">
            <Users className="h-6 w-6" strokeWidth={1.75} />
          </div>

          {/* O indicador de presença acende com luz verde esmeralda */}
          <motion.div
            initial={
              shouldReduceMotion
                ? { opacity: 1, scale: 1 }
                : { opacity: 0, scale: 0.6 }
            }
            animate={{
              opacity: 1,
              scale: shouldReduceMotion ? 1 : [0.6, 1.25, 1],
            }}
            transition={
              shouldReduceMotion
                ? { duration: 0.2 }
                : { delay: 0.2, duration: 0.4, ease: "easeOut" }
            }
            className="absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-[#141414] bg-[#30D158] shadow-[0_0_10px_rgba(48,209,88,0.75)]"
          />
        </motion.div>
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
   Microanimação 5: Overlay
   "Uma miniatura do painel se abre sobre uma pequena cena de jogo e se acomoda,
    demonstrando o recurso em contexto."
   ────────────────────────────────────────────────────────────────────────── */
const OverlayPreview: React.FC<{ shouldReduceMotion?: boolean | null }> = ({
  shouldReduceMotion,
}) => {
  return (
    <div className="relative flex items-center justify-center">
      <div className="pointer-events-none absolute h-36 w-36 rounded-full bg-blue-500/[0.08] blur-2xl" />

      {/* Mini cena de jogo no fundo */}
      <div className="relative h-[116px] w-[220px] overflow-hidden rounded-2xl border border-white/15 bg-[#0C1017] shadow-[0_16px_36px_rgba(0,0,0,0.7)]">
        {/* Atmosfera imersiva de gameplay */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0F172A] via-[#0A0E1A] to-[#05070B]" />
        {/* Grade de terreno 3D em perspectiva sutil */}
        <div className="absolute inset-x-0 bottom-0 h-10 border-t border-white/5 bg-[linear-gradient(to_bottom,transparent,rgba(255,255,255,0.03))]" />
        {/* Retículo de mira central discreto */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="h-1.5 w-1.5 rounded-full bg-white/25" />
        </div>
        {/* Mini HUD de jogo no canto superior esquerdo */}
        <div className="absolute left-2.5 top-2 flex items-center gap-1 opacity-50">
          <div className="h-1 w-6 rounded-full bg-red-400/80" />
          <div className="h-1 w-4 rounded-full bg-sky-400/80" />
        </div>

        {/* Uma miniatura do painel se abre sobre a cena de jogo e se acomoda */}
        <motion.div
          initial={
            shouldReduceMotion ? { opacity: 1 } : { opacity: 0, x: -16, scale: 0.94 }
          }
          animate={{ opacity: 1, x: 0, scale: 1 }}
          transition={
            shouldReduceMotion
              ? { duration: 0.2 }
              : { type: "spring", bounce: 0.12, duration: 0.45, delay: 0.1 }
          }
          className="absolute inset-y-1.5 left-2 flex w-[138px] flex-col justify-between rounded-xl border border-white/20 bg-[#161616]/92 p-2 shadow-[0_12px_28px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.25)] backdrop-blur-md"
        >
          {/* Topo do overlay */}
          <div className="flex items-center justify-between border-b border-white/10 pb-1">
            <div className="flex items-center gap-1">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-400 shadow-[0_0_6px_rgba(56,189,248,0.8)]" />
              <span className="text-[8.5px] font-bold tracking-tight text-white/90">
                Pherielium
              </span>
            </div>
            <span className="text-[7.5px] font-medium text-white/50">20:45</span>
          </div>

          {/* Conteúdo miniatura */}
          <div className="my-1 space-y-1">
            <div className="flex items-center gap-1 rounded border border-white/5 bg-white/5 p-1">
              <Users className="h-2.5 w-2.5 text-emerald-400" />
              <span className="text-[7.5px] font-medium text-white/80">
                3 Amigos Online
              </span>
            </div>
          </div>

          {/* Atalho de ativação */}
          <div className="flex items-center justify-between border-t border-white/10 pt-0.5">
            <span className="text-[7.5px] font-medium text-white/50">Atalho</span>
            <span className="rounded bg-white/10 px-1 py-0.5 text-[7px] font-bold text-white/85">
              Ctrl+Shift+O
            </span>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

/* ──────────────────────────────────────────────────────────────────────────
   Cores dinâmicas de iluminação ambiente por etapa
   ────────────────────────────────────────────────────────────────────────── */
const STEP_GLOW_COLORS = [
  "rgba(255, 255, 255, 0.08)", // Boas-vindas (neutro)
  "rgba(255, 255, 255, 0.07)", // Biblioteca (neutro refinado)
  "rgba(215, 230, 255, 0.10)", // Troféus (platina / metal frio)
  "rgba(48, 209, 88, 0.09)",   // Amigos (verde esmeralda presença)
  "rgba(100, 140, 255, 0.10)", // Overlay (cor do tema / foco)
];

const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isOpen,
  onClose,
  playSound,
  onOpenAddGame,
  onConnectPlatform,
}) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [actionFeedback, setActionFeedback] = useState<string | null>(null);
  const shouldReduceMotion = useReducedMotion();
  const { soundTheme } = usePreferences();

  const handleNext = useCallback(() => {
    if (currentStep < 4) {
      setCurrentStep((prev) => prev + 1);
      playSound?.("select");
    } else {
      playSound?.("select");
      onClose();
    }
  }, [currentStep, onClose, playSound]);

  const handlePrev = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1);
      playSound?.("back");
    } else {
      playSound?.("back");
      onClose();
    }
  }, [currentStep, onClose, playSound]);

  useGamepadButton("X", handleNext, isOpen, 260);
  useGamepadButton("O", handlePrev, isOpen, 260);

  // Navegação por teclado
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        handlePrev();
      } else if (e.key === "Enter") {
        e.preventDefault();
        handleNext();
      } else if (e.key === "Escape") {
        e.preventDefault();
        playSound?.("back");
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, handleNext, handlePrev, onClose, playSound]);

  const steps: StepContent[] = [
    {
      stepNumber: 1,
      category: "BEM-VINDO AO PHERIELIUM",
      title: "Seus jogos. Suas pessoas. Seu universo.",
      subtitle:
        "Reúna sua biblioteca, acompanhe suas conquistas e encontre seus amigos no Pherielium.",
      items: [
        {
          icon: Layers,
          title: "Biblioteca Centralizada",
          description:
            "Reúna jogos do PC, emuladores e plataformas digitais em uma só coleção fluida.",
        },
        {
          icon: Sparkles,
          title: "Conquistas e Conexão",
          description:
            "Evolua seu perfil com troféus autênticos e encontre amigos em tempo real.",
        },
      ],
    },
    {
      stepNumber: 2,
      category: "PRIMEIRO PASSO",
      title: "Monte sua Biblioteca",
      subtitle:
        "Clique em '+ Novo' no topo direito ou use o atalho Ctrl + N para adicionar seus jogos.",
      isActionStep: true,
    },
    {
      stepNumber: 3,
      category: "PROGRESSO",
      title: "Sistema de Troféus e XP",
      subtitle: "Cada momento jogado constrói seu legado no Pherielium.",
      items: [
        {
          icon: Sparkles,
          title: "Evolução do Jogador",
          description:
            "Suba de nível, ganhe pontos de XP e acompanhe seu histórico de jogatina.",
        },
        {
          icon: Check,
          title: "Feedback Sonoro Autêntico",
          description:
            "Desbloqueie troféus com animações e efeitos sonoros inspirados em consoles.",
        },
      ],
    },
    {
      stepNumber: 4,
      category: "COMUNIDADE",
      title: "Amigos e Voz em Tempo Real",
      subtitle:
        "Conecte-se com amigos por ID único, inicie conversas e compartilhe tela.",
      items: [
        {
          icon: Users,
          title: "Presença Ativa",
          description:
            "Acompanhe o que seus amigos estão jogando e junte-se à partida com um clique.",
        },
        {
          icon: Mic,
          title: "Salas de Áudio & Transmissão",
          description:
            "Comunicação com cancelamento de ruído e transmissão de tela estável.",
        },
      ],
    },
    {
      stepNumber: 5,
      category: "EXPERIÊNCIA",
      title: "Desempenho e Imersão",
      subtitle: "Ajuste animações e o comportamento do hub enquanto joga.",
      items: [
        {
          icon: Monitor,
          title: "Overlay In-Game (Ctrl + Shift + O)",
          description:
            "Abra conversas, lista de amigos e métricas rápidas sem pausar sua partida.",
        },
        {
          icon: Sparkles,
          title: "Personalização Completa",
          description:
            "Escolha temas visuais e sons clássicos de consoles nas preferências do hub.",
        },
      ],
    },
  ];

  const current = steps[currentStep];

  const renderBannerVisual = () => {
    switch (currentStep) {
      case 0:
        return <WelcomeLogoPreview shouldReduceMotion={shouldReduceMotion} />;
      case 1:
        return <LibraryPreview shouldReduceMotion={shouldReduceMotion} />;
      case 2:
        return (
          <TrophyXPPreview
            shouldReduceMotion={shouldReduceMotion}
            playSound={playSound}
            soundTheme={soundTheme}
          />
        );
      case 3:
        return <FriendsVoicePreview shouldReduceMotion={shouldReduceMotion} />;
      case 4:
        return <OverlayPreview shouldReduceMotion={shouldReduceMotion} />;
      default:
        return <WelcomeLogoPreview shouldReduceMotion={shouldReduceMotion} />;
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClassName="max-w-[460px]"
      zIndexClassName="z-[260]"
      backdropClassName="bg-black/80 backdrop-blur-md"
      ariaLabel="Tour de Boas-Vindas ao Pherielium"
      gamepadPriority={260}
      className="overflow-hidden rounded-[28px] border border-white/10 bg-[#141414] p-0 shadow-[0_32px_90px_rgba(0,0,0,0.8)]"
    >
      <div className="relative overflow-hidden">
        {/* Banner superior com iluminação adaptativa e altura ampliada estável */}
        <div className="relative flex h-[200px] items-center justify-center overflow-hidden bg-[#0A0A0A]">
          {/* Fundo luminoso que muda suavemente de tonalidade conforme o conteúdo */}
          <motion.div
            key={`glow-${currentStep}`}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
            className="pointer-events-none absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at center, ${
                STEP_GLOW_COLORS[currentStep] || STEP_GLOW_COLORS[0]
              } 0%, transparent 68%)`,
            }}
          />

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.98, y: 4 }
              }
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, scale: 0.98, y: -4 }
              }
              transition={
                shouldReduceMotion
                  ? { duration: 0.15 }
                  : {
                      duration: 0.3,
                      ease: [0.16, 1, 0.3, 1],
                    }
              }
              className="relative z-10 flex h-full w-full items-center justify-center"
            >
              {renderBannerVisual()}
            </motion.div>
          </AnimatePresence>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[#141414] to-transparent" />

          {/* Botão de Fechar no topo */}
          <button
            type="button"
            onClick={() => {
              playSound?.("back");
              onClose();
            }}
            aria-label="Fechar guia"
            className="absolute right-3.5 top-3.5 z-20 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/45 text-white/70 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-black/65 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Corpo com conteúdo do Step estável (sem saltos de layout) */}
        <div className="px-6 pb-6 pt-2">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, x: 8 }
              }
              animate={{ opacity: 1, x: 0 }}
              exit={
                shouldReduceMotion
                  ? { opacity: 0 }
                  : { opacity: 0, x: -8 }
              }
              transition={{
                duration: 0.25,
                ease: [0.16, 1, 0.3, 1],
              }}
            >
              <header className="min-h-[76px]">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/60">
                    {current.category}
                  </p>
                  <span className="rounded-full border border-white/10 bg-white/[0.05] px-2.5 py-0.5 text-[11px] font-medium tracking-wider text-white/50">
                    {currentStep + 1} de {steps.length}
                  </span>
                </div>
                <h2 className="mt-1 text-[20px] font-bold leading-tight tracking-tight text-white">
                  {current.title}
                </h2>
                <p className="mt-1 text-[12.5px] font-normal leading-relaxed text-white/75">
                  {current.subtitle}
                </p>
              </header>

              {/* Step 2: Primeira Ação Útil Interativa */}
              {current.isActionStep ? (
                <div className="mt-3.5 min-h-[156px] space-y-2.5">
                  {actionFeedback ? (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      className="flex items-center gap-2.5 rounded-2xl border border-white/20 bg-white/10 p-3 text-white"
                    >
                      <Check className="h-4 w-4 text-[#30D158]" strokeWidth={2.5} />
                      <span className="text-[13px] font-medium">{actionFeedback}</span>
                    </motion.div>
                  ) : (
                    <>
                      {/* Opção 1: Conectar Plataforma */}
                      <button
                        type="button"
                        onClick={() => {
                          playSound?.("select");
                          if (onConnectPlatform) {
                            setActionFeedback("Abrindo conexões...");
                            setTimeout(() => {
                              onConnectPlatform();
                            }, 350);
                          } else {
                            handleNext();
                          }
                        }}
                        className="group relative flex w-full cursor-pointer items-center gap-3.5 rounded-2xl border border-white/12 bg-white/[0.04] p-3 text-left transition-all duration-200 hover:border-white/25 hover:bg-white/[0.08] active:scale-[0.99]"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white shadow-inner">
                          <RefreshCw className="h-5 w-5 text-white/90 transition-transform duration-300 group-hover:rotate-45" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-[13.5px] font-semibold text-white">
                              Conectar uma plataforma
                            </p>
                            <ChevronRight className="h-4 w-4 text-white/40 transition-all group-hover:translate-x-0.5 group-hover:text-white" />
                          </div>
                          <p className="mt-0.5 text-[12px] font-normal leading-relaxed text-white/65">
                            Vincule sua conta Steam ou Epic para sincronização automática.
                          </p>
                        </div>
                      </button>

                      {/* Opção 2: Adicionar jogo do computador */}
                      <button
                        type="button"
                        onClick={() => {
                          playSound?.("select");
                          if (onOpenAddGame) {
                            setActionFeedback("Abrindo assistente de adição...");
                            setTimeout(() => {
                              onOpenAddGame();
                              onClose();
                            }, 350);
                          } else {
                            handleNext();
                          }
                        }}
                        className="group relative flex w-full cursor-pointer items-center gap-3.5 rounded-2xl border border-white/12 bg-white/[0.04] p-3 text-left transition-all duration-200 hover:border-white/25 hover:bg-white/[0.08] active:scale-[0.99]"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/10 text-white shadow-inner">
                          <Plus className="h-5 w-5 text-white/90 transition-transform duration-300 group-hover:scale-110" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-[13.5px] font-semibold text-white">
                              Adicionar jogo do computador
                            </p>
                            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/70">
                              Ctrl + N
                            </span>
                          </div>
                          <p className="mt-0.5 text-[12px] font-normal leading-relaxed text-white/65">
                            Cadastre executáveis (.exe) com capas e artes automáticas.
                          </p>
                        </div>
                      </button>

                      {/* Opção 3: Fazer isso depois */}
                      <button
                        type="button"
                        onClick={() => {
                          playSound?.("navigate");
                          handleNext();
                        }}
                        className="w-full cursor-pointer py-1 text-center text-[12px] font-medium text-white/60 transition-colors hover:text-white"
                      >
                        Fazer isso depois →
                      </button>
                    </>
                  )}
                </div>
              ) : (
                /* Lista compacta de destaques */
                <ul className="mt-3.5 min-h-[156px] space-y-2.5">
                  {current.items?.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <li
                        key={index}
                        className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5"
                      >
                        <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-white/90">
                          <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-[13px] font-semibold leading-snug text-white">
                            {item.title}
                          </p>
                          <p className="mt-0.5 text-[12px] font-normal leading-relaxed text-white/65">
                            {item.description}
                          </p>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Stepper Dots Indicators */}
          <div className="mt-4 flex items-center justify-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  playSound?.("navigate");
                  setCurrentStep(i);
                }}
                aria-label={`Ir para passo ${i + 1}`}
                className={`h-1.5 cursor-pointer rounded-full transition-all duration-300 ${
                  i === currentStep
                    ? "w-5 bg-white"
                    : "w-1.5 bg-white/25 hover:bg-white/45"
                }`}
              />
            ))}
          </div>

          {/* Rodapé estável com botões Anterior / Continuar */}
          <footer className="mt-3.5">
            <div className="grid grid-cols-2 gap-2.5">
              {currentStep > 0 ? (
                <button
                  type="button"
                  onClick={handlePrev}
                  aria-label="Passo anterior"
                  className="flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full border border-white/10 bg-white/10 px-4 text-[13px] font-semibold text-white/80 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 active:scale-[0.98]"
                >
                  <ChevronLeft className="h-4 w-4" />
                  <span>Voltar</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    playSound?.("back");
                    onClose();
                  }}
                  aria-label="Pular apresentação"
                  className="flex h-11 cursor-pointer items-center justify-center rounded-full border border-white/10 bg-white/10 px-4 text-[13px] font-semibold text-white/80 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 active:scale-[0.98]"
                >
                  Pular
                </button>
              )}

              <button
                type="button"
                onClick={handleNext}
                aria-label={
                  currentStep === steps.length - 1
                    ? "Começar a Jogar"
                    : "Próximo passo"
                }
                className="flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-[#E8E8E8] px-4 text-[13px] font-semibold text-[#111] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-[0.98]"
              >
                <span>
                  {currentStep === steps.length - 1 ? "Começar a Jogar" : "Continuar"}
                </span>
                {currentStep < steps.length - 1 && <ChevronRight className="h-4 w-4" />}
              </button>
            </div>

            <button
              type="button"
              onClick={() => {
                playSound?.("back");
                onClose();
              }}
              className="mt-2 block w-full cursor-pointer text-center text-[12px] font-medium text-white/45 transition-colors hover:text-white/80"
            >
              Pular guia
            </button>
          </footer>
        </div>
      </div>
    </ModalShell>
  );
};

export default WelcomeModal;
