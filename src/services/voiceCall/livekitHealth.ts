/**
 * Saúde da conexão com o servidor de voz (LiveKit) durante a chamada.
 *
 * Antes, a sala só reagia a faixas e participantes: uma queda de rede no meio da chamada não aparecia na interface e, se o SDK
 * desistisse de reconectar, a chamada ficava "ativa" sem som. Aqui ficam as decisões puras (testadas); `useVoiceCall` só liga
 * os eventos `Reconnecting`, `Reconnected`, `ConnectionQualityChanged` e `Disconnected` a elas.
 */

export type LinkQuality = "excellent" | "good" | "poor" | "lost" | "unknown";

/** Normaliza o valor do LiveKit (string do enum `ConnectionQuality`). Qualquer outra coisa é "unknown". */
export function toLinkQuality(raw: unknown): LinkQuality {
  return raw === "excellent" || raw === "good" || raw === "poor" || raw === "lost" ? raw : "unknown";
}

/** O aviso de "conexão ruim" aparece para qualidade ruim ou perdida; "unknown" nunca avisa (ainda não mediu). */
export function isPoorLink(quality: LinkQuality): boolean {
  return quality === "poor" || quality === "lost";
}

// Valores do `DisconnectReason` do protocolo do LiveKit (@livekit/protocol).
const REASON_CLIENT_INITIATED = 1;
const REASON_DUPLICATE_IDENTITY = 2;
const REASON_SERVER_SHUTDOWN = 3;
const REASON_PARTICIPANT_REMOVED = 4;
const REASON_ROOM_DELETED = 5;
const REASON_ROOM_CLOSED = 10;

export type DisconnectPlan = { action: "ignore" } | { action: "end-call"; message: string };

/**
 * Decide o que fazer quando a sala desconecta. `CLIENT_INITIATED` é o próprio app desligando (desligar, trocar de sala): ignora.
 * Qualquer outro motivo encerra a chamada com uma mensagem clara, em vez de deixá-la "ativa" sem som.
 */
export function planOnDisconnect(reason: number | undefined): DisconnectPlan {
  switch (reason) {
    case REASON_CLIENT_INITIATED:
      return { action: "ignore" };
    case REASON_DUPLICATE_IDENTITY:
      return { action: "end-call", message: "Você entrou nesta chamada em outro lugar." };
    case REASON_SERVER_SHUTDOWN:
      return { action: "end-call", message: "O servidor de voz foi reiniciado. Entre na chamada de novo." };
    case REASON_PARTICIPANT_REMOVED:
      return { action: "end-call", message: "Você foi removido da chamada." };
    case REASON_ROOM_DELETED:
    case REASON_ROOM_CLOSED:
      return { action: "end-call", message: "A chamada foi encerrada." };
    default:
      return { action: "end-call", message: "A conexão com o servidor de voz foi perdida." };
  }
}
