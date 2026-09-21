import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";

import {
  type PlayerLevelInfo,
  type PSNTierInfo,
  getPSNTierInfo,
} from "../utils/trophyTiers";

import levelUpSoundUrl from "../sounds/Phelierium Default/ui_level_up 2.mp3";
import { progressionEventBus } from "../services/progressionEvents";

import PherieliumTierBronze from "../assets/Pherielium_Tier_Bronze.png";
import PherieliumTierSilver from "../assets/Pherielium_Tier_Prata.png";
import PherieliumTierGold from "../assets/Pherielium_Tier_Ouro.png";
import PherieliumTierPlatinum from "../assets/Pherielium_Tier_Platina.png";

/* =========================================================
   TIER VISUAL SYSTEM
   ========================================================= */

const TIER_IMAGES: Record<string, string> = {
  bronze: PherieliumTierBronze,
  silver: PherieliumTierSilver,
  gold: PherieliumTierGold,
  platinum: PherieliumTierPlatinum,
};

/**
 * Cada tier tem sua identidade de cor + intensidade de efeito.
 * `intensity` escala nebulosa/partículas: tiers baixos ficam discretos,
 * tiers altos ficam mais "épicos" — a quantidade de espetáculo agora
 * acompanha a importância da conquista, em vez de ser igual pra todos.
 */
const TIER_VISUALS: Record<
  string,
  {
    accent: string;
    accentRgb: string;
    soft: string;
    label: string;
    subLabel: string;
    intensity: number; // 0-1, escala geral de opacidade/força dos efeitos
  }
> = {
  bronze: {
    accent: "#D98B45",
    accentRgb: "217, 139, 69",
    soft: "#8B522A",
    label: "BRONZE",
    subLabel: "FORJA // INÍCIO DA JORNADA",
    intensity: 0.6,
  },
  silver: {
    accent: "#E7EDF4",
    accentRgb: "231, 237, 244",
    soft: "#9099A5",
    label: "PRATA",
    subLabel: "✦ PRATA // EVOLUÇÃO TÉCNICA ✦",
    intensity: 0.75,
  },
  gold: {
    accent: "#FFD86B",
    accentRgb: "255, 216, 107",
    soft: "#B87A19",
    label: "OURO",
    subLabel: "★ OURO // MAESTRIA & GLÓRIA ★",
    intensity: 0.9,
  },
  platinum: {
    accent: "#75D8FF",
    accentRgb: "117, 216, 255",
    soft: "#277EA3",
    label: "PLATINA",
    subLabel: "✧ PLATINA // TRANSCENDÊNCIA SUPREMA ✧",
    intensity: 1,
  },
};

/* =========================================================
   PARTÍCULAS

   IMPORTANTE: o card central ocupa aproximadamente a faixa
   horizontal 30%–70% da tela (max-w-[530px] centralizado).
   Antes, várias partículas caíam bem nessa faixa e ficavam
   escondidas atrás do card (que é opaco e é renderizado por
   cima delas no DOM). Por isso o efeito "sumia" na prática.
   Agora elas ficam deliberadamente nas bordas (0–24% e
   76–100% horizontal), fora do footprint do card.
   ========================================================= */

const BRONZE_EMBERS = [
  { left: "6%", bottom: "12%", size: 3, delay: 0.1, duration: 2.8, xOffset: 14 },
  { left: "14%", bottom: "22%", size: 2.5, delay: 0.7, duration: 2.3, xOffset: -10 },
  { left: "9%", bottom: "55%", size: 3.5, delay: 0.3, duration: 3.1, xOffset: 18 },
  { left: "18%", bottom: "68%", size: 2.5, delay: 1.1, duration: 2.5, xOffset: -16 },
  { left: "84%", bottom: "16%", size: 3, delay: 0.5, duration: 2.9, xOffset: 12 },
  { left: "91%", bottom: "40%", size: 2.5, delay: 0.9, duration: 3.3, xOffset: -14 },
  { left: "86%", bottom: "62%", size: 3, delay: 0.2, duration: 2.6, xOffset: 8 },
];

