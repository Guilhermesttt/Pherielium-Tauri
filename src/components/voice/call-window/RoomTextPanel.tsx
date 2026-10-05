import React, { useEffect, useState } from "react";
import { supabase } from "../../../services/supabase";

type RoomTextMessage = {
  id: string;
  senderName: string;
  text: string;
  deletedAt?: string;
  mine: boolean;
};

export const RoomTextPanel: React.FC<{
  roomId: string;
  userId?: string | null;
  userName?: string | null;
}> = ({ roomId, userId, userName }) => {
  const [messages, setMessages] = useState<RoomTextMessage[]>([]);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const mapRow = (row: Record<string, unknown>): RoomTextMessage => ({
      id: String(row.id),
      senderName: String(row.sender_name || "Jogador"),
      text: String(row.text || ""),
      deletedAt: typeof row.deleted_at === "string" ? row.deleted_at : undefined,
      mine: String(row.sender_id) === userId,
    });

    void supabase
      .from("voice_room_messages")
      .select("id, sender_id, sender_name, text, deleted_at, created_at")
      .eq("room_id", roomId)
      .order("created_at", { ascending: true })
      .limit(80)
      .then(({ data, error: loadError }) => {
        if (cancelled) return;
        if (loadError) {
          setError("O texto desta sala ainda não está disponível.");
          return;
        }
        setMessages((data || []).map((row) => mapRow(row as Record<string, unknown>)));
      });

    const channel = supabase
      .channel(`room_text_${roomId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "voice_room_messages", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = (payload.new || payload.old) as Record<string, unknown> | null;
          if (!row?.id) return;
          const next = mapRow(row);
          setMessages((current) => {
            const index = current.findIndex((item) => item.id === next.id);
            if (index === -1) return [...current, next];
            return current.map((item) => (item.id === next.id ? next : item));
          });
        },
      )
      .subscribe();

    return () => {
      cancelled = true;
      void supabase.removeChannel(channel);
    };
  }, [roomId, userId]);

  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || !userId) return;
    setText("");
    const { error: sendError } = await supabase.from("voice_room_messages").insert({
      room_id: roomId,
      sender_id: userId,
      sender_name: userName || "Você",
      text: value,
    });
    if (sendError) setError(sendError.message);
  };

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-l border-[#161616] bg-[#0c0c0c]">
      <div className="border-b border-[#161616] px-4 py-3 text-xs font-semibold text-white">Texto da sala</div>
      <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {error ? <p className="text-[11px] text-amber-300/80">{error}</p> : null}
        {messages.map((message) => (
          <div key={message.id} className={message.mine ? "text-right" : "text-left"}>
            <p className="text-[10px] text-white/35">{message.senderName}</p>
            <p className="text-xs text-white/85">{message.deletedAt ? "Mensagem apagada" : message.text}</p>
          </div>
        ))}
      </div>
      <form onSubmit={(event) => void send(event)} className="border-t border-[#161616] p-3">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Mensagem da sala"
          className="w-full rounded-lg border border-[#161616] bg-black px-3 py-2 text-xs text-white outline-none"
        />
      </form>
    </aside>
  );
};
