import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { ImagePlus, MessageSquare, Phone, Send, Video, X, User } from "lucide-react";
import ModalShell from "../ui/ModalShell";
import { LoadingState } from "../ui/loading-state";
import { useNotification } from "../NotificationCenter";
import { useAuth } from "../../auth/AuthProvider";
import { useVoiceCallContext } from "../../context/VoiceCallContext";
import {
  MessageGroup,
  Message,
  MessageAvatar,
  MessageContent,
  MessageFooter,
} from "../ui/Shandc/message";
import { Bubble, BubbleContent } from "../ui/Shandc/bubble";
import {
  cleanupExpiredChatMessages,
  compareChatMessages,
  markMessagesAsRead,
  sendChatImage,
  sendChatMessage,
  setChatTyping,
  subscribeToChatMessages,
  subscribeToFriendTyping,
  validateChatImage,
} from "../../services/chat";
import type { ChatMessage, SocialFriend } from "../../types/domain";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import { CONTROLLER_KEYBOARD_VISIBILITY_EVENT } from "../../utils/controllerTextInput";
import { CallInviteCard, parseCallInviteText } from "../voice/CallInviteCard";

const LINK_PATTERN = /(https?:\/\/[^\s]+)|(www\.[^\s]+)/gi;
const IMAGE_LINK_PATTERN = /^https?:\/\/[^\s]+\.(png|jpe?g|gif|webp|bmp|svg)(\?[^\s]*)?$/i;

export const ChatAvatar: React.FC<{
  avatarUrl?: string | null;
  name?: string;
  sizeClassName?: string;
  className?: string;
  iconClassName?: string;
}> = ({
  avatarUrl,
  name,
  sizeClassName = "h-9 w-9",
  className = "",
  iconClassName = "h-4 w-4",
}) => {
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    setHasError(false);
  }, [avatarUrl]);

  if (avatarUrl && !hasError) {
    return (
      <img
        src={avatarUrl}
        alt={name || "Avatar"}
        onError={() => setHasError(true)}
        className={`${sizeClassName} rounded-full object-cover shrink-0 ${className}`}
      />
    );
  }

  return (
    <div
      className={`${sizeClassName} rounded-full bg-white/6 border border-white/10 flex items-center justify-center text-white/40 shrink-0 ${className}`}
      title={name}
      aria-label={name ? `Avatar de ${name}` : "Avatar padrão"}
    >
      <User className={iconClassName} />
    </div>
  );
};

export interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  friend: SocialFriend | null;
  playSound: (type: SoundEffectType) => void;
  onStartVoiceCall?: (friend: SocialFriend, withVideo?: boolean) => void;
}

interface ViewingImage {
  url: string;
  text: string;
  createdAt: string;
}

