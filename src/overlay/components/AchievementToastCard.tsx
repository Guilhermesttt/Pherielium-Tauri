import React, { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Trophy } from "lucide-react";
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

const SPARKLE_SEEDS = [
  { left: "10%", delay: "0s", duration: "2.2s" },
  { left: "22%", delay: "0.28s", duration: "2.7s" },
  { left: "36%", delay: "0.55s", duration: "2.4s" },
  { left: "48%", delay: "0.12s", duration: "3s" },
  { left: "61%", delay: "0.7s", duration: "2.5s" },
  { left: "74%", delay: "0.4s", duration: "2.9s" },
  { left: "87%", delay: "0.9s", duration: "2.3s" },
];

type CardSide = "left" | "right" | "center";

function sideFromPosition(position: AchievementNotificationPosition): CardSide {
  if (position === "top-center") return "center";
  if (position === "top-left" || position === "bottom-left") return "left";
  return "right";
}

function entryMotion(position: AchievementNotificationPosition) {
  if (position === "top-center") return { x: 0, y: -32 };
  if (position === "bottom-left" || position === "bottom-right") return { x: 0, y: 32 };
  if (position === "top-left") return { x: -32, y: 0 };
  return { x: 32, y: 0 };
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
    const duration = 720;
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

function resolveIconSource(toast: AchievementToast, imgFailed: boolean): "game" | "logo" | "trophy" {
  const icon = toast.icon?.trim();
  if (icon && !imgFailed) return "game";
  if (toast.isPreview) return "logo";
  return "trophy";
}

export const AchievementToastCard: React.FC<AchievementToastCardProps> = ({
  toast,
  position = "top-right",
  animated = true,
  onOpenDetails,
}) => {
  const tier = toast.tier || "iron";
  const [imgFailed, setImgFailed] = useState(false);
  const iconMode = useMemo(() => resolveIconSource(toast, imgFailed), [toast, imgFailed]);
  const side = sideFromPosition(position);
  const entry = entryMotion(position);
  const xp = toast.xpGained ?? 0;
  const shownXp = useCountUp(xp, animated && xp > 0);
  const eyebrow = xp > 0 ? `${tierLabels[tier]} • +${shownXp} XP` : tierLabels[tier];
  const isHighTier = tier === "gold" || tier === "platinum";
  const celebrate = animated && tier !== "iron";

  return (
    <motion.div
      initial={{ opacity: 0, x: entry.x, y: entry.y, scale: 0.86, rotateZ: side === "right" ? 2.4 : -2.4, filter: "blur(10px)" }}
      animate={{ opacity: 1, x: 0, y: 0, scale: 1, rotateZ: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, x: entry.x, y: entry.y, scale: 0.94, transition: { duration: 0.26 } }}
      transition={
        animated
          ? { type: "spring", stiffness: 280, damping: 20, mass: 0.85 }
          : { duration: 0.22 }
      }
      whileHover={animated ? { scale: 1.025, y: -4 } : undefined}
      whileTap={onOpenDetails && animated ? { scale: 0.985 } : undefined}
      className={`overlay-card achievement-card tier-${tier}${onOpenDetails ? " is-clickable" : ""}${isHighTier ? " is-important" : ""}`}
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
        {celebrate ? <span className="tier-aura" aria-hidden /> : null}
        {celebrate ? (
          <span className="achievement-sparkles" aria-hidden>
            {SPARKLE_SEEDS.map((sparkle) => (
              <span
                key={sparkle.left}
                className="sparkle"
                style={{
                  left: sparkle.left,
                  animationDelay: sparkle.delay,
                  animationDuration: sparkle.duration,
                }}
              />
            ))}
          </span>
        ) : null}

        <motion.div
          className="overlay-icon"
          aria-hidden
          initial={{ scale: 0.2, rotate: -28, opacity: 0 }}
          animate={{ scale: 1, rotate: 0, opacity: 1 }}
          transition={
            animated
              ? { type: "spring", stiffness: 520, damping: 14, delay: 0.08 }
              : { duration: 0.2 }
          }
        >
          {animated ? <span className="icon-halo" /> : null}
          <motion.div
            className={`icon-avatar${
              iconMode === "logo" ? " is-logo" : iconMode === "game" ? " is-photo" : ""
            }`}
            animate={
              celebrate
                ? isHighTier
                  ? { scale: [1, 1.08, 1], rotate: [0, -3, 3, 0] }
                  : { scale: [1, 1.04, 1] }
                : undefined
            }
            transition={
              celebrate
                ? { duration: isHighTier ? 2.2 : 2.8, repeat: Infinity, ease: "easeInOut", delay: 0.55 }
                : undefined
            }
          >
            {iconMode === "game" ? (
              <img
                src={toast.icon}
                alt=""
                className="icon-image"
                referrerPolicy="no-referrer"
                onError={() => setImgFailed(true)}
              />
            ) : iconMode === "logo" ? (
              <img src={PHERIELIUM_LOGO_PATH} alt="" className="icon-image" />
            ) : (
              <Trophy className="h-6 w-6" />
            )}
          </motion.div>
        </motion.div>

        <div className="overlay-content">
          <div className="overlay-text">
            <motion.div
              className="achievement-eyebrow"
              initial={{ opacity: 0, y: -10, scale: 0.82 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.42, delay: 0.18, ease: [0.16, 1, 0.3, 1] }}
            >
              {eyebrow}
            </motion.div>
            <motion.h2
              className="achievement-title"
              initial={{ opacity: 0, y: 14, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              transition={{ duration: 0.5, delay: 0.26, ease: [0.16, 1, 0.3, 1] }}
            >
              {toast.title}
            </motion.h2>
            {toast.description ? (
              <motion.p
                className="achievement-description"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.44, delay: 0.34, ease: [0.16, 1, 0.3, 1] }}
              >
                {toast.description}
              </motion.p>
            ) : null}
          </div>
        </div>

        <div className="overlay-progress" aria-hidden />
      </div>
    </motion.div>
  );
};
