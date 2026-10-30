import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { animated, useSpring } from "@react-spring/web";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { MascotView } from "../mascot/MascotView";
import { useNotchConfig } from "../mascot/useNotchConfig";
import { SPRINGS } from "../design-system/motion";
import {
  TOUR_STEPS,
  coachPlacement,
  loadTourState,
  progressOf,
  saveTourState,
  stepIndexFrom,
  tourForceKey,
  type Rect,
  type TourStep,
} from "./tourSteps";
import { TourFlash, TourSad, TourScene } from "./TourScene";
import { appleSprings } from "../design-system/motion";
import { useGamepadButton } from "../context/GamepadContext";
import { GAMEPAD_PRIORITY } from "../context/gamepadSubscribers";
import { TourPanelView, TourVisualView } from "./TourVisuals";

const Z = 320; // acima de ModalShell (100) e GameLaunchIntro (200)
const HOLE_PAD = 8;
/** Quanto o selo "Feito!" com a Pherie comemorando fica na tela antes do próximo passo. */
const FLASH_MS = 2400;
const COACH_BASE = { width: 360, height: 188 };
const COACH_RICH = { width: 400, height: 300 };
const COACH_PANEL = { width: 420, height: 400 };

/** Tamanho do cartão: passos com ilustração ou painel de ajustes precisam de mais espaço. */
const coachSizeFor = (step: TourStep | undefined) =>
  step?.panel ? COACH_PANEL : step?.visual || step?.task ? COACH_RICH : COACH_BASE;

/** Quanto tempo o alvo é medido quadro a quadro depois de mudar de passo (abas e gavetas deslizando). */
const FOLLOW_BURST_MS = 1600;
/** Depois disso basta conferir algumas vezes por segundo: nada se mexe, e medir layout a 60 Hz custa CPU. */
const FOLLOW_IDLE_MS = 250;

/**
 * Retângulo do alvo. Acompanha o movimento em quadros logo depois de o passo começar; depois só
 * remede 4x por segundo e a cada resize/scroll.
 */
function useTargetRect(selector: string | null): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null);
  useLayoutEffect(() => {
    if (!selector) {
      setRect(null);
      return;
    }
    let raf = 0;
    let idle = 0;
    let last = "";
    let scrolled = false;
    const startedAt = performance.now();
    const measure = () => {
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
    };
    const burst = () => {
      measure();
      if (performance.now() - startedAt < FOLLOW_BURST_MS) raf = requestAnimationFrame(burst);
    };
    burst();
    idle = window.setInterval(measure, FOLLOW_IDLE_MS);
    window.addEventListener("resize", measure, { passive: true });
    window.addEventListener("scroll", measure, { passive: true, capture: true });
    return () => {
      cancelAnimationFrame(raf);
      window.clearInterval(idle);
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, { capture: true });
    };
  }, [selector]);
  return rect;
}

