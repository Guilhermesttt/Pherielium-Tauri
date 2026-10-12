/**
 * Quem toca o áudio de um feed remoto: invariante "no máximo UM elemento audível por trilha".
 *
 * Com LiveKit, o áudio remoto toca num `<audio>` criado por `track.attach()` (volume, mute independente e `setSinkId` controlados
 * pelo app). Os mesmos MediaStreams alimentam os `<video>` da interface (palco da transmissão, câmera, miniaturas, tela cheia),
 * que por padrão tocam as trilhas de áudio do stream por conta própria, em volume 1,0 e fora do slider. Resultado: o slider
 * "não silenciava" e a voz de quem liga a câmera tocava em dobro (docs/backend-audit/09-v-volume-transmissao.md).
 *
 * Regra: sob transporte LiveKit **todo `<video>` fica mutado**; o `<audio>` do `attach()` é o único audível.
 * Também fica mutado com transporte `none` (a janela abre e as primeiras trilhas chegam antes de o transporte ser marcado como LiveKit;
 * P2P e eco marcam o transporte antes de criar qualquer stream, então não dependem do `<video>` nesse intervalo).
 * Em P2P (flag manual) e no eco local o comportamento anterior continua: o `<video>` toca o áudio do stream, porque ali não existe
 * o `<audio>` do LiveKit. Nesses modos a saída de áudio escolhida (`setSinkId`) não vale para o `<video>` (limitação conhecida).
 */

export type MediaTransport = "none" | "livekit" | "p2p" | "echo";

/** O `<video>` deve ficar mutado? `requestedMuted` é o que o chamador pediu (feed local, miniatura...). */
export function effectiveVideoMuted(requestedMuted: boolean, transport: MediaTransport): boolean {
  return requestedMuted || (transport !== "p2p" && transport !== "echo");
}

/** Saída de áudio desejada para `setSinkId`: "default"/vazio = padrão do sistema (string vazia). */
export function desiredSinkId(selected: string | null | undefined): string {
  return !selected || selected === "default" ? "" : selected;
}

type SinkCapableElement = {
  sinkId?: string;
  setSinkId?: (sinkId: string) => Promise<void>;
};

/**
 * Aplica a saída escolhida ao elemento audível. Só chama `setSinkId` quando a saída muda; **inclusive para voltar ao padrão**
 * (antes, escolher "default" depois de um dispositivo não revertia o elemento).
 */
export function applySinkId(element: SinkCapableElement, selected: string | null | undefined): void {
  if (typeof element.setSinkId !== "function") return;
  const wanted = desiredSinkId(selected);
  if ((element.sinkId ?? "") === wanted) return;
  element.setSinkId(wanted).catch((error: unknown) => {
    console.warn("[feedAudioPolicy] setSinkId falhou:", error);
  });
}
