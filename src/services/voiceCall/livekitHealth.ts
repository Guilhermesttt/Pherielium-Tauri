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

/** Como mostrar a qualidade de um participante: só "ruim" e "perdida" aparecem; o resto fica discreto (só no tooltip). */
export function linkQualityPresentation(quality: LinkQuality): { show: boolean; tone: "warn" | "bad" | "none"; label: string } {
  switch (quality) {
    case "poor":
      return { show: true, tone: "warn", label: "Conexão ruim" };
    case "lost":
      return { show: true, tone: "bad", label: "Sem conexão" };
    case "excellent":
      return { show: false, tone: "none", label: "Conexão excelente" };
    case "good":
      return { show: false, tone: "none", label: "Conexão boa" };
    default:
      return { show: false, tone: "none", label: "Conexão ainda não medida" };
  }
}

// Valores do `DisconnectReason` do protocolo do LiveKit (@livekit/protocol).
const REASON_CLIENT_INITIATED = 1;
const REASON_DUPLICATE_IDENTITY = 2;
const REASON_SERVER_SHUTDOWN = 3;
const REASON_PARTICIPANT_REMOVED = 4;
const REASON_ROOM_DELETED = 5;
const REASON_ROOM_CLOSED = 10;

/** Esperas (ms) antes de cada tentativa de religar a sala depois de uma queda definitiva: 2 s, 5 s e 10 s. */
export const REJOIN_DELAYS_MS: readonly number[] = [2000, 5000, 10000];

export type DisconnectPlan =
  | { action: "ignore" }
  /** Queda por rede ou servidor: tenta religar sozinho; se todas falharem, encerra com `message`. */
  | { action: "rejoin"; delaysMs: readonly number[]; message: string }
  /** O servidor tirou você de propósito (removido, sala fechada, outro dispositivo): não adianta religar. */
  | { action: "end-call"; message: string };

/**
 * Decide o que fazer quando a sala desconecta. `CLIENT_INITIATED` é o próprio app desligando (desligar, trocar de sala): ignora.
 * Motivos em que o servidor encerrou de propósito terminam a chamada com mensagem específica; os demais (rede, servidor
 * reiniciando, motivo desconhecido) tentam religar sozinhos, como o Discord faz.
 */
export function planOnDisconnect(reason: number | undefined): DisconnectPlan {
  switch (reason) {
    case REASON_CLIENT_INITIATED:
      return { action: "ignore" };
    case REASON_DUPLICATE_IDENTITY:
      return { action: "end-call", message: "Você entrou nesta chamada em outro lugar." };
    case REASON_PARTICIPANT_REMOVED:
      return { action: "end-call", message: "Você foi removido da chamada." };
    case REASON_ROOM_DELETED:
    case REASON_ROOM_CLOSED:
      return { action: "end-call", message: "A chamada foi encerrada." };
    case REASON_SERVER_SHUTDOWN:
      return { action: "rejoin", delaysMs: REJOIN_DELAYS_MS, message: "O servidor de voz foi reiniciado. Entre na chamada de novo." };
    default:
      return { action: "rejoin", delaysMs: REJOIN_DELAYS_MS, message: "A conexão com o servidor de voz foi perdida." };
  }
}
