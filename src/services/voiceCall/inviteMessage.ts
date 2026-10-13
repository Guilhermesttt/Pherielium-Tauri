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
