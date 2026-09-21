import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronRight, Home } from "lucide-react";
import type { SoundEffectType } from "../../hooks/useSoundEffects";

interface InteractiveBreadcrumbProps {
  activeCategory: string;
  categoryLabel?: string;
  onSelectCategory: (category: string) => void;
  playSound: (type: SoundEffectType) => void;
}

export const InteractiveBreadcrumb: React.FC<InteractiveBreadcrumbProps> = React.memo(({
  activeCategory,
  categoryLabel,
  onSelectCategory,
  playSound,
}) => {
  const handleHomeClick = () => {
    playSound("select");
    onSelectCategory("ALL");
  };

  return (
    <nav aria-label="Navegação em migalhas de pão" className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleHomeClick}
        onMouseEnter={() => playSound("hover")}
        className="group cursor-pointer flex items-center gap-1.5 rounded-lg px-2 py-1 text-[9.5px] font-black uppercase tracking-[0.4em] transition-all hover:bg-white/10 hover:text-white"
        style={{ color: "rgba(255,255,255,0.45)" }}
        title="Voltar para a página inicial"
      >
        <Home className="h-3 w-3 text-white/40 group-hover:text-white transition-colors" />
        
      </button>

      <ChevronRight className="h-3 w-3 shrink-0" style={{ color: "rgba(255,255,255,0.2)" }} />

      <AnimatePresence mode="wait">
        <motion.div
          key={activeCategory}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          className="flex items-center"
        >
          <span
            className="rounded-lg px-2 py-1 text-[13px] font-medium font-ui capitalize"
            style={{ color: "rgba(255,255,255,0.85)" }}
          >
            {(categoryLabel || activeCategory).toLowerCase()}
          </span>
        </motion.div>
      </AnimatePresence>
    </nav>
  );
});

InteractiveBreadcrumb.displayName = "InteractiveBreadcrumb";