interface PendingImage {
  file: File;
  previewUrl: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Pure helpers (no hooks / no component state needed)
// ─────────────────────────────────────────────────────────────────────────

function renderMessageText(text: string): React.ReactNode {
  if (!text) return null;

  return text
    .split(LINK_PATTERN)
    .filter(Boolean)
    .map((part, index) => {
      const isLink = /^(https?:\/\/|www\.)/i.test(part);
      if (!isLink) {
        return <React.Fragment key={`${part}-${index}`}>{part}</React.Fragment>;
      }

      const href = part.startsWith("http") ? part : `https://${part}`;
      return (
        <a
          key={`${href}-${index}`}
          href={href}
          target="_blank"
          rel="noreferrer"
          className="break-all text-sky-300 underline underline-offset-2 transition-colors hover:text-sky-200"
        >
          {part}
        </a>
      );
    });
}

function extractImageLinks(text: string): string[] {
  return Array.from(
    new Set(
      (text.match(LINK_PATTERN) ?? [])
        .map((part) => (part.startsWith("http") ? part : `https://${part}`))
        .filter((part) => IMAGE_LINK_PATTERN.test(part)),
    ),
  );
}

function getDayLabel(date: Date): string {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const keyOf = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const key = keyOf(date);

  if (key === keyOf(today)) return "Hoje";
  if (key === keyOf(yesterday)) return "Ontem";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function deduplicateChatMessages(messages: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  const seenIds = new Set<string>();

  for (const msg of messages) {
    if (msg.id && seenIds.has(msg.id)) {
      continue;
    }

    const isTemp = !msg.id || msg.id.startsWith("local-") || msg.id.startsWith("fast_");
    if (isTemp) {
      const alreadyConfirmed = result.some((other) => {
        const otherIsConfirmed = other.id && !other.id.startsWith("local-") && !other.id.startsWith("fast_");
        if (!otherIsConfirmed) return false;
        const sameText = other.text.trim() === msg.text.trim();
        const timeDiff = Math.abs(
          (Date.parse(other.createdAt) || 0) - (Date.parse(msg.createdAt) || 0)
        );
        return sameText && timeDiff < 20000;
      });
      if (alreadyConfirmed) {
        continue;
      }
    } else {
      const tempIndex = result.findIndex((other) => {
        const otherIsTemp = !other.id || other.id.startsWith("local-") || other.id.startsWith("fast_");
        if (!otherIsTemp) return false;
        const sameText = other.text.trim() === msg.text.trim();
        const timeDiff = Math.abs(
          (Date.parse(other.createdAt) || 0) - (Date.parse(msg.createdAt) || 0)
        );
        return sameText && timeDiff < 20000;
      });
      if (tempIndex !== -1) {
        result.splice(tempIndex, 1);
      }
    }

    const isExactDuplicate = result.some((other) => {
      if (other.id === msg.id) return true;
      const sameSender = other.senderId === msg.senderId;
      const sameText = other.text.trim() === msg.text.trim();
      const timeDiff = Math.abs(
        (Date.parse(other.createdAt) || 0) - (Date.parse(msg.createdAt) || 0)
      );
      return sameSender && sameText && timeDiff < 2000;
    });
    if (isExactDuplicate) {
      continue;
    }

    if (msg.id) seenIds.add(msg.id);
    result.push(msg);
  }

  return result;
}

// ─────────────────────────────────────────────────────────────────────────
// Subcomponents
// ─────────────────────────────────────────────────────────────────────────

const ChatHeaderBar: React.FC<{
  friend: SocialFriend;
  onStartVoiceCall?: (friend: SocialFriend, withVideo?: boolean) => void;
  onCall: () => void;
  onVideoCall: () => void;
  onClose: () => void;
}> = ({ friend, onStartVoiceCall, onCall, onVideoCall, onClose }) => {
  const voiceCall = useVoiceCallContext();
  const isCallActiveWithFriend = voiceCall.isCallActiveWithFriend(friend.id);

  const handleCallClick = () => {
    if (isCallActiveWithFriend && voiceCall.callState === "active") {
      voiceCall.setIsVoiceWindowOpen(true);
    } else {
      onCall();
    }
  };

  return (
    <div className="flex shrink-0 items-center justify-between border-b border-white/8 bg-[#080808] px-5 py-3.5 md:px-7">
      <div className="flex items-center gap-3">
        <div className="relative">
          <ChatAvatar
            avatarUrl={friend.avatar}
            name={friend.name}
            sizeClassName="h-9 w-9"
            className="ring-1 ring-white/15"
            iconClassName="h-4 w-4"
          />
          <span
            className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-[#080808] ${
              isCallActiveWithFriend
                ? "bg-[#23a55a] animate-pulse ring-2 ring-[#23a55a]/40"
                : friend.status === "playing"
                ? "animate-pulse bg-emerald-400"
                : friend.status === "online"
                ? "bg-emerald-400"
                : "bg-white/20"
            }`}
          />
        </div>
        <div>
          <h4 className="text-sm font-bold leading-none text-white">{friend.name}</h4>
          <span className="mt-1 block text-[10px] uppercase tracking-wider text-white/40 font-body">
            {isCallActiveWithFriend
              ? "🟢 Em Chamada de Voz"
              : friend.status === "playing"
              ? `Jogando ${friend.playing}`
              : friend.status}
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {onStartVoiceCall && (
          <>
            <motion.button
              type="button"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={handleCallClick}
              aria-label={isCallActiveWithFriend ? "Voltar para a chamada" : "Iniciar chamada de voz"}
              title={isCallActiveWithFriend ? "Chamada ativa — Clique para voltar à chamada" : "Iniciar chamada de voz"}
              className={`flex h-8 w-8 items-center justify-center rounded-full border transition-colors cursor-pointer ${
                isCallActiveWithFriend
                  ? "bg-emerald-500 text-white hover:bg-emerald-600"
                  : "border-white/8 bg-white/8 text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              <Phone className="h-3.5 w-3.5" />
            </motion.button>
            <motion.button
              type="button"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.92 }}
              onClick={onVideoCall}
              aria-label="Compartilhar tela / Vídeo"
              title="Compartilhar tela / Vídeo"
              className="flex h-8 w-8 items-center justify-center rounded-full border border-white/8 bg-white/8 text-white/60 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
            >
              <Video className="h-3.5 w-3.5" />
            </motion.button>
          </>
        )}
        <motion.button
          type="button"
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.92 }}
          onClick={onClose}
          aria-label="Fechar conversa"
          className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white/60 hover:bg-white/10 hover:text-white transition-colors cursor-pointer"
        >
          <X className="h-4 w-4" />
        </motion.button>
      </div>
    </div>
  );
};

