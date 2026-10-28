import React, { useMemo, useState } from "react";
import { Gamepad2, MessageSquare, Phone, Search, User, Video } from "lucide-react";
import type { SocialFriend } from "../../types/domain";
import type { SoundEffectType } from "../../hooks/useSoundEffects";

const TILE = "rounded-[var(--corner-md)]";
const ONLINE = new Set(["online", "playing", "streaming", "in_call", "idle", "dnd"]);

export interface ChatsPanelProps {
  friends: SocialFriend[];
  unreadByFriend: Record<string, number>;
  onOpenChat: (f: SocialFriend) => void;
  onStartVoiceCall?: (f: SocialFriend, withVideo?: boolean) => void;
  onAddFriend: () => void;
  playSound?: (t: SoundEffectType) => void;
}

/**
 * Conversas: lista única, quem tem mensagem nova primeiro, depois quem está online.
 * A conversa abre no mesmo chat de sempre; ligar e vídeo ficam a um clique, na própria linha.
 */
export const ChatsPanel: React.FC<ChatsPanelProps> = ({
  friends,
  unreadByFriend,
  onOpenChat,
  onStartVoiceCall,
  onAddFriend,
  playSound,
}) => {
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const unread = (f: SocialFriend) => unreadByFriend[f.id.split(":")[1]] || 0;
    const q = query.trim().toLowerCase();
    return friends
      .filter((f) => !q || f.name.toLowerCase().includes(q))
      .sort((a, b) => {
        const du = unread(b) - unread(a);
        if (du) return du;
        const on = Number(ONLINE.has(b.status)) - Number(ONLINE.has(a.status));
        return on || a.name.localeCompare(b.name);
      });
  }, [friends, query, unreadByFriend]);

  const unread = (f: SocialFriend) => unreadByFriend[f.id.split(":")[1]] || 0;
  const totalUnread = friends.reduce((n, f) => n + unread(f), 0);

  if (friends.length === 0) {
    return (
      <div className={`${TILE} mx-auto max-w-xl bg-[var(--tone-1)] p-10 text-center`}>
        <MessageSquare className="mx-auto h-8 w-8 text-[var(--ink-faint)]" aria-hidden />
        <h2 className="mt-4 text-[length:var(--step-3)] font-semibold text-[var(--ink)]">Nenhuma conversa ainda</h2>
        <p className="mt-1 text-[length:var(--step-1)] text-[var(--ink-muted)]">Adicione um amigo para começar a conversar.</p>
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
    <section aria-label="Conversas" className="mx-auto max-w-3xl">
      <header className="mb-4 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[length:var(--fs-label)] font-bold uppercase tracking-[0.08em] text-[var(--ink-muted)]">Conversas</h2>
          <p className="mt-1 text-[length:var(--step-1)] font-semibold text-[var(--ink)]">
            {totalUnread > 0 ? (
              <>
                <span className="font-metric">{totalUnread}</span> {totalUnread === 1 ? "mensagem nova" : "mensagens novas"}
              </>
            ) : (
              "Tudo em dia"
            )}
          </p>
        </div>
        <div className="relative w-64">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-faint)]" />
          <input
            aria-label="Buscar conversa"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar conversa"
            className="h-12 w-full rounded-[var(--corner-sm)] bg-[var(--tone-2)] pl-11 pr-4 text-[length:var(--step-0)] text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-faint)] focus:bg-[var(--tone-3)]"
          />
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="px-3 py-10 text-center text-[length:var(--step-0)] text-[var(--ink-faint)]">Nenhuma conversa com esse nome.</p>
      ) : (
        <ul className="flex flex-col gap-3">
          {rows.map((f) => {
            const n = unread(f);
            const playing = f.status === "playing";
            return (
              <li key={f.id} className="group relative">
                <button
                  type="button"
                  data-friend-id={f.id}
                  onMouseEnter={() => playSound?.("hover")}
                  onClick={() => {
                    playSound?.("select");
                    onOpenChat(f);
                  }}
                  className={`${TILE} flex w-full cursor-pointer items-center gap-4 bg-[var(--tone-2)] px-4 py-3.5 pr-32 text-left transition-colors duration-[var(--dur-focus)] hover:bg-[var(--tone-3)] focus-visible:bg-[var(--tone-3)]`}
                >
                  <span className="relative h-11 w-11 shrink-0">
                    <span className={`block h-full w-full overflow-hidden rounded-[28%] bg-[var(--tone-3)] ${ONLINE.has(f.status) ? "" : "opacity-60"}`}>
                      {f.avatar ? (
                        <img src={f.avatar} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[var(--ink-faint)]">
                          <User className="h-5 w-5" />
                        </span>
                      )}
                    </span>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[var(--tone-1)] ${
                        playing ? "bg-[var(--live)]" : ONLINE.has(f.status) ? "bg-[var(--presence-online)]" : "bg-[var(--presence-offline)]"
                      }`}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[length:var(--step-1)] ${n > 0 ? "font-bold text-[var(--ink)]" : "font-semibold text-[var(--ink)]"}`}>
                      {f.name}
                    </span>
                    <span className={`flex items-center gap-1 truncate text-[length:var(--step-0)] ${playing ? "text-[var(--live)]" : "text-[var(--ink-muted)]"}`}>
                      {playing && <Gamepad2 className="h-3 w-3 shrink-0" />}
                      <span className="truncate">
                        {n > 0
                          ? `${n} ${n === 1 ? "mensagem nova" : "mensagens novas"}`
                          : playing
                            ? `Jogando ${f.playing || "um jogo"}`
                            : ONLINE.has(f.status)
                              ? "Online"
                              : "Offline"}
                      </span>
                    </span>
                  </span>
                  {n > 0 && (
                    <span className="font-metric min-w-6 rounded-full bg-[var(--ink)] px-2 text-center text-[length:var(--step-0)] font-bold leading-6 text-[var(--tone-0)]">{n}</span>
                  )}
                </button>
                {onStartVoiceCall && (
                  <div className="absolute right-3 top-1/2 flex -translate-y-1/2 gap-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    <button
                      type="button"
                      aria-label={`Ligar para ${f.name}`}
                      title="Ligar"
                      onClick={() => onStartVoiceCall(f, false)}
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[var(--corner-sm)] bg-[var(--tone-4)] text-[var(--ink)] hover:bg-[var(--tone-3)]"
                    >
                      <Phone className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Chamada de vídeo com ${f.name}`}
                      title="Chamada de vídeo"
                      onClick={() => onStartVoiceCall(f, true)}
                      className="flex h-10 w-10 cursor-pointer items-center justify-center rounded-[var(--corner-sm)] bg-[var(--tone-4)] text-[var(--ink)] hover:bg-[var(--tone-3)]"
                    >
                      <Video className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

export default ChatsPanel;
