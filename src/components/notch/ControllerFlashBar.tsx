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

/**
 * Conteúdo da barra do notch durante o aviso. Conectou: a Pherie (à esquerda,
 * animada) "entrega" o controle, que pousa com mola e pulsa em verde.
 * Desconectou: o controle balança, ganha um risco e desbota.
 */
export const ControllerFlashBar: React.FC<{
  flash: ControllerFlash;
  mascot: React.ReactNode;
}> = ({ flash, mascot }) => {
  const connected = flash.kind === "connected";
  const { title, subtitle } = controllerFlashCopy(flash);

  return (
    <motion.div
      key={flash.at}
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

      <div className="relative flex h-[26px] w-[26px] shrink-0 items-center justify-center">
        {connected && (
          <motion.span
            className="absolute inset-0 rounded-full bg-emerald-400/40"
            initial={{ scale: 0.6, opacity: 0.7 }}
            animate={{ scale: 1.9, opacity: 0 }}
            transition={{ duration: 1.1, delay: 0.35, repeat: 2, ease: "easeOut" }}
          />
        )}
        <motion.span
          className={`relative flex items-center justify-center ${connected ? "text-emerald-300" : "text-white/55"}`}
          initial={connected ? { x: -34, y: 6, scale: 0.3, rotate: -35, opacity: 0 } : { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }}
          animate={
            connected
              ? { x: 0, y: 0, scale: 1, rotate: 0, opacity: 1 }
              : { x: [0, -2.5, 2.5, -2.5, 2.5, 0], y: [0, 0, 0, 0, 0, 5], rotate: [0, -8, 8, -8, 0, 12], opacity: [1, 1, 1, 1, 1, 0.45] }
          }
          transition={
            connected
              ? { type: "spring", stiffness: 380, damping: 15, delay: 0.12 }
              : { duration: 0.9, ease: "easeInOut" }
          }
        >
          <GamepadGlyph size={20} />
        </motion.span>
        {!connected && (
          <svg className="pointer-events-none absolute inset-0" viewBox="0 0 26 26" aria-hidden>
            <motion.line
              x1="4" y1="22" x2="22" y2="4"
              stroke="rgb(248 113 113)"
              strokeWidth={2.2}
              strokeLinecap="round"
              initial={{ pathLength: 0 }}
              animate={{ pathLength: 1 }}
              transition={{ duration: 0.25, delay: 0.55, ease: "easeOut" }}
            />
          </svg>
        )}
      </div>
    </motion.div>
  );
};
