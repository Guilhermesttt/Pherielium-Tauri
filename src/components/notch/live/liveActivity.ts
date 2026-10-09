/**
 * Atividades vivas do notch (ilha dinâmica): o que ocupa a barra agora, por prioridade, e a
 * largura de cada uma. Puro, para testar a ordem sem montar o componente.
 */
export type LiveKind = "call-incoming" | "call" | "event" | "controller" | "game" | "music" | "idle";

export interface LiveState {
  incomingCall: boolean;
  callActive: boolean;
  /** conquista, mensagem, pedido de amizade, captura salva... */
  event: boolean;
  /** aviso de controle (conectou, bateria baixa...) */
  controllerFlash: boolean;
  gameActive: boolean;
  musicPlaying: boolean;
}

/** Chamada manda em tudo; depois avisos efêmeros; depois o que dura (jogo, música). */
export function resolveLiveActivity(s: LiveState): LiveKind {
  if (s.incomingCall) return "call-incoming";
  if (s.controllerFlash) return "controller";
  if (s.event) return "event";
  if (s.callActive) return "call";
  if (s.gameActive) return "game";
  if (s.musicPlaying) return "music";
  return "idle";
}

/** Largura da barra compacta de cada atividade (px). */
export const LIVE_WIDTH: Record<LiveKind, number> = {
  "call-incoming": 392,
  call: 368,
  event: 344,
  controller: 320,
  game: 284,
  music: 256,
  idle: 216,
};
