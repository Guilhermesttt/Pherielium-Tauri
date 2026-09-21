import React from "react";
import { motion } from "framer-motion";
import { type LucideIcon, AlertCircle, RefreshCw } from "lucide-react";
import { EmptyStateGraphic } from "./EmptyStateGraphic";

export interface StandardEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryActionLabel?: string;
  onSecondaryAction?: () => void;
  actionDisabled?: boolean;
  actionLoading?: boolean;
  className?: string;
  /** Ilustração 2D interativa (parallax de mouse) no lugar do ícone */
  illustrated?: "library" | "friends";
}

export const StandardEmptyState: React.FC<StandardEmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
  secondaryActionLabel,
  onSecondaryAction,
  actionDisabled = false,
  actionLoading = false,
  className = "",
  illustrated,
}) => {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      className={`w-full max-w-lg mx-auto py-8 px-6 rounded-2xl border border-white/[0.08] bg-[var(--color-surface)] flex flex-col items-center justify-center text-center ${illustrated ? "max-h-none" : "max-h-[240px]"} ${className}`}
    >
      {illustrated ? (
        <EmptyStateGraphic variant={illustrated} icon={Icon} className="mb-3 h-32" />
      ) : (
        Icon && (
          <div className="w-9 h-9 rounded-lg bg-white/[0.05] border border-white/[0.08] flex items-center justify-center mb-3 shrink-0 text-white/60">
            <Icon className="w-4.5 h-4.5" />
          </div>
        )
      )}

      <h3 className="text-[15px] font-display font-semibold text-white tracking-tight leading-tight mb-1">
        {title}
      </h3>

      {description && (
        <p className="text-[13px] font-body text-white/60 leading-normal max-w-sm mb-4">
          {description}
        </p>
      )}

      {(actionLabel || secondaryActionLabel) && (
        <div className="flex items-center gap-2.5 mt-1">
          {actionLabel && onAction && (
            <button
              type="button"
              onClick={onAction}
              disabled={actionDisabled || actionLoading}
              className="cursor-pointer h-10 px-5 rounded-lg bg-white text-black text-xs font-semibold hover:bg-white/90 active:scale-98 transition-all duration-160 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {actionLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
              <span>{actionLabel}</span>
            </button>
          )}

          {secondaryActionLabel && onSecondaryAction && (
            <button
              type="button"
              onClick={onSecondaryAction}
              className="cursor-pointer h-10 px-4 rounded-lg border border-white/15 bg-white/[0.04] text-white/80 hover:text-white hover:bg-white/[0.08] active:scale-98 text-xs font-medium transition-all duration-160"
            >
              {secondaryActionLabel}
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
};

export interface StandardErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const StandardErrorState: React.FC<StandardErrorStateProps> = ({
  title = "Ocorreu um erro",
  message = "Não foi possível carregar as informações. Tente novamente.",
  onRetry,
  className = "",
}) => {
  return (
    <div
      className={`w-full max-w-md mx-auto py-7 px-6 rounded-2xl border border-red-500/20 bg-red-950/10 flex flex-col items-center justify-center text-center ${className}`}
    >
      <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/25 flex items-center justify-center mb-2.5 text-red-400 shrink-0">
        <AlertCircle className="w-4.5 h-4.5" />
      </div>

      <h3 className="text-sm font-semibold text-white mb-1">{title}</h3>
      <p className="text-xs text-white/60 mb-4">{message}</p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="cursor-pointer h-9 px-4 rounded-lg border border-white/20 bg-white/10 text-white hover:bg-white/20 active:scale-98 text-xs font-semibold transition-all duration-160 flex items-center gap-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Tentar novamente</span>
        </button>
      )}
    </div>
  );
};
