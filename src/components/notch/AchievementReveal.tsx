import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Trophy } from "lucide-react";
import type { NotchEvent } from "./notchEvent";
import { sparkPositions, tierStyle } from "./achievementTier";

/** Brilho que atravessa o cartão uma vez; a cor e a duração mudam com o tier. */
const Sheen: React.FC<{ rgb: string; prism: boolean; duration: number; delay: number }> = ({ rgb, prism, duration, delay }) => (
  <motion.span
    aria-hidden
    className="pointer-events-none absolute inset-y-0 left-0 w-2/5 -skew-x-12"
    style={{
      background: prism
        ? "linear-gradient(105deg, transparent, rgba(125,249,255,0.38), rgba(196,150,255,0.34), rgba(255,160,220,0.30), transparent)"
        : `linear-gradient(105deg, transparent, rgba(${rgb},0.34), transparent)`,
    }}
    initial={{ x: "-120%" }}
    animate={{ x: "340%" }}
    transition={{ duration, delay, ease: [0.4, 0, 0.2, 1] }}
  />
);

/** Explosão de luz atrás da imagem (ouro). */
const Burst: React.FC<{ rgb: string }> = ({ rgb }) => (
  <motion.span
    aria-hidden
    className="pointer-events-none absolute left-[42px] top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full"
    style={{ background: `radial-gradient(circle, rgba(${rgb},0.75) 0%, rgba(${rgb},0) 68%)` }}
    initial={{ scale: 0.2, opacity: 0.95 }}
    animate={{ scale: 2.8, opacity: 0 }}
    transition={{ duration: 1.1, delay: 0.25, ease: "easeOut" }}
  />
);

/** Anéis que se expandem a partir da imagem (platina). */
const Rings: React.FC<{ rgb: string; count: number }> = ({ rgb, count }) => (
  <>
    {Array.from({ length: count }, (_, i) => (
      <motion.span
        key={i}
        aria-hidden
        className="pointer-events-none absolute left-[42px] top-1/2 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ border: `2px solid rgba(${rgb},0.7)` }}
        initial={{ scale: 0.7, opacity: 0.7 }}
        animate={{ scale: 3.1, opacity: 0 }}
        transition={{ duration: 1.5, delay: 0.3 + i * 0.4, ease: "easeOut" }}
      />
    ))}
  </>
);

/** Faíscas que sobem ao redor da imagem. */
const Sparks: React.FC<{ rgb: string; count: number }> = ({ rgb, count }) => (
  <>
    {sparkPositions(count).map((s, i) => (
      <motion.span
        key={i}
        aria-hidden
        className="pointer-events-none absolute top-1/2 rotate-45"
        style={{ left: 42 + s.x, width: s.size, height: s.size, background: `rgb(${rgb})`, boxShadow: `0 0 6px rgba(${rgb},0.9)` }}
        initial={{ y: s.y + 8, opacity: 0, scale: 0.4 }}
        animate={{ y: s.y - 38, opacity: [0, 1, 0], scale: [0.4, 1, 0.6] }}
        transition={{ duration: 1.3, delay: 0.35 + s.delay, ease: "easeOut" }}
      />
    ))}
  </>
);

/**
 * Conteúdo do notch aberto durante uma conquista: a imagem é revelada, depois nome, descrição
 * e o jogo. O aro do notch (estático) e o efeito mudam com o tier para a raridade ficar clara.
 */
export const AchievementReveal: React.FC<{ event: NotchEvent; mascot?: React.ReactNode }> = ({ event, mascot }) => {
  const reduce = useReducedMotion();
  const style = tierStyle(event.tier);
  const { rgb } = style;
  const meta = [event.gameTitle, event.xp ? `+${event.xp} XP` : ""].filter(Boolean).join(" · ");

  return (
    <div
      className="relative overflow-hidden rounded-[20px] bg-[#141518] p-3"
      style={{
        boxShadow: `inset 0 0 0 1px rgba(${rgb},0.32)`,
        backgroundImage: `radial-gradient(120% 140% at 50% 130%, rgba(${rgb},0.26) 0%, transparent 62%)`,
      }}
    >
      {!reduce && style.effect !== "none" && (
        <Sheen rgb={rgb} prism={style.effect === "prism"} duration={style.effect === "sheen" ? 1.4 : 1.1} delay={0.5} />
      )}
      {!reduce && style.effect === "burst" && <Burst rgb={rgb} />}
      {!reduce && style.effect === "prism" && <Rings rgb={rgb} count={style.pulses} />}
      {!reduce && style.sparks > 0 && <Sparks rgb={rgb} count={style.sparks} />}

      <div className="relative flex items-center gap-3.5">
        <motion.div
          className="relative h-[68px] w-[68px] shrink-0 overflow-hidden rounded-[18px] bg-black/50"
          style={{ boxShadow: `0 0 0 2px rgba(${rgb},0.85)` }}
          initial={reduce ? false : { scale: 0.5, opacity: 0, rotate: -10 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 16, delay: 0.12 }}
        >
          {event.avatar ? (
            <img src={event.avatar} alt="" className="h-full w-full object-cover" draggable={false} />
          ) : (
            <span className="flex h-full w-full items-center justify-center" style={{ color: `rgb(${rgb})` }}>
              <Trophy size={30} />
            </span>
          )}
        </motion.div>

        <motion.div
          className="min-w-0 flex-1"
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: 0.3 }}
        >
          <p className="text-[11px] font-semibold" style={{ color: `rgb(${rgb})` }}>
            {style.label}
          </p>
          <p className="truncate text-[15px] font-bold leading-tight text-white">{event.title}</p>
          {event.description && (
            <p className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-white/65">{event.description}</p>
          )}
          {meta && <p className="mt-1 truncate text-[11px] text-white/40">{meta}</p>}
        </motion.div>

        {mascot && <div className="shrink-0 self-end">{mascot}</div>}
      </div>
      {(event.queued ?? 0) > 0 && (
        <span
          className="absolute right-2.5 top-2 rounded-full px-2 py-0.5 text-[10.5px] font-bold tabular-nums text-black"
          style={{ backgroundColor: `rgb(${rgb})` }}
          title={`${event.queued} ${event.queued === 1 ? "conquista" : "conquistas"} na fila`}
        >
          +{event.queued} na fila
        </span>
      )}
    </div>
  );
};
