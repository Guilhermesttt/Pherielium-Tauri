import React from "react";
import { motion, useReducedMotion } from "framer-motion";

export interface SectionTransitionProps {
  /** Muda a cada seção (aba, filtro, página): a troca da chave dispara a entrada. */
  id: string | number;
  className?: string;
  children: React.ReactNode;
}

/**
 * Entrada de uma seção quando a pessoa troca de aba ou filtro: sobe 8 px e desfoca 2 px até ficar
 * nítida, no ritmo do "panel reveal" do transitions.dev (250 ms, `--ease-smooth-out`). Com "reduzir
 * movimento" só aparece, sem deslocamento nem desfoque.
 */
export const SectionTransition: React.FC<SectionTransitionProps> = ({ id, className, children }) => {
  const reduced = useReducedMotion();
  return (
    <motion.div
      key={id}
      className={className}
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: 8, filter: "blur(2px)" }}
      animate={reduced ? { opacity: 1 } : { opacity: 1, y: 0, filter: "blur(0px)" }}
      transition={{ duration: reduced ? 0.12 : 0.25, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
};
