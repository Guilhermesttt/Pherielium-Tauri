import React, { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { animated, useSpring, useSprings } from "@react-spring/web";
import { ImagePlus, MessageSquare, Pencil, Phone, Send, Trash2, Video, X, User } from "lucide-react";
import ModalShell from "../ui/ModalShell";
import { LoadingState } from "../ui/loading-state";
import { useNotification } from "../NotificationCenter";
import { useAuth } from "../../auth/AuthProvider";
import { useVoiceCallContext } from "../../context/VoiceCallContext";
import { presenceLabel } from "../../services/presenceStatus";
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
  editChatMessage,
  deleteChatMessage,
  toggleChatReaction,
  setChatTyping,
  subscribeToChatMessages,
  subscribeToFriendTyping,
  validateChatImage,
} from "../../services/chat";
import type { ChatMessage, SocialFriend } from "../../types/domain";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import { CONTROLLER_KEYBOARD_VISIBILITY_EVENT } from "../../utils/controllerTextInput";
import { CallInviteCard, parseCallInviteText } from "../voice/CallInviteCard";
import type { CallInviteMeta } from "../../types/voice-governance";
import { SPRINGS } from "../../design-system/motion";
import { bubbleOrigin, groupInfo, messageSignature } from "./chat/bubbles";
import { useBubbleSpring } from "./chat/useBubbleSpring";

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
        return (
          <React.Fragment key={`${part}-${index}`}>
            {part.split(/(@\S+)/g).map((bit, bitIndex) =>
              bit.startsWith("@") ? (
                <span key={`${bit}-${bitIndex}`} className="font-semibold text-sky-300">{bit}</span>
              ) : (
                <React.Fragment key={`${bit}-${bitIndex}`}>{bit}</React.Fragment>
              ),
            )}
          </React.Fragment>
        );
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
    <div className="flex shrink-0 items-center justify-between border-b border-white/[0.06] bg-[#0a0a0b]/90 px-5 py-3 backdrop-blur-xl md:px-7">
      <div className="flex min-w-0 items-center gap-3">
        <ChatAvatar
          avatarUrl={friend.avatar}
          name={friend.name}
          sizeClassName="h-10 w-10"
          className="ring-1 ring-white/12"
          iconClassName="h-4 w-4"
        />
        <div className="min-w-0">
          <h4 className="truncate text-[15px] font-semibold leading-tight text-white">{friend.name}</h4>
          <span className="mt-0.5 flex items-center gap-1.5 text-[12px] leading-none text-white/50">
            <span
              aria-hidden
              className="inline-block h-[7px] w-[7px] shrink-0 rounded-full"
              style={{ backgroundColor: friend.status === "online" || friend.status === "playing" || friend.status === "idle" || friend.status === "dnd" || friend.status === "in_call" || friend.status === "streaming" ? "#30d158" : "#ef4444" }}
            />
            <span className="truncate">
              {isCallActiveWithFriend
                ? "Em chamada de voz"
                : friend.status === "playing"
                ? `Jogando ${friend.playing || "um jogo"}`
                : friend.status === "offline"
                ? "Offline"
                : friend.status === "idle"
                ? "Ausente"
                : "Online"}
            </span>
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
      {presenceLabel(friend.status, friend.playing)}
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
    <span className="text-[11px] font-medium text-white/35">{label}</span>
    <span className="h-px flex-1 bg-white/6" />
  </div>
);

/** Três pontinhos que "quicam" em onda, com mola. */
const TypingDots: React.FC = () => {
  const [springs] = useSprings(
    3,
    (i) => ({
      loop: true,
      from: { y: 0 },
      to: [{ y: -4 }, { y: 0 }],
      delay: i * 130,
      config: { ...SPRINGS.bouncy, friction: 11 },
    }),
    [],
  );
  return (
    <span className="flex items-center gap-[5px]" aria-hidden>
      {springs.map((style, i) => (
        <animated.span key={i} style={style} className="inline-block h-[6px] w-[6px] rounded-full bg-white/55" />
      ))}
    </span>
  );
};

