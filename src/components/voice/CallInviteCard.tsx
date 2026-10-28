import React, { useEffect, useState } from "react";
import {
  Radio,
  PhoneCall,
  Lock,
  Gamepad2,
  Swords,
  BookOpen,
  MessageSquare,
  KeyRound,
  X,
  Check,
} from "lucide-react";
import type { RoomCategory, CallInviteMeta } from "../../types/voice-governance";
import { useVoiceCallContext } from "../../context/VoiceCallContext";
import {
  INVITE_CARD_TOLERANCE_MS,
  INVITE_TTL_MS,
  inviteRemainingMs,
  inviteState,
  isInviteCancelled,
  isInviteNotificationsOn,
  type InviteStatus,
} from "../../services/voiceCall/inviteState";

interface CallInviteCardProps {
  invite: CallInviteMeta;
  isSelf: boolean;
  /** `created_at` da mensagem (relógio do servidor). Preferido ao `createdAt` do JSON, que vem do relógio de quem convidou. */
  serverCreatedAt?: string;
  onJoinCall: (invite: CallInviteMeta, password?: string) => void;
}

/** Cartões do chat: 15 min + tolerância de 2 min para diferença de relógios (inviteState.ts). */
const CARD_TTL_MS = INVITE_TTL_MS + INVITE_CARD_TOLERANCE_MS;

export const parseCallInviteText = (text: string): CallInviteMeta | null => {
  if (!text || typeof text !== "string" || !text.startsWith('{"__type":"call_invite"')) {
    return null;
  }
  try {
    const data = JSON.parse(text);
    if (data.__type === "call_invite" && data.chatId) {
      return {
        chatId: data.chatId,
        roomName: data.roomName || "Canal de Voz",
        category: data.category || "resenha_games",
        callerName: data.callerName || "Jogador",
        callerAvatar: data.callerAvatar || null,
        callerId: typeof data.callerId === "string" ? data.callerId : undefined,
        isPrivate: Boolean(data.isPrivate),
        createdAt: data.createdAt || Date.now(),
      };
    }
  } catch {
    // Not valid JSON
  }
  return null;
};

const categoryIcons: Record<RoomCategory, { label: string; icon: React.ReactNode }> = {
  resenha_games: { label: "Resenha & Games", icon: <Gamepad2 className="h-3 w-3" /> },
  gameplay_foco: { label: "Só Gameplay", icon: <Swords className="h-3 w-3" /> },
  estudos_foco: { label: "Foco & Estudos", icon: <BookOpen className="h-3 w-3" /> },
  casual_chat: { label: "Conversa Livre", icon: <MessageSquare className="h-3 w-3" /> },
};

