import React from "react";
import { Sparkles, type LucideIcon } from "lucide-react";

export interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description: string;
  primaryAction?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
    gamepadId?: string;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
    icon?: LucideIcon;
    gamepadId?: string;
  };
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon = Sparkles,
  title,
  description,
  primaryAction,
  secondaryAction,
  className = "",
  size = "md",
}) => {
  const isSm = size === "sm";
  const isLg = size === "lg";

  return (
    <div
      className={`flex flex-col items-center justify-center text-center rounded-3xl border border-white/8 bg-black/25 backdrop-blur-2xl px-6 py-12 shadow-[0_20px_50px_rgba(0,0,0,0.3)] transition-all ${
        isSm ? "py-8 px-4" : isLg ? "py-16 px-8" : ""
      } ${className}`}
    >
      {/* Glow & Icon Halo */}
      <div className="relative mb-4 flex items-center justify-center">
        <div className="absolute inset-0 rounded-full bg-white/10 blur-xl scale-150 animate-pulse" />
        <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.06] text-white/80 shadow-inner">
          <Icon className="h-7 w-7 text-white" />
        </div>
      </div>

      {/* Typography */}
      <h3 className="text-base font-bold text-white tracking-wide">{title}</h3>
      <p className="mt-1.5 max-w-sm text-xs font-normal leading-relaxed text-white/50">
        {description}
      </p>

      {/* Actions */}
      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {primaryAction && (
            <button
              type="button"
              data-gamepad-id={primaryAction.gamepadId || "empty-state-primary"}
              onClick={primaryAction.onClick}
              className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-black shadow-lg shadow-white/10 transition-all duration-200 hover:bg-white/90 hover:scale-105 active:scale-95"
            >
              {primaryAction.icon && <primaryAction.icon className="h-4 w-4" />}
              <span>{primaryAction.label}</span>
            </button>
          )}

          {secondaryAction && (
            <button
              type="button"
              data-gamepad-id={secondaryAction.gamepadId || "empty-state-secondary"}
              onClick={secondaryAction.onClick}
              className="flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-medium text-white/80 backdrop-blur-md transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-95"
            >
              {secondaryAction.icon && <secondaryAction.icon className="h-4 w-4" />}
              <span>{secondaryAction.label}</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
};
