import React from "react";
import {
  UserPlus,
  Maximize,
  Minimize2,
  X,
  Lock,
  Unlock,
  Palette,
  Loader2,
  Phone,
} from "lucide-react";
import type { VoiceCallSession, CallState } from "../../../types/domain";
import type { CallRoomConfig } from "../../../types/voice-governance";

interface CallHeaderProps {
  session: VoiceCallSession;
  callState?: CallState;
  duration: number;
  participantsCount: number;
  isReconnecting?: boolean;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
  onClose: () => void;
  onOpenInvite?: () => void;
  onOpenPrivacy?: () => void;
  onOpenAppearance?: () => void;
  canEditRoom?: boolean;
  roomConfig?: CallRoomConfig | null;
  isDevMode?: boolean;
  onAddDevMockParticipant?: () => void;
  onRemoveDevMockParticipant?: () => void;
}

const formatDuration = (secs: number) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
};

export const CallHeader: React.FC<CallHeaderProps> = ({
  session,
  callState,
  duration,
  participantsCount,
  isReconnecting = false,
  isFullscreen,
  onToggleFullscreen,
  onClose,
  onOpenInvite,
  onOpenPrivacy,
  onOpenAppearance,
  canEditRoom = false,
  roomConfig,
  isDevMode = false,
  onAddDevMockParticipant,
  onRemoveDevMockParticipant,
}) => {
  const isRoomSession = Boolean(
    session.roomName || (session.participants && session.participants.length > 0)
  );

  const title = isRoomSession
    ? session.roomName || "Canal de Voz"
    : session.friendName || "Chamada Direta";

  return (
    <header className="h-14 w-full flex items-center justify-between px-6 border-b border-[#161616] bg-[#0F0F0F]/80 backdrop-blur-md z-20 select-none shrink-0">
      {/* Left: Call Title, Duration and Connection Status */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-sm font-semibold text-white tracking-tight truncate max-w-[240px] sm:max-w-md">
              {title}
            </h1>

            {/* Connection / Status Badge */}
            {isReconnecting ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-[10px] font-medium text-amber-300 animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-400" />
                Reconectando…
              </span>
            ) : callState === "ringing-out" ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/25 text-[10px] font-medium text-amber-300">
                <Phone className="h-3 w-3 animate-bounce" aria-hidden="true" />
                Chamando…
              </span>
            ) : callState === "connecting" ? (
              <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/25 text-[10px] font-medium text-sky-300">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                Conectando…
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-white/[0.06] border border-[#161616] text-[10px] font-mono tabular-nums font-medium text-white/90">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {formatDuration(duration)}
              </span>
            )}

            {/* Contador de Participantes */}
            <span className="hidden sm:inline text-xs text-white/60 font-medium tabular-nums">
              • {participantsCount} {participantsCount === 1 ? "pessoa" : "pessoas"}
            </span>

            {/* Injetor Dev (Ativo no modo dev / teste, máx 10) */}
            {isDevMode && onAddDevMockParticipant && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/25 text-[11px] text-amber-300 font-mono ml-1">
                <span className="font-bold text-[10px] bg-amber-400/20 px-1 rounded">DEV</span>
                <button
                  type="button"
                  onClick={onAddDevMockParticipant}
                  disabled={participantsCount >= 10}
                  className="px-2 py-0.5 rounded-[8px] bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 text-[10px] font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 outline-none focus-visible:ring-1 focus-visible:ring-amber-400"
                  title="Adicionar participante de teste (Limite: 10)"
                  aria-label={`Adicionar participante de teste (${participantsCount} de 10)`}
                >
                  + Pessoa ({participantsCount}/10)
                </button>
                {onRemoveDevMockParticipant && (
                  <button
                    type="button"
                    onClick={onRemoveDevMockParticipant}
                    disabled={participantsCount <= 1}
                    className="px-1.5 py-0.5 rounded-[8px] bg-white/10 hover:bg-white/20 text-white/80 text-[10px] font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                    title="Remover participante de teste"
                    aria-label="Remover participante de teste"
                  >
                    -
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right: Actions (Convidar, Privacidade, Fullscreen, Fechar) */}
      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Privacidade da Sala (se canal/sala) */}
        {isRoomSession && onOpenPrivacy && (
          <button
            type="button"
            onClick={onOpenPrivacy}
            style={{ cornerShape: "squircle" } as React.CSSProperties}
            className={`hidden md:inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-[10px] border transition cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              session.isPrivate || roomConfig?.isPrivate
                ? "bg-amber-500/10 border-amber-500/25 text-amber-300 hover:bg-amber-500/20"
                : "bg-white/[0.04] border-[#161616] text-white/70 hover:bg-white/[0.08] hover:text-white"
            }`}
            title="Configurar privacidade e senha da sala"
            aria-label="Configurar privacidade da sala"
          >
            {session.isPrivate || roomConfig?.isPrivate ? (
              <>
                <Lock className="h-3 w-3 text-amber-400" aria-hidden="true" />
                <span>Privada</span>
              </>
            ) : (
              <>
                <Unlock className="h-3 w-3 text-white/60" aria-hidden="true" />
                <span>Pública</span>
              </>
            )}
          </button>
        )}

        {/* Editar Canal (se admin) */}
        {isRoomSession && canEditRoom && onOpenAppearance && (
          <button
            type="button"
            onClick={onOpenAppearance}
            style={{ cornerShape: "squircle" } as React.CSSProperties}
            className="hidden lg:inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-[10px] bg-white/[0.04] hover:bg-white/[0.08] border border-[#161616] text-white/80 hover:text-white transition cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            title="Editar aparência da sala"
            aria-label="Editar aparência da sala"
          >
            <Palette className="h-3 w-3 text-white/70" aria-hidden="true" />
            <span>Editar</span>
          </button>
        )}

        {/* Botão Convidar */}
        {onOpenInvite && (
          <button
            type="button"
            onClick={onOpenInvite}
            style={{ cornerShape: "squircle" } as React.CSSProperties}
            className="inline-flex items-center gap-1.5 h-8 px-3 rounded-[12px] bg-white/[0.06] hover:bg-white/[0.12] border border-[#161616] text-xs font-semibold text-white transition active:scale-96 cursor-pointer shadow-sm outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            title="Convidar amigos para a chamada"
            aria-label="Convidar amigos para a chamada"
          >
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Convidar</span>
          </button>
        )}

        {/* Fullscreen da Janela */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          style={{ cornerShape: "squircle" } as React.CSSProperties}
          className="h-8 w-8 flex items-center justify-center rounded-[10px] text-white/60 hover:text-white hover:bg-white/[0.08] transition cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Maximize className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {/* Minimizar / Fechar Janela */}
        <button
          type="button"
          onClick={onClose}
          style={{ cornerShape: "squircle" } as React.CSSProperties}
          className="h-8 w-8 flex items-center justify-center rounded-[10px] text-white/60 hover:text-white hover:bg-white/[0.08] transition cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          title="Fechar janela (a chamada continua na barra inferior)"
          aria-label="Fechar janela de chamada"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
};
