import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneOff, Video } from "lucide-react";
import { PHERIELIUM_LOGO_PATH } from "../../constants/assets";
import { OrbloomOrb } from "./OrbloomOrb";
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

  if (!isOpen || !invite) return null;

  const handleAccept = () => {
    setIsAccepting(true);
    onAccept();
  };

  const handleReject = () => {
    setIsRejecting(true);
    onReject();
  };

  // Progress arc for the countdown ring (SVG circle)
  const radius = 84;
  const circumference = 2 * Math.PI * radius;
  const progress = secondsLeft / RING_TIMEOUT_S;
  const dashOffset = circumference * (1 - progress);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/75 p-4 backdrop-blur-md select-none">
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 12 }}
          transition={{ type: "spring", bounce: 0, duration: 0.35 }}
          className="relative w-full max-w-[380px] overflow-hidden rounded-[24px] border border-white/[0.1] bg-[#0E0F12] shadow-[0_24px_80px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] flex flex-col"
        >
          {/* Top Atmospheric Glow */}
          <div className="pointer-events-none absolute left-1/2 -top-24 h-48 w-48 -translate-x-1/2 rounded-full bg-white/[0.04] blur-[70px]" />

          <div className="p-6">
            {/* Header bar */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-white/[0.08] border border-white/15 flex items-center justify-center text-white">
                  <Phone className="h-3 w-3 animate-pulse" />
                </div>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-white">
                  Chamada recebida
                </span>
              </div>

              <div className="flex items-center gap-1.5 opacity-40">
                <img src={PHERIELIUM_LOGO_PATH} alt="" className="h-3.5 w-3.5 object-contain" />
                <span className="text-[9.5px] font-bold text-white tracking-widest uppercase">
                  PHERIELIUM
                </span>
              </div>
            </div>

            {/* Caller presence */}
            <div className="flex flex-col items-center text-center">
              {/* Orb + countdown ring */}
              <div className="relative my-2 flex h-[192px] w-[192px] items-center justify-center">

                {/* SVG countdown ring */}
                <svg
                  className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none"
                  viewBox="0 0 192 192"
                  aria-hidden
                >
                  {/* Track */}
                  <circle
                    cx="96"
                    cy="96"
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="2"
                  />
                  {/* Progress arc */}
                  <motion.circle
                    cx="96"
                    cy="96"
                    r={radius}
                    fill="none"
                    stroke="rgba(255,255,255,0.32)"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={dashOffset}
                    style={{ transition: "stroke-dashoffset 1s linear" }}
                  />
                </svg>

                {/* Orb */}
                <motion.div
                  animate={isAccepting ? { scale: 1.06 } : { scale: 1 }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.35 }}
                  className="relative flex items-center justify-center"
                >
                  <OrbloomOrb
                    size={152}
                    orbState="listening"
                    participantId={invite.callerId}
                    ambientMotion={false}
                    label={`Chamada de ${invite.callerName}`}
                    color="#D4D4D8"
                    customConfig={{
                      preset: "deep-field-blue-01",
                      appearance: {
                        intensity: 0.8,
                        detail: 0.5,
                        glass: 0.2,
                        glow: 0.65,
                      },
                      motion: {
                        speed: 0.35,
                        drift: 0.2,
                      },
                    }}
                  />

                  {/* Avatar */}
                  <div className="absolute h-[88px] w-[88px] overflow-hidden rounded-full border border-white/15 bg-[#0E0E0E] shadow-[0_8px_32px_rgba(0,0,0,0.85),inset_0_1px_1px_rgba(255,255,255,0.12)] flex items-center justify-center z-10 pointer-events-none">
                    {invite.callerAvatar ? (
                      <img
                        src={invite.callerAvatar}
                        alt={invite.callerName}
                        className="h-full w-full object-cover rounded-full"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-2xl font-bold tracking-tight text-white select-none">
                        {invite.callerName.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                  </div>
                </motion.div>

                {/* Countdown badge */}
                <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex items-center justify-center">
                  <motion.div
                    key={secondsLeft}
                    initial={{ opacity: 0.5, scale: 0.85 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", bounce: 0, duration: 0.25 }}
                    className="px-2.5 py-1 rounded-full bg-black/60 border border-white/10 text-[11px] font-semibold tabular-nums text-white/60"
                  >
                    {secondsLeft}s
                  </motion.div>
                </div>
              </div>

              {/* Caller name */}
              <h2 className="text-[22px] font-bold tracking-tight text-white mt-2">
                {invite.callerName}
              </h2>

              {/* Badge — only when caller initiated with video */}
              {invite.hasVideo ? (
                <div className="mt-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.06] border border-white/10 text-white">
                  <Video className="h-3.5 w-3.5 text-sky-400" />
                  <span className="text-[12px] font-semibold tracking-wide">Chamada de vídeo</span>
                </div>
              ) : null}

              {/* Status line */}
              <p className="mt-1.5 text-[12.5px] font-medium text-white/45 tracking-wide">
                está te ligando
              </p>

              {/* Action buttons */}
              <div className="mt-6 flex items-center gap-3 w-full">
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isRejecting || isAccepting}
                  className="cursor-pointer flex-1 h-14 py-2.5 rounded-2xl border border-rose-500/25 bg-rose-500/10 hover:bg-rose-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 text-rose-400 shadow-md group disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-rose-400"
                >
                  <div className="h-7 w-7 rounded-full bg-rose-500/15 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <PhoneOff className="h-3.5 w-3.5" />
                  </div>
                  <span className="text-[12px] font-semibold tracking-wider uppercase">RECUSAR</span>
                </button>

                <button
                  type="button"
                  onClick={handleAccept}
                  disabled={isRejecting || isAccepting}
                  className="cursor-pointer flex-1 h-14 py-2.5 rounded-2xl bg-white hover:bg-white/90 text-black active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 shadow-[0_0_24px_rgba(255,255,255,0.18)] group disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-white"
                >
                  <div className="h-7 w-7 rounded-full bg-black/10 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Phone className="h-3.5 w-3.5 text-black" />
                  </div>
                  <span className="text-[12px] font-bold tracking-wider uppercase">
                    ATENDER
                  </span>
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};

export default IncomingCallModal;
