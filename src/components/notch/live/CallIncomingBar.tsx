import React from "react";
import { Phone, PhoneOff } from "../../../design-system/sf-symbols/lucideCompat";

/**
 * Chamada recebida na ilha: avatar, quem está ligando e os dois botões (recusar vermelho, atender
 * verde), como a referência da Apple.
 */
export const CallIncomingBar: React.FC<{
  name: string;
  avatar: React.ReactNode;
  /** a Pherie reagindo (animada) à esquerda */
  mascot?: React.ReactNode;
  onAccept: () => void;
  onReject: () => void;
}> = ({ name, avatar, mascot, onAccept, onReject }) => (
  <div className="flex w-full items-center gap-2.5" role="alertdialog" aria-label={`${name} está te ligando`}>
    {mascot ? <div className="shrink-0">{mascot}</div> : null}
    {avatar}
    <div className="min-w-0 flex-1 leading-tight">
      <p className="text-[10.5px] font-medium text-white/50">Chamada de voz</p>
      <p className="truncate text-[14px] font-semibold text-white">{name}</p>
    </div>
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onReject();
      }}
      title="Recusar"
      aria-label="Recusar"
      className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f4505e] text-white transition-all hover:brightness-110 active:scale-90"
    >
      <PhoneOff size={18} />
    </button>
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onAccept();
      }}
      title="Atender"
      aria-label="Atender"
      className="flex h-10 w-10 items-center justify-center rounded-full bg-[#30d158] text-white transition-all hover:brightness-110 active:scale-90"
    >
      <Phone size={18} />
    </button>
  </div>
);
