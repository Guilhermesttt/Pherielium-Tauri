import React from "react";
import { motion } from "framer-motion";
import { Camera } from "lucide-react";

interface CaptureToastCardProps {
  title?: string;
  subtitle?: string;
  previewUrl?: string;
  animated?: boolean;
}

export const CaptureToastCard: React.FC<CaptureToastCardProps> = ({
  title = "Captura salva",
  subtitle,
  previewUrl,
  animated = true,
}) => (
  <motion.div
    initial={animated ? { opacity: 0, y: 18, scale: 0.9 } : { opacity: 0 }}
    animate={{ opacity: 1, y: 0, scale: 1 }}
    exit={animated ? { opacity: 0, y: 10, scale: 0.96 } : { opacity: 0, transition: { duration: 0.15 } }}
    transition={animated ? { type: "spring", stiffness: 340, damping: 24 } : { duration: 0.15 }}
    className="overlay-card welcome-card social-card capture-card"
  >
    <div className="overlay-shell layout-left">
      <motion.div
        className="overlay-icon capture-shutter"
        aria-hidden
        initial={animated ? { scale: 0.4, opacity: 0 } : { opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={animated ? { type: "spring", stiffness: 480, damping: 16, delay: 0.04 } : { duration: 0.15 }}
      >
        {animated ? <span className="icon-halo capture-halo" /> : null}
        <div className={`icon-avatar${previewUrl ? " is-photo" : " is-logo"}`}>
          {previewUrl ? (
            <img src={previewUrl} alt="" className="icon-image" />
          ) : (
            <Camera className="h-7 w-7 text-white" />
          )}
        </div>
      </motion.div>

      <div className="overlay-content">
        <div className="overlay-text">
          <motion.div
            className="social-badge"
            initial={animated ? { opacity: 0, y: -8, scale: 0.88 } : { opacity: 0 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={animated ? { duration: 0.3, delay: 0.1 } : { duration: 0.15 }}
          >
            CAPTURA
          </motion.div>
          <motion.h2
            className="social-title"
            initial={animated ? { opacity: 0, y: 10 } : { opacity: 0 }}
            animate={{ opacity: 1, y: 0 }}
            transition={animated ? { duration: 0.36, delay: 0.16 } : { duration: 0.15 }}
          >
            {title}
          </motion.h2>
          {subtitle ? (
            <motion.p
              className="social-description"
              initial={animated ? { opacity: 0, y: 8 } : { opacity: 0 }}
              animate={{ opacity: 1, y: 0 }}
              transition={animated ? { duration: 0.32, delay: 0.22 } : { duration: 0.15 }}
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
