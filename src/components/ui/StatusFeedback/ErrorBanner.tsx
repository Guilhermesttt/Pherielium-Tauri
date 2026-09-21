import React, { useState } from "react";
import { WifiOff, ShieldAlert, Clock, AlertTriangle, RefreshCw, X } from "lucide-react";
import { type AppErrorDetails, type ErrorKind } from "./types";

export interface ErrorBannerProps {
  error: AppErrorDetails | string | null;
  onRetry?: () => void | Promise<void>;
  onDismiss?: () => void;
  className?: string;
  variant?: "banner" | "card" | "inline";
  gamepadId?: string;
}

const KIND_CONFIG: Record<
  ErrorKind,
  { icon: React.ComponentType<{ className?: string }>; accentColor: string; defaultTitle: string }
> = {
  network: {
    icon: WifiOff,
    accentColor: "border-sky-500/30 bg-sky-500/10 text-sky-400",
    defaultTitle: "Sem Conexão",
  },
  auth: {
    icon: ShieldAlert,
    accentColor: "border-amber-500/30 bg-amber-500/10 text-amber-400",
    defaultTitle: "Erro de Autenticação",
  },
  timeout: {
    icon: Clock,
    accentColor: "border-orange-500/30 bg-orange-500/10 text-orange-400",
    defaultTitle: "Tempo Esgotado",
  },
  business: {
    icon: AlertTriangle,
    accentColor: "border-rose-500/30 bg-rose-500/10 text-rose-400",
    defaultTitle: "Atenção",
  },
  unknown: {
    icon: AlertTriangle,
    accentColor: "border-white/20 bg-white/5 text-white/80",
    defaultTitle: "Ocorreu um Erro",
  },
};

export const ErrorBanner: React.FC<ErrorBannerProps> = ({
  error,
  onRetry,
  onDismiss,
  className = "",
  variant = "banner",
  gamepadId = "error-banner-retry",
}) => {
  const [retrying, setRetrying] = useState(false);

  if (!error) return null;

  const errorObj: AppErrorDetails =
    typeof error === "string"
      ? { kind: "business", message: error }
      : error;

  const config = KIND_CONFIG[errorObj.kind] || KIND_CONFIG.unknown;
  const Icon = config.icon;
  const retryHandler = onRetry || errorObj.retry;
  const title = errorObj.title || config.defaultTitle;

  const handleRetry = async () => {
    if (!retryHandler || retrying) return;
    setRetrying(true);
    try {
      await retryHandler();
    } finally {
      setRetrying(false);
    }
  };

  if (variant === "inline") {
    return (
      <div
        role="alert"
        className={`flex items-center gap-2 text-xs font-medium text-rose-400/90 ${className}`}
      >
        <Icon className="h-4 w-4 shrink-0" />
        <span className="truncate">{errorObj.message}</span>
        {retryHandler && (
          <button
            type="button"
            data-gamepad-id={gamepadId}
            onClick={handleRetry}
            disabled={retrying}
            className="ml-auto flex items-center gap-1 rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white hover:bg-white/20 active:scale-95 transition-all"
          >
            <RefreshCw className={`h-3 w-3 ${retrying ? "animate-spin" : ""}`} />
            {errorObj.actionLabel || "Repetir"}
          </button>
        )}
      </div>
    );
  }

  if (variant === "card") {
    return (
      <div
        role="alert"
        className={`rounded-2xl border ${config.accentColor} p-5 backdrop-blur-xl shadow-lg transition-all ${className}`}
      >
        <div className="flex items-start gap-3.5">
          <div className="rounded-xl bg-white/10 p-2.5">
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h4 className="text-sm font-bold text-white">{title}</h4>
            <p className="mt-1 text-xs text-white/70 leading-relaxed">{errorObj.message}</p>
            {retryHandler && (
              <div className="mt-3.5 flex items-center gap-2">
                <button
                  type="button"
                  data-gamepad-id={gamepadId}
                  onClick={handleRetry}
                  disabled={retrying}
                  className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-1.5 text-xs font-bold text-black shadow-md transition-all hover:bg-white/90 hover:scale-[1.02] active:scale-95 disabled:opacity-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${retrying ? "animate-spin" : ""}`} />
                  {errorObj.actionLabel || "Tentar Novamente"}
                </button>
                {onDismiss && (
                  <button
                    type="button"
                    onClick={onDismiss}
                    className="rounded-xl border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/70 hover:bg-white/10 active:scale-95 transition-all"
                  >
                    Dispensar
                  </button>
                )}
              </div>
            )}
          </div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              aria-label="Fechar"
              className="rounded-lg p-1 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  // Banner padrão (topo ou embutido em lista)
  return (
    <div
      role="alert"
      className={`flex items-center justify-between gap-3 rounded-xl border ${config.accentColor} px-4 py-3 backdrop-blur-md transition-all ${className}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <Icon className="h-4 w-4 shrink-0" />
        <div className="min-w-0">
          <span className="text-xs font-bold text-white mr-2">{title}:</span>
          <span className="text-xs text-white/80">{errorObj.message}</span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        {retryHandler && (
          <button
            type="button"
            data-gamepad-id={gamepadId}
            onClick={handleRetry}
            disabled={retrying}
            className="flex items-center gap-1.5 rounded-lg bg-white/15 px-2.5 py-1 text-xs font-semibold text-white hover:bg-white/25 active:scale-95 transition-all"
          >
            <RefreshCw className={`h-3 w-3 ${retrying ? "animate-spin" : ""}`} />
            <span>{errorObj.actionLabel || "Tentar"}</span>
          </button>
        )}
        {onDismiss && (
          <button
            type="button"
            onClick={onDismiss}
            aria-label="Fechar aviso"
            className="rounded-md p-1 text-white/40 hover:bg-white/10 hover:text-white transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
