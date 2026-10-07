import React from "react";

/** Barra de progresso monocromática (sem gradiente colorido), no estilo do notch. */
export const ProgressBar: React.FC<{ percent: number; label?: string; className?: string }> = ({
  percent,
  label,
  className = "",
}) => {
  const clamped = Math.min(100, Math.max(0, Number.isFinite(percent) ? percent : 0));
  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-white/[0.1] ${className}`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(clamped)}
      aria-label={label ?? `${Math.round(clamped)}%`}
    >
      <div
        className="h-full rounded-full bg-white/85 transition-[width] duration-500"
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
};
