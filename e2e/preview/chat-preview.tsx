import React from "react";
import { createRoot } from "react-dom/client";
import { ChatComposer, ChatMessageList } from "../../src/components/home/ChatModal";
import type { ChatMessage, SocialFriend } from "../../src/types/domain";

const friend: SocialFriend = { id: "cp:bia", name: "Bia Azevedo", status: "offline", source: "checkpoint" } as SocialFriend;
const t = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const base: ChatMessage[] = [
  { id: "1", senderId: "bia", text: "okaaaay", createdAt: t(40) },
  { id: "2", senderId: "bia", text: "xeroooo", createdAt: t(39.5), reactions: { "👍": ["me"] } },
  { id: "3", senderId: "me", text: "vou mexer aqui", createdAt: t(20), read: true },
  { id: "4", senderId: "me", text: "me chama quando terminar", createdAt: t(19.8), read: true },
  { id: "5", senderId: "me", text: "Xero", createdAt: t(19.6) },
];

export const Preview: React.FC<{ live?: boolean }> = () => {
  const [messages, setMessages] = React.useState<ChatMessage[]>(base);
  const [text, setText] = React.useState("");
  React.useEffect(() => {
    (window as unknown as { __chatPush?: (m: ChatMessage) => void }).__chatPush = (m) => setMessages((prev) => [...prev, m]);
  }, []);
  const endRef = React.useRef<HTMLDivElement | null>(null);
  const imgRef = React.useRef<HTMLInputElement | null>(null);
  return (
    <div style={{ width: 560, height: 560, display: "flex", flexDirection: "column", background: "#050505", borderRadius: 26, border: "1px solid rgba(255,255,255,.1)", overflow: "hidden" }}>
      <ChatMessageList
        isLoading={false}
        loadError={null}
        onRetryLoad={() => {}}
        messages={messages}
        friendUid="bia"
        friend={friend}
        selfAvatarUrl={null}
        friendTyping={false}
        onViewImage={() => {}}
        onJoinCall={() => {}}
        playSound={() => {}}
        messagesEndRef={endRef}
        onReply={() => {}}
        onEdit={() => {}}
        onDelete={() => {}}
        onReact={() => {}}
      />
      <ChatComposer
        inputText={text}
        onChangeInputText={setText}
        onSubmit={(e) => e.preventDefault()}
        onPasteImage={() => {}}
        onPickImage={() => {}}
        onImageSelected={() => {}}
        imageInputRef={imgRef}
        pendingImage={null}
        onRemovePendingImage={() => {}}
        isSendingImage={false}
        friendTyping={false}
        friendName="Bia"
        spamLockedUntil={null}
      />
    </div>
  );
};

export function mount(el: HTMLElement) {
  createRoot(el).render(<Preview />);
}
