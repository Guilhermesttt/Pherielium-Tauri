import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { MascotView } from "../mascot/MascotView";
import { TourPanelView, TourVisualView } from "./TourVisuals";
import { appleSprings, materialize } from "../design-system/motion";
import type { TourStep } from "./tourSteps";


interface TourSceneProps {
  step: TourStep;
  index: number;
  total: number;
  /** de onde o usuário veio: +1 avançou, -1 voltou (decide o lado de onde a cena entra) */
  direction: 1 | -1;
  isLast: boolean;
  onNext: () => void;
  onBack: () => void;
  onSkip: () => void;
  /** o painel da cena concluiu a tarefa (ex.: o controle foi conectado) */
  onTaskDone: () => void;
  /** a pessoa não tem controle agora */
  onNoController: () => void;
  bodyColor: string | null;
  zIndex: number;
}

/**
 * Cena em tela cheia do tutorial: o fundo cobre a janela inteira e cada passo entra deslizando pelo
 * lado certo, com a Pherie grande e o gesto ilustrado. Usada nos passos sem alvo (boas-vindas,
 * ajustes, notch...).
 */
export const TourScene: React.FC<TourSceneProps> = ({ step, index, total, direction, isLast, onNext, onBack, onSkip, onTaskDone, onNoController, bodyColor, zIndex }) => {
  const practice = step.advanceOn === "practice";
  const noControllerStep = step.panel === "controller-connect";
  const reduce = useReducedMotion();
  const enter = reduce ? { opacity: 0 } : { opacity: 0, x: 48 * direction, scale: 0.985 };
  const leave = reduce ? { opacity: 0 } : { opacity: 0, x: -48 * direction, scale: 0.985 };

  return (
    <motion.div
      className="fixed inset-0 flex flex-col bg-[var(--tone-0)] text-white"
      style={{ zIndex }}
      role="dialog"
      aria-modal="true"
      aria-label="Tutorial de boas-vindas"
      initial={reduce ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_30%,rgba(255,255,255,0.08)_0%,transparent_58%)]"
      />

      {/* progresso + pular */}
      <header className="relative z-10 px-8 pt-7">
        <div className="flex items-center justify-between text-[length:var(--step-0)] font-semibold tracking-[0.12em] text-[var(--ink-faint)]">
          <span className="tabular-nums">
            ETAPA {index + 1} DE {total}
          </span>
          {!isLast && (
            <button type="button" onClick={onSkip} className="cursor-pointer tracking-normal transition hover:text-white">
              Pular tutorial
            </button>
          )}
        </div>
        <div className="mt-3 flex gap-1.5" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={index + 1}>
          {Array.from({ length: total }, (_, i) => (
            <motion.span
              key={i}
              className="h-1 flex-1 rounded-full"
              initial={false}
              animate={{ backgroundColor: i <= index ? "rgba(255,255,255,0.95)" : "rgba(255,255,255,0.18)" }}
              transition={{ duration: 0.4 }}
            />
          ))}
        </div>
      </header>

      {/* cena */}
      <main className="relative z-10 flex flex-1 items-center justify-center overflow-y-auto px-8 py-6">
        <AnimatePresence mode="wait" initial={false}>
          <motion.section
            key={step.id}
            className="flex w-full max-w-[560px] flex-col items-center text-center"
            initial={enter}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={leave}
            transition={reduce ? { duration: 0.15 } : appleSprings.move}
          >
            <MascotView size={isLast ? 132 : 108} mood={step.mood} bodyColor={bodyColor} isHovered />
            <h1 className="mt-5 text-[length:var(--step-4)] font-semibold leading-[1.05] tracking-[-0.02em]">{step.title}</h1>
            <p className="mt-2 max-w-[460px] text-[length:var(--step-1)] leading-relaxed text-[var(--ink-muted)]">{step.text}</p>
            {step.visual && (
              <div className="mt-6 w-full max-w-[360px] rounded-3xl bg-white/[0.04] p-4">
                <TourVisualView visual={step.visual} />
              </div>
            )}
            {step.panel && (
              <div className={`mt-5 w-full text-left ${step.panel === "notch-setup" ? "max-w-[600px]" : "max-w-[460px]"}`}>
                <TourPanelView panel={step.panel} onDone={onTaskDone} onNoController={onNoController} />
              </div>
            )}
          </motion.section>
        </AnimatePresence>
      </main>

      {/* navegação */}
      <footer className="relative z-10 flex items-center justify-between px-8 pb-8">
        {index > 0 ? (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-11 cursor-pointer items-center gap-2 rounded-full bg-white/[0.08] px-5 text-[length:var(--step-1)] font-semibold apple-press transition hover:bg-white/[0.14]"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={noControllerStep ? onNoController : onNext}
          className={`inline-flex h-11 cursor-pointer items-center gap-2 rounded-full px-6 text-[length:var(--step-1)] font-semibold apple-press transition ${
            practice ? "bg-white/[0.08] text-white hover:bg-white/[0.14]" : "bg-white text-black hover:bg-white/90"
          }`}
        >
          {noControllerStep ? "Continuar sem controle" : practice ? "Pular" : isLast ? "Começar" : "Continuar"} <ArrowRight className="h-4 w-4" />
        </button>
      </footer>
    </motion.div>
  );
};

const CONFETTI = Array.from({ length: 26 }, (_, i) => ({
  id: i,
  left: (i * 37 + 11) % 100,
  delay: ((i * 13) % 14) / 20,
  color: ["#7dd3fc", "#f0abfc", "#fde68a", "#86efac", "#fca5a5"][i % 5],
}));

/**
 * Selo de "tarefa concluída": a Pherie comemora com confete e um check por alguns segundos, antes
 * do próximo passo. Confete em CSS (não depende da biblioteca de animação para tocar).
 */
export const TourFlash: React.FC<{ label: string; zIndex: number; bodyColor?: string | null }> = ({ label, zIndex, bodyColor = null }) => {
  const reduce = useReducedMotion();
  // muda uma vez por exibição: faz a Pherie levantar as mãos ("tcharam!")
  const celebrateAt = React.useMemo(() => Date.now(), []);
  return (
    <motion.div
      className="pointer-events-none fixed inset-0 flex items-center justify-center overflow-hidden bg-black/60 backdrop-blur-md"
      style={{ zIndex }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.22 }}
      role="status"
      aria-live="polite"
    >
      {!reduce && CONFETTI.map((c) => <span key={c.id} className="tour-confetti" style={{ left: `${c.left}%`, background: c.color, animationDelay: `${c.delay}s` }} />)}
      <motion.div
        className="flex flex-col items-center gap-2"
        initial={reduce ? false : materialize.initial}
        animate={materialize.animate}
        transition={appleSprings.delight}
      >
        <MascotView size={132} mood="excited" bodyColor={bodyColor} celebrateAt={celebrateAt} isHovered />
        <span className="-mt-1 grid h-14 w-14 place-items-center rounded-full bg-emerald-400 text-black shadow-[0_0_0_8px_rgba(52,211,153,0.2)]">
          <Check className="h-8 w-8" strokeWidth={3} />
        </span>
        <p className="mt-1 text-[length:var(--step-3)] font-semibold text-white">Feito!</p>
        <p className="text-[length:var(--step-1)] text-[var(--ink-muted)]">{label}</p>
      </motion.div>
    </motion.div>
  );
};

/** A Pherie triste por um instante: a pessoa não tem controle agora. Depois o tutorial segue sem as etapas dele. */
export const TourSad: React.FC<{ zIndex: number; bodyColor?: string | null }> = ({ zIndex, bodyColor = null }) => {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className="fixed inset-0 flex items-center justify-center bg-[var(--tone-0)]"
      style={{ zIndex }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.25 }}
      role="status"
      aria-live="polite"
    >
      <motion.div
        className="flex flex-col items-center gap-3 text-center"
        initial={reduce ? false : { y: 12, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={appleSprings.move}
      >
        <MascotView size={132} mood="sad" bodyColor={bodyColor} isHovered />
        <p className="text-[length:var(--step-3)] font-semibold text-white">Ah, que pena…</p>
        <p className="max-w-[380px] text-[length:var(--step-1)] text-[var(--ink-muted)]">
          Sem problema! Tudo funciona com mouse e teclado. Quando tiver um controle, é só conectar.
        </p>
      </motion.div>
    </motion.div>
  );
};
