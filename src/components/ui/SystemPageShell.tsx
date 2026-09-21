import React, { useRef } from "react";
import { motion } from "framer-motion";
import { useGamepadNavigation } from "../../hooks/useGamepadNavigation";

export interface SystemPageShellProps {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export const SystemPageShell: React.FC<SystemPageShellProps> = React.memo(
  ({ eyebrow, title, description, actions, children }) => {
    const scrollRef = useRef<HTMLDivElement>(null);

    useGamepadNavigation({
      scrollRef: scrollRef as React.RefObject<HTMLElement>,
      scrollSpeed: 25,
      disableX: true,
      disableO: true,
    });

    return (
      <motion.div
        ref={scrollRef}
        data-system-page
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", bounce: 0, duration: 0.4 }}
        className="flex-1 overflow-y-auto thin-scrollbar"
        style={{
          padding: "32px 40px 48px",
          contain: "layout",
        }}
      >
        <div className="mx-auto flex min-h-full max-w-6xl flex-col">
          {/* Page Header */}
          <div className="mx-auto mb-8 w-full max-w-5xl">
            {eyebrow && (
              <div
                className="inline-flex items-center gap-2 mb-4 rounded-xl border border-white/[0.08] text-[11px] font-mono font-semibold tracking-wider text-white/70 uppercase"
                style={{
                  padding: "6px 12px",
                  background: "rgba(255,255,255,0.04)",
                  backdropFilter: "blur(20px)",
                  WebkitBackdropFilter: "blur(20px)",
                }}
              >
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                <span>{eyebrow}</span>
              </div>
            )}
            <h1
              className="font-display font-black bg-gradient-to-b from-[#FFFFFF] to-[#8A8A8A] bg-clip-text text-transparent leading-[1.08]"
              style={{ fontSize: "clamp(28px, 4vw, 40px)", letterSpacing: "-0.02em" }}
            >
              {title}
            </h1>
            {description && (
              <p className="mt-2 max-w-2xl text-sm font-body leading-relaxed text-white/50">
                {description}
              </p>
            )}
            {actions && (
              <div className="mt-6 flex flex-wrap items-center gap-3">{actions}</div>
            )}
          </div>

          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </div>
      </motion.div>
    );
  },
);

SystemPageShell.displayName = "SystemPageShell";

