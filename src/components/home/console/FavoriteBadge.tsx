import React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";

/**
 * Selo de favorito no canto da capa. Favoritar faz a estrela "estourar" (mola + um anel que abre e
 * some); desfavoritar encolhe e apaga rápido. Quem já era favorito ao abrir a Home não anima: o
 * `initial={false}` só deixa animar o que muda depois. Com "reduzir movimento" vira um fade.
 */
export const FavoriteBadge: React.FC<{ isFavorite: boolean }> = ({ isFavorite }) => {
  const reduced = useReducedMotion();
  return (
    <AnimatePresence initial={false}>
      {isFavorite && (
        <motion.span
          key="favorite"
          className="console-fav"
          role="img"
          aria-label="Favorito"
          initial={reduced ? { opacity: 0 } : { scale: 0.3, opacity: 0 }}
          animate={reduced ? { opacity: 1 } : { scale: 1, opacity: 1 }}
          exit={reduced ? { opacity: 0 } : { scale: 0.5, opacity: 0, transition: { duration: 0.15, ease: [0.22, 1, 0.36, 1] } }}
          transition={{ type: "spring", stiffness: 520, damping: 15, mass: 0.8 }}
        >
          {!reduced && (
            <motion.span
              aria-hidden
              className="console-fav-ring"
              initial={{ scale: 0.7, opacity: 0.7 }}
              animate={{ scale: 2.1, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            />
          )}
          <svg viewBox="0 0 24 24" className="console-fav-star" aria-hidden="true">
            <path d="M12 2.6l2.9 6.1 6.7.8-4.9 4.6 1.3 6.6L12 17.4l-6 3.3 1.3-6.6L2.4 9.5l6.7-.8L12 2.6z" fill="currentColor" />
          </svg>
        </motion.span>
      )}
    </AnimatePresence>
  );
};