export const CallInviteCard: React.FC<CallInviteCardProps> = ({
  invite,
  isSelf,
  serverCreatedAt,
  onJoinCall,
}) => {
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const categoryInfo =
    categoryIcons[invite.category] || categoryIcons.resenha_games;

  // I0 (flag): estado local do convite, não autoritativo. Com a flag desligada o cartão é sempre "pendente", como antes.
  const { inviteStore } = useVoiceCallContext();
  const trackStatus = isInviteNotificationsOn();
  const serverMs = serverCreatedAt ? Date.parse(serverCreatedAt) : Number.NaN;
  const createdAtMs = Number.isFinite(serverMs) ? serverMs : invite.createdAt;
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [showInvalidNotice, setShowInvalidNotice] = useState(false);
  useEffect(() => {
    if (!trackStatus) return;
    const remaining = inviteRemainingMs({ createdAtMs, nowMs: Date.now(), ttlMs: CARD_TTL_MS });
    if (remaining <= 0) return;
    const timer = window.setTimeout(() => setNowMs(Date.now()), remaining + 50);
    return () => window.clearTimeout(timer);
  }, [trackStatus, createdAtMs]);
  const status: InviteStatus = trackStatus
    ? inviteState({
        createdAtMs,
        nowMs,
        ttlMs: CARD_TTL_MS,
        cancelled: isInviteCancelled(inviteStore, invite.chatId, createdAtMs),
      })
    : "pending";

  const handleJoinClick = () => {
    if (status !== "pending") {
      setShowInvalidNotice(true);
      return;
    }
    if (invite.isPrivate) {
      setIsPasswordModalOpen(true);
      return;
    }
    onJoinCall(invite);
  };

  const handleConfirmPassword = () => {
    if (!enteredPassword.trim()) {
      setPasswordError("Digite a senha da sala para entrar.");
      return;
    }
    setIsPasswordModalOpen(false);
    onJoinCall(invite, enteredPassword.trim());
  };

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl border border-transparent bg-gradient-to-b from-[#1c1d28]/95 via-[#13141c]/95 to-[#0b0c10] p-4 shadow-xl select-none max-w-sm w-full space-y-3.5">
        {/* Top Header Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[var(--tone-3)] border border-transparent text-[length:var(--step-0)] font-black uppercase text-[var(--ink)] tracking-wider">
            <span className="h-2 w-2 rounded-full bg-[var(--live)] animate-pulse" />
            <span>Canal de Voz</span>
          </div>

          {invite.isPrivate && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-[var(--tone-3)] border border-transparent text-[length:var(--step-0)] font-bold text-[var(--ink)]">
              <Lock className="h-3 w-3" />
              <span>Privada</span>
            </div>
          )}
        </div>

        {/* Room Info */}
        <div className="space-y-1">
          <h4 className="text-base font-black text-[var(--ink)] tracking-tight flex items-center gap-2">
            <Radio className="h-4 w-4 text-[var(--ink)] shrink-0" />
            <span className="truncate">{invite.roomName}</span>
          </h4>

          {/* Category badge */}
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-[var(--tone-3)] border border-transparent text-[length:var(--step-0)] font-bold text-[var(--ink-muted)]">
            {categoryInfo.icon}
            <span>{categoryInfo.label}</span>
          </div>
        </div>

        {/* Caller Info */}
        <div className="flex items-center gap-2.5 pt-1 border-t border-transparent text-xs text-[var(--ink-muted)]">
          <div className="h-6 w-6 rounded-full overflow-hidden border border-transparent bg-[var(--tone-3)] shrink-0">
            {invite.callerAvatar ? (
              <img
                src={invite.callerAvatar}
                alt={invite.callerName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[length:var(--step-0)] font-bold text-[var(--ink)]">
                {invite.callerName.slice(0, 2).toUpperCase()}
              </div>
            )}
          </div>
          <span className="truncate">
            {isSelf ? "Você enviou este convite" : `Convidado por ${invite.callerName}`}
          </span>
        </div>

        {/* Join Action Button */}
        <button
          type="button"
          onClick={handleJoinClick}
          className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-[var(--ink)] text-[var(--tone-0)] font-black text-xs hover:opacity-90 shadow-[0_4px_20px_rgba(255,255,255,0.15)] hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer${status === "pending" ? "" : " opacity-50"}`}
        >
          <PhoneCall className="h-4 w-4" />
          <span>
            {status === "expired" ? "Convite expirado" : status === "cancelled" ? "Convite cancelado" : "Entrar na Chamada"}
          </span>
        </button>
        {showInvalidNotice && status !== "pending" && (
          <p className="text-[length:var(--step-0)] text-[var(--danger)] font-medium">Convite inválido ou expirado.</p>
        )}
      </div>

      {/* Password Modal (when room is private) */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div className="relative w-full max-w-xs rounded-2xl bg-[var(--tone-2)] border border-transparent p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-[var(--ink)] font-bold text-sm">
                <KeyRound className="h-4 w-4 text-[var(--ink)]" />
                <span>Senha da Sala</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-[var(--ink-faint)] hover:text-[var(--ink)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-[var(--ink-muted)]">
              Esta chamada é privada. Digite a senha para entrar:
            </p>

            <input aria-label="Senha da sala"
              type="password"
              placeholder="Digite a senha..."
              value={enteredPassword}
              onChange={(e) => {
                setEnteredPassword(e.target.value);
                setPasswordError(null);
              }}
              autoFocus
              className="w-full h-10 px-3 rounded-xl bg-[var(--tone-3)] border border-transparent text-xs font-semibold text-[var(--ink)] placeholder-white/30 focus:outline-none focus:border-transparent"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmPassword();
              }}
            />

            {passwordError && (
              <p className="text-[length:var(--step-0)] text-[var(--danger)] font-medium">{passwordError}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="flex-1 py-2 rounded-xl bg-[var(--tone-3)] text-[var(--ink)] font-bold text-xs hover:bg-[var(--tone-4)] transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmPassword}
                className="flex-1 py-2 rounded-xl bg-[var(--ink)] text-[var(--tone-0)] font-black text-xs hover:opacity-90 transition cursor-pointer"
              >
                Entrar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