const ChatIdentityHero: React.FC<{ friend: SocialFriend }> = ({ friend }) => (
  <section className="flex flex-col items-center pb-8 pt-2 text-center" aria-label="Identidade da amizade">
    <div className="relative">
      <div className="h-24 w-24 overflow-hidden rounded-full border border-[#292d30] bg-black p-1">
        <ChatAvatar
          avatarUrl={friend.avatar}
          name={friend.name}
          sizeClassName="h-full w-full"
          iconClassName="h-10 w-10 text-white/30"
        />
      </div>
      <span
        className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-[3px] border-[#050507] ${friend.status === "offline" ? "bg-white/25" : "bg-emerald-400"
          }`}
      />
    </div>
    <h2 className="mt-4 text-xl font-black tracking-tight text-white">{friend.name}</h2>
    <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.22em] text-white/35">
      {friend.status === "playing" ? `Jogando ${friend.playing}` : friend.status === "online" ? "Online agora" : "Offline"}
    </p>
    <div className="mt-5 flex items-center -space-x-2" aria-hidden="true">
      <ChatAvatar
        avatarUrl={friend.avatar}
        name={friend.name}
        sizeClassName="h-9 w-9"
        className="border-2 border-[#050507]"
        iconClassName="h-4 w-4"
      />
      <span className="flex h-9 w-9 items-center justify-center rounded-full border-2 border-[#050507] bg-white/8 text-[10px] font-black text-white/60">
        CP
      </span>
    </div>
    <p className="mt-4 text-xs font-semibold text-white/45">Vocês já são amigos</p>
    <p className="mt-1 text-[10px] text-white/25">Comece a conversar agora</p>
  </section>
);

const DaySeparator: React.FC<{ label: string }> = ({ label }) => (
  <div className="flex items-center gap-3 py-2" role="separator" aria-label={label}>
    <span className="h-px flex-1 bg-white/6" />
    <span className="text-[9px] font-semibold uppercase tracking-[0.24em] text-white/30">{label}</span>
    <span className="h-px flex-1 bg-white/6" />
  </div>
);

const TypingBubble: React.FC<{ friendName: string; avatarUrl?: string | null }> = ({ friendName, avatarUrl }) => (
  <motion.div
    initial={{ opacity: 0, y: 6 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: 6 }}
    transition={{ duration: 0.2, ease: "easeOut" }}
    className="flex items-center gap-2.5 py-1 px-1"
    role="status"
    aria-label={`${friendName} está digitando`}
  >
    <ChatAvatar
      avatarUrl={avatarUrl}
      name={friendName}
      sizeClassName="h-6 w-6"
      iconClassName="h-3 w-3"
      className="border border-white/10"
    />
    <span className="text-[12px] font-medium text-white/40 italic">
      {friendName} está digitando...
    </span>
  </motion.div>
);

const ChatMessageRow: React.FC<{
  msg: ChatMessage;
  isMe: boolean;
  friend: SocialFriend;
  selfAvatarUrl?: string | null;
  onViewImage: (image: ViewingImage) => void;
  onJoinCall: () => void;
  playSound: (type: SoundEffectType) => void;
}> = ({ msg, isMe, friend, selfAvatarUrl, onViewImage, onJoinCall, playSound }) => {
  const inviteMeta = parseCallInviteText(msg.text);
  const inlineImageLinks = extractImageLinks(msg.text);
  const visibleImages = Array.from(
    new Set([...(msg.attachmentUrl ? [msg.attachmentUrl] : []), ...inlineImageLinks]),
  );

  if (inviteMeta) {
    return (
      <Message align={isMe ? "end" : "start"} className="my-1.5">
        <MessageContent>
          <CallInviteCard invite={inviteMeta} isSelf={isMe} onJoinCall={onJoinCall} />
        </MessageContent>
      </Message>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <Message align={isMe ? "end" : "start"} className="gap-2.5">
        <MessageAvatar className="h-7 w-7 min-w-7 border border-white/10 translate-y-0!">
          <ChatAvatar
            avatarUrl={isMe ? selfAvatarUrl : friend.avatar}
            name={isMe ? "Você" : friend.name}
            sizeClassName="h-full w-full"
            iconClassName="h-3.5 w-3.5"
          />
        </MessageAvatar>

        <MessageContent className="max-w-[76%] gap-1">
          <div className={`px-1 text-[11px] font-medium text-white/38 ${isMe ? "text-right" : "text-left"}`}>
            {isMe ? "Você" : friend.name}
          </div>

          <Bubble
            align={isMe ? "end" : "start"}
            variant={isMe ? "default" : "outline"}
            className={
              isMe
                ? "rounded-lg rounded-br-none bg-white text-black border border-transparent"
                : "rounded-lg rounded-tl-none border border-[#292d30] bg-black text-white"
            }
          >
            <BubbleContent className="p-3 text-sm">
              {msg.text && (
                <p className="leading-relaxed select-text cursor-text selection:bg-black/20 wrap-break-words font-sans">
                  {renderMessageText(msg.text)}
                </p>
              )}

              {visibleImages.length > 0 && (
                <div
                  className={`grid gap-2 ${
                    visibleImages.length === 1 ? "grid-cols-1" : "grid-cols-2"
                  } ${msg.text ? "mt-2 pt-2 border-t border-white/10" : ""}`}
                >
                  {visibleImages.map((imageUrl, imgIdx) => (
                    <button
                      key={`${imageUrl}-${imgIdx}`}
                      type="button"
                      onClick={() => {
                        playSound("select");
                        onViewImage({
                          url: imageUrl,
                          text: msg.text,
                          createdAt: msg.createdAt,
                        });
                      }}
                      className="group/img relative overflow-hidden rounded-xl border border-white/10 bg-black/40 text-left transition-transform hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                    >
                      <img
                        src={imageUrl}
                        alt="Imagem enviada no chat"
                        loading="lazy"
                        className="max-h-64 w-full object-cover rounded-xl"
                      />
                      <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover/img:bg-black/20" />
                    </button>
                  ))}
                </div>
              )}
            </BubbleContent>
          </Bubble>

          <MessageFooter
            className={`px-1 text-[10px] text-white/30 ${
              isMe ? "justify-end" : "justify-start"
            }`}
          >
            {isMe ? (
              <span>
                {msg.id?.startsWith("local-")
                  ? "Enviando..."
                  : msg.read
                  ? "Lida"
                  : "Enviada"}
              </span>
            ) : (
              <span>
                {new Date(msg.createdAt).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            )}
          </MessageFooter>
        </MessageContent>
      </Message>
    </motion.div>
  );
};

const ChatMessageList: React.FC<{
  isLoading: boolean;
  messages: ChatMessage[];
  friendUid: string | null;
  friend: SocialFriend;
  selfAvatarUrl?: string | null;
  friendTyping: boolean;
  onViewImage: (image: ViewingImage) => void;
  onJoinCall: () => void;
  playSound: (type: SoundEffectType) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}> = ({
  isLoading,
  messages,
  friendUid,
  friend,
  selfAvatarUrl,
  friendTyping,
  onViewImage,
  onJoinCall,
  playSound,
  messagesEndRef,
}) => (
  <div className="chat-scrollbar flex-1 space-y-2 overflow-y-auto px-7 py-6 pr-4 md:px-9">
    {isLoading ? (
      <div className="flex flex-1 min-h-65 flex-col items-center justify-center space-y-3 py-16 text-center">
        <LoadingState label="Carregando conversa..." variant="searching" size="md" showTimer={false} />
      </div>
    ) : messages.length === 0 ? (
      <div className="flex flex-col items-center justify-center space-y-2 pb-8 text-center text-white/20">
        <MessageSquare className="h-6 w-6" />
        <p className="text-xs uppercase tracking-wider">Nenhuma mensagem ainda</p>
      </div>
    ) : (
      <MessageGroup className="space-y-3">
        {messages.map((msg, index) => {
          const isMe = msg.senderId !== friendUid;
          const messageDate = new Date(msg.createdAt);
          const previousDate = index > 0 ? new Date(messages[index - 1].createdAt) : null;
          const showDaySeparator =
            index === 0 || !previousDate || !isSameDay(messageDate, previousDate);

          return (
            <React.Fragment key={msg.id || index}>
              {showDaySeparator && Number.isFinite(messageDate.getTime()) ? (
                <DaySeparator label={getDayLabel(messageDate)} />
              ) : null}
              <ChatMessageRow
                msg={msg}
                isMe={isMe}
                friend={friend}
                selfAvatarUrl={selfAvatarUrl}
                onViewImage={onViewImage}
                onJoinCall={onJoinCall}
                playSound={playSound}
              />
            </React.Fragment>
          );
        })}
      </MessageGroup>
    )}

    {!isLoading && friendTyping && <TypingBubble friendName={friend.name} avatarUrl={friend.avatar} />}
    <div ref={messagesEndRef} />
  </div>
);

const ChatComposer: React.FC<{
  inputText: string;
  onChangeInputText: (val: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onPasteImage: (e: React.ClipboardEvent<HTMLInputElement>) => void;
  onPickImage: () => void;
  onImageSelected: (e: React.ChangeEvent<HTMLInputElement>) => void;
  imageInputRef: React.RefObject<HTMLInputElement | null>;
  pendingImage: PendingImage | null;
  onRemovePendingImage: () => void;
  isSendingImage: boolean;
  friendTyping: boolean;
  friendName: string;
  spamLockedUntil: number | null;
}> = ({
  inputText,
  onChangeInputText,
  onSubmit,
  onPasteImage,
  onPickImage,
  onImageSelected,
  imageInputRef,
  pendingImage,
  onRemovePendingImage,
  isSendingImage,
  friendTyping,
  friendName,
  spamLockedUntil,
}) => {
    const isSpamLocked = Boolean(spamLockedUntil && spamLockedUntil > Date.now());

    return (
      <form onSubmit={onSubmit} className="shrink-0 border-t border-white/8 bg-[#080808] px-5 py-4 md:px-7">
        <div className="mb-2 flex min-h-4 items-center justify-between px-1">
          <span className="text-[10px] uppercase tracking-[0.24em] text-white/30 font-body">
            Chat em tempo real
          </span>
          {isSpamLocked ? (
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-400">DEVAGAR PAE</span>
          ) : null}
        </div>

        {pendingImage ? (
          <div className="relative mb-3 w-fit max-w-full rounded-xl border border-white/10 bg-[#141414] p-2">
            <img src={pendingImage.previewUrl} alt="Prévia da imagem anexada" className="max-h-32 max-w-full rounded-lg object-cover" />
            <button
              type="button"
              onClick={onRemovePendingImage}
              aria-label="Remover imagem anexada"
              title="Remover imagem"
              className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full border border-[#292d30] bg-[#0a0a0a] text-white transition-colors hover:bg-red-600"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <span className="mt-1.5 block max-w-56 truncate px-1 text-[9px] text-white/40">{pendingImage.file.name}</span>
          </div>
        ) : null}

        <div className="flex items-center gap-2 rounded-md border border-[#292d30] bg-black p-1.5">
          <input
            ref={imageInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={onImageSelected}
          />
          <motion.button
            type="button"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={onPickImage}
            disabled={isSendingImage}
            aria-label="Anexar imagem"
            title="Anexar imagem"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ImagePlus className="h-4 w-4" />
          </motion.button>
          <input
            type="text"
            value={inputText}
            disabled={isSendingImage}
            onChange={(e) => onChangeInputText(e.target.value)}
            onPaste={onPasteImage}
            placeholder={pendingImage ? "Adicionar uma legenda (opcional)..." : "Digite sua mensagem..."}
            className="h-10 flex-1 rounded-full border-0 bg-transparent px-3 text-[13px] text-white placeholder-white/30 outline-none ring-0 focus:outline-none focus:ring-0 disabled:cursor-wait"
          />
          <motion.button
            type="submit"
            whileHover={{ scale: 1.06 }}
            whileTap={{ scale: 0.94 }}
            disabled={isSendingImage || (!inputText.trim() && !pendingImage) || isSpamLocked}
            aria-label="Enviar mensagem"
            className="flex h-10 w-10 items-center justify-center rounded-md bg-white text-black transition-all hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer"
          >
            <Send className="h-4 w-4" />
          </motion.button>
        </div>
      </form>
    );
  };

const ImageLightbox: React.FC<{
  isOpen: boolean;
  image: ViewingImage | null;
  onClose: () => void;
}> = ({ isOpen, image, onClose }) => (
  <ModalShell
    isOpen={isOpen}
    onClose={onClose}
    maxWidthClassName="max-w-5xl"
    className="border-0 bg-transparent p-0 shadow-none"
    backdropClassName="bg-black/90"
    zIndexClassName="z-[220]"
    reducedEffects
    ariaLabel="Visualização da imagem do chat"
    gamepadPriority={220}
  >
    {image ? (
      <div className="relative overflow-hidden rounded-2xl border border-[#292d30] bg-black">
        <div className="flex items-center justify-between border-b border-white/5 px-6 py-4">
          <span className="text-xs font-semibold uppercase tracking-wider text-white/70">Imagem do chat</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/10 bg-white/8 text-white/60 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex max-h-[75dvh] items-center justify-center p-6">
          <img src={image.url} alt="Imagem expandida" className="max-h-[68dvh] max-w-full rounded-md object-contain" />
        </div>
        {image.text ? (
          <div className="border-t border-white/5 bg-white/2 px-6 py-4 text-xs text-white/80">{image.text}</div>
        ) : null}
      </div>
    ) : null}
  </ModalShell>
);

// ─────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────

export const ChatModal: React.FC<ChatModalProps> = React.memo(
  ({ isOpen, onClose, friend, playSound, onStartVoiceCall }) => {
    const { notify } = useNotification();
    const { user, userProfile } = useAuth();

    const [displayMessages, setDisplayMessages] = useState<ChatMessage[]>([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(true);
    const optimisticRef = useRef<Map<string, ChatMessage>>(new Map());
    const [inputText, setInputText] = useState("");
    const [pendingImage, setPendingImage] = useState<PendingImage | null>(null);
    const [viewingImage, setViewingImage] = useState<ViewingImage | null>(null);
    const [friendTyping, setFriendTyping] = useState(false);
    const [isSendingImage, setIsSendingImage] = useState(false);
    const [spamLockedUntil, setSpamLockedUntil] = useState<number | null>(null);
    const [controllerKeyboardOpen, setControllerKeyboardOpen] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement | null>(null);
    const imageInputRef = useRef<HTMLInputElement | null>(null);
    const pendingImageRef = useRef<PendingImage | null>(null);
    const recentSendTimestampsRef = useRef<number[]>([]);
    const lastTypingSentRef = useRef(false);
    const lastTypingRefreshRef = useRef(0);
    const friendUidRef = useRef<string | null>(null);
    const pendingSnapshotRef = useRef<ChatMessage[] | null>(null);

    const friendUid = friend?.id.split(":")[1] ?? null;

    const selfAvatarUrl =
      userProfile?.photoURL ||
      userProfile?.discordAvatar ||
      userProfile?.steamAvatar ||
      null;

    const detachPendingImage = React.useCallback(() => {
      const current = pendingImageRef.current;
      if (current) URL.revokeObjectURL(current.previewUrl);
      pendingImageRef.current = null;
      setPendingImage(null);
    }, []);

    const attachImageDraft = React.useCallback(
      (file: File) => {
        validateChatImage(file);
        detachPendingImage();
        const imageDraft = { file, previewUrl: URL.createObjectURL(file) };
        pendingImageRef.current = imageDraft;
        setPendingImage(imageDraft);
      },
      [detachPendingImage],
    );

    // ── Cleanup de blob URL pendente ao desmontar ──────────────────────────
    useEffect(
      () => () => {
        const current = pendingImageRef.current;
        if (current) URL.revokeObjectURL(current.previewUrl);
      },
      [],
    );

    // ── Teclado do controle (Electron gamepad text input) ───────────────────
    useEffect(() => {
      const handleKeyboardVisibility = (event: Event) => {
        setControllerKeyboardOpen(Boolean((event as CustomEvent<{ isOpen?: boolean }>).detail?.isOpen));
      };
      window.addEventListener(CONTROLLER_KEYBOARD_VISIBILITY_EVENT, handleKeyboardVisibility);
      return () => window.removeEventListener(CONTROLLER_KEYBOARD_VISIBILITY_EVENT, handleKeyboardVisibility);
    }, []);

    // ── Buffer de snapshot do servidor (reduz re-renders em rajada) ─────────
    useEffect(() => {
      const flushInterval = 100; // ms
      const id = window.setInterval(() => {
        const snapshot = pendingSnapshotRef.current;
        if (snapshot !== null) {
          setDisplayMessages(snapshot);
          pendingSnapshotRef.current = null;
        }
      }, flushInterval);
      return () => window.clearInterval(id);
    }, []);

    // ── Subscrições realtime (mensagens + digitando) ────────────────────────
    useEffect(() => {
      if (!isOpen || !friendUid) {
        setDisplayMessages([]);
        optimisticRef.current.clear();
        setInputText("");
        detachPendingImage();
        setViewingImage(null);
        setFriendTyping(false);
        setIsSendingImage(false);
        setSpamLockedUntil(null);
        setIsLoadingMessages(true);
        recentSendTimestampsRef.current = [];
        lastTypingSentRef.current = false;
        friendUidRef.current = null;
        pendingSnapshotRef.current = null;
        return;
      }

      if (friendUidRef.current === friendUid) return;
      friendUidRef.current = friendUid;
      setIsLoadingMessages(true);

      void cleanupExpiredChatMessages(friendUid).catch(() => undefined);
      void markMessagesAsRead(friendUid);

      let messagesInitialized = false;
      let knownServerMessageIds = new Set<string>();

      const unsubscribeMessages = subscribeToChatMessages(friendUid, (serverMsgs) => {
        setIsLoadingMessages(false);
        const serverIds = new Set(serverMsgs.map((m) => m.id));
        optimisticRef.current.forEach((_, key) => {
          if (serverIds.has(key)) optimisticRef.current.delete(key);
        });

        const pending = Array.from(optimisticRef.current.values());
        const merged = deduplicateChatMessages([...serverMsgs, ...pending]).sort(compareChatMessages);

        const nextServerMessageIds = new Set(serverMsgs.flatMap((message) => (message.id ? [message.id] : [])));
        if (
          messagesInitialized &&
          serverMsgs.some(
            (message) => message.senderId === friendUid && Boolean(message.id) && !knownServerMessageIds.has(message.id!),
          )
        ) {
          playSound("chatReceived");
        }
        knownServerMessageIds = nextServerMessageIds;
        messagesInitialized = true;

        setDisplayMessages(merged);
        pendingSnapshotRef.current = merged;

        // Se o chat está ativo/aberto e há mensagens recebidas do amigo que ainda não foram marcadas como lidas:
        if (serverMsgs.some((message) => message.senderId === friendUid && !message.read)) {
          void markMessagesAsRead(friendUid);
        }
      });

      const unsubscribeTyping = subscribeToFriendTyping(friendUid, (typing) => {
        setFriendTyping(typing);
      });

      return () => {
        void setChatTyping(friendUid, false);
        unsubscribeMessages();
        unsubscribeTyping();
        friendUidRef.current = null;
        pendingSnapshotRef.current = null;
      };
    }, [detachPendingImage, isOpen, friendUid, playSound]);

    // ── Scroll automático até a última mensagem ─────────────────────────────
    useEffect(() => {
      const el = messagesEndRef.current;
      if (!el) return;
      const timer = setTimeout(() => el.scrollIntoView({ behavior: "smooth" }), 60);
      return () => clearTimeout(timer);
    }, [displayMessages, friendTyping]);

    // ── Cooldown de anti-spam ────────────────────────────────────────────────
    useEffect(() => {
      if (!spamLockedUntil) return;
      const remaining = spamLockedUntil - Date.now();
      if (remaining <= 0) {
        setSpamLockedUntil(null);
        return;
      }
      const timer = window.setTimeout(() => setSpamLockedUntil(null), remaining);
      return () => window.clearTimeout(timer);
    }, [spamLockedUntil]);

    // ── Indicador de "está digitando" ────────────────────────────────────────
    useEffect(() => {
      if (!isOpen || !friendUid) return;
      const shouldSendTyping = inputText.trim().length > 0;
      if (!shouldSendTyping) {
        lastTypingSentRef.current = false;
        lastTypingRefreshRef.current = 0;
        void setChatTyping(friendUid, false);
        return;
      }

      const now = Date.now();
      if (!lastTypingSentRef.current || now - lastTypingRefreshRef.current >= 1_500) {
        lastTypingSentRef.current = true;
        lastTypingRefreshRef.current = now;
        void setChatTyping(friendUid, true);
      }
      const idleTimer = window.setTimeout(() => {
        lastTypingSentRef.current = false;
        lastTypingRefreshRef.current = 0;
        void setChatTyping(friendUid, false);
      }, 2_500);
      return () => window.clearTimeout(idleTimer);
    }, [friendUid, inputText, isOpen]);

    if (!friend) return null;

    const handleSendMessageSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      const text = inputText.trim();
      const imageDraft = pendingImageRef.current;
      if (!text && !imageDraft) return;
      if (!friendUid) return;

      const now = Date.now();
      const optimisticId = `local-${crypto.randomUUID()}`;
      const recentWindow = now - 8000;
      const freshTimestamps = recentSendTimestampsRef.current.filter((timestamp) => timestamp > recentWindow);

      if (spamLockedUntil && spamLockedUntil > now) {
        notify("DEVAGAR PAE: Você está enviando mensagens rápido demais!", "error");
        return;
      }

      if (freshTimestamps.length >= 4) {
        const cooldownEnd = now + 6000;
        recentSendTimestampsRef.current = freshTimestamps;
        setSpamLockedUntil(cooldownEnd);
        notify("DEVAGAR PAE: Você está enviando mensagens rápido demais!", "error");
        return;
      }

      try {
        playSound("chatSent");
        const optimisticMessage: ChatMessage = {
          id: optimisticId,
          chatId: friendUid,
          senderId: "me",
          receiverId: friendUid,
          text,
          createdAt: new Date(now).toISOString(),
          read: true,
          attachmentName: imageDraft?.file.name,
          attachmentUrl: imageDraft?.previewUrl,
          attachmentType: imageDraft?.file.type,
          attachmentSize: imageDraft?.file.size,
        };

        recentSendTimestampsRef.current = [...freshTimestamps, now];
        optimisticRef.current.set(optimisticId, optimisticMessage);
        setDisplayMessages((current) => [...current, optimisticMessage].sort(compareChatMessages));
        setInputText("");
        if (imageDraft) {
          pendingImageRef.current = null;
          setPendingImage(null);
          setIsSendingImage(true);
        }
        lastTypingSentRef.current = false;
        void setChatTyping(friendUid, false);
        const confirmedMessage = imageDraft
          ? await sendChatImage(friendUid, imageDraft.file, text)
          : await sendChatMessage(friendUid, text);
        optimisticRef.current.delete(optimisticId);
        setDisplayMessages((current) =>
          deduplicateChatMessages([
            ...current.filter((message) => message.id !== optimisticId && message.id !== confirmedMessage.id),
            confirmedMessage,
          ]).sort(compareChatMessages),
        );
        if (imageDraft) {
          setViewingImage((current) =>
            current?.url === imageDraft.previewUrl
              ? { ...current, url: confirmedMessage.attachmentUrl || current.url, createdAt: confirmedMessage.createdAt }
              : current,
          );
          URL.revokeObjectURL(imageDraft.previewUrl);
        }
      } catch (error) {
        console.error("Erro ao enviar mensagem:", error);
        optimisticRef.current.delete(optimisticId);
        setDisplayMessages((current) => current.filter((message) => message.id !== optimisticId));
        setInputText((current) => current || text);
        if (imageDraft) {
          pendingImageRef.current = imageDraft;
          setPendingImage(imageDraft);
        }
        notify("Nao foi possivel enviar a mensagem.", "error");
      } finally {
        if (imageDraft) setIsSendingImage(false);
      }
    };

    const handleImageSelected = async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file || !friendUid || isSendingImage) return;
      try {
        playSound("select");
        attachImageDraft(file);
      } catch (error) {
        notify(error instanceof Error ? error.message : "Nao foi possivel anexar a imagem.", "error");
      }
    };

    const handleImagePaste = (event: React.ClipboardEvent<HTMLInputElement>) => {
      if (!friendUid || isSendingImage) return;
      const clipboardImage = Array.from(event.clipboardData.items)
        .find((item) => item.kind === "file" && item.type.startsWith("image/"))
        ?.getAsFile();
      if (!clipboardImage) return;

      event.preventDefault();
      try {
        const extension = clipboardImage.type.split("/")[1]?.replace("jpeg", "jpg") || "png";
        const file = clipboardImage.name
          ? clipboardImage
          : new File([clipboardImage], `imagem-colada-${Date.now()}.${extension}`, { type: clipboardImage.type });
        playSound("select");
        attachImageDraft(file);
      } catch (error) {
        notify(error instanceof Error ? error.message : "Nao foi possivel colar a imagem.", "error");
      }
    };

    const handleCloseModal = () => {
      if (viewingImage) {
        setViewingImage(null);
        playSound("modalClose");
        return;
      }
      playSound("back");
      onClose();
    };

    const handleJoinCallFromInvite = () => {
      onClose();
      if (onStartVoiceCall && friend) {
        onStartVoiceCall(friend, false);
      }
    };

    return (
      <ModalShell
        isOpen={isOpen}
        onClose={handleCloseModal}
        maxWidthClassName={controllerKeyboardOpen ? "max-w-[min(880px,68vw)]" : "max-w-4xl"}
        zIndexClassName="z-[180]"
        closeDurationMs={320}
        containerClassName={
          controllerKeyboardOpen ? "items-start justify-center p-2 md:items-center md:justify-start md:p-3" : undefined
        }
        className="t-modal-panel overflow-hidden rounded-2xl border border-[#292d30] bg-black p-0"
        ariaLabel={`Conversa com ${friend.name}`}
      >
        <div className="flex h-[calc(100dvh-2rem)] max-h-200 min-h-140 w-full flex-col bg-[#050505] md:h-[calc(100dvh-4rem)]">
          <ChatHeaderBar
            friend={friend}
            onStartVoiceCall={onStartVoiceCall}
            onCall={() => {
              playSound("select");
              onStartVoiceCall?.(friend, false);
            }}
            onVideoCall={() => {
              playSound("select");
              onStartVoiceCall?.(friend, true);
            }}
            onClose={() => {
              playSound("back");
              onClose();
            }}
          />

          <ChatMessageList
            isLoading={isLoadingMessages}
            messages={displayMessages}
            friendUid={friendUid}
            friend={friend}
            selfAvatarUrl={selfAvatarUrl}
            friendTyping={friendTyping}
            onViewImage={setViewingImage}
            onJoinCall={handleJoinCallFromInvite}
            playSound={playSound}
            messagesEndRef={messagesEndRef}
          />

          <ChatComposer
            inputText={inputText}
            onChangeInputText={setInputText}
            onSubmit={handleSendMessageSubmit}
            onPasteImage={handleImagePaste}
            onPickImage={() => imageInputRef.current?.click()}
            onImageSelected={handleImageSelected}
            imageInputRef={imageInputRef}
            pendingImage={pendingImage}
            onRemovePendingImage={detachPendingImage}
            isSendingImage={isSendingImage}
            friendTyping={friendTyping}
            friendName={friend.name}
            spamLockedUntil={spamLockedUntil}
          />
        </div>

        <ImageLightbox
          isOpen={Boolean(viewingImage)}
          image={viewingImage}
          onClose={() => {
            setViewingImage(null);
            playSound("modalClose");
          }}
        />
      </ModalShell>
    );
  },
);

ChatModal.displayName = "ChatModal";