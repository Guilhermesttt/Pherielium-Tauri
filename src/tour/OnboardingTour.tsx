import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { animated, useSpring } from "@react-spring/web";
import { motion, useReducedMotion } from "framer-motion";
import { MascotView } from "../mascot/MascotView";
import { useNotchConfig } from "../mascot/useNotchConfig";
import { SPRINGS } from "../design-system/motion";
import {
  TOUR_STEPS,
  coachPlacement,
  loadTourState,
  saveTourState,
  stepIndexFrom,
  tourForceKey,
  type Rect,
  type TourStep,
} from "./tourSteps";

const INTRO_KEY = "pherielium_intro_v1";
const Z = 320; // acima de ModalShell (100) e GameLaunchIntro (200)
const HOLE_PAD = 8;
const COACH = { width: 360, height: 188 };

/** Retângulo do alvo, remedido a cada quadro (abas e carrosséis se mexem). */
function useTargetRect(selector: string | null): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);
  useLayoutEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    let raf = 0;
    let last = "";
    let scrolled = false;
    const tick = () => {
      const el = document.querySelector<HTMLElement>(selector);
      if (el) {
        if (!scrolled) {
          scrolled = true;
          el.scrollIntoView({ block: "nearest", inline: "nearest" });
        }
        const r = el.getBoundingClientRect();
        const key = `${Math.round(r.x)}|${Math.round(r.y)}|${Math.round(r.width)}|${Math.round(r.height)}`;
        if (key !== last) {
          last = key;
          setRect({ x: r.x, y: r.y, width: r.width, height: r.height });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    tick();
    return () => cancelAnimationFrame(raf);
  }, [selector]);
  return rect;
}

/** Tem algum diálogo modal aberto? (o tour espera ele fechar antes de seguir) */
const modalOpen = () => document.querySelector('[aria-modal="true"], [role="dialog"][data-state="open"]') !== null;

/** Abertura no overlay (a Pherie na área de trabalho → notch). Só no app instalado e só na 1ª vez. */
async function playIntroOnce(force: boolean): Promise<void> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) return;
  try {
    if (!force && localStorage.getItem(INTRO_KEY)) return;
    localStorage.setItem(INTRO_KEY, "1");
    const { emit, listen } = await import("@tauri-apps/api/event");
    await new Promise<void>((resolve) => {
      let unlisten: (() => void) | undefined;
      const finish = () => {
        unlisten?.();
        resolve();
      };
      const timer = window.setTimeout(finish, 12_000);
      void listen("overlay:intro-done", () => {
        window.clearTimeout(timer);
        finish();
      }).then((fn) => {
        unlisten = fn;
      });
      void emit("overlay:intro", {});
    });
  } catch {
    /* sem overlay: segue direto para o tutorial */
  }
}

const hasTarget = (selector: string) => document.querySelector(selector) !== null;

/** Dica visual da Alt + rolagem. */
const AltScrollHint: React.FC = () => (
  <div className="mt-2 flex items-center gap-2" aria-hidden>
    <kbd className="rounded-md border border-white/25 bg-white/10 px-2 py-0.5 text-[11px] font-semibold text-white">Alt</kbd>
    <span className="text-white/50">+</span>
    <motion.span
      className="relative flex h-7 w-5 justify-center rounded-full border border-white/40 pt-1"
      animate={{ opacity: [0.6, 1, 0.6] }}
      transition={{ duration: 1.4, repeat: Infinity }}
    >
      <motion.span
        className="h-2 w-[3px] rounded-full bg-white"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
      />
    </motion.span>
  </div>
);

const Confetti: React.FC = () => {
  const bits = useMemo(
    () => Array.from({ length: 22 }, (_, i) => ({ id: i, x: (i * 37) % 100, d: 0.6 + ((i * 13) % 10) / 10, c: ["#7dd3fc", "#f0abfc", "#fde68a", "#86efac"][i % 4] })),
    [],
  );
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      {bits.map((b) => (
        <motion.span
          key={b.id}
          className="absolute top-0 h-2 w-1.5 rounded-sm"
          style={{ left: `${b.x}%`, backgroundColor: b.c }}
          initial={{ y: -20, rotate: 0, opacity: 0 }}
          animate={{ y: 260, rotate: 360, opacity: [0, 1, 1, 0] }}
          transition={{ duration: 1.6 + b.d, delay: b.id * 0.04, ease: "easeOut" }}
        />
      ))}
    </div>
  );
};

export interface OnboardingTourProps {
  uid: string | undefined;
  /** o usuário é novo? (regra de veteranos fica no pai) */
  eligible: boolean;
  /** algo (modal de novidades, intro de jogo) está na frente: espera */
  blocked?: boolean;
  playSound?: (name: "showModal" | "select" | "hover") => void;
}

/**
 * Tutorial em quests: escurece a tela, deixa só o botão da vez iluminado e a Pherie ao lado
 * explicando. O progresso é salvo por usuário; "Rever tutorial" (configurações) reinicia.
 */
