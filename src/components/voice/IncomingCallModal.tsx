import React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Clock, LoaderCircle, Phone, PhoneOff, Video } from "lucide-react";
import { modalBackdropMotion, modalMotion } from "../../design-system/motion";
import { IconSwap } from "../ui/IconSwap";
import { TextSwap } from "../ui/TextSwap";
import type { CallInvitePayload } from "../../services/voiceCall";

// Ring timeout in seconds — must match incomingTimeoutTimerRef in useVoiceCall (35s),
// but we show 30s to give a few seconds buffer before the hook actually dismisses.
const RING_TIMEOUT_S = 30;

interface IncomingCallModalProps {
  isOpen: boolean;
  invite: CallInvitePayload | null;
  onAccept: () => void;
  onReject: () => void;
}

/**
 * Chamada recebida, no formato de cartão do estúdio de transições (Event Card): uma faixa no topo,
 * o avatar sobreposto à faixa como o selo de data, nome grande, linhas de detalhe, divisor e dois
 * botões. O cartão entra como um modal (0.96 → 1, 250ms) e sai mais rápido (150ms); o texto dos
 * botões troca no lugar ao atender/recusar; o toque do botão é de 0.99. Ver src/index.css (`.ic-*`).
 */
export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  isOpen,
  invite,
  onAccept,
  onReject,
}) => {
  const [isAccepting, setIsAccepting] = React.useState(false);
  const [isRejecting, setIsRejecting] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState(RING_TIMEOUT_S);

  // Reset local state when invite changes
  React.useEffect(() => {
    if (!isOpen || !invite) return;
    setIsAccepting(false);
    setIsRejecting(false);
    setSecondsLeft(RING_TIMEOUT_S);
  }, [invite?.callerId, isOpen]);

  // Countdown timer — auto-reject when it hits 0
  React.useEffect(() => {
    if (!isOpen || !invite) return;

    const interval = window.setInterval(() => {
      setSecondsLeft((s) => {
        if (s <= 1) {
          window.clearInterval(interval);
          // Auto-reject only if not already handled
          setIsRejecting((rej) => {
            if (!rej) onReject();
            return true;
          });
          return 0;
        }
        return s - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [invite?.callerId, isOpen, onReject]);

  const handleAccept = () => {
    setIsAccepting(true);
    onAccept();
  };

  const handleReject = () => {
    setIsRejecting(true);
    onReject();
  };

  const busy = isRejecting || isAccepting;

  return (
    <AnimatePresence>
      {isOpen && invite && (
        <motion.div
          {...modalBackdropMotion}
          className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xl select-none"
          role="alertdialog"
          aria-modal="true"
          aria-label={`${invite.callerName} está te ligando`}
        >
          <motion.div {...modalMotion} className="ic-card w-full max-w-[340px]">
            {/* faixa do topo: as ondas saem do avatar enquanto toca */}
            <div className="ic-band" aria-hidden="true">
              {!busy && (
                <>
                  <span className="ic-ripple" />
                  <span className="ic-ripple" style={{ animationDelay: "1.1s" }} />
                </>
              )}
              {/* tempo restante: a barra encolhe de 1 em 1 segundo */}
              <span className="ic-timer" style={{ transform: `scaleX(${secondsLeft / RING_TIMEOUT_S})` }} />
            </div>

            <div className="ic-body">
              <div className="ic-avatar">
                {invite.callerAvatar ? (
                  <img src={invite.callerAvatar} alt="" className="h-full w-full object-cover" draggable={false} />
                ) : (
                  <span className="text-[length:var(--step-3)] font-semibold tracking-tight text-[var(--ink)]">
                    {invite.callerName.slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>

              <h2 className="ic-title">{invite.callerName}</h2>

              <div className="ic-meta">
                <p className="ic-row">
                  {invite.hasVideo ? <Video className="h-4 w-4 shrink-0" aria-hidden /> : <Phone className="h-4 w-4 shrink-0" aria-hidden />}
                  <span>{invite.hasVideo ? "Chamada de vídeo" : "Chamada de voz"}</span>
                </p>
                <p className="ic-row">
                  <Clock className="h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    Toca por mais <span className="font-metric">{secondsLeft}</span> s
                  </span>
                </p>
              </div>

              <div className="ic-divider" />

              <div className="ic-actions">
                <button type="button" onClick={handleAccept} disabled={busy} autoFocus className="ic-press ic-accept">
                  <IconSwap
                    active={isAccepting}
                    a={invite.hasVideo ? <Video className="h-4 w-4" /> : <Phone className="h-4 w-4" />}
                    b={<LoaderCircle className="h-4 w-4 animate-spin" />}
                  />
                  <TextSwap text={isAccepting ? "Entrando…" : "Atender"} />
                </button>
                <button type="button" onClick={handleReject} disabled={busy} className="ic-press ic-decline">
                  <IconSwap
                    active={isRejecting}
                    a={<PhoneOff className="h-4 w-4" />}
                    b={<LoaderCircle className="h-4 w-4 animate-spin" />}
                  />
                  <TextSwap text={isRejecting ? "Recusando…" : "Recusar"} />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IncomingCallModal;
