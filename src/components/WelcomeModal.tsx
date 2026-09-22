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
  Camera,
  Layers,
  Check,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ModalShell from "./ui/ModalShell";
import { useGamepadButton } from "../context/GamepadContext";
import desktopIcon from "../assets/Pherielium_Desktop_icon.png";
import epicBadgeIcon from "../assets/brands/epic-games.png";

interface WelcomeModalProps {
  isOpen: boolean;
  onClose: () => void;
  playSound?: (sound: "select" | "back" | "navigate") => void;
}

interface StepContent {
  stepNumber: number;
  category: string;
  title: string;
  subtitle: string;
  bannerVisual: React.ReactNode;
  items: {
    icon: React.ComponentType<{ className?: string; strokeWidth?: number }>;
    title: string;
    description: string;
  }[];
}

const WelcomeModal: React.FC<WelcomeModalProps> = ({
  isOpen,
  onClose,
  playSound,
}) => {
  const [currentStep, setCurrentStep] = useState(0);

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

  // Keyboard navigation
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
      title: "Seu Hub de Jogos Definitivo",
      subtitle:
        "Tudo o que você joga, suas conquistas e seus amigos reunidos em uma interface ultrarrápida.",
      bannerVisual: (
        <div className="relative flex items-center justify-center">
          <div className="absolute h-32 w-32 rounded-full bg-white/10 blur-2xl" />
          <img
            src={desktopIcon}
            alt="Pherielium Hub"
            className="relative z-10 h-28 w-28 rounded-[24px] object-cover shadow-[0_16px_40px_rgba(0,0,0,0.6)]"
            draggable={false}
          />
        </div>
      ),
      items: [
        {
          icon: Layers,
          title: "Biblioteca Unificada",
          description:
            "Reúna jogos de PC, emuladores e plataformas digitais em uma coleção fluida e organizada.",
        },
        {
          icon: Sparkles,
          title: "Sistema de Troféus e XP",
          description:
            "Evolua seu nível de jogador e desbloqueie troféus com animações e efeitos sonoros exclusivos.",
        },
        {
          icon: Check,
          title: "Foco e Desempenho",
          description:
            "Interface minimalista, zero engasgos e consumo ultrabaixo de memória RAM em segundo plano.",
        },
      ],
    },
    {
      stepNumber: 2,
      category: "ORGANIZAÇÃO",
      title: "Adicione seus Jogos",
      subtitle:
        "Cadastre executáveis (.exe), emuladores ou atalhos com metadados e capas automáticas.",
      bannerVisual: (
        <div className="relative flex items-center justify-center">
          <div className="absolute h-28 w-28 rounded-full bg-blue-500/15 blur-2xl" />
          <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-[24px] border border-white/15 bg-white/5 shadow-[0_16px_40px_rgba(0,0,0,0.5)]">
            <Gamepad2 className="h-12 w-12 text-white/90" strokeWidth={1.5} />
            <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-full border border-white/20 bg-[#222] text-white">
              <Plus className="h-4 w-4" strokeWidth={2.5} />
            </div>
          </div>
        </div>
      ),
      items: [
        {
          icon: Plus,
          title: "Botão Adicionar Jogo (+)",
          description:
            "Clique no botão '+' na barra lateral ou pressione o atalho para cadastrar qualquer jogo.",
        },
        {
          icon: Sparkles,
          title: "Capas e Metadados na Nuvem",
          description:
            "Buscamos automaticamente capas verticais, logos transparentes e artes em alta resolução.",
        },
        {
          icon: Layers,
          title: "Filtros e Coleções",
          description:
            "Classifique por tempo jogado, launcher, favoritos ou ordem alfabética com um clique.",
        },
      ],
    },
    {
      stepNumber: 3,
      category: "CONEXÕES",
      title: "Sincronize Steam & Epic",
      subtitle:
        "Importe instantaneamente suas bibliotecas da Steam e Epic Games com sincronização automática.",
      bannerVisual: (
        <div className="relative flex items-center justify-center gap-4">
          <div className="absolute h-28 w-44 rounded-full bg-emerald-500/10 blur-2xl" />
          <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-[22px] border border-white/15 bg-white/5 shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
            <RefreshCw className="h-9 w-9 text-white/80 animate-spin-slow" strokeWidth={1.75} />
          </div>
          <div className="relative z-10 flex h-16 w-16 items-center justify-center rounded-[20px] border border-white/10 bg-[#1e1e1e] shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
            <img src={epicBadgeIcon} alt="Epic Games" className="h-8 w-8 object-contain" />
          </div>
        </div>
      ),
      items: [
        {
          icon: RefreshCw,
          title: "Sincronização com 1 Clique",
          description:
            "Vincule sua conta nas Configurações e todos os seus títulos serão listados imediatamente.",
        },
        {
          icon: Check,
          title: "Sessões Persistentes",
          description:
            "Suas contas permanecem ativas e seguras mesmo após fechar e reiniciar o Pherielium.",
        },
        {
          icon: Layers,
          title: "Conquistas Integradas",
          description:
            "Acompanhe suas conquistas da Steam e da Epic Games de forma unificada no seu perfil.",
        },
      ],
    },
    {
      stepNumber: 4,
      category: "COMUNIDADE",
      title: "Amigos & Voz em Tempo Real",
      subtitle:
        "Fale com seus amigos com baixa latência, cancelamento de ruído e transmissão de tela.",
      bannerVisual: (
        <div className="relative flex items-center justify-center gap-3">
          <div className="absolute h-28 w-36 rounded-full bg-purple-500/15 blur-2xl" />
          <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-[22px] border border-white/15 bg-white/5 shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
            <Users className="h-9 w-9 text-white/90" strokeWidth={1.75} />
          </div>
          <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#1e1e1e]">
            <Mic className="h-6 w-6 text-white/70" strokeWidth={1.75} />
          </div>
        </div>
      ),
      items: [
        {
          icon: Users,
          title: "Checkpoint ID Único",
          description:
            "Adicione seus amigos usando o ID de jogador ou o e-mail cadastrado e veja o status ao vivo.",
        },
        {
          icon: Mic,
          title: "Áudio com IA e Redução de Ruído",
          description:
            "Salas de voz com supressão de ruído inteligente para você focar apenas na gameplay.",
        },
        {
          icon: Monitor,
          title: "Compartilhamento a 60 FPS",
          description:
            "Transmita sua tela com aceleração por hardware fluida e sem atrasos na chamada.",
        },
      ],
    },
    {
      stepNumber: 5,
      category: "IMERSÃO",
      title: "Temas, Sons & Overlay",
      subtitle:
        "Personalize o launcher com sons de consoles lendários e controle seus jogos via Overlay.",
      bannerVisual: (
        <div className="relative flex items-center justify-center gap-3">
          <div className="absolute h-28 w-44 rounded-full bg-amber-500/15 blur-2xl" />
          <div className="relative z-10 flex h-20 w-20 items-center justify-center rounded-[22px] border border-white/15 bg-white/5 shadow-[0_12px_32px_rgba(0,0,0,0.5)]">
            <Sparkles className="h-9 w-9 text-white/90" strokeWidth={1.75} />
          </div>
          <div className="relative z-10 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-[#1e1e1e]">
            <Camera className="h-6 w-6 text-white/70" strokeWidth={1.75} />
          </div>
        </div>
      ),
      items: [
        {
          icon: Sparkles,
          title: "Sons de Consoles (PS5, PS4, GameCube...)",
          description:
            "Navegue com efeitos de áudio autênticos e temas visuais sob medida nas preferências.",
        },
        {
          icon: Monitor,
          title: "Overlay In-Game (Ctrl + Shift + O)",
          description:
            "Abra o menu de amigos, conversas e desempenho em tempo real sem sair da partida.",
        },
        {
          icon: Camera,
          title: "Fotos de Gameplay (Tecla F10)",
          description:
            "Tire screenshots instantâneas durante seus jogos com o som clássico de obturador.",
        },
      ],
    },
  ];

  const current = steps[currentStep];

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={onClose}
      maxWidthClassName="max-w-[460px]"
      zIndexClassName="z-[260]"
      backdropClassName="bg-black/80 backdrop-blur-md"
      ariaLabel="Tour de Boas-Vindas ao Pherielium"
      gamepadPriority={260}
      className="overflow-hidden rounded-[28px] border border-white/10 bg-[#141414] p-0 shadow-[0_32px_90px_rgba(0,0,0,0.75)]"
    >
      <div className="relative overflow-hidden">
        {/* Banner superior com gradiente e visual da etapa */}
        <div className="relative flex h-[175px] items-center justify-center overflow-hidden bg-[#0A0A0A]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.08)_0%,transparent_65%)]" />

          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, scale: 0.92, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: -8 }}
              transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
              className="relative z-10"
            >
              {current.bannerVisual}
            </motion.div>
          </AnimatePresence>

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#141414] to-transparent" />

          {/* Botão de Fechar no topo */}
          <button
            type="button"
            onClick={() => {
              playSound?.("back");
              onClose();
            }}
            aria-label="Pular apresentação"
            className="absolute right-3.5 top-3.5 z-20 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/45 text-white/60 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-black/65 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Corpo com conteúdo do Step */}
        <div className="px-6 pb-6 pt-3">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentStep}
              initial={{ opacity: 0, x: 12 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -12 }}
              transition={{ type: "spring", bounce: 0.1, duration: 0.3 }}
            >
              <header>
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/40">
                    {current.category}
                  </p>
                  <span className="text-[11px] font-medium tracking-wider text-white/30">
                    {currentStep + 1} DE {steps.length}
                  </span>
                </div>
                <h2 className="mt-1.5 text-[22px] font-bold leading-tight tracking-tight text-white">
                  {current.title}
                </h2>
                <p className="mt-2 text-[13px] font-medium leading-relaxed text-white/50">
                  {current.subtitle}
                </p>
              </header>

              {/* Lista de destaques */}
              <ul className="mt-5 space-y-3.5">
                {current.items.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <li key={index} className="flex items-start gap-3">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border border-white/15 bg-white/5 text-white/80">
                        <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-[13.5px] font-semibold leading-snug text-white">
                          {item.title}
                        </p>
                        <p className="mt-0.5 text-[12.5px] font-medium leading-relaxed text-white/45">
                          {item.description}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </motion.div>
          </AnimatePresence>

          {/* Stepper Dots Indicators */}
          <div className="mt-6 flex items-center justify-center gap-1.5">
            {steps.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => {
                  playSound?.("navigate");
                  setCurrentStep(i);
                }}
                aria-label={`Ir para passo ${i + 1}`}
                className={`h-1.5 rounded-full transition-all duration-200 cursor-pointer ${
                  i === currentStep
                    ? "w-6 bg-white"
                    : "w-1.5 bg-white/20 hover:bg-white/40"
                }`}
              />
            ))}
          </div>

          {/* Rodapé com botões Anterior / Próximo */}
          <footer className="mt-5 grid grid-cols-2 gap-2.5">
            {currentStep > 0 ? (
              <button
                type="button"
                onClick={handlePrev}
                aria-label="Passo anterior"
                className="flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-[#2A2A2A] px-4 text-[13px] font-semibold text-white/70 transition-colors hover:bg-[#333] hover:text-white/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 active:scale-[0.98]"
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
                className="h-11 cursor-pointer rounded-full bg-[#2A2A2A] px-4 text-[13px] font-semibold text-white/60 transition-colors hover:bg-[#333] hover:text-white/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40 active:scale-[0.98]"
              >
                Pular
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              aria-label={currentStep === steps.length - 1 ? "Começar a Usar" : "Próximo passo"}
              className="flex h-11 cursor-pointer items-center justify-center gap-1.5 rounded-full bg-[#E8E8E8] px-4 text-[13px] font-semibold text-[#111] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white active:scale-[0.98]"
            >
              <span>{currentStep === steps.length - 1 ? "Começar a Jogar" : "Continuar"}</span>
              {currentStep < steps.length - 1 && <ChevronRight className="h-4 w-4" />}
            </button>
          </footer>
        </div>
      </div>
    </ModalShell>
  );
};

export default WelcomeModal;