const SILVER_GLINTS = [
  { left: "5%", top: "18%", size: 3, delay: 0.2, duration: 1.8 },
  { left: "12%", top: "58%", size: 2.5, delay: 0.6, duration: 2.2 },
  { left: "18%", top: "78%", size: 3.5, delay: 0.9, duration: 1.6 },
  { left: "8%", top: "38%", size: 2.5, delay: 0.3, duration: 2.4 },
  { left: "88%", top: "14%", size: 3, delay: 1.1, duration: 1.7 },
  { left: "93%", top: "50%", size: 3, delay: 0.4, duration: 2.0 },
  { left: "82%", top: "72%", size: 3.5, delay: 0.7, duration: 1.9 },
  { left: "90%", top: "30%", size: 2.5, delay: 1.3, duration: 2.3 },
];

const GOLD_SPARKLES = [
  { left: "6%", top: "16%", size: 4, delay: 0.1, duration: 2.0 },
  { left: "15%", top: "48%", size: 3.5, delay: 0.5, duration: 1.8 },
  { left: "10%", top: "72%", size: 4.5, delay: 0.8, duration: 2.2 },
  { left: "19%", top: "28%", size: 3.5, delay: 0.3, duration: 1.9 },
  { left: "88%", top: "18%", size: 5, delay: 1.0, duration: 2.4 },
  { left: "94%", top: "44%", size: 3.5, delay: 0.4, duration: 1.7 },
  { left: "84%", top: "68%", size: 4.5, delay: 0.7, duration: 2.1 },
  { left: "91%", top: "80%", size: 3, delay: 1.2, duration: 2.3 },
];

const PLATINUM_COSMOS = [
  { left: "4%", top: "14%", size: 3.5, color: "#75D8FF", delay: 0.1, duration: 2.6 },
  { left: "13%", top: "42%", size: 2.5, color: "#C084FC", delay: 0.6, duration: 2.2 },
  { left: "8%", top: "66%", size: 4, color: "#E0F2FE", delay: 0.9, duration: 2.8 },
  { left: "18%", top: "82%", size: 2.5, color: "#75D8FF", delay: 0.3, duration: 2.0 },
  { left: "89%", top: "12%", size: 3.5, color: "#E879F9", delay: 1.1, duration: 2.5 },
  { left: "94%", top: "36%", size: 2.5, color: "#38BDF8", delay: 0.4, duration: 2.3 },
  { left: "84%", top: "58%", size: 4.5, color: "#C084FC", delay: 0.8, duration: 2.7 },
  { left: "92%", top: "78%", size: 3, color: "#75D8FF", delay: 1.3, duration: 2.1 },
  { left: "97%", top: "22%", size: 3, color: "#E879F9", delay: 0.5, duration: 2.4 },
];

interface LevelUpDetail {
  oldLevel: number;
  newLevel: number;
  levelInfo: PlayerLevelInfo;
  tierInfo?: PSNTierInfo;
}

/* =========================================================
   SPARKLE BURST estilo mymind: disparo único de faíscas
   radiais quando o emblema entra (12 faíscas, stagger,
   easeOut, depois somem). Barato: 12 spans, sem repeat.
   ========================================================= */

const BURST_SPARKLES = Array.from({ length: 12 }, (_, i) => {
  const angle = (i / 12) * Math.PI * 2;
  return {
    angle,
    distance: 78 + ((i * 37) % 34),
    size: 3 + ((i * 13) % 3),
  };
});

const SparkleBurst: React.FC<{ color: string }> = ({ color }) => (
  <div aria-hidden className="pointer-events-none absolute inset-0 flex items-center justify-center">
    {BURST_SPARKLES.map((spark, i) => (
      <motion.span
        key={i}
        initial={{ opacity: 0, x: 0, y: 0, scale: 0.4 }}
        animate={{
          opacity: [0, 1, 0],
          x: Math.cos(spark.angle) * spark.distance,
          y: Math.sin(spark.angle) * spark.distance,
          scale: [0.4, 1, 0.6],
        }}
        transition={{ delay: 0.32 + i * 0.02, duration: 0.85, ease: "easeOut" }}
        className="absolute rounded-full"
        style={{
          width: spark.size,
          height: spark.size,
          background: `rgb(${color})`,
          boxShadow: `0 0 8px rgb(${color})`,
        }}
      />
    ))}
  </div>
);

