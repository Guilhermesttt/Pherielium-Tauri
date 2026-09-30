import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
import PherieliumLogoBronze from "../../assets/Pherielium_Logo_Bronze.png";
import PherieliumLogoSilver from "../../assets/Pherielium_Logo_Prata.png";
import PherieliumLogoGold from "../../assets/Pherielium_Logo_Ouro.png";
import PherieliumLogoPlatinum from "../../assets/Pherielium_Logo_Platina.png";
import { PHERIELIUM_LOGO_PATH } from "../../constants/assets";
import type { AchievementNotificationPosition } from "../../types/overlay";
import type { AchievementToast } from "../OverlayApp";

const tierLabels: Record<NonNullable<AchievementToast["tier"]>, string> = {
  platinum: "TROFÉU DE PLATINA",
  gold: "TROFÉU DE OURO",
  silver: "TROFÉU DE PRATA",
  bronze: "TROFÉU DE BRONZE",
  iron: "BLOQUEADA",
};

const METALLIC_TIER_LOGOS: Record<string, string> = {
  platinum: PherieliumLogoPlatinum,
  gold: PherieliumLogoGold,
  silver: PherieliumLogoSilver,
  bronze: PherieliumLogoBronze,
  iron: PHERIELIUM_LOGO_PATH,
};

const PLATINUM_SPARKLES = [
  { left: "14%", delay: "0.04s" },
  { left: "32%", delay: "0.14s" },
  { left: "54%", delay: "0.08s" },
  { left: "72%", delay: "0.18s" },
  { left: "88%", delay: "0.12s" },
];

type CardSide = "left" | "right" | "center";

function sideFromPosition(position: AchievementNotificationPosition): CardSide {
  if (position === "top-center") return "center";
  if (position === "top-left" || position === "bottom-left") return "left";
  return "right";
}

function entryMotion(position: AchievementNotificationPosition) {
  if (position === "top-center") return { x: 0, y: -20 };
  if (position === "top-left" || position === "bottom-left") return { x: -24, y: 0 };
  return { x: 24, y: 0 };
}

