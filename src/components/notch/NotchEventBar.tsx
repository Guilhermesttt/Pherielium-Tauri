import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Check, Gamepad2, MessageSquare, Trophy, UserPlus, Sparkles } from "lucide-react";
import {
  NOTCH_EVENT_TAURI_EVENT,
  NOTCH_EVENT_WINDOW_EVENT,
  enqueueNotchEvent,
  notchEventDuration,
  notchEventSubtitle,
  parseNotchEvent,
  type AchievementTier,
  type NotchEvent,
  type NotchEventKind,
} from "./notchEvent";

/**
 * Evento ativo (ou null). Escuta a janela e, no Tauri, o evento vindo do hub; mantém uma
 * fila curta e mostra um por vez. Com `hold` (painel expandido) a fila espera sem perder nada.
 */
export function useNotchEvent(enabled: boolean, hold = false): NotchEvent | null {
  const [queue, setQueue] = useState<NotchEvent[]>([]);
  const seen = useRef<string[]>([]);

  useEffect(() => {
    if (!enabled) {
      setQueue([]);
      return;
    }
    const push = (raw: unknown) => {
      const next = parseNotchEvent(raw);
      if (!next) return;
      // a mesma janela recebe CustomEvent e Tauri emit: o id impede mostrar duas vezes
      if (seen.current.includes(next.id)) return;
      seen.current = [...seen.current.slice(-19), next.id];
      setQueue((q) => enqueueNotchEvent(q, next));
    };
    const onWindow = (e: Event) => push((e as CustomEvent).detail);
    window.addEventListener(NOTCH_EVENT_WINDOW_EVENT, onWindow);

    let cancelled = false;
    let unlisten: (() => void) | undefined;
    if ("__TAURI_INTERNALS__" in window) {
      void import("@tauri-apps/api/event").then(({ listen }) =>
        listen<unknown>(NOTCH_EVENT_TAURI_EVENT, (event) => push(event.payload)).then((fn) => {
          if (cancelled) fn();
          else unlisten = fn;
        }),
      );
    }
    return () => {
      cancelled = true;
      window.removeEventListener(NOTCH_EVENT_WINDOW_EVENT, onWindow);
      unlisten?.();
    };
  }, [enabled]);

  const active = queue[0] ?? null;
  const activeAt = active?.at ?? null;
  const activeKind = active?.kind ?? null;
  useEffect(() => {
    if (hold || activeAt === null || activeKind === null) return;
    const id = window.setTimeout(() => setQueue((q) => q.slice(1)), notchEventDuration(activeKind, active?.tier));
    return () => window.clearTimeout(id);
  }, [activeAt, activeKind, hold]);

  const queued = Math.max(0, queue.length - 1);
  return useMemo(() => (hold || !active ? null : queued > 0 ? { ...active, queued } : active), [hold, active, queued]);
}

const TIER_COLOR: Record<AchievementTier, string> = {
  iron: "113,121,126",
  bronze: "205,127,50",
  silver: "190,194,201",
  gold: "245,165,36",
  platinum: "125,249,255",
};

const WASH: Record<Exclude<NotchEventKind, "achievement">, string> = {
  "friend-request": "99,102,241",
  "friend-accepted": "34,197,94",
  "friend-online": "48,209,88",
  "friend-playing": "139,92,246",
  "capture-saved": "125,249,255",
  message: "244,114,182",
  "level-up": "245,165,36",
  welcome: "56,189,248",
};

const washFor = (e: NotchEvent) =>
  e.kind === "achievement" ? TIER_COLOR[e.tier ?? "bronze"] : WASH[e.kind];

const KindIcon: React.FC<{ kind: NotchEventKind; size: number }> = ({ kind, size }) => {
  switch (kind) {
    case "friend-request":
      return <UserPlus size={size} />;
    case "friend-accepted":
    case "friend-online":
      return <Check size={size} />;
    case "capture-saved":
      return <Camera size={size} />;
    case "message":
      return <MessageSquare size={size} />;
    case "achievement":
      return <Trophy size={size} />;
    case "welcome":
    case "friend-playing":
      return <Gamepad2 size={size} />;
    default:
      return <Sparkles size={size} />;
  }
};

/** Barra do notch durante um evento: mascote reagindo, texto e o avatar/ícone de quem gerou. */
export const NotchEventBar: React.FC<{ event: NotchEvent; mascot: React.ReactNode }> = ({ event, mascot }) => {
  const wash = washFor(event);
  const subtitle = notchEventSubtitle(event);
  return (
    <motion.div
      key={event.id}
      className="relative flex w-full items-center gap-2.5"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.18 }}
      role="status"
      aria-live="polite"
    >
      <div className="shrink-0">{mascot}</div>
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[11.5px] font-semibold text-white">{event.title}</p>
        {subtitle && <p className="truncate text-[10.5px] font-medium text-white/55">{subtitle}</p>}
      </div>
      {(event.queued ?? 0) > 0 && (
        <span
          className="shrink-0 rounded-full bg-white/[0.14] px-1.5 py-0.5 text-[10px] font-bold tabular-nums text-white/80"
          title={`${event.queued} na fila`}
        >
          +{event.queued}
        </span>
      )}
      <motion.div
        className="relative flex h-[26px] w-[26px] shrink-0 items-center justify-center overflow-hidden rounded-full"
        style={{ background: `rgba(${wash},0.22)`, color: `rgb(${wash})` }}
        initial={{ scale: 0.4, rotate: -25, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 380, damping: 15, delay: 0.1 }}
      >
        {event.avatar ? (
          <img src={event.avatar} alt="" className="h-full w-full object-cover" draggable={false} />
        ) : (
          <KindIcon kind={event.kind} size={14} />
        )}
      </motion.div>
      {event.avatar && (
        <span
          className="absolute -right-1 -bottom-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-black"
          style={{ color: `rgb(${wash})` }}
        >
          <KindIcon kind={event.kind} size={9} />
        </span>
      )}
    </motion.div>
  );
};
