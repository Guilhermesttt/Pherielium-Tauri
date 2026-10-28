import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, ExternalLink, LogOut, CheckCircle2, KeyRound, AlertCircle } from "lucide-react";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import { LinearProgress } from "../ui/LinearProgress";
import { ThinkingOrbLoader } from "../ThinkingOrbLoader";
import { fetchEpicStatus, validateEpicSession } from "../../services/epic";
import { PHERIELIUM_LOGO_PATH } from "../../constants/assets";

import type { PlatformOperationState } from "../../types/platformOperations";
import { getPlatformPhaseLabel } from "../../utils/platformOperationReducer";
import { modalBackdropMotion, modalMotion } from "../../design-system/motion";
import { useModalSounds } from "../../hooks/useModalSounds";

interface EpicConnectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConnect: (sid: string) => Promise<void>;
  onDisconnect?: () => Promise<void>;
  playSound: (sound: SoundEffectType) => void;
  operationState?: PlatformOperationState;
}

export const EpicConnectModal: React.FC<EpicConnectModalProps> = ({
  isOpen,
  onClose,
  onConnect,
  onDisconnect,
  playSound,
  operationState,
}) => {
  useModalSounds(isOpen);
  const [sid, setSid] = useState("");
  const [loading, setLoading] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  // Web (sem Electron): após abrir o navegador, segue aguardando o código
  // para o loader continuar visível até o usuário colar/submeter.
  const [waitingBrowser, setWaitingBrowser] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentAccount, setCurrentAccount] = useState<{
    authenticated: boolean;
    displayName?: string;
  } | null>(null);
  const [needsReauth, setNeedsReauth] = useState<{
    reason: "expired" | "network";
  } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setError(null);
      setSid("");
      setLoading(false);
      setDisconnecting(false);
      setWaitingBrowser(false);
      setNeedsReauth(null);
      // Run both checks in parallel. fetchEpicStatus reflects Legendary's view;
      // validateEpicSession reflects the encrypted vault + auto-refresh path.
      void Promise.allSettled([fetchEpicStatus(), validateEpicSession()]).then(
        ([statusResult, sessionResult]) => {
          if (statusResult.status === "fulfilled") {
            setCurrentAccount({
              authenticated: Boolean(statusResult.value.authenticated),
              displayName: statusResult.value.displayName,
            });
          } else {
            setCurrentAccount({ authenticated: false });
          }
          if (sessionResult.status === "fulfilled") {
            const { valid, reason } = sessionResult.value;
            if (!valid && (reason === "expired" || reason === "network")) {
              setNeedsReauth({ reason });
            }
          }
        },
      );
    }
  }, [isOpen]);

  const reauthMessage = needsReauth
    ? needsReauth.reason === "expired"
      ? "Sua sessão expirou. Reconecte a conta da Epic Games para continuar."
      : "Não foi possível validar sua sessão Epic. Verifique a conexão e reconecte."
    : null;

  const isOperationBusy = Boolean(
    operationState &&
    (operationState.status === "syncing" || operationState.status === "connecting" || operationState.status === "disconnecting"),
  );
  const isBusy = loading || disconnecting || waitingBrowser || isOperationBusy;
  const canClose = !loading && !disconnecting && !(operationState?.status === "syncing");

  const handleModalClose = () => {
    if (!canClose) return;
    setWaitingBrowser(false);
    setLoading(false);
    setError(null);
    onClose();
  };

  const busyLabel =
    operationState && isOperationBusy && "phase" in operationState
      ? getPlatformPhaseLabel(operationState.phase, "pt-BR")
      : disconnecting
        ? "Desconectando…"
        : waitingBrowser
          ? "Aguardando login no navegador..."
          : "Autenticando...";

  const handleDisconnectCurrent = async () => {
    if (isBusy) return;
    setDisconnecting(true);
    setError(null);
    playSound("back");
    try {
      if (onDisconnect) {
        await onDisconnect();
      } else if (window.electronAPI?.logoutEpic) {
        await window.electronAPI.logoutEpic();
      }
      setCurrentAccount({ authenticated: false });
      playSound("select");
    } catch (err: any) {
      setError(err?.message || "Erro ao desconectar conta da Epic Games.");
      playSound("back");
    } finally {
      setDisconnecting(false);
    }
  };

  const handleQuickLogin = async () => {
    if (isBusy) return;
    setLoading(true);
    setError(null);
    playSound("select");

    try {
      if (window.electronAPI?.openEpicLoginWindow) {
        const code = await window.electronAPI.openEpicLoginWindow();
        if (code) {
          await onConnect(code);
          setSid("");
          playSound("select");
          onClose();
        }
      } else {
        handleOpenAuthUrl();
        // Web: mantém o loader até o usuário colar o código abaixo.
        setWaitingBrowser(true);
      }
    } catch (err: any) {
      setError(err?.message || "Falha ao autenticar na Epic Games.");
      playSound("back");
    } finally {
      setLoading(false);
    }
  };

  const extractAuthorizationCode = (input: string): string => {
    let clean = input.trim();
    if (!clean) return "";
    // Se o usuário colou o JSON completo do navegador
    if (clean.startsWith("{") && clean.endsWith("}")) {
      try {
        const parsed = JSON.parse(clean);
        if (parsed.authorizationCode) return String(parsed.authorizationCode).trim();
        if (parsed.sid) return String(parsed.sid).trim();
      } catch {}
    }
    // Se colou a URL de redirecionamento do navegador
    if (clean.includes("code=")) {
      const match = clean.match(/[?&]code=([a-f0-9]+)/i);
      if (match && match[1]) return match[1];
    }
    return clean;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = extractAuthorizationCode(sid);
    // waitingBrowser conta como busy p/ travar outros botões, mas o submit
    // do código precisa passar — ele encerra a espera.
    if (!cleanCode || (isBusy && !waitingBrowser)) return;

    setLoading(true);
    setWaitingBrowser(false);
    setError(null);
    playSound("select");

    try {
      await onConnect(cleanCode);
      setSid("");
      playSound("select");
      onClose();
    } catch (err: any) {
      setError(err?.message || "Falha ao autenticar na Epic Games.");
      playSound("back");
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAuthUrl = () => {
    playSound("select");
    const authUrl =
      "https://www.epicgames.com/id/login?redirectUrl=https%3A%2F%2Fwww.epicgames.com%2Fid%2Fapi%2Fredirect%3FclientId%3D34a02cf8f4414e29b15921876da36f9a%26responseType%3Dcode";
    if (window.electronAPI?.openExternalUrl) {
      void window.electronAPI.openExternalUrl(authUrl);
    } else {
      window.open(authUrl, "_blank");
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            {...modalBackdropMotion}
            onClick={handleModalClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-[32px] z-50"
          />

          <motion.div
            {...modalMotion}
            className="glass-panel fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg border border-transparent rounded-[var(--corner-lg)] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_30px_100px_rgba(0,0,0,0.55)] z-50 overflow-hidden font-sans"
          >
            <div className="p-6">
              <div className="flex items-center justify-between pb-4 border-b border-transparent">
                <div className="flex items-center gap-3">
                  <img src={PHERIELIUM_LOGO_PATH} alt="Phelierium" className="w-8 h-8 rounded-[10px]" />
                  <h2 className="text-lg font-bold text-[var(--ink)]">Conectar Epic Games</h2>
                </div>
                <button
                  onClick={handleModalClose}
                  disabled={!canClose}
                  className="text-neutral-500 hover:text-[var(--ink)] transition-colors disabled:opacity-30 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-6 space-y-5">
                {/* Barra de progresso Linear-style durante auth/sync */}
                <AnimatePresence initial={false}>
                  {isBusy && (
                    <motion.div
                      key="epic-busy-progress"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className="overflow-hidden"
                    >
                      <div className="flex items-center justify-between gap-2.5 pb-1">
                        <div className="flex items-center gap-2.5">
                          <ThinkingOrbLoader size={20} preset={operationState?.status === "syncing" ? "sync" : "connecting"} />
                          <p className="text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)]">
                            <span className="t-shimmer" data-text={busyLabel}>{busyLabel}</span>
                          </p>
                        </div>
                        {waitingBrowser && (
                          <button
                            type="button"
                            onClick={() => setWaitingBrowser(false)}
                            className="text-[length:var(--step-0)] text-[var(--ink-muted)] hover:text-[var(--ink)] underline cursor-pointer"
                          >
                            Cancelar espera
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                {currentAccount?.authenticated && (
                  <div className="flex items-center justify-between p-3.5 rounded-[var(--corner-md)] bg-[var(--tone-3)] border border-transparent">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-[10px] bg-[var(--tone-3)] border border-transparent flex items-center justify-center text-[var(--ink)] shrink-0">
                        <CheckCircle2 size={16} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[length:var(--step-0)] font-bold text-[var(--ink)] truncate">
                          {currentAccount.displayName || "Conta Conectada"}
                        </p>
                        <p className="text-[length:var(--step-0)] text-neutral-400">Conta atualmente vinculada</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleDisconnectCurrent}
                      disabled={isBusy}
                      className="px-3 py-1.5 rounded-[var(--corner-sm)] bg-transparent hover:bg-white text-neutral-300 hover:text-[var(--tone-0)] border border-transparent hover:border-white text-[length:var(--step-0)] font-semibold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                    >
                      <LogOut size={13} />
                      Desconectar
                    </button>
                  </div>
                )}

                {reauthMessage && (
                  <div className="flex items-start gap-2 p-3 rounded-[10px] bg-[var(--tone-3)] border border-transparent">
                    <AlertCircle className="w-4 h-4 text-[var(--ink)] shrink-0 mt-0.5" />
                    <div className="min-w-0 space-y-1">
                      <p className="text-[var(--ink)] text-[length:var(--step-0)] font-semibold leading-relaxed">
                        {reauthMessage}
                      </p>
                    </div>
                  </div>
                )}

                {/* Opção 1: Login Rápido Automático (Recomendado) */}
                <div className="p-4 rounded-[var(--corner-lg)] bg-[var(--tone-3)] border border-transparent space-y-3">
                  <div className="space-y-1">
                    <p className="text-[length:var(--step-0)] font-bold text-[var(--ink)] flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-[var(--live)]" />
                      Login Automático com 1 Clique
                    </p>
                    <p className="text-[length:var(--step-0)] text-neutral-400 leading-relaxed">
                      Abre uma janela segura da Epic Games. Ao fazer login, seu código é detectado e validado automaticamente sem precisar copiar nada.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleQuickLogin}
                    disabled={isBusy}
                    className="w-full py-2.5 px-4 bg-[var(--ink)] hover:bg-neutral-200 text-[var(--tone-0)] rounded-[var(--corner-md)] text-[length:var(--step-0)] font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    {waitingBrowser ? "Aguardando navegador..." : loading ? "Conectando…" : "Entrar com a Epic Games"}
                  </button>
                </div>

                {/* Opção 2: Manual via Navegador */}
                <div className="p-4 rounded-[var(--corner-lg)] bg-[var(--tone-3)] border border-transparent space-y-3">
                  <div className="space-y-1">
                    <p className="text-[length:var(--step-0)] font-bold text-[var(--ink-muted)]">
                      Entrada Manual (Código ou JSON)
                    </p>
                    <p className="text-[length:var(--step-0)] text-neutral-400 leading-relaxed">
                      Se preferir usar o navegador externo, faça login e cole o código ou o JSON completo aqui embaixo:
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    <button
                      type="button"
                      onClick={handleOpenAuthUrl}
                      disabled={isBusy}
                      className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-[var(--tone-3)] hover:bg-[var(--tone-4)] text-[var(--ink-muted)] hover:text-[var(--ink)] text-[length:var(--step-0)] font-medium rounded-[var(--corner-sm)] border border-transparent transition-colors cursor-pointer"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Abrir no Navegador Externo
                    </button>

                    <form onSubmit={handleSubmit} className="space-y-2.5">
                      <input aria-label="Código de autorização da Epic"
                        type="text"
                        value={sid}
                        disabled={isBusy}
                        onChange={(e) => setSid(extractAuthorizationCode(e.target.value))}
                        placeholder="Cole o código (ex: 5beff...), JSON ou URL aqui..."
                        className="w-full bg-black border border-neutral-800 rounded-[var(--corner-sm)] px-4 py-2 text-[length:var(--step-0)] text-[var(--ink)] placeholder-neutral-600 focus:outline-none focus:border-neutral-500 transition-colors font-mono"
                      />
                      <button
                        type="submit"
                        disabled={!sid.trim() || isBusy}
                        className="w-full py-2 bg-[var(--tone-3)] hover:bg-[var(--tone-4)] text-[var(--ink)] disabled:bg-neutral-800 disabled:text-neutral-500 rounded-[var(--corner-sm)] text-[length:var(--step-0)] font-bold transition-colors cursor-pointer disabled:cursor-not-allowed"
                      >
                        Confirmar Código Manual
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};