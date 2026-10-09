import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { animated, useSpring } from "@react-spring/web";
import { Phone, PhoneOff, Video } from "lucide-react";
import { OrbloomOrb } from "./OrbloomOrb";
import { SPRINGS } from "../../design-system/motion";
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

/** Ondas que saem do avatar enquanto toca (uma só mola em loop; parado com "reduzir movimento"). */
const Ripple: React.FC<{ delay: number; reduce: boolean }> = ({ delay, reduce }) => {
  const style = useSpring({
    loop: !reduce,
    from: { scale: 0.9, opacity: reduce ? 0 : 0.28 },
    to: { scale: 1.55, opacity: 0 },
    delay,
    config: { duration: 2200 },
  });
  return (
    <animated.span
      aria-hidden
      style={style}
      className="pointer-events-none absolute inset-6 rounded-full border border-white/25"
    />
  );
};

const RoundAction: React.FC<{
  label: string;
  tone: "danger" | "accept";
  disabled: boolean;
  onClick: () => void;
  autoFocus?: boolean;
  children: React.ReactNode;
}> = ({ label, tone, disabled, onClick, autoFocus, children }) => (
  <div className="flex flex-col items-center gap-2">
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      autoFocus={autoFocus}
      aria-label={label}
      whileHover={{ scale: 1.06 }}
      whileTap={{ scale: 0.9 }}
      transition={{ type: "spring", stiffness: 520, damping: 22 }}
      className={`flex h-16 w-16 cursor-pointer items-center justify-center rounded-full text-white outline-none transition-[filter] focus-visible:ring-2 focus-visible:ring-white/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0e] disabled:cursor-default disabled:opacity-50 ${
        tone === "danger" ? "bg-[#ff453a] hover:brightness-110" : "bg-[#30d158] hover:brightness-110"
      }`}
    >
      {children}
    </motion.button>
    <span className="text-[12px] font-medium text-white/60">{label}</span>
  </div>
);

export const IncomingCallModal: React.FC<IncomingCallModalProps> = ({
  isOpen,
  invite,
  onAccept,
  onReject,
}) => {
  const reduce = Boolean(useReducedMotion());
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

  // O cartão sobe com uma mola; o avatar "respira" de leve até atender/recusar.
  const panel = useSpring({
    from: reduce ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 28, scale: 0.94 },
    to: { opacity: 1, y: 0, scale: 1 },
    config: SPRINGS.soft,
  });
  const avatarSpring = useSpring({ scale: isAccepting ? 1.07 : 1, config: SPRINGS.bouncy });

  if (!isOpen || !invite) return null;

  const handleAccept = () => {
    setIsAccepting(true);
    onAccept();
  };

  const handleReject = () => {
    setIsRejecting(true);
    onReject();
  };

  // Anel fino de contagem regressiva ao redor do avatar
  const radius = 84;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - secondsLeft / RING_TIMEOUT_S);
  const busy = isRejecting || isAccepting;

  return (
    <div
      className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 p-4 backdrop-blur-xl select-none"
      role="alertdialog"
      aria-modal="true"
      aria-label={`${invite.callerName} está te ligando`}
    >
      <animated.div
        style={panel}
        className="relative flex w-full max-w-[360px] flex-col items-center overflow-hidden rounded-[30px] border border-white/10 bg-[#0c0c0e]/95 px-8 pb-8 pt-9 shadow-[0_30px_90px_rgba(0,0,0,0.75)]"
      >
        <div className="pointer-events-none absolute -top-28 left-1/2 h-56 w-56 -translate-x-1/2 rounded-full bg-white/[0.05] blur-[80px]" />

        {/* avatar + anel de tempo + ondas */}
        <div className="relative flex h-[192px] w-[192px] items-center justify-center">
          {!busy && (
            <>
              <Ripple delay={0} reduce={reduce} />
              <Ripple delay={1100} reduce={reduce} />
            </>
          )}
          <svg className="pointer-events-none absolute inset-0 h-full w-full -rotate-90" viewBox="0 0 192 192" aria-hidden>
            <circle cx="96" cy="96" r={radius} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2" />
            <circle
              cx="96"
              cy="96"
              r={radius}
              fill="none"
              stroke="rgba(255,255,255,0.34)"
              strokeWidth="2"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={dashOffset}
              style={{ transition: "stroke-dashoffset 1s linear" }}
            />
          </svg>

          <animated.div style={avatarSpring} className="relative flex items-center justify-center">
            <OrbloomOrb
              size={152}
              orbState="listening"
              participantId={invite.callerId}
              ambientMotion={false}
              label={`Chamada de ${invite.callerName}`}
              color="#D4D4D8"
              customConfig={{
                preset: "deep-field-blue-01",
                appearance: { intensity: 0.8, detail: 0.5, glass: 0.2, glow: 0.65 },
                motion: { speed: 0.35, drift: 0.2 },
              }}
            />
            <div className="pointer-events-none absolute z-10 flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-full border border-white/15 bg-[#0E0E0E] shadow-[0_8px_32px_rgba(0,0,0,0.85)]">
              {invite.callerAvatar ? (
                <img src={invite.callerAvatar} alt="" className="h-full w-full rounded-full object-cover" />
              ) : (
                <span className="text-2xl font-semibold tracking-tight text-white">
                  {invite.callerName.slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
          </animated.div>
        </div>

        <h2 className="mt-3 max-w-full truncate text-[24px] font-semibold tracking-tight text-white">{invite.callerName}</h2>
        <p className="mt-1 flex items-center gap-1.5 text-[14px] text-white/50">
          {invite.hasVideo ? <Video className="h-3.5 w-3.5" aria-hidden /> : null}
          {invite.hasVideo ? "Chamada de vídeo" : "Chamada de voz"}
        </p>

        <div className="mt-8 flex w-full items-start justify-center gap-14">
          <RoundAction label="Recusar" tone="danger" disabled={busy} onClick={handleReject}>
            <PhoneOff className="h-6 w-6" />
          </RoundAction>
          <RoundAction label="Atender" tone="accept" disabled={busy} onClick={handleAccept} autoFocus>
            <Phone className="h-6 w-6" />
          </RoundAction>
        </div>
      </animated.div>
    </div>
  );
};

export default IncomingCallModal;