export const OnboardingTour: React.FC<OnboardingTourProps> = ({ uid, eligible, blocked = false, playSound }) => {
  const reduce = useReducedMotion();
  const config = useNotchConfig();
  const [active, setActive] = useState(false);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const indexRef = useRef(0);
  indexRef.current = index;

  // inicia: novo usuário não concluído, ou refazer forçado pelas configurações
  useEffect(() => {
    if (!uid) return;
    const start = async () => {
      const forced = localStorage.getItem(tourForceKey(uid)) === "1";
      const state = loadTourState(uid, localStorage);
      if ((forced || (eligible && !state.done)) && !(state.done && !forced)) {
        localStorage.removeItem(tourForceKey(uid));
        await playIntroOnce(forced);
        setIndex(state.step);
        setActive(true);
      }
    };
    // espera a interface assentar (preloader/intro terminam logo antes)
    const first = window.setTimeout(start, 1500);
    // dá tempo de a Home voltar para a biblioteca (os alvos só existem lá)
    const onRestart = () => window.setTimeout(start, 700);
    window.addEventListener("pherielium:restart-tour", onRestart);
    return () => {
      window.clearTimeout(first);
      window.removeEventListener("pherielium:restart-tour", onRestart);
    };
  }, [uid, eligible]);

  const step: TourStep | undefined = TOUR_STEPS[index];
  const rect = useTargetRect(active && !paused && !blocked ? step?.selector ?? null : null);

  const goTo = useCallback(
    (from: number, dir: 1 | -1) => {
      const next = stepIndexFrom(from, dir, TOUR_STEPS, hasTarget);
      if (next === null) {
        if (uid) saveTourState(uid, { step: TOUR_STEPS.length - 1, done: true }, localStorage);
        setActive(false);
        return;
      }
      setIndex(next);
      if (uid) saveTourState(uid, { step: next, done: false }, localStorage);
      playSound?.("select");
    },
    [uid, playSound],
  );

  const finish = useCallback(() => {
    if (uid) saveTourState(uid, { step: TOUR_STEPS.length - 1, done: true }, localStorage);
    setActive(false);
    playSound?.("select");
  }, [uid, playSound]);

  // passo sem alvo na tela (ex.: sincronizar sem contas): pula sozinho
  useEffect(() => {
    if (!active || blocked || paused || !step || step.selector === null) return;
    const id = window.setTimeout(() => {
      if (!hasTarget(step.selector as string)) goTo(indexRef.current + 1, 1);
    }, 400);
    return () => window.clearTimeout(id);
  }, [active, blocked, paused, step, goTo]);

  // avanço por ação do usuário (clicar no botão / Alt + rolagem): espera o modal que abrir fechar
  const advanceAfterAction = useCallback(() => {
    setPaused(true);
    const from = indexRef.current;
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      if (!modalOpen() || tries > 600) {
        window.clearInterval(id);
        setPaused(false);
        goTo(from + 1, 1);
      }
    }, 350);
  }, [goTo]);

  useEffect(() => {
    if (!active || blocked || paused || !step) return;
    if (step.advanceOn === "click-target" && step.selector) {
      const el = document.querySelector<HTMLElement>(step.selector);
      if (!el) return;
      const onClick = () => advanceAfterAction();
      el.addEventListener("click", onClick, { once: true });
      return () => el.removeEventListener("click", onClick);
    }
    if (step.advanceOn === "alt-scroll") {
      const onWheel = (e: WheelEvent) => {
        if (e.altKey) advanceAfterAction();
      };
      window.addEventListener("wheel", onWheel, { passive: true });
      return () => window.removeEventListener("wheel", onWheel);
    }
  }, [active, blocked, paused, step, advanceAfterAction]);

  // teclado: Enter/→ próximo, Esc pular
  useEffect(() => {
    if (!active || blocked || paused) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") finish();
      else if ((e.key === "Enter" || e.key === "ArrowRight") && step?.advanceOn === "next") goTo(indexRef.current + 1, 1);
      else if (e.key === "ArrowLeft") goTo(indexRef.current - 1, -1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active, blocked, paused, step, goTo, finish]);

  const vp = { width: typeof window !== "undefined" ? window.innerWidth : 1280, height: typeof window !== "undefined" ? window.innerHeight : 720 };
  const hole = rect
    ? { x: rect.x - HOLE_PAD, y: rect.y - HOLE_PAD, width: rect.width + HOLE_PAD * 2, height: rect.height + HOLE_PAD * 2 }
    : { x: vp.width / 2, y: vp.height / 2, width: 0, height: 0 };
  const place = coachPlacement(rect ? hole : null, vp, COACH);

  const holeSpring = useSpring({
    ...hole,
    immediate: Boolean(reduce),
    config: SPRINGS.soft,
  });
  const coachSpring = useSpring({ x: place.x, y: place.y, immediate: Boolean(reduce), config: SPRINGS.soft });

  if (!active || blocked || paused || !step || typeof document === "undefined") return null;

  const isLast = index === TOUR_STEPS.length - 1;
  const total = TOUR_STEPS.length;
  const manual = step.advanceOn === "next";

  return createPortal(
    <div className="fixed inset-0 select-none" style={{ zIndex: Z }} role="dialog" aria-modal="false" aria-label="Tutorial de boas-vindas">
      {/* fundo escuro com recorte (mola de um alvo ao outro) */}
      <svg className="absolute inset-0 h-full w-full" aria-hidden>
        <defs>
          <mask id="tour-mask">
            <rect width="100%" height="100%" fill="white" />
            <animated.rect
              x={holeSpring.x}
              y={holeSpring.y}
              width={holeSpring.width}
              height={holeSpring.height}
              rx={16}
              fill="black"
            />
          </mask>
        </defs>
        <rect width="100%" height="100%" fill="rgba(4,4,8,0.74)" mask="url(#tour-mask)" />
      </svg>

      {/* bloqueia cliques fora do recorte; no recorte, só passa quando o passo é "clique no botão" */}
      {rect ? (
        <>
          <animated.div className="absolute left-0 top-0 w-full bg-transparent" style={{ height: holeSpring.y }} />
          <animated.div
            className="absolute left-0 bg-transparent"
            style={{ top: holeSpring.y, height: holeSpring.height, width: holeSpring.x }}
          />
          <animated.div
            className="absolute right-0 bg-transparent"
            style={{
              top: holeSpring.y,
              height: holeSpring.height,
              left: holeSpring.x.to((x) => x + holeSpring.width.get()),
            }}
          />
          <animated.div
            className="absolute left-0 w-full bg-transparent"
            style={{ top: holeSpring.y.to((y) => y + holeSpring.height.get()), bottom: 0 }}
          />
          {step.advanceOn === "next" && (
            <animated.div
              className="absolute bg-transparent"
              style={{ left: holeSpring.x, top: holeSpring.y, width: holeSpring.width, height: holeSpring.height }}
            />
          )}
          {/* halo que pulsa em volta do botão */}
          <animated.div
            className="pointer-events-none absolute rounded-2xl"
            style={{ left: holeSpring.x, top: holeSpring.y, width: holeSpring.width, height: holeSpring.height }}
          >
            <motion.div
              className="h-full w-full rounded-2xl border-2 border-white/80"
              animate={reduce ? undefined : { boxShadow: ["0 0 0 0 rgba(255,255,255,0.45)", "0 0 0 14px rgba(255,255,255,0)"] }}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeOut" }}
            />
          </animated.div>
        </>
      ) : (
        <div className="absolute inset-0 bg-transparent" />
      )}

      {/* Pherie + balão */}
      <animated.div className="absolute" style={{ left: coachSpring.x, top: coachSpring.y, width: COACH.width }}>
        <motion.div
          key={step.id}
          initial={reduce ? false : { opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 380, damping: 26 }}
          className="relative flex items-end gap-3"
        >
          {isLast && !reduce && <Confetti />}
          <div className="shrink-0">
            <MascotView
              size={isLast ? 104 : 84}
              mood={step.mood}
              bodyColor={config.bodyColor}
              hat={config.hat}
              items={config.items}
              isHovered
            />
          </div>
          <div className="relative min-w-0 flex-1 rounded-[22px] rounded-bl-md border border-white/10 bg-[#141416]/95 p-4 shadow-[0_24px_60px_rgba(0,0,0,0.55)] backdrop-blur-xl">
            <p className="text-[11px] font-medium tabular-nums text-white/40">
              {index + 1} de {total}
            </p>
            <h3 className="mt-0.5 text-[16px] font-semibold leading-tight text-white">{step.title}</h3>
            <p className="mt-1.5 text-[13px] leading-snug text-white/70">{step.text}</p>
            {step.altScrollHint && <AltScrollHint />}
            <div className="mt-3 flex items-center justify-between gap-2">
              {!isLast ? (
                <button type="button" onClick={finish} className="cursor-pointer text-[12px] font-medium text-white/45 transition hover:text-white">
                  Pular
                </button>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-2">
                {index > 0 && !isLast && (
                  <button
                    type="button"
                    onClick={() => goTo(index - 1, -1)}
                    className="h-8 cursor-pointer rounded-full bg-white/[0.08] px-3 text-[12px] font-semibold text-white transition hover:bg-white/[0.14]"
                  >
                    Voltar
                  </button>
                )}
                {manual ? (
                  <button
                    type="button"
                    onClick={() => (isLast ? finish() : goTo(index + 1, 1))}
                    className="h-8 cursor-pointer rounded-full bg-white px-4 text-[12px] font-semibold text-black transition hover:bg-white/90 active:scale-95"
                  >
                    {isLast ? "Começar" : "Próximo"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => goTo(index + 1, 1)}
                    className="h-8 cursor-pointer rounded-full bg-white/[0.08] px-3 text-[12px] font-semibold text-white/80 transition hover:bg-white/[0.14]"
                  >
                    Já sei
                  </button>
                )}
              </div>
            </div>
          </div>
        </motion.div>
      </animated.div>
    </div>,
    document.body,
  );
};
