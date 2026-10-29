import React from "react";
import { Trophy, Users } from "../../../design-system/sf-symbols/lucideCompat";
import type { NotchGameTabData } from "../gameTabData";

const SURFACE = "overflow-hidden rounded-[24px] bg-[#171717] p-3.5 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]";

const clock = (seconds: number) => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
};

/**
 * Aba "Jogo": a sessão em andamento (arte, título e relógio), o progresso de conquistas com as
 * últimas desbloqueadas e quem está jogando entre os amigos.
 */
export const GameTab: React.FC<{ data: NotchGameTabData; elapsedSeconds: number }> = ({ data, elapsedSeconds }) => (
  <div className="flex flex-col gap-3.5">
    <div className="grid grid-cols-2 items-stretch gap-3.5">
      <section className={`${SURFACE} flex flex-col`} aria-label="Sessão atual">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">Jogando agora</p>
        <div className="mt-2 flex items-center gap-3">
          {data.art ? (
            <img src={data.art} alt="" draggable={false} className="h-14 w-14 shrink-0 rounded-2xl object-cover" />
          ) : (
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-white/[0.07] text-white/60">
              <Trophy size={22} />
            </span>
          )}
          <p className="line-clamp-2 min-w-0 text-[14px] font-semibold leading-tight text-white">{data.title}</p>
        </div>
        <p className="mt-auto pt-3 font-mono text-[30px] font-light leading-none tabular-nums text-white" aria-label="Tempo de sessão">
          {clock(elapsedSeconds)}
        </p>
      </section>

      <section className={`${SURFACE} flex flex-col`} aria-label="Conquistas do jogo">
        <div className="flex items-baseline justify-between">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">Conquistas</p>
          <p className="text-[12px] font-semibold tabular-nums text-white/80">
            {data.total > 0 ? `${data.unlocked}/${data.total}` : "—"}
          </p>
        </div>
        <div className="mt-2.5 h-[5px] w-full overflow-hidden rounded-full bg-white/[0.12]" aria-hidden>
          <span className="block h-full rounded-full bg-white transition-[width] duration-500" style={{ width: `${data.percent}%` }} />
        </div>
        <p className="mt-1.5 text-[11px] tabular-nums text-white/45">{data.total > 0 ? `${data.percent}% completo` : "Sem conquistas registradas"}</p>
        <div className="mt-auto flex items-center gap-2 pt-3">
          {data.recent.length === 0 ? (
            <p className="text-[12px] text-white/35">Nenhuma desbloqueada ainda</p>
          ) : (
            data.recent.map((a, i) => (
              <span
                key={`${a.name}-${i}`}
                title={a.name}
                className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white/[0.08]"
              >
                {a.icon ? <img src={a.icon} alt={a.name} draggable={false} className="h-full w-full object-cover" /> : <Trophy size={15} className="text-white/60" />}
              </span>
            ))
          )}
        </div>
      </section>
    </div>

    <section className={SURFACE} aria-label="Amigos jogando">
      <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/40">Amigos jogando</p>
      {data.friendsPlaying.length === 0 ? (
        <p className="mt-2 text-[12px] text-white/35">Ninguém jogando agora.</p>
      ) : (
        <ul className="mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2.5">
          {data.friendsPlaying.map((f) => (
            <li key={f.id} className="flex min-w-0 items-center gap-2.5">
              <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.09] text-white/60">
                {f.avatar ? <img src={f.avatar} alt="" draggable={false} className="h-full w-full object-cover" /> : <Users size={14} />}
              </span>
              <span className="min-w-0 leading-tight">
                <span className="block truncate text-[12.5px] font-semibold text-white">{f.name}</span>
                <span className="block truncate text-[11px] text-white/50">{f.game ?? "Jogando"}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  </div>
);
