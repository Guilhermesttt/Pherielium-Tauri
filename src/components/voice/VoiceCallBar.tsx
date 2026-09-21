import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  MonitorUp,
  MonitorOff,
  Maximize2,
  PhoneOff,
  Phone,
} from "lucide-react";
import type { UserProfile, VoiceCallSession, CallState } from "../../types/domain";
import { OrbloomOrb, mapCallToOrbState } from "./OrbloomOrb";

interface VoiceCallBarProps {
  session: VoiceCallSession | null;
  userProfile?: UserProfile | null;
  duration: number;
  isMuted: boolean;
  isDeafened: boolean;
  isRemoteMuted?: boolean;
  isRemoteDeafened?: boolean;
  isSpeakingLocal?: boolean;
  isSpeakingRemote?: boolean;
  remoteSpeakingStates?: Map<string, boolean>;
  isSharingScreen: boolean;
  isReconnecting?: boolean;
  inputMode?: "voice-activity" | "push-to-talk";
  pushToTalkKey?: string;
  isPttPressed?: boolean;
  callState?: CallState;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleScreenShare: () => void;
  onOpenWindow: () => void;
  onHangUp: () => void;
}

const formatDuration = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export const VoiceCallBar: React.FC<VoiceCallBarProps> = ({
  session,
  userProfile,
  duration,
  isMuted,
  isDeafened,
  isRemoteMuted = false,
  isRemoteDeafened = false,
  isSpeakingLocal = false,
  isSpeakingRemote = false,
  remoteSpeakingStates,
  isSharingScreen,
  isReconnecting = false,
  inputMode = "voice-activity",
  pushToTalkKey = "F8",
  isPttPressed = false,
  callState = "active",
  onToggleMute,
  onToggleDeafen,
  onToggleScreenShare,
  onOpenWindow,
  onHangUp,
}) => {
  if (!session) return null;

  const isRingingOut = callState === "ringing-out";
  const isConnecting = callState === "connecting";

  // Determine active speaker info and avatar
  let displayAvatar: string | null | undefined = session.friendAvatar;
  let displayName = session.friendName || "Voz";
  let isCurrentlySpeaking = false;

  if (isSpeakingRemote) {
    isCurrentlySpeaking = true;
    if (session.participants && remoteSpeakingStates) {
      const activeRemote = session.participants.find((p) => remoteSpeakingStates.get(p.uid));
      if (activeRemote) {
        displayAvatar = activeRemote.avatar;
        displayName = activeRemote.name;
      }
    }
  } else if (isSpeakingLocal) {
    isCurrentlySpeaking = true;
    if (userProfile?.photoURL) {
      displayAvatar = userProfile.photoURL;
    }
    if (userProfile?.displayName) {
      displayName = `${userProfile.displayName} (Você)`;
    } else {
      displayName = "Você";
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: 50, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        transition={{ type: "spring", stiffness: 400, damping: 30 }}        className={`fixed bottom-4 left-1/2 -translate-x-1/2 z-[9990] flex items-center gap-4 rounded-2xl border px-4 py-2.5 shadow-[0_20px_50px_rgba(0,0,0,0.85)] backdrop-blur-2xl transition-colors duration-200 ${
          isReconnecting
            ? "border-[#2A2A2A] bg-[#0F0F0F]/90"
            : "border-[#161616] bg-[#0F0F0F]/90"
        }`}
      >
        {/* Connection Status & Friend / Speaker */}
        <div
          onClick={onOpenWindow}
          className="flex items-center gap-3 cursor-pointer group select-none"
          title="Abrir tela de chamada"
        >
          <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
            <OrbloomOrb
              size={44}
              quality="low"
              orbState={mapCallToOrbState({
                isRinging: isRingingOut,
                isConnecting: isConnecting || isReconnecting,
                isMuted,
                isDeafened,
                isSpeaking: isCurrentlySpeaking,
                callActive: true,
              })}
              participantId={session.friendUid ?? session.chatId}
              ambientMotion={false}
              label={`Chamada com ${displayName}`}
            />
            <div
              className={`absolute h-6 w-6 rounded-full overflow-hidden border transition-all duration-200 ${
                isReconnecting || isConnecting
                  ? "border-white/40 opacity-80 animate-pulse"
                  : isRingingOut
                  ? "border-white/30 opacity-60"
                  : isCurrentlySpeaking
                  ? "border-white/80 shadow-[0_0_12px_rgba(255,255,255,0.4)]"
                  : "border-white/10"
              }`}
            >
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-black/60 text-[9px] font-bold text-white backdrop-blur-sm">
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[#0F0F0F] ${
                isReconnecting
                  ? "bg-white animate-ping"
                  : isRingingOut
                  ? "bg-white/60"
                  : isConnecting
                  ? "bg-white/70 animate-pulse"
                  : isCurrentlySpeaking
                  ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)]"
                  : "bg-white/80"
              }`}
            />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  isReconnecting
                    ? "bg-white animate-pulse"
                    : isRingingOut
                    ? "bg-white/50 animate-ping"
                    : isConnecting
                    ? "bg-white/60 animate-pulse"
                    : isCurrentlySpeaking
                    ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.9)] ring-2 ring-white/30"
                    : "bg-white shadow-[0_0_6px_rgba(255,255,255,0.7)]"
                }`}
              />
              <span className="text-xs font-semibold uppercase tracking-[0.06em] text-white/90">
                {isReconnecting
                  ? "Reconectando..."
                  : isRingingOut
                  ? "Chamando..."
                  : isConnecting
                  ? "Conectando..."
                  : isCurrentlySpeaking
                  ? "Voz Ativa"
                  : "Conectado"}
              </span>

              {inputMode === "push-to-talk" && (
                <span
                  className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                    isPttPressed
                      ? "bg-white/20 text-white border-white/40 animate-pulse"
                      : "bg-white/5 text-white/60 border-white/10"
                  }`}
                >
                  PTT [{pushToTalkKey}]
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[#D2D2D2] group-hover:text-white transition-colors truncate max-w-[130px]">
                {displayName}
              </span>
              {isRemoteDeafened ? (
                <span className="flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white/80 border border-white/15">
                  <VolumeX className="h-2.5 w-2.5" /> Mutou tudo
                </span>
              ) : isRemoteMuted ? (
                <span className="flex items-center gap-1 rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-white/80 border border-white/15">
                  <MicOff className="h-2.5 w-2.5" /> Mutado
                </span>
              ) : null}
              {isCurrentlySpeaking && !isMuted && (
                <div className="flex items-end gap-0.5 ml-1 h-2.5" title="Transmitindo voz">
                  <span className="w-0.5 h-2 bg-white rounded-full animate-pulse" />
                  <span className="w-0.5 h-3 bg-white rounded-full animate-bounce" />
                  <span className="w-0.5 h-1.5 bg-white rounded-full animate-pulse" />
                </div>
              )}
              <span className="text-xs font-mono text-[#6C6C6C] shrink-0">
                • {formatDuration(duration)}
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-7 w-[1px] bg-[#2A2A2A]" />

        {/* Call Controls */}
        <div className="flex items-center gap-1.5">
          {/* Mute Mic */}
          <button
            type="button"
            onClick={onToggleMute}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-160 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              isMuted
                ? "bg-white text-[#030405] font-bold shadow-sm scale-105"
                : "bg-white/[0.06] text-white hover:bg-white/[0.12] border border-white/[0.08]"
            }`}
            title={isMuted ? "Desmutar microfone" : "Mutar microfone"}
          >
            {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
          </button>

          {/* Deafen Sound */}
          <button
            type="button"
            onClick={onToggleDeafen}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-160 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              isDeafened
                ? "bg-white text-[#030405] font-bold shadow-sm scale-105"
                : "bg-white/[0.06] text-white hover:bg-white/[0.12] border border-white/[0.08]"
            }`}
            title={isDeafened ? "Desmutar áudio" : "Silenciar áudio"}
          >
            {isDeafened ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          {/* Share Screen */}
          <button
            type="button"
            onClick={onToggleScreenShare}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-160 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              isSharingScreen
                ? "bg-white text-[#030405] shadow-md scale-105 hover:bg-white/90"
                : "bg-white/[0.06] text-white hover:bg-white/[0.12] border border-white/[0.08]"
            }`}
            title={isSharingScreen ? "Parar compartilhamento" : "Compartilhar tela"}
          >
            {isSharingScreen ? <MonitorOff className="h-4 w-4" /> : <MonitorUp className="h-4 w-4" />}
          </button>

          {/* Expand Window */}
          <button
            type="button"
            onClick={onOpenWindow}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/[0.06] text-white hover:bg-white/[0.12] border border-white/[0.08] transition-all duration-160 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            title="Expandir chamada"
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          {/* Disconnect */}
          <button
            type="button"
            onClick={onHangUp}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-white text-[#030405] hover:bg-white/80 active:scale-95 transition-all duration-160 shadow-md cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            title="Desconectar"
          >
            <PhoneOff className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