export const LevelUpModal: React.FC = () => {
  const [currentEvent, setCurrentEvent] = useState<LevelUpDetail | null>(null);
  const reduceMotion = useReducedMotion();

  const continueButtonRef = useRef<HTMLButtonElement | null>(null);
  const activeAudioRef = useRef<HTMLAudioElement | null>(null);
  const lastTriggerRef = useRef<{ key: string; time: number } | null>(null);

  /* =========================================================
     EVENTO + ÁUDIO

     Duas fontes diferentes podem disparar um level-up
     (progressionEventBus e o CustomEvent de window). Se as
     duas dispararem para o mesmo acontecimento, o modal e o
     som tocavam em duplicidade — daí o áudio "estourado".
     Agora: (1) uma trava por assinatura oldLevel-newLevel
     ignora o segundo disparo se ele chegar a menos de 400ms
     do primeiro, e (2) qualquer áudio anterior é interrompido
     antes de tocar um novo, então nunca há dois áudios
     sobrepostos mesmo em level-ups legítimos e rápidos.
     ========================================================= */

  const triggerModal = useCallback((detail: LevelUpDetail) => {
    const key = `${detail.oldLevel}-${detail.newLevel}`;
    const now = Date.now();

    if (
      lastTriggerRef.current &&
      lastTriggerRef.current.key === key &&
      now - lastTriggerRef.current.time < 400
    ) {
      // Disparo duplicado do mesmo level-up (bus + window event) — ignora.
      return;
    }
    lastTriggerRef.current = { key, time: now };

    setCurrentEvent(detail);

    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current.currentTime = 0;
      activeAudioRef.current = null;
    }

    try {
      const audio = new Audio(levelUpSoundUrl);
      audio.volume = 0.82;
      activeAudioRef.current = audio;
      const playPromise = audio.play();

      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch((err) => {
          console.debug("[LevelUpModal] Som não reproduzido:", err);
        });
      }
    } catch (err) {
      console.debug("[LevelUpModal] Erro ao instanciar áudio:", err);
    }
  }, []);

  useEffect(() => {
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<LevelUpDetail>;
      if (customEvent.detail) {
        triggerModal(customEvent.detail);
      }
    };

    const unsubscribeBus = progressionEventBus.onLevelUp(triggerModal);
    window.addEventListener("checkpoint:level-up", handleCustomEvent);

    return () => {
      unsubscribeBus();
      window.removeEventListener("checkpoint:level-up", handleCustomEvent);
      activeAudioRef.current?.pause();
    };
  }, [triggerModal]);

  const handleClose = useCallback(() => {
    setCurrentEvent(null);
  }, []);

  /* =========================================================
     TECLADO + FOCO

     O modal agora move o foco pro botão de continuar assim que
     abre, então leitores de tela anunciam a abertura e um
     usuário de teclado não fica preso na página de trás.
     ========================================================= */

  useEffect(() => {
    if (!currentEvent) return;

    const raf = requestAnimationFrame(() => {
      continueButtonRef.current?.focus();
    });

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [currentEvent, handleClose]);

  const oldLevel = currentEvent?.oldLevel ?? 1;
  const newLevel = currentEvent?.newLevel ?? 2;
  const levelInfo = currentEvent?.levelInfo;

  const oldTierInfo = getPSNTierInfo(oldLevel);
  const currentTierInfo = currentEvent?.tierInfo || getPSNTierInfo(newLevel);
  const tierKey = currentTierInfo.tier || levelInfo?.tier || "bronze";
  const isTierPromotion = currentEvent ? oldTierInfo.tier !== tierKey : false;

  const visual = TIER_VISUALS[tierKey] || TIER_VISUALS.bronze;
  const tierImage = TIER_IMAGES[tierKey] || PherieliumTierBronze;
  const rankName = currentTierInfo?.name || levelInfo?.tierName || visual.label;
  const progress = Math.max(0, Math.min(100, levelInfo?.progress ?? 0));
  const remainingXp = levelInfo
    ? Math.max(0, levelInfo.xpForNextLevel - levelInfo.currentLevelXp)
    : 0;

  const nebulaOpacity = 0.55 * visual.intensity;
  const particleOpacity = 0.7 + 0.3 * visual.intensity;

  return (
    <AnimatePresence>
      {currentEvent && (
        <motion.div
          key="level-up-modal"
          role="dialog"
          aria-modal="true"
          aria-labelledby="level-up-title"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.4 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center overflow-hidden p-5"
        >
          {/* BACKDROP */}
          <div
            onClick={handleClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-xl"
          />

          {/* Vinheta */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                "radial-gradient(circle at center, transparent 15%, rgba(0,0,0,.45) 55%, rgba(0,0,0,.95) 100%)",
            }}
          />

          {/* =====================================================
              NEBULOSA / ATMOSFERA — intensidade escala por tier
          ====================================================== */}
          {tierKey === "platinum" ? (
            <>
              <motion.div
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{
                  opacity: [0, nebulaOpacity, nebulaOpacity * 0.6],
                  scale: [0.5, 1.25, 1],
                }}
                transition={{ duration: reduceMotion ? 0 : 1.6, ease: [0.16, 1, 0.3, 1] }}
                className="absolute h-[720px] w-[720px] rounded-full blur-[85px] pointer-events-none"
                style={{
                  background:
                    "radial-gradient(circle, rgba(56,189,248,.5) 0%, rgba(192,132,252,.22) 45%, transparent 75%)",
                }}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{
                  opacity: [0, nebulaOpacity * 0.75, nebulaOpacity * 0.4],
                  scale: [0.8, 1.4, 1.2],
                }}
                transition={{ duration: reduceMotion ? 0 : 2.2, repeat: Infinity, repeatType: "reverse" }}
                className="absolute h-[850px] w-[850px] rounded-full blur-[105px] pointer-events-none"
                style={{
                  background: "radial-gradient(circle, rgba(232,121,249,.28) 0%, transparent 65%)",
                }}
              />
            </>
          ) : tierKey === "gold" ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{
                opacity: [0, nebulaOpacity, nebulaOpacity * 0.55],
                scale: [0.6, 1.2, 1],
              }}
              transition={{ duration: reduceMotion ? 0 : 1.5, ease: [0.16, 1, 0.3, 1] }}
              className="absolute h-[700px] w-[700px] rounded-full blur-[80px] pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, rgba(251,191,36,.5) 0%, rgba(217,119,6,.18) 40%, transparent 70%)",
              }}
            />
          ) : tierKey === "silver" ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{
                opacity: [0, nebulaOpacity, nebulaOpacity * 0.5],
                scale: [0.6, 1.15, 1],
              }}
              transition={{ duration: reduceMotion ? 0 : 1.4, ease: [0.16, 1, 0.3, 1] }}
              className="absolute h-[650px] w-[650px] rounded-full blur-[70px] pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, rgba(231,237,244,.45) 0%, rgba(148,163,184,.16) 38%, transparent 70%)",
              }}
            />
          ) : (
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{
                opacity: [0, nebulaOpacity, nebulaOpacity * 0.45],
                scale: [0.6, 1.12, 1],
              }}
              transition={{ duration: reduceMotion ? 0 : 1.4, ease: [0.16, 1, 0.3, 1] }}
              className="absolute h-[620px] w-[620px] rounded-full blur-[65px] pointer-events-none"
              style={{
                background:
                  "radial-gradient(circle, rgba(217,139,69,.42) 0%, rgba(139,82,42,.12) 35%, transparent 70%)",
              }}
            />
          )}

          {/* =====================================================
              PARTÍCULAS — posicionadas nas bordas, fora do
              footprint do card central (ver comentário acima
              dos arrays de partículas)
          ====================================================== */}
          {!reduceMotion && tierKey === "bronze" &&
            BRONZE_EMBERS.map((ember, i) => (
              <motion.span
                key={`bronze-ember-${i}`}
                initial={{ opacity: 0, y: 0, x: 0 }}
                animate={{
                  opacity: [0, particleOpacity, particleOpacity * 0.25, 0],
                  y: [-20, -180],
                  x: [0, ember.xOffset, ember.xOffset * -0.5],
                  scale: [0.5, 1.2, 0.4],
                }}
                transition={{
                  delay: ember.delay,
                  duration: ember.duration,
                  repeat: Infinity,
                  ease: "easeOut",
                }}
                className="absolute rounded-full bg-gradient-to-t from-amber-600 to-orange-300 pointer-events-none"
                style={{
                  left: ember.left,
                  bottom: ember.bottom,
                  width: ember.size,
                  height: ember.size,
                  boxShadow: "0 0 10px rgba(245,158,11,0.9)",
                }}
              />
            ))}

          {!reduceMotion && tierKey === "silver" &&
            SILVER_GLINTS.map((glint, i) => (
              <motion.span
                key={`silver-glint-${i}`}
                initial={{ opacity: 0, scale: 0, rotate: 0 }}
                animate={{
                  opacity: [0, particleOpacity, particleOpacity * 0.16],
                  scale: [0, 1.2, 0.7],
                  rotate: [0, 90],
                }}
                transition={{
                  delay: glint.delay,
                  duration: glint.duration,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                }}
                className="absolute rounded-full bg-slate-100 pointer-events-none"
                style={{
                  left: glint.left,
                  top: glint.top,
                  width: glint.size,
                  height: glint.size,
                  boxShadow: "0 0 10px rgba(241,245,249,0.95)",
                }}
              />
            ))}

          {!reduceMotion && tierKey === "gold" &&
            GOLD_SPARKLES.map((spark, i) => (
              <motion.span
                key={`gold-sparkle-${i}`}
                initial={{ opacity: 0, scale: 0, y: 0 }}
                animate={{
                  opacity: [0, particleOpacity, particleOpacity * 0.3],
                  scale: [0, 1.3, 0.8],
                  y: [0, -40],
                }}
                transition={{
                  delay: spark.delay,
                  duration: spark.duration,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeOut",
                }}
                className="absolute rounded-full bg-gradient-to-br from-amber-200 to-yellow-400 pointer-events-none"
                style={{
                  left: spark.left,
                  top: spark.top,
                  width: spark.size,
                  height: spark.size,
                  boxShadow: "0 0 12px rgba(251,191,36,0.9)",
                }}
              />
            ))}

          {!reduceMotion && tierKey === "platinum" &&
            PLATINUM_COSMOS.map((cosmo, i) => (
              <motion.span
                key={`plat-cosmo-${i}`}
                initial={{ opacity: 0, scale: 0 }}
                animate={{
                  opacity: [0, particleOpacity, particleOpacity * 0.25],
                  scale: [0, 1.4, 0.9],
                }}
                transition={{
                  delay: cosmo.delay,
                  duration: cosmo.duration,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "easeInOut",
                }}
                className="absolute rounded-full pointer-events-none"
                style={{
                  left: cosmo.left,
                  top: cosmo.top,
                  width: cosmo.size,
                  height: cosmo.size,
                  backgroundColor: cosmo.color,
                  boxShadow: `0 0 12px ${cosmo.color}`,
                }}
              />
            ))}

          {/* =====================================================
              MODAL CARD PRINCIPAL
          ====================================================== */}
          <motion.div
            initial={{
              opacity: 0,
              scale: reduceMotion ? 1 : 0.965,
              y: reduceMotion ? 0 : 24,
            }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{
              opacity: 0,
              scale: reduceMotion ? 1 : 0.98,
              y: reduceMotion ? 0 : 10,
            }}
            transition={{ duration: reduceMotion ? 0 : 0.55, ease: [0.16, 1, 0.3, 1] }}
            className="bg-[#0E0E0E] relative w-full max-w-[530px] overflow-hidden rounded-[28px] border border-[var(--color-border)] px-7 pb-7 pt-8 text-center shadow-[0_40px_120px_rgba(0,0,0,.95)] select-none"
          >
            {isTierPromotion && !reduceMotion && (
              <motion.div
                initial={{ opacity: 0.65 }}
                animate={{ opacity: 0 }}
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="absolute inset-0 bg-white pointer-events-none z-50 rounded-[28px]"
              />
            )}

            <div
              className="absolute left-1/2 top-0 h-px w-[65%] -translate-x-1/2"
              style={{
                background: `linear-gradient(90deg, transparent, ${visual.accent}, transparent)`,
                boxShadow: `0 0 28px rgba(${visual.accentRgb}, .8)`,
              }}
            />

            <div
              className="absolute inset-0 opacity-40 pointer-events-none"
              style={{
                backgroundImage: `
                  radial-gradient(circle at 20% 20%, rgba(255,255,255,.12) 0 1px, transparent 1.5px),
                  radial-gradient(circle at 76% 36%, rgba(255,255,255,.09) 0 1px, transparent 1.5px),
                  radial-gradient(circle at 62% 72%, rgba(255,255,255,.07) 0 1px, transparent 1.5px)
                `,
              }}
            />

            <div className="relative z-10">
              {/* Banner de promoção ou eyebrow */}
              {isTierPromotion ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8, y: -8 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  transition={{ delay: reduceMotion ? 0 : 0.1, duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
                  className="mb-1 inline-flex items-center gap-2 rounded-full px-3.5 py-1 border font-mono text-[10px] font-black uppercase tracking-[0.2em] shadow-lg"
                  style={{
                    borderColor: visual.accent,
                    backgroundColor: `rgba(${visual.accentRgb}, 0.15)`,
                    color: visual.accent,
                    boxShadow: `0 0 16px rgba(${visual.accentRgb}, 0.35)`,
                  }}
                >
                  <span>⚡ PROMOÇÃO DE PATENTE: {visual.label} ⚡</span>
                </motion.div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduceMotion ? 0 : 0.15, duration: 0.4 }}
                  className="text-[10px] font-mono font-semibold uppercase tracking-[0.3em] text-white/40"
                >
                  {visual.subLabel}
                </motion.div>
              )}

              {/* Emblema hero */}
              <div className="relative mx-auto mt-5 flex h-[175px] w-[220px] items-center justify-center">
                {/* Burst de faíscas estilo mymind: disparo único quando o emblema entra */}
                {!reduceMotion && (
                  <SparkleBurst key={`burst-${tierKey}`} color={visual.accentRgb} />
                )}
                {tierKey === "silver" && !reduceMotion && (
                  <>
                    <motion.div
                      animate={{ scale: [0.65, 1.95], opacity: [0.75, 0] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut" }}
                      className="absolute h-32 w-32 rounded-full border border-slate-200/55 pointer-events-none"
                      style={{ boxShadow: "0 0 18px rgba(241,245,249,0.4)" }}
                    />
                    <motion.div
                      animate={{ scaleX: [0.2, 1.35, 0.2], opacity: [0.15, 0.85, 0.15] }}
                      transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute h-[1.5px] w-[240px] bg-gradient-to-r from-transparent via-slate-100 to-transparent pointer-events-none blur-[0.5px]"
                      style={{ boxShadow: "0 0 14px rgba(241,245,249,0.8)" }}
                    />
                  </>
                )}

                {tierKey === "gold" && !reduceMotion && (
                  <>
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 24, repeat: Infinity, ease: "linear" }}
                      className="absolute h-56 w-56 pointer-events-none opacity-50"
                      style={{
                        background: `conic-gradient(
                          from 0deg,
                          rgba(251, 191, 36, 0.35) 0deg 15deg,
                          transparent 15deg 30deg,
                          rgba(251, 191, 36, 0.35) 30deg 45deg,
                          transparent 45deg 60deg,
                          rgba(251, 191, 36, 0.35) 60deg 75deg,
                          transparent 75deg 90deg,
                          rgba(251, 191, 36, 0.35) 90deg 105deg,
                          transparent 105deg 120deg,
                          rgba(251, 191, 36, 0.35) 120deg 135deg,
                          transparent 135deg 150deg,
                          rgba(251, 191, 36, 0.35) 150deg 165deg,
                          transparent 165deg 180deg,
                          rgba(251, 191, 36, 0.35) 180deg 195deg,
                          transparent 195deg 210deg,
                          rgba(251, 191, 36, 0.35) 210deg 225deg,
                          transparent 225deg 240deg,
                          rgba(251, 191, 36, 0.35) 240deg 255deg,
                          transparent 255deg 270deg,
                          rgba(251, 191, 36, 0.35) 270deg 285deg,
                          transparent 285deg 300deg,
                          rgba(251, 191, 36, 0.35) 300deg 315deg,
                          transparent 315deg 330deg,
                          rgba(251, 191, 36, 0.35) 330deg 345deg,
                          transparent 345deg 360deg
                        )`,
                        maskImage: "radial-gradient(circle, black 35%, transparent 70%)",
                        WebkitMaskImage: "radial-gradient(circle, black 35%, transparent 70%)",
                      }}
                    />
                    <motion.div
                      animate={{ scale: [0.7, 1.8], opacity: [0.7, 0] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "easeOut" }}
                      className="absolute h-36 w-36 rounded-full border border-amber-400/50 pointer-events-none"
                      style={{ boxShadow: "0 0 20px rgba(251,191,36,0.45)" }}
                    />
                  </>
                )}

                {tierKey === "platinum" && !reduceMotion && (
                  <>
                    <motion.div
                      animate={{ rotate: -360 }}
                      transition={{ duration: 18, repeat: Infinity, ease: "linear" }}
                      className="absolute h-[155px] w-[155px] rounded-full border border-dashed border-purple-400/40 pointer-events-none"
                      style={{ boxShadow: "0 0 24px rgba(192,132,252,0.3)" }}
                    />
                    <motion.div
                      animate={{
                        scale: [0.85, 1.25, 0.85],
                        rotate: [0, 45, 0],
                        opacity: [0.55, 0.95, 0.55],
                      }}
                      transition={{ duration: 3.4, repeat: Infinity, ease: "easeInOut" }}
                      className="absolute h-44 w-44 pointer-events-none flex items-center justify-center"
                    >
                      <div className="absolute h-full w-[2px] bg-gradient-to-b from-transparent via-[#75D8FF] to-transparent blur-[0.5px]" />
                      <div className="absolute w-full h-[2px] bg-gradient-to-r from-transparent via-[#C084FC] to-transparent blur-[0.5px]" />
                    </motion.div>
                  </>
                )}

                <motion.div
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{
                    opacity: tierKey === "platinum" ? 0.65 : tierKey === "gold" ? 0.6 : 0.45,
                    scale: 1,
                  }}
                  transition={{ delay: reduceMotion ? 0 : 0.15, duration: 0.8, ease: "easeOut" }}
                  className="absolute h-36 w-36 rounded-full blur-[45px]"
                  style={{
                    background: `radial-gradient(
                      circle,
                      rgba(${visual.accentRgb}, .8) 0%,
                      rgba(${visual.accentRgb}, .18) 40%,
                      transparent 72%
                    )`,
                  }}
                />

                <motion.div
                  initial={{ opacity: 0, scale: 0.75 }}
                  animate={{ opacity: 1, scale: 1, rotate: reduceMotion ? 0 : 360 }}
                  transition={{
                    opacity: { delay: 0.2, duration: 0.6 },
                    scale: { delay: 0.2, duration: 0.7, ease: [0.16, 1, 0.3, 1] },
                    rotate: { duration: 22, repeat: Infinity, ease: "linear" },
                  }}
                  className="absolute h-[132px] w-[132px] rounded-full border border-white/[0.08]"
                  style={{ borderTopColor: visual.accent }}
                />

                <motion.div
                  animate={
                    tierKey === "platinum" && !reduceMotion
                      ? { y: [-5, 5, -5] }
                      : { y: 0 }
                  }
                  transition={{ duration: 3.6, repeat: Infinity, ease: "easeInOut" }}
                  className="relative z-10 flex items-center justify-center"
                >
                  <motion.img
                    src={tierImage}
                    alt={rankName}
                    width={124}
                    height={124}
                    initial={{
                      opacity: 0,
                      scale: reduceMotion ? 1 : 0.4,
                      filter: reduceMotion ? "blur(0px)" : "blur(8px)",
                    }}
                    animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }}
                    transition={
                      reduceMotion
                        ? { duration: 0 }
                        : {
                            opacity: { delay: 0.2, duration: 0.3 },
                            // Pop estilo mymind: spring com overshoot natural
                            scale: { delay: 0.2, type: "spring", stiffness: 280, damping: 14 },
                            filter: { delay: 0.2, duration: 0.4 },
                          }
                    }
                    className="h-[120px] w-[120px] object-contain pointer-events-none"
                    style={{
                      filter: `drop-shadow(0 18px 28px rgba(0,0,0,.9)) drop-shadow(0 0 16px rgba(${visual.accentRgb}, .35))`,
                    }}
                  />
                </motion.div>

                {!reduceMotion && (
                  <motion.div
                    initial={{ x: -190, opacity: 0 }}
                    animate={{ x: 190, opacity: [0, 0.8, 0] }}
                    transition={{ delay: 0.55, duration: 0.8, ease: "easeInOut" }}
                    className="absolute z-20 h-[150px] w-8 rotate-[18deg] bg-gradient-to-r from-transparent via-white/70 to-transparent blur-sm pointer-events-none"
                  />
                )}
              </div>

              {/* Novo nível — ponto focal principal, sem repetição do número em outro lugar */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduceMotion ? 0 : 0.38, duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
              >
                <p
                  id="level-up-title"
                  className="text-[11px] font-bold uppercase tracking-[0.24em] text-white/45"
                >
                  {isTierPromotion ? "Nova patente conquistada" : "Novo nível alcançado"}
                </p>

                <div className="mt-1 flex items-baseline justify-center gap-2">
                  <span className="text-lg font-semibold text-white/35">NÍVEL</span>
                  <span
                    className={`text-[66px] font-black leading-none tracking-[-0.06em] ${tierKey === "platinum"
                      ? "bg-gradient-to-r from-[#75D8FF] via-[#F8FAFC] to-[#C084FC] bg-clip-text text-transparent"
                      : tierKey === "gold"
                        ? "text-[#FFD86B]"
                        : tierKey === "silver"
                          ? "text-[#F8FAFC]"
                          : "text-white"
                      }`}
                    style={{
                      textShadow:
                        tierKey === "platinum"
                          ? "0 0 35px rgba(117, 216, 255, 0.45)"
                          : `0 0 30px rgba(${visual.accentRgb}, .35)`,
                    }}
                  >
                    {newLevel}
                  </span>
                </div>

                <div className="mt-2 flex items-center justify-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{
                      backgroundColor: visual.accent,
                      boxShadow: `0 0 10px rgba(${visual.accentRgb}, .9)`,
                    }}
                  />
                  <span className="text-sm font-bold tracking-wide text-white/90">
                    {rankName}
                  </span>
                </div>
              </motion.div>

              {/* Transição de nível — a única referência ao "de onde veio" */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: reduceMotion ? 0 : 0.55, duration: 0.4 }}
                className="mt-6 flex items-center justify-center gap-4"
              >
                <span className="font-mono text-[11px] text-white/30">NV. {oldLevel}</span>
                <div className="relative h-px w-24 overflow-hidden bg-white/[0.08]">
                  <motion.div
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: reduceMotion ? 0 : 0.55, duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
                    className="absolute inset-0 origin-left"
                    style={{
                      background: `linear-gradient(90deg, rgba(255,255,255,.15), ${visual.accent})`,
                      boxShadow: `0 0 12px rgba(${visual.accentRgb}, .5)`,
                    }}
                  />
                </div>
                <span className="font-mono text-[11px] font-bold text-white/90">NV. {newLevel}</span>
              </motion.div>

              {/* Próximo marco — barra com mais contraste, sem repetir "Nível X" */}
              {levelInfo && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: reduceMotion ? 0 : 0.68, duration: 0.45 }}
                  className="mt-7"
                >
                  <div className="mb-2.5 flex items-center justify-between gap-4 text-[11px]">
                    <span className="font-medium text-white/40">Próximo marco</span>
                    <span className="font-mono text-white/55">
                      {levelInfo.currentLevelXp} / {levelInfo.xpForNextLevel} XP
                    </span>
                  </div>

                  <div className="h-[5px] w-full overflow-hidden rounded-full bg-white/10">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ delay: reduceMotion ? 0 : 0.8, duration: reduceMotion ? 0 : 0.8, ease: [0.16, 1, 0.3, 1] }}
                      className="h-full rounded-full"
                      style={{
                        backgroundColor: visual.accent,
                        boxShadow: `0 0 10px rgba(${visual.accentRgb}, .65)`,
                      }}
                    />
                  </div>

                  <div className="mt-2 flex items-center justify-between text-[10px] text-white/25">
                    <span>Faltam {remainingXp} XP para o Nv. {newLevel + 1}</span>
                    <span>{progress}%</span>
                  </div>
                </motion.div>
              )}

              {/* CTA */}
              <motion.button
                ref={continueButtonRef}
                type="button"
                onClick={handleClose}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reduceMotion ? 0 : 0.85, duration: 0.4 }}
                whileHover={reduceMotion ? undefined : { y: -1 }}
                whileTap={{ scale: 0.99 }}
                className="group mt-7 flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-white/[0.11] bg-white/[0.055] text-xs font-semibold text-white/85 transition-colors hover:bg-white/[0.09] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50 cursor-pointer"
              >
                <span>Continuar jornada</span>
                <span className="rounded-md border border-white/[0.08] bg-black/30 px-2 py-0.5 font-mono text-[10px] text-white/40 transition-colors group-hover:text-white/60">
                  ENTER / A
                </span>
              </motion.button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LevelUpModal;