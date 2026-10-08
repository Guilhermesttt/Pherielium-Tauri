import React, { useMemo, useState } from "react";
import { Gamepad2, MessageSquare, Phone, Search, User, Video } from "lucide-react";
import type { SocialFriend } from "../../types/domain";
import type { SoundEffectType } from "../../hooks/useSoundEffects";

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
      <div className="mx-auto max-w-xl rounded-[22px] bg-[#121216] p-10 text-center ring-1 ring-white/[0.07]">
        <MessageSquare className="mx-auto h-8 w-8 text-white/30" />
        <h2 className="mt-4 font-display text-[20px] font-bold text-white">Nenhuma conversa ainda</h2>
        <p className="mt-1 text-[14px] text-white/55">Adicione um amigo para começar a conversar.</p>
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
    <section aria-label="Conversas" className="mx-auto max-w-3xl rounded-[22px] bg-[#121216] p-4 ring-1 ring-white/[0.07]">
      <header className="mb-3 flex items-center gap-3 px-1">
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[22px] font-bold leading-tight text-white">Conversas</h2>
          <p className="text-[13px] text-white/50">{totalUnread > 0 ? `${totalUnread} mensagens novas` : "Tudo em dia"}</p>
        </div>
        <div className="relative w-56">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
          <input
            aria-label="Buscar conversa"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar conversa"
            className="h-10 w-full rounded-full bg-[#0d0d10] pl-10 pr-4 text-[13px] text-white outline-none placeholder:text-white/35 focus:ring-2 focus:ring-white/25"
          />
        </div>
      </header>

      {rows.length === 0 ? (
        <p className="px-3 py-10 text-center text-[13px] text-white/45">Nenhuma conversa com esse nome.</p>
      ) : (
        <ul className="flex flex-col gap-0.5">
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
                  className="flex w-full items-center gap-3.5 rounded-2xl px-3 py-2.5 pr-28 text-left transition-colors hover:bg-white/[0.06] focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <span className="relative h-11 w-11 shrink-0">
                    <span className={`block h-full w-full overflow-hidden rounded-[28%] bg-white/[0.06] ${ONLINE.has(f.status) ? "" : "opacity-60"}`}>
                      {f.avatar ? (
                        <img src={f.avatar} alt="" loading="lazy" decoding="async" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-white/45">
                          <User className="h-5 w-5" />
                        </span>
                      )}
                    </span>
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#121216] ${
                        playing ? "bg-emerald-400" : ONLINE.has(f.status) ? "bg-white/80" : "bg-white/20"
                      }`}
                    />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={`block truncate text-[15px] ${n > 0 ? "font-bold text-white" : "font-semibold text-white/90"}`}>
                      {f.name}
                    </span>
                    <span className={`flex items-center gap-1 truncate text-[12.5px] ${playing ? "text-emerald-300" : "text-white/50"}`}>
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
                    <span className="min-w-6 rounded-full bg-white px-2 text-center text-[12px] font-bold leading-6 text-black">{n}</span>
                  )}
                </button>
                {onStartVoiceCall && (
                  <div className="absolute right-3 top-1/2 flex -translate-y-1/2 gap-1.5 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                    <button
                      type="button"
                      aria-label={`Ligar para ${f.name}`}
                      title="Ligar"
                      onClick={() => onStartVoiceCall(f, false)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.1] text-white hover:bg-white/[0.18] focus-visible:ring-2 focus-visible:ring-white/50"
                    >
                      <Phone className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Chamada de vídeo com ${f.name}`}
                      title="Chamada de vídeo"
                      onClick={() => onStartVoiceCall(f, true)}
                      className="flex h-9 w-9 items-center justify-center rounded-full bg-white/[0.1] text-white hover:bg-white/[0.18] focus-visible:ring-2 focus-visible:ring-white/50"
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
