import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronRight, Monitor, Power, ShieldCheck } from "lucide-react";
import desktopIcon from "../assets/Pherielium_Desktop_icon.png";
import { usePreferences } from "../context/PreferencesContext";
import { useGamepadButton } from "../context/GamepadContext";
import { useSoundEffects } from "../hooks/useSoundEffects";
import { Switch } from "./ui/switch";
import { setLauncherInputLocked } from "../utils/launcherInputLock";

export const INSTALL_SETUP_STORAGE_KEY = "pherielium_install_setup_v1";

export function isInstallSetupDone(): boolean {
  try {
    return localStorage.getItem(INSTALL_SETUP_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function markInstallSetupDone(): void {
  try {
    localStorage.setItem(INSTALL_SETUP_STORAGE_KEY, "1");
  } catch {
    // ignore quota / private mode
  }
}

interface InstallSetupScreenProps {
  onFinish: () => void;
}

const STEPS = 3;

export const InstallSetupScreen: React.FC<InstallSetupScreenProps> = ({ onFinish }) => {
  const [step, setStep] = useState(0);
  const reduceMotion = useReducedMotion();
  const {
    effectsVolume,
    soundTheme,
    minimizeToTrayOnClose,
    setMinimizeToTrayOnClose,
    confirmBeforeExit,
    setConfirmBeforeExit,
    openAtLogin,
    setOpenAtLogin,
  } = usePreferences();
  const { playSound } = useSoundEffects(effectsVolume / 100, soundTheme);

  useEffect(() => {
    setLauncherInputLocked(true);
    return () => setLauncherInputLocked(false);
  }, []);

  const finish = useCallback(() => {
    markInstallSetupDone();
    playSound("select");
    onFinish();
  }, [onFinish, playSound]);

  const goNext = useCallback(() => {
    if (step < STEPS - 1) {
      playSound("select");
      setStep((s) => s + 1);
      return;
    }
    finish();
  }, [finish, playSound, step]);

  const goBack = useCallback(() => {
    if (step > 0) {
      playSound("back");
      setStep((s) => s - 1);
    }
  }, [playSound, step]);

  useGamepadButton("X", goNext, true, 280);
  useGamepadButton("O", goBack, step > 0, 280);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "Enter") {
        e.preventDefault();
        goNext();
      } else if (e.key === "ArrowLeft" || e.key === "Escape") {
        if (step > 0) {
          e.preventDefault();
          goBack();
        }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goBack, goNext, step]);

  const motionProps = reduceMotion
    ? { initial: false, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : {
        initial: { opacity: 0, y: 16 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: -12 },
      };

  return (
    <motion.div
      className="fixed inset-0 z-[240] flex flex-col items-center justify-center overflow-hidden bg-[#070707]"
      initial={reduceMotion ? false : { opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={reduceMotion ? { opacity: 0 } : { opacity: 0 }}
      transition={{ duration: reduceMotion ? 0.15 : 0.4 }}
      role="dialog"
      aria-modal="true"
      aria-label="Configuração inicial do Pherielium"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_28%,rgba(255,255,255,0.09)_0%,transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/50 to-transparent"
      />

      <div className="relative z-10 flex w-full max-w-[440px] flex-col items-center px-6">
        <motion.div
          className="relative mb-8"
          initial={reduceMotion ? false : { opacity: 0, scale: 0.88 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={
            reduceMotion
              ? { duration: 0.2 }
              : { type: "spring", bounce: 0.28, duration: 0.7 }
          }
        >
          <div className="absolute inset-0 -m-6 rounded-full bg-white/10 blur-3xl" />
          <img
            src={desktopIcon}
            alt=""
            className="relative h-[120px] w-[120px] rounded-[28px] object-cover shadow-[0_24px_64px_rgba(0,0,0,0.65)]"
            draggable={false}
          />
        </motion.div>

        <div className="mb-6 flex items-center gap-2" aria-hidden>
          {Array.from({ length: STEPS }).map((_, i) => (
            <motion.span
              key={i}
              className="h-1 rounded-full bg-white/20"
              animate={{
                width: i === step ? 28 : 8,
                backgroundColor:
                  i === step ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.2)",
              }}
              transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
            />
          ))}
        </div>

        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            className="w-full text-center"
            {...motionProps}
            transition={
              reduceMotion
                ? { duration: 0.15 }
                : { type: "spring", bounce: 0.12, duration: 0.38 }
            }
          >
            {step === 0 && (
              <>
                <p className="text-[12px] font-medium tracking-[0.14em] text-white/40">
                  Configuração inicial
                </p>
                <h1 className="mt-3 text-[32px] font-semibold tracking-tight text-white">
                  Pherielium
                </h1>
                <p className="mx-auto mt-3 max-w-[340px] text-[15px] leading-relaxed text-white/50">
                  Seu hub de jogos está pronto. Em poucos passos ajustamos como a
                  janela se comporta neste PC.
                </p>
              </>
            )}

            {step === 1 && (
              <>
                <h2 className="text-[24px] font-semibold tracking-tight text-white">
                  Comportamento da janela
                </h2>
                <p className="mt-2 text-[14px] text-white/45">
                  Você pode mudar isso depois em Ajustes.
                </p>
                <ul className="mt-7 space-y-3 text-left">
                  <li className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70">
                      <Monitor className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-white">
                        Minimizar para a bandeja
                      </p>
                      <p className="mt-0.5 text-[12px] text-white/40">
                        Fechar a janela oculta o app em vez de encerrar.
                      </p>
                    </div>
                    <Switch
                      checked={minimizeToTrayOnClose}
                      onCheckedChange={setMinimizeToTrayOnClose}
                      aria-label="Minimizar para a bandeja"
                    />
                  </li>
                  <li className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70">
                      <ShieldCheck className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-white">
                        Confirmar antes de sair
                      </p>
                      <p className="mt-0.5 text-[12px] text-white/40">
                        Pede confirmação ao encerrar o aplicativo.
                      </p>
                    </div>
                    <Switch
                      checked={confirmBeforeExit}
                      onCheckedChange={setConfirmBeforeExit}
                      aria-label="Confirmar antes de sair"
                    />
                  </li>
                  <li className="flex items-center gap-3 rounded-2xl border border-white/[0.08] bg-white/[0.03] px-4 py-3.5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/5 text-white/70">
                      <Power className="h-4 w-4" strokeWidth={2} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-white">
                        Iniciar com o Windows
                      </p>
                      <p className="mt-0.5 text-[12px] text-white/40">
                        Abre o launcher em segundo plano ao ligar o PC.
                      </p>
                    </div>
                    <Switch
                      checked={openAtLogin}
                      onCheckedChange={setOpenAtLogin}
                      aria-label="Iniciar com o Windows"
                    />
                  </li>
                </ul>
              </>
            )}

            {step === 2 && (
              <>
                <h2 className="text-[24px] font-semibold tracking-tight text-white">
                  Tudo certo
                </h2>
                <p className="mx-auto mt-3 max-w-[320px] text-[15px] leading-relaxed text-white/50">
                  Preferências salvas neste computador. Abra o hub e comece a
                  montar sua biblioteca.
                </p>
              </>
            )}
          </motion.div>
        </AnimatePresence>

        <div className="mt-10 flex w-full items-center justify-between gap-3">
          <button
            type="button"
            onClick={goBack}
            disabled={step === 0}
            className="rounded-full px-4 py-2.5 text-[13px] font-medium text-white/45 transition-colors hover:text-white disabled:invisible focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/50"
          >
            Voltar
          </button>
          <motion.button
            type="button"
            onClick={goNext}
            whileTap={reduceMotion ? undefined : { scale: 0.97 }}
            className="inline-flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-[13px] font-semibold text-black shadow-[0_0_28px_rgba(255,255,255,0.22)] transition-colors hover:bg-white/92 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          >
            {step === STEPS - 1 ? "Abrir hub" : "Continuar"}
            {step < STEPS - 1 && <ChevronRight className="h-4 w-4" strokeWidth={2.5} />}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default InstallSetupScreen;
