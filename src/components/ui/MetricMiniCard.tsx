import React from "react";
import type { SoundEffectType } from "../../hooks/useSoundEffects";

export interface MetricMiniCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  hint?: string;
  badge?: string;
  isMono?: boolean;
  className?: string;
  onClick?: () => void;
  onMouseEnter?: () => void;
  playSound?: (type: SoundEffectType) => void;
}

export const MetricMiniCard: React.FC<MetricMiniCardProps> = ({
  label,
  value,
  icon,
  hint,
  badge,
  isMono = false,
  className = "",
  onClick,
  onMouseEnter,
  playSound,
}) => {
  const isClickable = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      onMouseEnter={() => {
        playSound?.("hover");
        onMouseEnter?.();
      }}
      className={`relative flex flex-col justify-between rounded-xl border border-white/[0.08] bg-[#0a0a0a] p-4 transition-all duration-150 ease-out hover:border-white/20 hover:bg-[#141414] hover:-translate-y-0.5 ${
        isClickable ? "cursor-pointer hover:border-white/20 hover:bg-[#141414] active:scale-[0.98]" : ""
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {icon && <span className="text-white/45">{icon}</span>}
          <span className="text-[10px] font-black uppercase tracking-[0.24em] text-[#8A8A8A] font-body">
            {label}
          </span>
        </div>
        {badge && (
          <span className="rounded-md border border-white/10 bg-white/[0.05] px-2 py-0.5 font-mono text-[9px] font-bold text-white/50">
            {badge}
          </span>
        )}
      </div>

      <div className="mt-3">
        <p
          className={`text-2xl md:text-3xl font-black text-white leading-none ${
            isMono ? "font-mono" : "tracking-tight"
          }`}
        >
          {value}
        </p>
        {hint && (
          <p className="mt-1.5 text-[10.5px] font-medium text-white/35 leading-tight">
            {hint}
          </p>
        )}
      </div>
    </div>
  );
};
