import React from "react";
import { UserPlus, User } from "lucide-react";
import type { CheckpointFriendRequest } from "../../types/domain";
import type { SoundEffectType } from "../../hooks/useSoundEffects";

export interface RequestsPanelProps {
  requests: CheckpointFriendRequest[];
  onAccept: (uid: string) => void;
  onReject: (uid: string) => void;
  onAddFriend: () => void;
  playSound?: (t: SoundEffectType) => void;
}

/** Convites de amizade: um por linha, com a decisão (aceitar/recusar) ao lado de quem enviou. */
export const RequestsPanel: React.FC<RequestsPanelProps> = ({ requests, onAccept, onReject, onAddFriend, playSound }) => {
  if (requests.length === 0) {
    return (
      <div className="mx-auto max-w-xl rounded-[22px] bg-[#121216] p-10 text-center ring-1 ring-white/[0.07]">
        <UserPlus className="mx-auto h-8 w-8 text-white/30" />
        <h2 className="mt-4 font-display text-[20px] font-bold text-white">Nenhum convite pendente</h2>
        <p className="mt-1 text-[14px] text-white/55">Quando alguém pedir para ser seu amigo, o convite aparece aqui.</p>
        <button
          type="button"
          onClick={onAddFriend}
          className="mt-5 h-11 rounded-full bg-white px-6 text-[13px] font-semibold text-black active:scale-95"
        >
          Adicionar amigo
        </button>
      </div>
    );
  }

  return (
    <section aria-label="Convites de amizade" className="mx-auto max-w-3xl rounded-[22px] bg-[#121216] p-4 ring-1 ring-white/[0.07]">
      <header className="mb-3 px-1">
        <h2 className="font-display text-[22px] font-bold leading-tight text-white">Convites de amizade</h2>
        <p className="text-[13px] text-white/50">
          {requests.length === 1 ? "1 pessoa quer ser sua amiga" : `${requests.length} pessoas querem ser suas amigas`}
        </p>
      </header>
      <ul className="flex flex-col gap-1">
        {requests.map((r) => (
          <li key={r.uid} className="flex items-center gap-3.5 rounded-2xl bg-[#0d0d10] px-3.5 py-3">
            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-[28%] bg-white/[0.06]">
              {r.photoURL ? (
                <img src={r.photoURL} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-white/45">
                  <User className="h-5 w-5" />
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[15px] font-semibold text-white">{r.displayName || "Jogador"}</span>
              <span className="text-[12.5px] text-white/50">Quer ser seu amigo</span>
            </span>
            <button
              type="button"
              onClick={() => {
                playSound?.("back");
                onReject(r.uid);
              }}
              className="h-10 rounded-full bg-white/[0.08] px-4 text-[13px] font-semibold text-white/75 hover:bg-white/[0.14] hover:text-white focus-visible:ring-2 focus-visible:ring-white/40"
            >
              Recusar
            </button>
            <button
              type="button"
              onClick={() => {
                playSound?.("select");
                onAccept(r.uid);
              }}
              className="h-10 rounded-full bg-white px-5 text-[13px] font-semibold text-black active:scale-95 focus-visible:ring-2 focus-visible:ring-white/60"
            >
              Aceitar
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};

export default RequestsPanel;
