import React from "react";
import { motion } from "framer-motion";
import { PHERIELIUM_LOGO_PATH } from "../../constants/assets";

interface WelcomeToastCardProps {
  title: string;
  subtitle?: string;
  avatar?: string;
  badge?: string;
  animated?: boolean;
  className?: string;
}

export const WelcomeToastCard: React.FC<WelcomeToastCardProps> = ({
  title,
  subtitle,
  avatar,
  badge = "PHELIERIUM",
  animated = true,
  className = "",
}) => (
  <motion.div
    initial={animated ? { opacity: 0, x: -28, y: 8, scale: 0.92 } : { opacity: 0 }}
    animate={animated ? { opacity: 1, x: 0, y: 0, scale: 1 } : { opacity: 1 }}
    exit={
      animated
        ? {
          opacity: 0,
          x: -22,
          y: -6,
          scale: 0.94,
          filter: "blur(2px)",
          transition: { duration: 0.34, ease: [0.4, 0, 1, 1] },
        }
        : { opacity: 0, transition: { duration: 0.12 } }
    }
    transition={animated ? { type: "spring", stiffness: 320, damping: 24 } : { duration: 0.15 }}
    className={`overlay-card welcome-card social-card${className ? ` ${className}` : ""}`}
  >
    <div className="overlay-shell layout-left">
      <motion.div
        className="overlay-icon"
        aria-hidden
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 18, delay: 0.06 }}
      >
        <span className="icon-halo" />
        <div className={`icon-avatar${avatar ? " is-photo" : " is-logo"}`}>
          <img src={avatar || PHERIELIUM_LOGO_PATH} alt="" className="icon-image" />
        </div>
      </motion.div>

      <div className="overlay-content">
        <div className="overlay-text">
          <motion.div
            className="social-badge"
            initial={{ opacity: 0, y: -8, scale: 0.88 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.34, delay: 0.12 }}
          >
            {badge}
          </motion.div>
          <motion.h2
            className="social-title"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.18 }}
          >
            {title}
          </motion.h2>
          {subtitle ? (
            <motion.p
              className="social-description"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.38, delay: 0.24 }}
            >
              {subtitle}
            </motion.p>
          ) : null}
        </div>
      </div>
      <div className="overlay-progress" aria-hidden />
    </div>
  </motion.div>
);
