import { BatteryMeter } from "./live/BatteryMeter";
import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  CONTROLLER_FLASH_MS,
  CONTROLLER_FLASH_TAURI_EVENT,
  CONTROLLER_FLASH_WINDOW_EVENT,
  controllerFlashCopy,
  parseControllerFlash,
  type ControllerFlash,
} from "./controllerFlash";

/** Aviso ativo (ou null). Escuta a janela e, no Tauri, o evento vindo do hub. */
export function useControllerFlash(enabled = true): ControllerFlash | null {
  const [flash, setFlash] = useState<ControllerFlash | null>(null);

  useEffect(() => {
    if (!enabled) {
      setFlash(null);
      return;
    }
    const onWindow = (e: Event) => {
      const next = parseControllerFlash((e as CustomEvent).detail);
      if (next) setFlash(next);
    };
    window.addEventListener(CONTROLLER_FLASH_WINDOW_EVENT, onWindow);

    let cancelled = false;
    let unlisten: (() => void) | undefined;
    if ("__TAURI_INTERNALS__" in window) {
      void import("@tauri-apps/api/event").then(({ listen }) =>
        listen<unknown>(CONTROLLER_FLASH_TAURI_EVENT, (event) => {
          const next = parseControllerFlash(event.payload);
          if (next) setFlash(next);
        }).then((fn) => {
          if (cancelled) fn();
          else unlisten = fn;
        }),
      );
    }
    return () => {
      cancelled = true;
      window.removeEventListener(CONTROLLER_FLASH_WINDOW_EVENT, onWindow);
      unlisten?.();
    };
  }, [enabled]);

  useEffect(() => {
    if (!flash) return;
    const id = window.setTimeout(() => setFlash(null), CONTROLLER_FLASH_MS);
    return () => window.clearTimeout(id);
  }, [flash]);

  return flash;
}

const GamepadGlyph: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M6 12h4M8 10v4" />
    <path d="M15 13h.01M18 11h.01" />
    <path d="M17.3 5H6.7a4 4 0 0 0-3.9 3.1l-1.5 6.4A2.6 2.6 0 0 0 5.9 17l1.5-1.6a2 2 0 0 1 1.5-.7h6.2a2 2 0 0 1 1.5.7l1.5 1.6a2.6 2.6 0 0 0 4.6-2.5l-1.5-6.4A4 4 0 0 0 17.3 5Z" />
  </svg>
);

const BatteryGlyph: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <rect x="2" y="7" width="16" height="10" rx="2" />
    <path d="M22 11v2" />
    <path d="M6 10v4" />
  </svg>
);

const Strike: React.FC<{ delay: number }> = ({ delay }) => (
  <svg className="pointer-events-none absolute inset-0" viewBox="0 0 26 26" aria-hidden>
    <motion.line
      x1="4" y1="22" x2="22" y2="4"
      stroke="rgb(248 113 113)"
      strokeWidth={2.2}
      strokeLinecap="round"
      initial={{ pathLength: 0 }}
      animate={{ pathLength: 1 }}
      transition={{ duration: 0.25, delay, ease: "easeOut" }}
    />
  </svg>
);

/** Humor da Pherie para cada aviso (usado pelo notch). */
export const FLASH_MASCOT_MOOD = {
  connected: "excited",
  disconnected: "sad",
  hapticsOn: "excited",
  hapticsOff: "bored",
  batteryLow: "scared",
} as const;

/** Ícone animado de cada aviso (lado direito da barra). */
const FlashIcon: React.FC<{ flash: ControllerFlash }> = ({ flash }) => {
  const { kind } = flash;
  const Glyph = kind === "batteryLow" ? BatteryGlyph : GamepadGlyph;
  const tone =
    kind === "connected" || kind === "hapticsOn"
      ? "text-emerald-300"
      : kind === "batteryLow"
        ? "text-red-300"
        : "text-white/55";

  const pulse = kind === "connected" || kind === "hapticsOn" || kind === "batteryLow";
  const ringColor = kind === "batteryLow" ? "bg-red-400/40" : "bg-emerald-400/40";

  const iconMotion =
    kind === "connected"
      ? {
          initial: { x: -34, y: 6, scale: 0.3, rotate: -35, opacity: 0 },
          animate: { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 },
          transition: { type: "spring" as const, stiffness: 380, damping: 15, delay: 0.12 },
        }
      : kind === "hapticsOn"
        ? {
            // o controle "treme" de verdade: sacudidas curtas e repetidas
            initial: { scale: 0.6, opacity: 0 },
            animate: { scale: 1, opacity: 1, x: [0, -1.6, 1.6, -1.6, 1.6, 0], rotate: [0, -6, 6, -6, 6, 0] },
            transition: {
              scale: { type: "spring" as const, stiffness: 420, damping: 16 },
              opacity: { duration: 0.15 },
              x: { duration: 0.34, repeat: 4, delay: 0.2 },
              rotate: { duration: 0.34, repeat: 4, delay: 0.2 },
            },
          }
        : kind === "batteryLow"
          ? {
              initial: { scale: 0.6, opacity: 0 },
              animate: { scale: [1, 1.14, 1], opacity: 1 },
              transition: { scale: { duration: 0.7, repeat: 3, delay: 0.15 }, opacity: { duration: 0.15 } },
            }
          : {
              // desconectou / vibração desligada: balança e desbota
              initial: { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 },
              animate: { x: [0, -2.5, 2.5, -2.5, 2.5, 0], y: [0, 0, 0, 0, 0, 4], rotate: [0, -8, 8, -8, 0, 10], opacity: [1, 1, 1, 1, 1, 0.5] },
              transition: { duration: 0.9, ease: "easeInOut" as const },
            };

  return (
    <div className="relative flex h-[26px] w-[26px] shrink-0 items-center justify-center">
      {pulse && (
        <motion.span
          className={`absolute inset-0 rounded-full ${ringColor}`}
          initial={{ scale: 0.6, opacity: 0.7 }}
          animate={{ scale: 1.9, opacity: 0 }}
          transition={{ duration: 1.1, delay: 0.35, repeat: 2, ease: "easeOut" }}
        />
      )}
      <motion.span className={`relative flex items-center justify-center ${tone}`} {...iconMotion}>
        <Glyph size={20} />
      </motion.span>
      {(kind === "disconnected" || kind === "hapticsOff") && <Strike delay={0.55} />}
    </div>
  );
};

/**
 * Conteúdo da barra do notch durante um aviso do controle (estilo Dynamic Island):
 * mascote reagindo à esquerda, texto no meio, ícone animado à direita.
 */
export const ControllerFlashBar: React.FC<{
  flash: ControllerFlash;
  mascot: React.ReactNode;
}> = ({ flash, mascot }) => {
  const { title, subtitle } = controllerFlashCopy(flash);

  return (
    <motion.div
      key={`${flash.kind}-${flash.at}`}
      className="flex w-full items-center gap-2.5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      role="status"
      aria-live="polite"
    >
      <div className="shrink-0">{mascot}</div>

      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[11.5px] font-semibold text-white">{title}</p>
        <p className="truncate text-[9.5px] font-medium uppercase tracking-[0.14em] text-white/50">{subtitle}</p>
      </div>

      {flash.battery != null && (flash.kind === "connected" || flash.kind === "batteryLow") ? (
        <BatteryMeter level={flash.battery} charging={flash.charging} approximate={flash.approximate} />
      ) : (
        <FlashIcon flash={flash} />
      )}
    </motion.div>
  );
};