const TypingBubble: React.FC<{ friendName: string; avatarUrl?: string | null }> = ({ friendName, avatarUrl }) => {
  const style = useBubbleSpring(false, true);
  return (
    <animated.div
      style={{ ...style, transformOrigin: bubbleOrigin(false) }}
      className="mt-3 flex items-end gap-2.5"
      role="status"
      aria-label={`${friendName} está digitando`}
    >
      <ChatAvatar
        avatarUrl={avatarUrl}
        name={friendName}
        sizeClassName="h-7 w-7"
        iconClassName="h-3.5 w-3.5"
        className="ring-1 ring-white/10"
      />
      <span className="flex h-[34px] items-center rounded-[18px] rounded-bl-[6px] bg-white/[0.08] px-3.5">
        <TypingDots />
      </span>
    </animated.div>
  );
};

/** Seta de "responder" (o conjunto de SF Symbols do app não traz uma equivalente). */
const Reply: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
    <path d="M9 14 4 9l5-5" />
    <path d="M4 9h10a6 6 0 0 1 6 6v3" />
  </svg>
);

const ACTION_BTN =
  "flex h-7 w-7 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40";

const ChatMessageRow: React.FC<{
  msg: ChatMessage;
  isMe: boolean;
  friend: SocialFriend;
  selfAvatarUrl?: string | null;
  /** primeira / última do bloco de mensagens seguidas do mesmo autor */
  startsGroup: boolean;
  endsGroup: boolean;
  /** só mensagens que chegam agora animam; o histórico entra direto */
  animateIn: boolean;
  onViewImage: (image: ViewingImage) => void;
  onJoinCall: (invite: CallInviteMeta, password?: string) => void;
  playSound: (type: SoundEffectType) => void;
  replyPreview?: string;
  onReply?: (message: ChatMessage) => void;
  onEdit?: (message: ChatMessage) => void;
  onDelete?: (message: ChatMessage) => void;
  onReact?: (message: ChatMessage) => void;
}> = ({ msg, isMe, friend, selfAvatarUrl, startsGroup, endsGroup, animateIn, onViewImage, onJoinCall, playSound, replyPreview, onReply, onEdit, onDelete, onReact }) => {
  const spring = useBubbleSpring(isMe, animateIn);
  const inviteMeta = parseCallInviteText(msg.text);
  const inlineImageLinks = extractImageLinks(msg.text);
  const visibleImages = Array.from(
    new Set([...(msg.attachmentUrl ? [msg.attachmentUrl] : []), ...inlineImageLinks]),
  );
  const deleted = Boolean(msg.deletedAt);
  const rowSpacing = startsGroup ? "mt-3.5" : "mt-0.5";

  if (inviteMeta) {
    return (
      <animated.div style={{ ...spring, transformOrigin: bubbleOrigin(isMe) }} className={rowSpacing}>
        <Message align={isMe ? "end" : "start"}>
          <MessageContent>
            <CallInviteCard invite={inviteMeta} isSelf={isMe} onJoinCall={onJoinCall} />
          </MessageContent>
        </Message>
      </animated.div>
    );
  }

  const reactions = Object.entries(msg.reactions || {}).filter(([, users]) => (users?.length || 0) > 0);
  const radius = isMe
    ? `rounded-[18px] rounded-br-[6px] ${startsGroup ? "" : "rounded-tr-[6px]"}`
    : `rounded-[18px] rounded-bl-[6px] ${startsGroup ? "" : "rounded-tl-[6px]"}`;

  return (
    <animated.div style={{ ...spring, transformOrigin: bubbleOrigin(isMe) }} className={rowSpacing}>
      <Message align={isMe ? "end" : "start"} className="gap-2.5">
        {/* avatar só na última do bloco (as outras mantêm o espaço, o texto fica alinhado) */}
        <MessageAvatar className="h-7 w-7 min-w-7 translate-y-0! bg-transparent">
          {endsGroup ? (
            <ChatAvatar
              avatarUrl={isMe ? selfAvatarUrl : friend.avatar}
              name={isMe ? "Você" : friend.name}
              sizeClassName="h-full w-full"
              iconClassName="h-3.5 w-3.5"
              className="ring-1 ring-white/10"
            />
          ) : null}
        </MessageAvatar>

        <MessageContent className="max-w-[74%] gap-0.5">
          {!isMe && startsGroup ? (
            <div className="px-1 pb-0.5 text-[11px] font-medium text-white/40">{friend.name}</div>
          ) : null}

          <div className={`group/bubble relative flex items-center gap-1.5 ${isMe ? "flex-row-reverse" : ""}`}>
            <Bubble
              align={isMe ? "end" : "start"}
              variant={isMe ? "default" : "outline"}
              className={`${radius} border-0 ${isMe ? "bg-white text-black" : "bg-white/[0.08] text-white"}`}
            >
              <BubbleContent className="px-3.5 py-2 text-[14px]">
                {replyPreview ? (
                  <p className={`mb-1.5 border-l-2 pl-2 text-[11.5px] ${isMe ? "border-black/25 text-black/55" : "border-white/30 text-white/55"}`}>
                    {replyPreview}
                  </p>
                ) : null}
                {deleted ? (
                  <p className="italic opacity-55">Mensagem apagada</p>
                ) : msg.text ? (
                  <p className="select-text cursor-text font-sans leading-[1.45] wrap-break-words selection:bg-black/20">
                    {renderMessageText(msg.text)}
                  </p>
                ) : null}

                {visibleImages.length > 0 && (
                  <div
                    className={`grid gap-2 ${visibleImages.length === 1 ? "grid-cols-1" : "grid-cols-2"} ${msg.text ? "mt-2" : ""}`}
                  >
                    {visibleImages.map((imageUrl, imgIdx) => (
                      <button
                        key={`${imageUrl}-${imgIdx}`}
                        type="button"
                        onClick={() => {
                          playSound("select");
                          onViewImage({ url: imageUrl, text: msg.text, createdAt: msg.createdAt });
                        }}
                        className="group/img relative overflow-hidden rounded-xl bg-black/30 text-left transition-transform hover:scale-[1.01] active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                      >
                        <img src={imageUrl} alt="Imagem enviada no chat" loading="lazy" className="max-h-64 w-full rounded-xl object-cover" />
                        <span className="pointer-events-none absolute inset-0 bg-black/0 transition-colors group-hover/img:bg-black/15" />
                      </button>
                    ))}
                  </div>
                )}
              </BubbleContent>
            </Bubble>

            {/* ações: aparecem ao passar o mouse / focar, sem poluir a conversa */}
            {!deleted && (onReply || onReact || (isMe && (onEdit || onDelete))) ? (
              <div
                className="flex shrink-0 items-center rounded-full border border-white/10 bg-[#161618]/95 p-0.5 opacity-0 shadow-lg backdrop-blur transition-opacity duration-150 group-hover/bubble:opacity-100 group-focus-within/bubble:opacity-100"
                role="toolbar"
                aria-label="Ações da mensagem"
              >
                {onReply ? (
                  <button type="button" className={ACTION_BTN} onClick={() => onReply(msg)} title="Responder" aria-label="Responder">
                    <Reply className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {onReact ? (
                  <button type="button" className={`${ACTION_BTN} text-[13px]`} onClick={() => onReact(msg)} title="Curtir" aria-label="Curtir">
                    👍
                  </button>
                ) : null}
                {isMe && onEdit ? (
                  <button type="button" className={ACTION_BTN} onClick={() => onEdit(msg)} title="Editar" aria-label="Editar">
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                ) : null}
                {isMe && onDelete ? (
                  <button type="button" className={`${ACTION_BTN} hover:text-red-300`} onClick={() => onDelete(msg)} title="Apagar" aria-label="Apagar">
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>

          {reactions.length > 0 ? (
            <div className={`flex flex-wrap gap-1 px-1 ${isMe ? "justify-end" : "justify-start"}`}>
              {reactions.map(([emoji, users]) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => onReact?.(msg)}
                  className="rounded-full bg-white/[0.08] px-2 py-0.5 text-[11px] text-white/80 transition-colors hover:bg-white/[0.14]"
                >
                  {emoji} {users.length}
                </button>
              ))}
            </div>
          ) : null}

          {endsGroup ? (
            <MessageFooter className={`gap-1.5 px-1 pt-0.5 text-[10.5px] text-white/32 ${isMe ? "justify-end" : "justify-start"}`}>
              {msg.editedAt && !deleted ? <span>editada ·</span> : null}
              {isMe ? (
                <span>{msg.id?.startsWith("local-") ? "Enviando…" : msg.read ? "Lida" : "Enviada"}</span>
              ) : (
                <span>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              )}
            </MessageFooter>
          ) : null}
        </MessageContent>
      </Message>
    </animated.div>
  );
};

export const ChatMessageList: React.FC<{
  isLoading: boolean;
  loadError: string | null;
  onRetryLoad: () => void;
  messages: ChatMessage[];
  friendUid: string | null;
  friend: SocialFriend;
  selfAvatarUrl?: string | null;
  friendTyping: boolean;
  onViewImage: (image: ViewingImage) => void;
  onJoinCall: (invite: CallInviteMeta, password?: string) => void;
  playSound: (type: SoundEffectType) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
  onReply?: (message: ChatMessage) => void;
  onEdit?: (message: ChatMessage) => void;
  onDelete?: (message: ChatMessage) => void;
  onReact?: (message: ChatMessage) => void;
}> = ({
  isLoading,
  loadError,
  onRetryLoad,
  messages,
  friendUid,
  friend,
  selfAvatarUrl,
  friendTyping,
  onViewImage,
  onJoinCall,
  playSound,
  messagesEndRef,
  onReply,
  onEdit,
  onDelete,
  onReact,
}) => {
  // Mensagens que já estavam na conversa ao abrir não animam; só as que chegam depois.
  const seenKeys = React.useRef<Set<string> | null>(null);
  const recentSignatures = React.useRef<Map<string, number>>(new Map());
  if (!isLoading && seenKeys.current === null) {
    seenKeys.current = new Set(messages.map((m) => m.id || ""));
    for (const m of messages) recentSignatures.current.set(messageSignature(m), 0);
  }
  const shouldAnimate = (m: ChatMessage): boolean => {
    const seen = seenKeys.current;
    if (!seen) return false;
    const key = m.id || "";
    if (seen.has(key)) return false;
    // o mesmo balão que ganhou o id real do servidor (era "local-…") não anima de novo
    const sig = messageSignature(m);
    const at = recentSignatures.current.get(sig);
    seen.add(key);
    if (at !== undefined && Date.now() - at < 15_000) return false;
    recentSignatures.current.set(sig, Date.now());
    return true;
  };

  return (
  <div className="chat-scrollbar flex-1 overflow-y-auto px-7 py-5 pr-4 md:px-9">
    {isLoading ? (
      <div className="flex flex-1 min-h-65 flex-col items-center justify-center space-y-3 py-16 text-center">
        <LoadingState label="Carregando conversa..." variant="searching" size="md" showTimer={false} />
      </div>
    ) : loadError ? (
      <div className="flex flex-1 min-h-65 flex-col items-center justify-center space-y-4 py-16 text-center">
        <MessageSquare className="h-6 w-6 text-amber-400/80" />
        <p className="max-w-sm text-sm text-white/70">{loadError}</p>
        <motion.button
          type="button"
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          onClick={onRetryLoad}
          className="rounded-md border border-white/15 bg-white/8 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-white transition-colors hover:bg-white/12"
        >
          Tentar novamente
        </motion.button>
      </div>
    ) : messages.length === 0 ? (
      <div className="flex flex-col items-center justify-center space-y-2 pb-8 text-center text-white/20">
        <MessageSquare className="h-6 w-6" />
        <p className="text-xs uppercase tracking-wider">Nenhuma mensagem ainda</p>
      </div>
    ) : (
      <MessageGroup className="gap-0">
        {messages.map((msg, index) => {
          const { startsGroup, endsGroup } = groupInfo(
            messages.map((x) => ({ senderId: x.senderId, createdAt: x.createdAt })),
            index,
          );
          const isMe = msg.senderId !== friendUid;
          const messageDate = new Date(msg.createdAt);
          const previousDate = index > 0 ? new Date(messages[index - 1].createdAt) : null;
          const showDaySeparator =
            index === 0 || !previousDate || !isSameDay(messageDate, previousDate);
          const animateIn = shouldAnimate(msg);

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
                startsGroup={startsGroup || showDaySeparator}
                endsGroup={endsGroup}
                animateIn={animateIn}
                onViewImage={onViewImage}
                onJoinCall={onJoinCall}
                playSound={playSound}
                replyPreview={messages.find((item) => item.id === msg.replyToId)?.text}
                onReply={onReply}
                onEdit={onEdit}
                onDelete={onDelete}
                onReact={onReact}
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
};

/** Botão de enviar: acorda com uma mola quando há o que enviar e "afunda" ao apertar. */
const SendButton: React.FC<{ disabled: boolean }> = ({ disabled }) => {
  const style = useSpring({
    scale: disabled ? 0.86 : 1,
    opacity: disabled ? 0.38 : 1,
    config: SPRINGS.snappy,
  });
  return (
    <animated.button
      type="submit"
      disabled={disabled}
      style={style}
      aria-label="Enviar mensagem"
      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-black transition-[filter] enabled:cursor-pointer enabled:hover:brightness-95 enabled:active:scale-90 disabled:cursor-not-allowed"
    >
      <Send className="h-4 w-4" />
    </animated.button>
  );
};

export const ChatComposer: React.FC<{
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
  contextLabel?: string | null;
  onClearContext?: () => void;
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
  contextLabel,
  onClearContext,
}) => {
    const isSpamLocked = Boolean(spamLockedUntil && spamLockedUntil > Date.now());

    return (
      <form onSubmit={onSubmit} className="shrink-0 border-t border-white/[0.06] bg-[#0a0a0b]/90 px-5 py-3.5 backdrop-blur-xl md:px-7">
        {isSpamLocked ? (
          <p className="mb-2 px-1 text-[12px] font-medium text-amber-300/90" role="status">
            Calma, você está enviando rápido demais.
          </p>
        ) : null}

        {contextLabel ? (
          <div className="mb-2 flex items-center justify-between rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-[11px] text-white/70">
            <span className="truncate">{contextLabel}</span>
            <button type="button" onClick={onClearContext} className="ml-3 text-white/40 hover:text-white">fechar</button>
          </div>
        ) : null}

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

        <div className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.05] p-1.5 transition-colors focus-within:border-white/25 focus-within:bg-white/[0.07]">
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
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ImagePlus className="h-4 w-4" />
          </motion.button>
          <input
            type="text"
            value={inputText}
            disabled={isSendingImage}
            onChange={(e) => onChangeInputText(e.target.value)}
            onPaste={onPasteImage}
            placeholder={pendingImage ? "Adicionar uma legenda (opcional)" : "Mensagem"}
            className="h-9 flex-1 rounded-full border-0 bg-transparent px-3 text-[13px] text-white placeholder-white/30 outline-none ring-0 focus:outline-none focus:ring-0 disabled:cursor-wait"
          />
          <SendButton disabled={isSendingImage || (!inputText.trim() && !pendingImage) || isSpamLocked} />
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
    const { joinActiveCall } = useVoiceCallContext();

    const [displayMessages, setDisplayMessages] = useState<ChatMessage[]>([]);
    const [isLoadingMessages, setIsLoadingMessages] = useState(true);
    const [chatLoadError, setChatLoadError] = useState<string | null>(null);
    const [chatRetryToken, setChatRetryToken] = useState(0);
    const optimisticRef = useRef<Map<string, ChatMessage>>(new Map());
    const [inputText, setInputText] = useState("");
    const [replyTarget, setReplyTarget] = useState<ChatMessage | null>(null);
    const [editingMessage, setEditingMessage] = useState<ChatMessage | null>(null);
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
    const chatSubscriptionKeyRef = useRef<string>("");
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
        setChatLoadError(null);
        recentSendTimestampsRef.current = [];
        lastTypingSentRef.current = false;
        friendUidRef.current = null;
        chatSubscriptionKeyRef.current = "";
        pendingSnapshotRef.current = null;
        return;
      }

      const subscriptionKey = `${friendUid}:${chatRetryToken}`;
      if (chatSubscriptionKeyRef.current === subscriptionKey) return;
      chatSubscriptionKeyRef.current = subscriptionKey;
      friendUidRef.current = friendUid;
      setIsLoadingMessages(true);
      setChatLoadError(null);

      void cleanupExpiredChatMessages(friendUid).catch(() => undefined);
      void markMessagesAsRead(friendUid);

      let messagesInitialized = false;
      let knownServerMessageIds = new Set<string>();

      const unsubscribeMessages = subscribeToChatMessages(
        friendUid,
        (serverMsgs) => {
        setIsLoadingMessages(false);
        setChatLoadError(null);
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
      },
        (error) => {
          setIsLoadingMessages(false);
          setChatLoadError(error.message || "Nao foi possivel carregar a conversa.");
        },
      );

      const unsubscribeTyping = subscribeToFriendTyping(friendUid, (typing) => {
        setFriendTyping(typing);
      });

      return () => {
        void setChatTyping(friendUid, false);
        unsubscribeMessages();
        unsubscribeTyping();
        chatSubscriptionKeyRef.current = "";
        friendUidRef.current = null;
        pendingSnapshotRef.current = null;
      };
    }, [chatRetryToken, detachPendingImage, isOpen, friendUid, playSound]);

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

      if (editingMessage) {
        try {
          const updated = await editChatMessage(editingMessage, text);
          setDisplayMessages((current) => current.map((item) => (item.id === updated.id ? updated : item)));
          setEditingMessage(null);
          setInputText("");
        } catch (error) {
          notify(error instanceof Error ? error.message : "Não foi possível editar a mensagem.", "error");
        }
        return;
      }

      try {
        playSound("chatSent");
        const mentions = friendUid && friend.name && new RegExp(`@${friend.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`, "i").test(text)
          ? [friendUid]
          : undefined;
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
          replyToId: replyTarget?.id,
          mentions,
        };

        recentSendTimestampsRef.current = [...freshTimestamps, now];
        optimisticRef.current.set(optimisticId, optimisticMessage);
        setDisplayMessages((current) => [...current, optimisticMessage].sort(compareChatMessages));
        setInputText("");
        setReplyTarget(null);
        if (imageDraft) {
          pendingImageRef.current = null;
          setPendingImage(null);
          setIsSendingImage(true);
        }
        lastTypingSentRef.current = false;
        void setChatTyping(friendUid, false);
        const confirmedMessage = imageDraft
          ? await sendChatImage(friendUid, imageDraft.file, text)
          : await sendChatMessage(friendUid, text, undefined, {
              replyToId: replyTarget?.id,
              mentions,
            });
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

    const handleJoinCallFromInvite = (invite: CallInviteMeta, password?: string) => {
      onClose();
      void joinActiveCall(invite, password);
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
        className="t-modal-panel overflow-hidden rounded-[26px] border border-white/10 bg-black p-0"
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
            loadError={chatLoadError}
            onRetryLoad={() => {
              playSound("select");
              setChatRetryToken((current) => current + 1);
            }}
            messages={displayMessages}
            friendUid={friendUid}
            friend={friend}
            selfAvatarUrl={selfAvatarUrl}
            friendTyping={friendTyping}
            onViewImage={setViewingImage}
            onJoinCall={handleJoinCallFromInvite}
            playSound={playSound}
            messagesEndRef={messagesEndRef}
            onReply={(message) => {
              setEditingMessage(null);
              setReplyTarget(message);
            }}
            onEdit={(message) => {
              setReplyTarget(null);
              setEditingMessage(message);
              setInputText(message.text);
            }}
            onDelete={(message) => {
              void deleteChatMessage(message)
                .then((updated) => setDisplayMessages((current) => current.map((item) => (item.id === updated.id ? updated : item))))
                .catch((error) => notify(error instanceof Error ? error.message : "Não foi possível apagar a mensagem.", "error"));
            }}
            onReact={(message) => {
              if (!user?.uid) return;
              void toggleChatReaction(message, "👍", user.uid)
                .then((updated) => setDisplayMessages((current) => current.map((item) => (item.id === updated.id ? updated : item))))
                .catch((error) => notify(error instanceof Error ? error.message : "Não foi possível reagir.", "error"));
            }}
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
            contextLabel={
              editingMessage
                ? "Editando mensagem"
                : replyTarget
                  ? `Respondendo: ${replyTarget.deletedAt ? "Mensagem apagada" : replyTarget.text}`
                  : null
            }
            onClearContext={() => {
              setReplyTarget(null);
              setEditingMessage(null);
            }}
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