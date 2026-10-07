import React from "react";
import { Mic, MicOff, PhoneOff, Volume2, VolumeX } from "lucide-react";
import { NotchIconButton, formatSeconds } from "../../components/notch/DesktopNotch";

export interface CallPillProps {
  friendName?: string;
  durationSeconds: number;
  muted: boolean;
  deafened: boolean;
  onMute: () => void;
  onDeafen: () => void;
  onHangUp: () => void;
}

/**
 * Controles mínimos de chamada para quando o notch está DESATIVADO nas
 * configurações: mutar, silenciar e desligar continuam ao alcance durante o jogo.
 * Mesma linguagem do notch (preto #050506, pílulas, sem borda).
 */
export const CallPill: React.FC<CallPillProps> = ({
  friendName,
  durationSeconds,
  muted,
  deafened,
  onMute,
  onDeafen,
  onHangUp,
}) => (
  <div
    data-overlay-interactive="true"
    className="fixed left-1/2 top-3 z-[10030] flex -translate-x-1/2 items-center gap-2 rounded-full bg-[#050506] py-1.5 pl-4 pr-1.5 text-white shadow-[0_10px_28px_rgba(0,0,0,0.4)] pointer-events-auto select-none"
  >
    <span className="relative flex h-1.5 w-1.5 shrink-0">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-400" />
    </span>
    <span className="max-w-[110px] truncate text-[11px] font-semibold text-white/90">{friendName || "Voz"}</span>
    <span className="px-1 font-mono text-[12px] font-semibold tabular-nums">{formatSeconds(durationSeconds)}</span>
    <NotchIconButton onClick={onMute} active={muted} title={muted ? "Desmutar microfone" : "Mutar microfone"}>
      {muted ? <MicOff size={15} /> : <Mic size={15} />}
    </NotchIconButton>
    <NotchIconButton
      onClick={onDeafen}
      active={deafened}
      tone="warn"
      title={deafened ? "Reativar áudio" : "Silenciar áudio"}
    >
      {deafened ? <VolumeX size={15} /> : <Volume2 size={15} />}
    </NotchIconButton>
    <NotchIconButton onClick={onHangUp} tone="danger" title="Desconectar">
      <PhoneOff size={15} />
    </NotchIconButton>
  </div>
);