function useCountUp(target: number, enabled: boolean) {
  const [value, setValue] = useState(enabled ? 0 : target);
  useEffect(() => {
    if (!enabled) {
      setValue(target);
      return;
    }
    setValue(0);
    const started = performance.now();
    const duration = 650;
    let raf = 0;
    const tick = (now: number) => {
      const progress = Math.min((now - started) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(target * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [enabled, target]);
  return value;
}

interface AchievementToastCardProps {
  toast: AchievementToast;
  position?: AchievementNotificationPosition;
  animated?: boolean;
  onOpenDetails?: () => void;
}

function resolveIconSource(toast: AchievementToast, imgFailed: boolean): "game" | "logo" {
  const icon = toast.icon?.trim();
  if (icon && !imgFailed) return "game";
  return "logo";
}

export const AchievementToastCard: React.FC<AchievementToastCardProps> = ({
  toast,
  position = "top-right",
  animated = true,
  onOpenDetails,
}) => {
  const tier = toast.tier || "bronze";
  const [imgFailed, setImgFailed] = useState(false);
  const iconMode = useMemo(() => resolveIconSource(toast, imgFailed), [toast, imgFailed]);
  const side = sideFromPosition(position);
  const entry = entryMotion(position);
  const xp = toast.xpGained ?? 0;
  const shownXp = useCountUp(xp, animated && xp > 0);
  const eyebrow = xp > 0 ? `${tierLabels[tier] || "TROFÉU"} • +${shownXp} XP` : (tierLabels[tier] || "TROFÉU");
  const isPlatinum = tier === "platinum";
  const metallicEmblem = METALLIC_TIER_LOGOS[tier] || PherieliumLogoBronze;
  const hasDescription = Boolean(toast.description && toast.description.trim());

  return (
    <motion.div
      initial={
        animated
          ? { opacity: 0, x: entry.x, y: entry.y, scale: 0.96 }
          : { opacity: 0, x: 0, y: 0, scale: 1 }
      }
      animate={
        animated
          ? { opacity: 1, x: 0, y: 0, scale: 1 }
          : { opacity: 1, x: 0, y: 0, scale: 1 }
      }
      exit={
        animated
          ? { opacity: 0, x: entry.x * 0.6, y: entry.y * 0.6, scale: 0.97, transition: { duration: 0.22, ease: "easeOut" } }
          : { opacity: 0, transition: { duration: 0.12 } }
      }
      transition={
        animated
          ? { type: "spring", stiffness: 320, damping: 24, mass: 0.9 }
          : { duration: 0.15 }
      }
      whileHover={animated ? { scale: 1.015 } : undefined}
      whileTap={onOpenDetails && animated ? { scale: 0.985 } : undefined}
      className={`overlay-card achievement-card tier-${tier}${onOpenDetails ? " is-clickable" : ""}${isPlatinum ? " is-platinum" : ""}`}
      data-side={side}
      onClick={onOpenDetails}
      role={onOpenDetails ? "button" : undefined}
      tabIndex={onOpenDetails ? 0 : undefined}
      onKeyDown={
        onOpenDetails
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onOpenDetails();
              }
            }
          : undefined
      }
    >
      <div className={`overlay-shell layout-${side}`}>
        {/* Celebração única de entrada da Platina (sem loop perpétuo) */}
        {isPlatinum && animated ? (
          <span className="achievement-sparkles" aria-hidden>
            {PLATINUM_SPARKLES.map((sparkle) => (
              <span
                key={sparkle.left}
                className="sparkle"
                style={{
                  left: sparkle.left,
                  animationDelay: sparkle.delay,
                }}
              />
            ))}
          </span>
        ) : null}

        {/* Suporte único do emblema com iluminação concentrada */}
        <motion.div
          className="overlay-icon"
          aria-hidden
          initial={animated ? { scale: 0.8, opacity: 0 } : { opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={
            animated
              ? { type: "spring", stiffness: 360, damping: 22, delay: 0.05 }
              : { duration: 0.15 }
          }
        >
          {animated ? <span className="icon-halo" /> : null}
          <div
            className={`icon-avatar${iconMode === "game" ? " is-photo" : " is-logo"}`}
          >
            {iconMode === "game" ? (
              <img
                src={toast.icon}
                alt=""
                className="icon-image"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
              />
            ) : (
              <img
                src={metallicEmblem}
                alt={tier}
                className="icon-image"
              />
            )}
          </div>
        </motion.div>

        {/* Conteúdo textual estruturado: Eyebrow + Título até 2 linhas + Descrição opcional */}
        <div className="overlay-content">
          <div className="overlay-text">
            <motion.div
              className="achievement-eyebrow"
              initial={animated ? { opacity: 0, y: -6 } : { opacity: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={animated ? { duration: 0.35, delay: 0.10, ease: [0.16, 1, 0.3, 1] } : { duration: 0.15 }}
            >
              {eyebrow}
            </motion.div>

            <motion.h2
              className="achievement-title"
              initial={animated ? { opacity: 0, y: 6, filter: "blur(4px)" } : { opacity: 0 }}
              animate={{ opacity: 1, y: 0, filter: "none" }}
              transition={animated ? { duration: 0.40, delay: 0.15, ease: [0.16, 1, 0.3, 1] } : { duration: 0.15 }}
            >
              {toast.title}
            </motion.h2>

            {hasDescription ? (
              <motion.p
                className="achievement-description"
                initial={animated ? { opacity: 0, y: 4 } : { opacity: 0 }}
                animate={{ opacity: 1, y: 0 }}
                transition={animated ? { duration: 0.38, delay: 0.20, ease: [0.16, 1, 0.3, 1] } : { duration: 0.15 }}
              >
                {toast.description}
              </motion.p>
            ) : null}
          </div>
        </div>

        {/* Linha única inferior de contagem regressiva temporal */}
        <div className="overlay-progress" aria-hidden />
      </div>
    </motion.div>
  );
};
