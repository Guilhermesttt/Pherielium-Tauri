/**
 * Texto de pré-visualização de uma mensagem para notificações (notch, toast, sistema).
 * O convite de canal viaja como mensagem de chat com JSON (`{"__type":"call_invite",...}`); sem este tratamento a notificação
 * mostraria o JSON cru.
 */
const CALL_INVITE_PREFIX = '{"__type":"call_invite"';

export const isCallInviteText = (text: unknown): boolean => typeof text === "string" && text.startsWith(CALL_INVITE_PREFIX);

/** Nome de quem convidou, lido do JSON do cartão; vazio se o JSON não puder ser lido. */
function inviterNameOf(text: string): string {
  try {
    const name = (JSON.parse(text) as { callerName?: unknown }).callerName;
    return typeof name === "string" ? name.trim() : "";
  } catch {
    return "";
  }
}

/** `fallbackName` (nome do amigo na lista) é usado quando o cartão não traz `callerName`. */
export function messageNotificationPreview(text: string, isImage: boolean, fallbackName = ""): string {
  if (isImage) return "📷 Enviou uma imagem";
  if (isCallInviteText(text)) {
    const who = inviterNameOf(text) || fallbackName.trim();
    return who ? `${who} convidou para uma chamada.` : "Convidou para uma chamada.";
  }
  return text;
}

/** Cartão de convite da ligação 1:1 (a conversa 1:1 é a própria sala). Mesmo formato do convite de canal, mais `callerId`. */
export function buildOneOnOneInviteCardText(input: {
  chatId: string;
  callerId: string;
  callerName: string;
  callerAvatar?: string | null;
  nowMs: number;
}): string {
  return JSON.stringify({
    __type: "call_invite",
    chatId: input.chatId,
    roomName: `Call de ${input.callerName}`,
    category: "casual_chat",
    callerId: input.callerId,
    callerName: input.callerName,
    callerAvatar: input.callerAvatar ?? null,
    isPrivate: false,
    createdAt: input.nowMs,
  });
}

/** O cartão aponta para esta conversa? (a notificação do convite ao vivo já cobre esse caso; evita avisar duas vezes). */
export function isInviteCardForChat(text: string, chatId: string): boolean {
  if (!isCallInviteText(text)) return false;
  try {
    return (JSON.parse(text) as { chatId?: unknown }).chatId === chatId;
  } catch {
    return false;
  }
}
