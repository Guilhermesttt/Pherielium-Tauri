import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Loader2 } from "lucide-react";
import { getPlatformPhaseLabel } from "../utils/platformOperationReducer";

interface PlatformRemovalTransitionProps {
  active: boolean;
  phase?: string;
  reducedMotion?: boolean;
  children: React.ReactNode;
}

export const PlatformRemovalTransition: React.FC<PlatformRemovalTransitionProps> = ({
  active,
  phase = "revoking-account",
  reducedMotion = false,
  children,
}) => {
  return (
    <div className="relative overflow-hidden rounded-2xl">
      {children}

      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={reducedMotion ? { duration: 0.1 } : { duration: 0.25 }}
            className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-black/75 backdrop-blur-md p-6 text-center"
          >
            <Loader2 className="w-8 h-8 text-red-400 animate-spin mb-3" />
            <h4 className="text-sm font-bold text-white mb-1">
              Desconectando plataforma...
            </h4>
            <p className="text-xs text-white/60">
              {getPlatformPhaseLabel(phase)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
