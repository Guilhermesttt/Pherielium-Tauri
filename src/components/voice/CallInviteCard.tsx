import React, { useState } from "react";
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

interface CallInviteCardProps {
  invite: CallInviteMeta;
  isSelf: boolean;
  onJoinCall: (invite: CallInviteMeta, password?: string) => void;
}

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
  onJoinCall,
}) => {
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [enteredPassword, setEnteredPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const categoryInfo =
    categoryIcons[invite.category] || categoryIcons.resenha_games;

  const handleJoinClick = () => {
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
      <div className="relative overflow-hidden rounded-2xl border border-white/15 bg-gradient-to-b from-[#1c1d28]/95 via-[#13141c]/95 to-[#0b0c10] p-4 shadow-xl select-none max-w-sm w-full space-y-3.5">
        {/* Top Header Badge */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/10 border border-white/15 text-[10px] font-black uppercase text-white tracking-wider">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Canal de Voz</span>
          </div>

          {invite.isPrivate && (
            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/15 border border-amber-500/30 text-[10px] font-bold text-amber-300">
              <Lock className="h-3 w-3" />
              <span>Privada</span>
            </div>
          )}
        </div>

        {/* Room Info */}
        <div className="space-y-1">
          <h4 className="text-base font-black text-white tracking-tight flex items-center gap-2">
            <Radio className="h-4 w-4 text-white/80 shrink-0" />
            <span className="truncate">{invite.roomName}</span>
          </h4>

          {/* Category badge */}
          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg bg-white/5 border border-white/8 text-[11px] font-bold text-white/70">
            {categoryInfo.icon}
            <span>{categoryInfo.label}</span>
          </div>
        </div>

        {/* Caller Info */}
        <div className="flex items-center gap-2.5 pt-1 border-t border-white/6 text-xs text-white/60">
          <div className="h-6 w-6 rounded-full overflow-hidden border border-white/10 bg-white/10 shrink-0">
            {invite.callerAvatar ? (
              <img
                src={invite.callerAvatar}
                alt={invite.callerName}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-[9px] font-bold text-white">
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
          className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-white text-black font-black text-xs hover:bg-white/90 shadow-[0_4px_20px_rgba(255,255,255,0.15)] hover:scale-[1.02] active:scale-[0.98] transition cursor-pointer"
        >
          <PhoneCall className="h-4 w-4" />
          <span>Entrar na Chamada</span>
        </button>
      </div>

      {/* Password Modal (when room is private) */}
      {isPasswordModalOpen && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
          <div className="relative w-full max-w-xs rounded-2xl bg-[#161722] border border-white/15 p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-white font-bold text-sm">
                <KeyRound className="h-4 w-4 text-amber-400" />
                <span>Senha da Sala</span>
              </div>
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="text-white/40 hover:text-white"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-xs text-white/60">
              Esta chamada é privada. Digite a senha para entrar:
            </p>

            <input
              type="password"
              placeholder="Digite a senha..."
              value={enteredPassword}
              onChange={(e) => {
                setEnteredPassword(e.target.value);
                setPasswordError(null);
              }}
              autoFocus
              className="w-full h-10 px-3 rounded-xl bg-white/5 border border-white/10 text-xs font-semibold text-white placeholder-white/30 focus:outline-none focus:border-white/30"
              onKeyDown={(e) => {
                if (e.key === "Enter") handleConfirmPassword();
              }}
            />

            {passwordError && (
              <p className="text-[11px] text-rose-400 font-medium">{passwordError}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsPasswordModalOpen(false)}
                className="flex-1 py-2 rounded-xl bg-white/10 text-white font-bold text-xs hover:bg-white/15 transition cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmPassword}
                className="flex-1 py-2 rounded-xl bg-white text-black font-black text-xs hover:bg-white/90 transition cursor-pointer"
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
