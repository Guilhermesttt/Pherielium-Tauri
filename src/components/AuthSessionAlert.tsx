import React, { useEffect, useState } from "react";
import { LogIn, ShieldAlert, X } from "lucide-react";
import { useAuth, type AuthIssue } from "../auth/AuthProvider";

const AUTH_EVENT = "checkpoint:auth-issue";

export const dispatchAuthError = (issue: Exclude<AuthIssue, null>) => {
  window.dispatchEvent(
    new CustomEvent(AUTH_EVENT, { detail: { issue } }),
  );
};

/** Hook leve para disparar alertas de auth de qualquer ponto da app. */
export const useAuthAlert = () => ({
  dispatchAuthError,
});

export const AuthSessionAlert: React.FC = () => {
  const { authIssue, signOutUser, clearAuthIssue, refreshProfile } = useAuth();
  const [externalIssue, setExternalIssue] = useState<AuthIssue>(null);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);

  const activeIssue = authIssue ?? externalIssue;

  useEffect(() => {
    setDismissed(false);
  }, [activeIssue]);

  useEffect(() => {
    const onAuthIssue = (event: Event) => {
      const detail = (event as CustomEvent<{ issue?: AuthIssue }>).detail;
      if (detail?.issue === "session_expired" || detail?.issue === "profile_stale") {
        setExternalIssue(detail.issue);
        setDismissed(false);
      }
    };
    window.addEventListener(AUTH_EVENT, onAuthIssue);
    return () => window.removeEventListener(AUTH_EVENT, onAuthIssue);
  }, []);

  if (!activeIssue || dismissed) return null;

  const isExpired = activeIssue === "session_expired";
  const title = isExpired ? "Sessão expirada" : "Sessão instável";
  const message = isExpired
    ? "Faça login novamente para continuar sincronizando e usando recursos online."
    : "Não foi possível atualizar seu perfil. Algumas informações podem estar desatualizadas.";

  const handleRelogin = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await signOutUser();
    } finally {
      setBusy(false);
    }
  };

  const handleRetry = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await refreshProfile();
      setExternalIssue(null);
    } finally {
      setBusy(false);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    setExternalIssue(null);
    if (authIssue) {
      clearAuthIssue();
    }
  };

  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-120 flex justify-center px-4">
      <div
        role="alert"
        className="pointer-events-auto flex w-full max-w-xl items-start gap-3 rounded-xl border border-amber-500/30 bg-[#12141a]/95 px-4 py-3 text-amber-100 shadow-lg backdrop-blur-md"
      >
        <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold text-white">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-white/75">{message}</p>
          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            {isExpired ? (
              <button
                type="button"
                onClick={handleRelogin}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-bold text-black transition-all hover:bg-white/90 active:scale-95 disabled:opacity-50"
              >
                <LogIn className="h-3.5 w-3.5" />
                Fazer login
              </button>
            ) : (
              <button
                type="button"
                onClick={handleRetry}
                disabled={busy}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition-all hover:bg-white/25 active:scale-95 disabled:opacity-50"
              >
                Tentar novamente
              </button>
            )}
            <button
              type="button"
              onClick={handleDismiss}
              className="rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition-all hover:bg-white/10 active:scale-95"
            >
              Dispensar
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Fechar aviso de sessão"
          className="rounded-md p-1 text-white/40 transition-colors hover:bg-white/10 hover:text-white"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
