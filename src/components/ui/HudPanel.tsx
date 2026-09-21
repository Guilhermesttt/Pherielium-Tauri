import React from "react";

export interface HudPanelProps {
  title?: string;
  subtitle?: string;
  tag?: string;
  headerRight?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  withCorners?: boolean;
}

export const HudCornerMarkers: React.FC<{ className?: string }> = () => null;

export const HudPanel: React.FC<HudPanelProps> = ({
  title,
  subtitle,
  tag,
  headerRight,
  children,
  className = "",
  contentClassName = "",
}) => {
  return (
    <section
      className={`relative overflow-hidden rounded-2xl border border-white/[0.08] bg-[#08090C]/90 p-5 md:p-6 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-xl font-sans ${className}`}
    >
      {(title || tag || headerRight) && (
        <header className="relative mb-5 flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] pb-4">
          <div className="flex items-center gap-3">
            {tag && (
              <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-xs font-medium tracking-wide text-white/70">
                {tag}
              </span>
            )}
            {title && (
              <div>
                <h3 className="text-sm md:text-base font-display font-semibold tracking-tight text-white">
                  {title}
                </h3>
                {subtitle && (
                  <p className="mt-0.5 text-xs text-white/40">
                    {subtitle}
                  </p>
                )}
              </div>
            )}
          </div>
          {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
        </header>
      )}

      <div className={`relative ${contentClassName}`}>{children}</div>
    </section>
  );
};

export interface HudModRowProps {
  name: string;
  version?: string;
  author?: string;
  status?: "installed" | "downloaded" | "active" | "disabled" | "error";
  enabled?: boolean;
  onToggle?: (next: boolean) => void;
  onRemove?: () => void;
  onClick?: () => void;
  className?: string;
}

export const HudModRow: React.FC<HudModRowProps> = ({
  name,
  version,
  author,
  status,
  enabled = true,
  onToggle,
  onRemove,
  onClick,
  className = "",
}) => {
  return (
    <div
      onClick={onClick}
      className={`group relative flex items-center justify-between gap-4 rounded-2xl border border-white/[0.06] bg-[#0E1015] px-4 py-3.5 transition-all duration-200 hover:border-white/20 hover:bg-[#12151B] ${
        onClick ? "cursor-pointer" : ""
      } ${className}`}
    >
      <div className="flex min-w-0 items-center gap-3.5">
        <div
          className={`h-2.5 w-2.5 rounded-full transition-all ${
            enabled
              ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)]"
              : "bg-white/20"
          }`}
        />
        <div className="min-w-0">
          <p className="truncate text-xs md:text-sm font-semibold text-white group-hover:text-white tracking-tight">
            {name}
          </p>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-white/40">
            {version && <span>v{version}</span>}
            {author && (
              <>
                <span>•</span>
                <span className="truncate">{author}</span>
              </>
            )}
            {status && (
              <span
                className={`rounded-full px-2 py-0.2 text-[9px] font-medium tracking-wide uppercase ${
                  status === "active" || status === "installed"
                    ? "bg-white/10 text-white"
                    : status === "error"
                    ? "bg-red-500/20 text-red-300"
                    : "bg-white/[0.05] text-white/50"
                }`}
              >
                {status}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {onToggle && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggle(!enabled);
            }}
            className={`cursor-pointer relative inline-flex h-6 w-11 shrink-0 items-center rounded-full border transition-colors focus:outline-none ${
              enabled
                ? "border-white bg-white"
                : "border-white/20 bg-white/[0.05]"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
                enabled
                  ? "translate-x-6 bg-black"
                  : "translate-x-1 bg-white/40"
              }`}
            />
          </button>
        )}

        {onRemove && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
            className="cursor-pointer p-1 text-white/30 hover:text-red-400 transition-colors"
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};
