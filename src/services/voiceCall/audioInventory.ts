/**
 * Inventário de reprodução de áudio da chamada (diagnóstico do volume da transmissão).
 *
 * Responde, com dados do runtime, às perguntas: quantos elementos tocam a mesma trilha? o <video> da transmissão está mutado?
 * quais publicações de áudio o espectador recebe, e de qual source? o Room usa webAudioMix?
 * Só observa: não altera volume, mute nem elementos. A coleta (DOM/LiveKit) fica no hook; aqui há só a análise e o texto.
 *
 * Gerar:  await window.pherieliumAudioInventory()   (precisa de pherielium_stream_debug=1)
 */

export interface ElementInfo {
  tag: "audio" | "video";
  /** `livekit` = criado por `track.attach()`; `dom` = presente na árvore da página. */
  origin: "livekit" | "dom";
  /** Rótulo legível (peer, source) quando conhecido. */
  label: string;
  volume: number;
  muted: boolean;
  paused: boolean;
  audioTrackIds: string[];
  videoTrackCount: number;
}

export interface PublicationInfo {
  scope: "remote" | "local";
  /** 4 primeiros caracteres da identidade. */
  identity: string;
  source: string;
  kind: string;
  trackSid: string;
  subscribed: boolean;
  muted: boolean;
}

export interface InventoryInput {
  elements: ElementInfo[];
  publications: PublicationInfo[];
  roomOptions: { webAudioMix: string; adaptiveStream: string };
  /** Volumes salvos por chave (`voice:<uid>` / `screen:<uid>`), só os números. */
  storedVolumes: Record<string, number>;
}

export const shortId = (value: string): string => (value ? value.slice(0, 4) : "?");

/** Descreve um elemento de mídia sem depender de tipos do DOM além do necessário (facilita testar). */
export function describeElement(
  el: {
    tagName: string;
    volume: number;
    muted: boolean;
    paused: boolean;
    srcObject?: unknown;
  },
  origin: ElementInfo["origin"],
  label: string,
): ElementInfo {
  const stream = el.srcObject as { getAudioTracks?: () => Array<{ id: string }>; getVideoTracks?: () => unknown[] } | null | undefined;
  return {
    tag: el.tagName.toLowerCase() === "video" ? "video" : "audio",
    origin,
    label,
    volume: Number(el.volume.toFixed(3)),
    muted: el.muted,
    paused: el.paused,
    audioTrackIds: stream?.getAudioTracks ? stream.getAudioTracks().map((t) => t.id) : [],
    videoTrackCount: stream?.getVideoTracks ? stream.getVideoTracks().length : 0,
  };
}

export interface DoublePlayback {
  trackId: string;
  /** Elementos que tocam a trilha de forma audível (não mutados e com volume > 0). */
  elements: string[];
}

/**
 * Trilhas de áudio que tocam em MAIS DE UM elemento ao mesmo tempo. É o sintoma de um slider "que não silencia": o controle de volume
 * age num elemento e o outro continua em volume cheio.
 */
export function findDoublePlayback(elements: ElementInfo[]): DoublePlayback[] {
  const byTrack = new Map<string, string[]>();
  for (const el of elements) {
    if (el.muted || el.paused || el.volume <= 0) continue;
    for (const id of el.audioTrackIds) {
      const list = byTrack.get(id) ?? [];
      list.push(`${el.origin}:${el.tag} "${el.label}" vol=${el.volume}`);
      byTrack.set(id, list);
    }
  }
  return Array.from(byTrack.entries())
    .filter(([, list]) => list.length > 1)
    .map(([trackId, list]) => ({ trackId, elements: list }));
}

/** Texto compacto para colar numa conversa. */
export function formatInventory(input: InventoryInput, appVersion: string): string {
  const lines: string[] = [];
  lines.push("=== Pherielium audio inventory ===");
  lines.push(`app=${appVersion} room.webAudioMix=${input.roomOptions.webAudioMix} room.adaptiveStream=${input.roomOptions.adaptiveStream}`);

  const remoteAudio = input.publications.filter((p) => p.scope === "remote" && p.kind === "audio");
  lines.push(`--- publicações de áudio recebidas: ${remoteAudio.length} ---`);
  for (const p of remoteAudio) {
    lines.push(`remote ${p.identity} source=${p.source} sid=${p.trackSid.slice(0, 8)} subscribed=${p.subscribed} muted=${p.muted}`);
  }
  const localAudio = input.publications.filter((p) => p.scope === "local" && p.kind === "audio");
  lines.push(`--- publicações de áudio enviadas: ${localAudio.length} ---`);
  for (const p of localAudio) lines.push(`local source=${p.source} sid=${p.trackSid.slice(0, 8)} muted=${p.muted}`);

  lines.push(`--- elementos de mídia: ${input.elements.length} ---`);
  for (const el of input.elements) {
    lines.push(
      `${el.origin}:${el.tag} "${el.label}" vol=${el.volume} muted=${el.muted} paused=${el.paused} audioTracks=${el.audioTrackIds.length} videoTracks=${el.videoTrackCount}`,
    );
  }

  const doubles = findDoublePlayback(input.elements);
  lines.push("--- trilhas tocando em mais de um elemento ---");
  if (doubles.length === 0) lines.push("(nenhuma)");
  for (const d of doubles) lines.push(`ATENÇÃO trilha ${d.trackId.slice(0, 8)} em ${d.elements.length} elementos: ${d.elements.join(" | ")}`);

  lines.push("--- volumes salvos (%) ---");
  const stored = Object.entries(input.storedVolumes);
  if (stored.length === 0) lines.push("(nenhum)");
  for (const [key, value] of stored) lines.push(`${key.replace(/:(.{4}).*/, ":$1")}=${value}`);
  return lines.join("\n");
}
