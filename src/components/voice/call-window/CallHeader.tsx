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
  PictureInPicture2,
  MessageSquare,
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
  isCompactMode?: boolean;
  onToggleFullscreen: () => void;
  onToggleCompactMode?: () => void;
  onClose: () => void;
  onOpenInvite?: () => void;
  onOpenPrivacy?: () => void;
  onOpenAppearance?: () => void;
  canEditRoom?: boolean;
  roomConfig?: CallRoomConfig | null;
  isDevMode?: boolean;
  onAddDevMockParticipant?: () => void;
  onRemoveDevMockParticipant?: () => void;
  roomChatOpen?: boolean;
  onToggleRoomChat?: () => void;
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
  isCompactMode = false,
  onToggleFullscreen,
  onToggleCompactMode,
  onClose,
  onOpenInvite,
  onOpenPrivacy,
  onOpenAppearance,
  canEditRoom = false,
  roomConfig,
  isDevMode = false,
  onAddDevMockParticipant,
  onRemoveDevMockParticipant,
  roomChatOpen = false,
  onToggleRoomChat,
}) => {
  const isRoomSession = Boolean(
    session.roomName || (session.participants && session.participants.length > 0)
  );

  const title = isRoomSession
    ? session.roomName || "Canal de Voz"
    : session.friendName || "Chamada Direta";

  return (
    <header className="h-16 w-full flex items-center justify-between px-8 bg-transparent backdrop-blur-xl z-20 select-none shrink-0">
      {/* Left: Call Title, Duration and Connection Status */}
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex flex-col min-w-0">
          <div className="flex items-center gap-2.5">
            <h1 className="text-[length:var(--step-1)] font-semibold text-[var(--ink)] tracking-tight truncate max-w-[240px] sm:max-w-md">
              {title}
            </h1>

            {/* Connection / Status Badge */}
            {isReconnecting ? (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-[var(--corner-sm)] bg-[var(--tone-3)] border border-transparent text-[length:var(--step-0)] font-medium text-[var(--ink)] animate-pulse">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--tone-3)]" />
                Reconectando…
              </span>
            ) : callState === "ringing-out" ? (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-[var(--corner-sm)] bg-[var(--tone-3)] border border-transparent text-[length:var(--step-0)] font-medium text-[var(--ink)]">
                <Phone className="h-3 w-3 animate-bounce" aria-hidden="true" />
                Chamando…
              </span>
            ) : callState === "connecting" ? (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-[var(--corner-sm)] bg-[var(--tone-3)] border border-transparent text-[length:var(--step-0)] font-medium text-[var(--ink)]">
                <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                Conectando…
              </span>
            ) : (
              <span className="inline-flex items-center gap-2 px-3 py-1 rounded-[var(--corner-sm)] bg-[var(--tone-3)] text-[length:var(--step-0)] font-mono tabular-nums font-medium text-[var(--ink)]">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--live)]" />
                {formatDuration(duration)}
              </span>
            )}

            {/* Contador de Participantes */}
            <span className="hidden sm:inline text-xs text-[var(--ink-muted)] font-medium tabular-nums">
              • {participantsCount} {participantsCount === 1 ? "pessoa" : "pessoas"}
            </span>

            {/* Injetor Dev (Ativo no modo dev / teste, máx 10) */}
            {isDevMode && onAddDevMockParticipant && (
              <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-[var(--tone-3)] border border-transparent text-[length:var(--step-0)] text-[var(--ink)] font-mono ml-1">
                <span className="font-bold text-[length:var(--step-0)] bg-[var(--tone-3)] px-1 rounded">DEV</span>
                <button
                  type="button"
                  onClick={onAddDevMockParticipant}
                  disabled={participantsCount >= 10}
                  className="px-2 py-0.5 rounded-[8px] bg-[var(--tone-3)] hover:bg-[var(--tone-3)] text-[var(--ink)] text-[length:var(--step-0)] font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--tone-4)]"
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
                    className="px-1.5 py-0.5 rounded-[8px] bg-[var(--tone-3)] hover:bg-[var(--tone-4)] text-[var(--ink)] text-[length:var(--step-0)] font-semibold transition cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed active:scale-95 outline-none focus-visible:ring-1 focus-visible:ring-[color:var(--ink)]"
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
      <div className="flex items-center gap-2 sm:gap-2.5">
        {/* Privacidade da Sala (se canal/sala) */}
        {isRoomSession && onOpenPrivacy && (
          <button
            type="button"
            onClick={onOpenPrivacy}
            style={{ cornerShape: "squircle" } as React.CSSProperties}
            className={`hidden md:inline-flex items-center gap-2 h-10 text-[length:var(--step-0)] font-medium px-3.5 rounded-[var(--corner-sm)] border transition cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] ${
              session.isPrivate || roomConfig?.isPrivate
                ? "bg-[var(--tone-3)] border-transparent text-[var(--ink)] hover:bg-[var(--tone-3)]"
                : "bg-[var(--tone-3)] border-transparent text-[var(--ink-muted)] hover:bg-[var(--tone-4)] hover:text-[var(--ink)]"
            }`}
            title="Configurar privacidade e senha da sala"
            aria-label="Configurar privacidade da sala"
          >
            {session.isPrivate || roomConfig?.isPrivate ? (
              <>
                <Lock className="h-3 w-3 text-[var(--ink)]" aria-hidden="true" />
                <span>Privada</span>
              </>
            ) : (
              <>
                <Unlock className="h-3 w-3 text-[var(--ink-muted)]" aria-hidden="true" />
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
            className="hidden lg:inline-flex items-center gap-1.5 text-[length:var(--step-0)] font-medium px-2.5 py-1 rounded-[var(--corner-sm)] bg-[var(--tone-3)] hover:bg-[var(--tone-4)] border border-transparent text-[var(--ink)] hover:text-[var(--ink)] transition cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)]"
            title="Editar aparência da sala"
            aria-label="Editar aparência da sala"
          >
            <Palette className="h-3 w-3 text-[var(--ink-muted)]" aria-hidden="true" />
            <span>Editar</span>
          </button>
        )}

        {/* Botão Convidar */}
        {isRoomSession && onToggleRoomChat && (
          <button
            type="button"
            onClick={onToggleRoomChat}
            className={`h-10 w-10 flex items-center justify-center rounded-[var(--corner-sm)] transition cursor-pointer ${
              roomChatOpen ? "bg-[var(--ink)] text-[var(--tone-0)]" : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--tone-4)]"
            }`}
            title="Texto da sala"
            aria-label="Texto da sala"
          >
            <MessageSquare className="h-4 w-4" />
          </button>
        )}

        {onOpenInvite && (
          <button
            type="button"
            onClick={onOpenInvite}
            style={{ cornerShape: "squircle" } as React.CSSProperties}
            className="inline-flex items-center gap-1.5 h-8 px-3.5 rounded-[var(--corner-sm)] bg-[var(--tone-3)] hover:bg-[var(--tone-4)] text-[length:var(--step-0)] font-semibold text-[var(--ink)] transition active:scale-95 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)]"
            title="Convidar amigos para a chamada"
            aria-label="Convidar amigos para a chamada"
          >
            <UserPlus className="h-3.5 w-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Convidar</span>
          </button>
        )}

        {/* Modo Compacto (ideal para multitarefas e jogos) */}
        {onToggleCompactMode && (
          <button
            type="button"
            onClick={onToggleCompactMode}
            style={{ cornerShape: "squircle" } as React.CSSProperties}
            className={`h-10 w-10 flex items-center justify-center rounded-[var(--corner-sm)] transition cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] ${
              isCompactMode
                ? "bg-[var(--ink)] text-[var(--tone-0)] font-semibold shadow-sm"
                : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--tone-4)]"
            }`}
            title={isCompactMode ? "Restaurar tamanho padrão" : "Modo compacto (útil ao jogar)"}
            aria-label={isCompactMode ? "Restaurar tamanho padrão" : "Ativar modo compacto"}
          >
            <PictureInPicture2 className="h-4 w-4" aria-hidden="true" />
          </button>
        )}

        {/* Fullscreen da Janela */}
        <button
          type="button"
          onClick={onToggleFullscreen}
          style={{ cornerShape: "squircle" } as React.CSSProperties}
          className="h-10 w-10 flex items-center justify-center rounded-[var(--corner-sm)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--tone-4)] transition cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)]"
          title={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
          aria-label={isFullscreen ? "Sair da tela cheia" : "Tela cheia"}
        >
          {isFullscreen ? (
            <Minimize2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Maximize className="h-4 w-4" aria-hidden="true" />
          )}
        </button>

        {/* Ocultar / Minimizar Janela (Mantém chamada ativa no hub) */}
        <button
          type="button"
          onClick={onClose}
          style={{ cornerShape: "squircle" } as React.CSSProperties}
          className="h-10 w-10 flex items-center justify-center rounded-[var(--corner-sm)] text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--tone-4)] transition cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)]"
          title="Ocultar janela (a chamada continuará ativa no hub)"
          aria-label="Ocultar janela de chamada"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </header>
  );
};
