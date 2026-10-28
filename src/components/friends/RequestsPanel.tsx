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

const TILE = "rounded-[var(--corner-md)]";

/** Convites de amizade: um por linha, com a decisão (aceitar/recusar) ao lado de quem enviou. */
export const RequestsPanel: React.FC<RequestsPanelProps> = ({ requests, onAccept, onReject, onAddFriend, playSound }) => {
  if (requests.length === 0) {
    return (
      <div className={`${TILE} mx-auto max-w-xl bg-[var(--tone-1)] p-10 text-center`}>
        <UserPlus className="mx-auto h-8 w-8 text-[var(--ink-faint)]" aria-hidden />
        <h2 className="mt-4 text-[length:var(--step-3)] font-semibold text-[var(--ink)]">Nenhum convite pendente</h2>
        <p className="mt-1 text-[length:var(--step-1)] text-[var(--ink-muted)]">Quando alguém pedir para ser seu amigo, o convite aparece aqui.</p>
        <button
          type="button"
          onClick={onAddFriend}
          className="mt-6 h-14 cursor-pointer rounded-[var(--corner-sm)] bg-[var(--ink)] px-8 text-[length:var(--fs-label)] font-bold uppercase tracking-[0.06em] text-[var(--tone-0)] transition active:scale-[0.97] hover:opacity-90"
        >
          Adicionar amigo
        </button>
      </div>
    );
  }

  return (
    <section aria-label="Convites de amizade" className="mx-auto max-w-3xl">
      <h2 className="mb-3 flex items-baseline gap-2.5 px-0.5 text-[length:var(--fs-label)] font-bold uppercase tracking-[0.08em] text-[var(--ink-muted)]">
        Convites de amizade
        <span className="font-metric text-[length:var(--step-0)] font-normal tracking-normal text-[var(--ink-faint)]">{requests.length}</span>
      </h2>
      <ul className="flex flex-col gap-3">
        {requests.map((r) => (
          <li key={r.uid} className={`${TILE} flex items-center gap-4 bg-[var(--tone-2)] px-5 py-4`}>
            <span className="h-12 w-12 shrink-0 overflow-hidden rounded-[28%] bg-[var(--tone-3)]">
              {r.photoURL ? (
                <img src={r.photoURL} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-[var(--ink-faint)]">
                  <User className="h-5 w-5" aria-hidden />
                </span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[length:var(--step-1)] font-semibold text-[var(--ink)]">{r.displayName || "Jogador"}</span>
              <span className="text-[length:var(--step-0)] text-[var(--ink-muted)]">Quer ser seu amigo</span>
            </span>
            <button
              type="button"
              onClick={() => {
                playSound?.("back");
                onReject(r.uid);
              }}
              className="h-12 cursor-pointer rounded-[var(--corner-sm)] bg-[var(--tone-3)] px-5 text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] transition-colors hover:bg-[var(--tone-4)] hover:text-[var(--ink)]"
            >
              Recusar
            </button>
            <button
              type="button"
              onClick={() => {
                playSound?.("select");
                onAccept(r.uid);
              }}
              className="h-12 cursor-pointer rounded-[var(--corner-sm)] bg-[var(--ink)] px-6 text-[length:var(--fs-label)] font-bold uppercase tracking-[0.06em] text-[var(--tone-0)] transition active:scale-[0.97] hover:opacity-90"
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
