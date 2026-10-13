/**
 * Texto de pré-visualização de uma mensagem para notificações (notch, toast, sistema).
 * O convite de canal viaja como mensagem de chat com JSON (`{"__type":"call_invite",...}`); sem este tratamento a notificação
 * mostraria o JSON cru.
 */
const CALL_INVITE_PREFIX = '{"__type":"call_invite"';

export const isCallInviteText = (text: unknown): boolean => typeof text === "string" && text.startsWith(CALL_INVITE_PREFIX);

export function messageNotificationPreview(text: string, isImage: boolean): string {
  if (isImage) return "📷 Enviou uma imagem";
  if (isCallInviteText(text)) return "📞 Convidou você para uma call";
  return text;
}
