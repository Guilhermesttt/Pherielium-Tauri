import React, { useRef } from "react";
import { motion } from "framer-motion";
import { useGamepadNavigation } from "../../hooks/useGamepadNavigation";

export interface SystemPageShellProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}

export const SystemPageShell: React.FC<SystemPageShellProps> = React.memo(
  ({ title, description, actions, children }) => {
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
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
        className="flex-1 overflow-y-auto thin-scrollbar"
        style={{
          padding: "32px 40px 48px",
          contain: "layout",
        }}
      >
        <div className="mx-auto flex min-h-full max-w-6xl flex-col">
          {/* Page Header Apple Style */}
          <div className="mx-auto mb-8 flex w-full max-w-5xl flex-wrap items-end justify-between gap-x-8 gap-y-4">
            <div className="min-w-0">
              <h1
                className="font-display font-black leading-[1.04] text-[var(--ink)]"
                style={{ fontSize: "var(--step-4)", letterSpacing: "-0.035em" }}
              >
                {title}
              </h1>
              {description && (
                <p className="mt-2 max-w-2xl text-[0.9375rem] font-body leading-relaxed text-[var(--ink-muted)] tracking-[-0.011em]">
                  {description}
                </p>
              )}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
          </div>

          <div className="mx-auto w-full max-w-5xl">{children}</div>
        </div>
      </motion.div>
    );
  },
);

SystemPageShell.displayName = "SystemPageShell";

