import React from "react";

/** Balões de exemplo: lado, largura e altura variam para parecer uma conversa de verdade. */
const BUBBLES: Array<{ mine: boolean; width: string; height: number }> = [
  { mine: false, width: "46%", height: 44 },
  { mine: false, width: "62%", height: 64 },
  { mine: true, width: "40%", height: 40 },
  { mine: false, width: "54%", height: 52 },
  { mine: true, width: "58%", height: 60 },
  { mine: true, width: "32%", height: 40 },
];

/**
 * Esqueleto da conversa: aparece no lugar das mensagens enquanto elas carregam (modal de mensagens do
 * hub e painel do overlay). Os balões pulsam em opacidade e ficam parados com "reduzir movimento".
 */
export const ChatSkeleton: React.FC<{ className?: string; count?: number; label?: string }> = ({
  className = "",
  count = BUBBLES.length,
  label = "Carregando conversa…",
}) => (
  <div role="status" aria-live="polite" aria-busy="true" className={`flex w-full flex-col gap-3 ${className}`}>
    <span className="sr-only">{label}</span>
    {BUBBLES.slice(0, count).map((bubble, index) => (
      <div key={index} className={`flex ${bubble.mine ? "justify-end" : "justify-start"}`} aria-hidden="true">
        <div
          className="chat-skel-bubble"
          data-mine={bubble.mine}
          style={{ width: bubble.width, height: bubble.height, animationDelay: `${index * 120}ms` }}
        />
      </div>
    ))}
  </div>
);

export default ChatSkeleton;
