import { isFlagOn } from "../../lib/featureFlags";

export type VoiceTransportContext = "start-call" | "answer-call" | "join-room" | "join-invite";

export const isLiveKitGloballyDisabled = (error: unknown): boolean => {
  const msg = String((error as Error)?.message ?? error ?? "").toLowerCase();
  return (
    msg.includes("não habilitado") ||
    msg.includes("nao habilitado") ||
    msg.includes("disabled") ||
    msg.includes("livekit não habilitado")
  );
};

/** Flag `pherielium_p2p_fallback` (padrão DESLIGADA): permite cair para P2P quando o LiveKit falha para UM lado. */
export const isP2pFallbackFlagOn = (): boolean => isFlagOn("p2p_fallback", false);

/**
 * Quando o LiveKit não conecta, só se usa P2P em dois casos:
 *  1. o backend declarou o LiveKit **desligado** (`disabled`): os dois lados recebem a mesma resposta, então ficam no mesmo transporte;
 *  2. a flag manual `pherielium_p2p_fallback` está ligada (desligada por padrão; o código P2P continua no app).
 *
 * Falha individual (token, rede, timeout) **não** troca de transporte em silêncio: antes, quem ligava caía para P2P enquanto
 * quem atendia seguia no SFU, e os dois nunca se encontravam. Agora a chamada tenta de novo e, se esgotar, termina com motivo
 * claro (ver livekitConnectPolicy.ts). Decisão em docs/decisions/0006-chamada-sem-fallback-p2p-silencioso.md.
 *
 * `context` fica na assinatura porque os quatro pontos de entrada o informam; a política hoje vale igual para todos.
 */
export const shouldUseP2PFallback = (
  _context: VoiceTransportContext,
  livekitError?: unknown,
  options: { p2pFlag?: boolean } = {},
): boolean => {
  if (isLiveKitGloballyDisabled(livekitError)) return true;
  return options.p2pFlag ?? isP2pFallbackFlagOn();
};