/** Tamanho da janela, atualizado no resize (o cartão da Pherie reposiciona se a janela mudar). */
function useViewportSize() {
  const read = () => ({
    width: typeof window !== "undefined" ? window.innerWidth : 1280,
    height: typeof window !== "undefined" ? window.innerHeight : 720,
  });
  const [size, setSize] = useState(read);
  useEffect(() => {
    const onResize = () => setSize(read);
    window.addEventListener("resize", onResize, { passive: true });
    return () => window.removeEventListener("resize", onResize);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return size;
}

/** Tem algum diálogo modal aberto? (o tour espera ele fechar antes de seguir) */
const modalOpen = () => document.querySelector('[aria-modal="true"], [role="dialog"][data-state="open"]') !== null;

const hasTarget = (selector: string) => document.querySelector(selector) !== null;

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
  const viewport = useViewportSize();
  /** timeouts do tutorial: todos morrem junto com ele (pular no meio de um selo não pode "avançar" depois) */
  const timersRef = useRef(new Set<number>());
  const later = useCallback((fn: () => void, ms: number) => {
    const id = window.setTimeout(() => {
      timersRef.current.delete(id);
      fn();
    }, ms);
    timersRef.current.add(id);
  }, []);
  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current.clear();
  }, []);
  useEffect(() => clearTimers, [clearTimers]);
  /** rótulo da tarefa recém-concluída: mostra o selo "Feito!" por um instante antes do próximo passo */
  const [flash, setFlash] = useState<string | null>(null);
  /** recado do passo anterior (ex.: "você soltou o Alt cedo demais"), mostrado no cartão da Pherie */
  const [notice, setNotice] = useState<string | null>(null);
  /** a pessoa tem controle? Decide se as etapas do controle entram no roteiro. */
  const controllerModeRef = useRef<"unknown" | "yes" | "no">("unknown");
  /** a Pherie triste ("não tenho controle agora") antes de seguir sem as etapas do controle */
  const [sad, setSad] = useState(false);
  /** para qual lado o usuário está andando: decide de onde a próxima cena entra */
  const directionRef = useRef<1 | -1>(1);
  const indexRef = useRef(0);
  indexRef.current = index;
  // lido dentro do loop de espera sem recriar o efeito de início
  const blockedRef = useRef(blocked);
  useEffect(() => {
    blockedRef.current = blocked;
  }, [blocked]);

  // inicia: novo usuário não concluído, ou refazer forçado pelas configurações
  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    let retry: number | undefined;

    // Se o modal de novidades ou outra tela estiver na frente, o tutorial espera ela sair.
    const somethingElseOnScreen = () => blockedRef.current || modalOpen();
    let waitedForModal = false;

    const start = async () => {
      if (cancelled) return;
      if (somethingElseOnScreen()) {
        waitedForModal = true;
        retry = window.setTimeout(start, 600);
        return;
      }
      if (waitedForModal) {
        // o modal já fechou, mas a animação de saída ainda está correndo
        waitedForModal = false;
        retry = window.setTimeout(start, 450);
        return;
      }
      const forced = localStorage.getItem(tourForceKey(uid)) === "1";
      const state = loadTourState(uid, localStorage);
      if ((forced || (eligible && !state.done)) && !(state.done && !forced)) {
        localStorage.removeItem(tourForceKey(uid));
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
      cancelled = true;
      window.clearTimeout(first);
      if (retry) window.clearTimeout(retry);
      window.removeEventListener("pherielium:restart-tour", onRestart);
    };
  }, [uid, eligible]);

  const step: TourStep | undefined = TOUR_STEPS[index];
  const rect = useTargetRect(active && !paused && !blocked ? step?.selector ?? null : null);

  const goTo = useCallback(
    (from: number, dir: 1 | -1) => {
      const next = stepIndexFrom(from, dir, TOUR_STEPS, hasTarget, (s) => Boolean(s.requiresController) && controllerModeRef.current === "no");
      if (next === null) {
        if (uid) saveTourState(uid, { step: TOUR_STEPS.length - 1, done: true }, localStorage);
        setActive(false);
        return;
      }
      directionRef.current = dir;
      setIndex(next);
      if (uid) saveTourState(uid, { step: next, done: false }, localStorage);
      playSound?.("select");
    },
    [uid, playSound],
  );

  const finish = useCallback(() => {
    clearTimers();
    setFlash(null);
    setSad(false);
    setPaused(false);
    if (uid) saveTourState(uid, { step: TOUR_STEPS.length - 1, done: true }, localStorage);
    setActive(false);
    playSound?.("select");
  }, [uid, playSound, clearTimers]);

  // passo sem alvo na tela (ex.: sincronizar sem contas): pula sozinho
  useEffect(() => {
    if (!active || blocked || paused || !step || step.selector === null) return;
    const id = window.setTimeout(() => {
      if (!hasTarget(step.selector as string)) goTo(indexRef.current + 1, 1);
    }, 400 + (step.waitForTargetMs ?? 0));
    return () => window.clearTimeout(id);
  }, [active, blocked, paused, step, goTo]);

  // avanço por ação do usuário (clicar no botão / Alt + rolagem): espera o modal que abrir fechar
  const celebrate = useCallback((label: string) => {
    setFlash(label);
    later(() => setFlash(null), FLASH_MS);
  }, [later]);

  const advanceAfterAction = useCallback(() => {
    setPaused(true);
    const from = indexRef.current;
    celebrate(TOUR_STEPS[from]?.task ?? "Muito bem");
    const startedAt = Date.now();
    let tries = 0;
    const id = window.setInterval(() => {
      tries += 1;
      // só segue quando o selo já foi visto e o modal que a ação abriu (se houve) fechou
      if ((!modalOpen() && Date.now() - startedAt >= FLASH_MS) || tries > 600) {
        window.clearInterval(id);
        setPaused(false);
        goTo(from + 1, 1);
      }
    }, 350);
  }, [goTo, celebrate]);

  useEffect(() => {
    if (!active || blocked || paused || !step) return;
    if (step.advanceOn === "click-target" && step.selector) {
      const el = document.querySelector<HTMLElement>(step.selector);
      if (!el) return;
      const onClick = () => advanceAfterAction();
      // captura: o mascote chama stopPropagation no próprio clique, e o evento nunca chegaria ao alvo na fase normal
      el.addEventListener("click", onClick, { once: true, capture: true });
      return () => el.removeEventListener("click", onClick, { capture: true });
    }
    if (step.advanceOn === "alt-scroll") {
      // Sem selo nem pausa: o seletor acabou de abrir e o usuário ainda está com o Alt apertado.
      let advanced = false;
      const onWheel = (e: WheelEvent) => {
        if (!e.altKey || advanced) return;
        advanced = true;
        setNotice(null);
        goTo(indexRef.current + 1, 1);
      };
      window.addEventListener("wheel", onWheel, { passive: true });
      return () => window.removeEventListener("wheel", onWheel);
    }
    if (step.advanceOn === "notch-open") {
      // a notch vive na janela do overlay: ela avisa por evento quando abre
      let cancelled = false;
      let unlisten: (() => void) | undefined;
      if ("__TAURI_INTERNALS__" in window) {
        void import("@tauri-apps/api/event").then(({ listen }) =>
          listen("overlay:notch-expanded", () => advanceAfterAction()).then((fn) => {
            if (cancelled) fn();
            else unlisten = fn;
          }),
        );
      }
      return () => {
        cancelled = true;
        unlisten?.();
      };
    }
    if (step.advanceOn === "target-gone" && step.selector) {
      // só vale depois de o alvo ter aparecido: o painel abre um instante depois do passo anterior
      let seenAt = 0;
      const selector = step.selector;
      const minOpenMs = step.minOpenMs ?? 0;
      const id = window.setInterval(() => {
        const present = hasTarget(selector);
        if (present) {
          if (!seenAt) seenAt = Date.now();
        } else if (seenAt) {
          window.clearInterval(id);
          if (Date.now() - seenAt < minOpenMs) {
            // soltou o Alt antes de escolher: não conta, volta para o passo de segurar
            setNotice("Você soltou o Alt cedo demais. Segure o Alt, role o mouse e só solte quando a plataforma estiver no centro.");
            goTo(indexRef.current - 1, -1);
            return;
          }
          setPaused(true);
          celebrate(step.task ?? "Muito bem");
          later(() => {
            setPaused(false);
            goTo(indexRef.current + 1, 1);
          }, FLASH_MS);
        }
      }, 200);
      return () => window.clearInterval(id);
    }
  }, [active, blocked, paused, step, advanceAfterAction, goTo, celebrate, later]);

  const handleNoController = useCallback(() => {
    controllerModeRef.current = "no";
    setSad(true);
    later(() => {
      setSad(false);
      goTo(indexRef.current + 1, 1);
    }, 2200);
  }, [goTo, later]);

  const handleTaskDone = useCallback(() => {
    if (TOUR_STEPS[indexRef.current]?.id === "controller-connect") controllerModeRef.current = "yes";
    advanceAfterAction();
  }, [advanceAfterAction]);

  // Controle: X confirma e O volta nos passos de "Continuar" (as práticas usam o X para a própria tarefa).
  const manualStepActive = active && !blocked && !paused && !sad && Boolean(step) && step.advanceOn === "next";
  useGamepadButton(
    "X",
    () => {
      if (indexRef.current >= TOUR_STEPS.length - 1) finish();
      else goTo(indexRef.current + 1, 1);
    },
    manualStepActive,
    GAMEPAD_PRIORITY.overlayMenu,
  );
  useGamepadButton("O", () => goTo(indexRef.current - 1, -1), manualStepActive && index > 0, GAMEPAD_PRIORITY.overlayMenu);

  // A gaveta lateral começa fechada; o tutorial a abre só nos passos que a mostram e a fecha depois.
  const sidebarOpenedRef = useRef(false);
  useEffect(() => {
    const wantsOpen = active && !blocked && Boolean(step?.sidebar);
    if (wantsOpen === sidebarOpenedRef.current) return;
    sidebarOpenedRef.current = wantsOpen;
    window.dispatchEvent(new CustomEvent("checkpoint:sidebar-toggle", { detail: { expanded: wantsOpen } }));
  }, [active, blocked, step?.sidebar]);

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

  const vp = viewport;
  const hole = rect
    ? { x: rect.x - HOLE_PAD, y: rect.y - HOLE_PAD, width: rect.width + HOLE_PAD * 2, height: rect.height + HOLE_PAD * 2 }
    : { x: vp.width / 2, y: vp.height / 2, width: 0, height: 0 };
  const coach = coachSizeFor(step);
  // Em passos que o usuário executa por cima de outra tela (o seletor de filtros), a Pherie fica no fundo,
  // fora do caminho, em vez de colada ao alvo.
  const place =
    step?.coachAt === "bottom-center"
      ? { x: (vp.width - coach.width) / 2, y: vp.height - coach.height - 28, side: "bottom" as const }
      : coachPlacement(rect ? hole : null, vp, coach);

  const holeSpring = useSpring({
    ...hole,
    immediate: Boolean(reduce),
    config: SPRINGS.soft,
  });
  const coachSpring = useSpring({ x: place.x, y: place.y, immediate: Boolean(reduce), config: SPRINGS.soft });

  if (typeof document === "undefined") return null;
  // selo "Feito!" entre uma tarefa e o próximo passo (o tutorial fica pausado enquanto a tela por baixo muda)
  if (active && !blocked && paused) {
    return createPortal(<AnimatePresence>{flash && <TourFlash key="flash" label={flash} zIndex={Z} bodyColor={config.bodyColor} />}</AnimatePresence>, document.body);
  }
  if (!active || blocked || !step) return null;
  if (sad) return createPortal(<TourSad zIndex={Z} bodyColor={config.bodyColor} />, document.body);

  const isLast = index === TOUR_STEPS.length - 1;
  const progress = progressOf(TOUR_STEPS, step.id, (s) => Boolean(s.requiresController) && controllerModeRef.current === "no");
  const total = progress.total;
  const manual = step.advanceOn === "next";

  // passos sem alvo viram cenas em tela cheia
  if (step.scene) {
    return createPortal(
      <TourScene
        step={step}
        index={progress.index}
        total={total}
        direction={directionRef.current}
        isLast={isLast}
        onNext={() => (isLast ? finish() : goTo(index + 1, 1))}
        onBack={() => goTo(index - 1, -1)}
        onSkip={finish}
        onTaskDone={handleTaskDone}
        onNoController={handleNoController}
        bodyColor={config.bodyColor}
        zIndex={Z}
      />,
      document.body,
    );
  }

  return createPortal(
    <div
      className={`fixed inset-0 select-none ${step.interactive ? "pointer-events-none" : ""}`}
      style={{ zIndex: Z }}
      role="dialog"
      aria-modal="false"
      aria-label="Tutorial de boas-vindas"
    >
      {/* fundo escuro com recorte (mola de um alvo ao outro) */}
      <svg className={`absolute inset-0 h-full w-full ${step.interactive ? "hidden" : ""}`} aria-hidden>
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
      {rect && !step.interactive ? (
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
          {(step.advanceOn === "next") && (
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
            <div className="tour-halo h-full w-full rounded-2xl border-2 border-white/80" />
          </animated.div>
        </>
      ) : step.interactive ? null : (
        <div className="absolute inset-0 bg-transparent" />
      )}

      {/* Pherie + balão */}
      <animated.div className="pointer-events-auto absolute" style={{ left: coachSpring.x, top: coachSpring.y, width: coach.width }}>
        <motion.div
          key={step.id}
          initial={reduce ? false : { opacity: 0, y: 10, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={appleSprings.move}
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
          <div className="relative min-w-0 flex-1 rounded-[var(--corner-md)] rounded-bl-md apple-material p-4 shadow-[0_24px_60px_rgba(0,0,0,0.55)]">
            <div className="flex items-center gap-[3px]" role="progressbar" aria-valuemin={1} aria-valuemax={total} aria-valuenow={progress.index + 1} aria-label={`Passo ${progress.index + 1} de ${total}`}>
              {Array.from({ length: total }, (_, i) => (
                <span
                  key={i}
                  className={`h-[3px] flex-1 rounded-full transition-colors duration-300 ${i <= progress.index ? "bg-white" : "bg-white/20"}`}
                />
              ))}
            </div>
            <h3 className="mt-2.5 text-[length:var(--step-1)] font-semibold leading-tight text-white">{step.title}</h3>
            <p className="mt-1.5 text-[length:var(--step-0)] leading-snug text-[var(--ink-muted)]">{step.text}</p>
            {step.visual && (
              <div className="mt-3 rounded-2xl bg-black/30 p-3">
                <TourVisualView visual={step.visual} />
              </div>
            )}
            {step.panel && <TourPanelView panel={step.panel} />}
            {notice && step.id === "platform-filter" && (
              <p role="alert" className="mt-3 rounded-xl border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-[length:var(--step-0)] font-medium leading-snug text-amber-100">
                {notice}
              </p>
            )}
            {step.task && (
              <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-3 py-1 text-[length:var(--step-0)] font-semibold text-white">
                <motion.span
                  className="h-2 w-2 rounded-full bg-emerald-400"
                  animate={reduce ? undefined : { opacity: [1, 0.35, 1] }}
                  transition={{ duration: 1.3, repeat: Infinity }}
                />
                Tarefa: {step.task}
              </p>
            )}
            <div className="mt-3 flex items-center justify-between gap-2">
              {!isLast ? (
                <button type="button" onClick={finish} className="cursor-pointer text-[length:var(--step-0)] font-medium text-[var(--ink-faint)] transition hover:text-white">
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
                    className="h-8 cursor-pointer rounded-full bg-white/[0.08] px-3 text-[length:var(--step-0)] font-semibold text-white transition hover:bg-white/[0.14]"
                  >
                    Voltar
                  </button>
                )}
                {manual ? (
                  <button
                    type="button"
                    onClick={() => (isLast ? finish() : goTo(index + 1, 1))}
                    className="h-8 cursor-pointer rounded-full bg-white px-4 text-[length:var(--step-0)] font-semibold text-black apple-press transition hover:bg-white/90"
                  >
                    {isLast ? "Começar" : "Próximo"}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => goTo(index + 1, 1)}
                    className="h-8 cursor-pointer rounded-full bg-white/[0.08] px-3 text-[length:var(--step-0)] font-semibold text-[var(--ink)] transition hover:bg-white/[0.14]"
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
