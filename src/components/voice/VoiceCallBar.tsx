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
import { IconSwap } from "../ui/IconSwap";

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
            ? "border-[#2A2A2A] bg-[var(--tone-1)]/90"
            : "border-[#161616] bg-[var(--tone-1)]/90"
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
                  ? "border-transparent opacity-80 animate-pulse"
                  : isRingingOut
                  ? "border-transparent opacity-60"
                  : isCurrentlySpeaking
                  ? "border-transparent shadow-[0_0_12px_rgba(255,255,255,0.4)]"
                  : "border-transparent"
              }`}
            >
              {displayAvatar ? (
                <img
                  src={displayAvatar}
                  alt={displayName}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-black/60 text-[length:var(--step-0)] font-bold text-[var(--ink)] backdrop-blur-sm">
                  {displayName.slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div
              className={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border border-[#0F0F0F] ${
                isReconnecting
                  ? "bg-[var(--ink)] animate-ping"
                  : isRingingOut
                  ? "bg-[var(--tone-4)]"
                  : isConnecting
                  ? "bg-[var(--tone-4)] animate-pulse"
                  : isCurrentlySpeaking
                  ? "bg-[var(--ink)] shadow-[0_0_8px_rgba(255,255,255,0.9)]"
                  : "bg-[var(--tone-4)]"
              }`}
            />
          </div>

          <div className="flex flex-col">
            <div className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  isReconnecting
                    ? "bg-[var(--ink)] animate-pulse"
                    : isRingingOut
                    ? "bg-[var(--tone-4)] animate-ping"
                    : isConnecting
                    ? "bg-[var(--tone-4)] animate-pulse"
                    : isCurrentlySpeaking
                    ? "bg-[var(--ink)] shadow-[0_0_8px_rgba(255,255,255,0.9)] ring-2 ring-[color:var(--ink)]"
                    : "bg-[var(--ink)] shadow-[0_0_6px_rgba(255,255,255,0.7)]"
                }`}
              />
              <span className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--ink)]">
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
                  className={`text-[length:var(--step-0)] font-mono font-semibold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
                    isPttPressed
                      ? "bg-[var(--tone-4)] text-[var(--ink)] border-transparent animate-pulse"
                      : "bg-[var(--tone-3)] text-[var(--ink-muted)] border-transparent"
                  }`}
                >
                  PTT [{pushToTalkKey}]
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-[var(--ink-muted)] group-hover:text-[var(--ink)] transition-colors truncate max-w-[130px]">
                {displayName}
              </span>
              {isRemoteDeafened ? (
                <span className="flex items-center gap-1 rounded bg-[var(--tone-3)] px-1.5 py-0.5 text-[length:var(--step-0)] font-semibold uppercase text-[var(--ink)] border border-transparent">
                  <VolumeX className="h-2.5 w-2.5" /> Mutou tudo
                </span>
              ) : isRemoteMuted ? (
                <span className="flex items-center gap-1 rounded bg-[var(--tone-3)] px-1.5 py-0.5 text-[length:var(--step-0)] font-semibold uppercase text-[var(--ink)] border border-transparent">
                  <MicOff className="h-2.5 w-2.5" /> Mutado
                </span>
              ) : null}
              {isCurrentlySpeaking && !isMuted && (
                <div className="flex items-end gap-0.5 ml-1 h-2.5" title="Transmitindo voz">
                  <span className="w-0.5 h-2 bg-[var(--ink)] rounded-full animate-pulse" />
                  <span className="w-0.5 h-3 bg-[var(--ink)] rounded-full animate-bounce" />
                  <span className="w-0.5 h-1.5 bg-[var(--ink)] rounded-full animate-pulse" />
                </div>
              )}
              <span className="text-xs font-mono text-[var(--ink-faint)] shrink-0">
                • {formatDuration(duration)}
              </span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="h-7 w-[1px] bg-[var(--tone-4)]" />

        {/* Call Controls */}
        <div className="flex items-center gap-1.5">
          {/* Mute Mic */}
          <button
            type="button"
            onClick={onToggleMute}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-160 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] ${
              isMuted
                ? "bg-[var(--ink)] text-[var(--tone-0)] font-bold shadow-sm scale-105"
                : "bg-[var(--tone-3)] text-[var(--ink)] hover:bg-[var(--tone-4)] border border-transparent"
            }`}
            title={isMuted ? "Desmutar microfone" : "Mutar microfone"}
          >
            <IconSwap active={isMuted} a={<Mic className="h-4 w-4" />} b={<MicOff className="h-4 w-4" />} />
          </button>

          {/* Deafen Sound */}
          <button
            type="button"
            onClick={onToggleDeafen}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-160 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] ${
              isDeafened
                ? "bg-[var(--ink)] text-[var(--tone-0)] font-bold shadow-sm scale-105"
                : "bg-[var(--tone-3)] text-[var(--ink)] hover:bg-[var(--tone-4)] border border-transparent"
            }`}
            title={isDeafened ? "Desmutar áudio" : "Silenciar áudio"}
          >
            <IconSwap active={isDeafened} a={<Volume2 className="h-4 w-4" />} b={<VolumeX className="h-4 w-4" />} />
          </button>

          {/* Share Screen */}
          <button
            type="button"
            onClick={onToggleScreenShare}
            className={`flex h-9 w-9 items-center justify-center rounded-lg transition-all duration-160 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] ${
              isSharingScreen
                ? "bg-[var(--ink)] text-[var(--tone-0)] shadow-md scale-105 hover:opacity-90"
                : "bg-[var(--tone-3)] text-[var(--ink)] hover:bg-[var(--tone-4)] border border-transparent"
            }`}
            title={isSharingScreen ? "Parar compartilhamento" : "Compartilhar tela"}
          >
            <IconSwap active={isSharingScreen} a={<MonitorUp className="h-4 w-4" />} b={<MonitorOff className="h-4 w-4" />} />
          </button>

          {/* Expand Window */}
          <button
            type="button"
            onClick={onOpenWindow}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[var(--tone-3)] text-[var(--ink)] hover:bg-[var(--tone-4)] border border-transparent transition-all duration-160 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)]"
            title="Expandir chamada"
          >
            <Maximize2 className="h-4 w-4" />
          </button>

          {/* Sair da chamada */}
          <button
            type="button"
            onClick={onHangUp}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E02424] hover:bg-[#C81E1E] text-[var(--ink)] active:scale-95 transition-all duration-160 shadow-sm cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)]"
            title="Sair da chamada"
            aria-label="Sair da chamada"
          >
            <PhoneOff className="h-4 w-4" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

