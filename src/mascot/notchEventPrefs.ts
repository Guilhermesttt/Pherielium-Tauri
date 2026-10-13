/**
 * Preferências dos avisos do notch: quais tipos de aviso aparecem e por quanto tempo ficam na tela.
 *
 * Só avisos **informativos** podem ser silenciados. Mensagens, pedidos de amizade e conquistas ficam de fora de propósito: com
 * o notch ligado, o hub deixa de mostrar o toast desses avisos (o notch os cobre), então silenciá-los no notch os faria sumir.
 */

export const MUTABLE_NOTCH_EVENT_KINDS = ["friend-online", "friend-playing", "capture-saved", "welcome", "level-up"] as const;
export type MutableNotchEventKind = (typeof MUTABLE_NOTCH_EVENT_KINDS)[number];

export const MUTABLE_NOTCH_EVENT_LABELS: Record<MutableNotchEventKind, { title: string; description: string }> = {
  "friend-online": { title: "Amigo ficou online", description: "Aviso curto quando um amigo entra." },
  "friend-playing": { title: "Amigo começou a jogar", description: "Mostra o jogo que ele abriu." },
  "capture-saved": { title: "Captura salva", description: "Confirma screenshots e gravações." },
  welcome: { title: "Boas-vindas ao abrir um jogo", description: "A Pherie acena quando um jogo inicia." },
  "level-up": { title: "Subiu de nível", description: "Aviso de novo nível e rank." },
};

/** Fator de duração dos avisos: 0,5x (mais rápido) a 2x (mais tempo para ler). */
export const EVENT_DURATION_SCALE_RANGE = { min: 0.5, max: 2 } as const;
export const DEFAULT_EVENT_DURATION_SCALE = 1;

const MUTABLE = new Set<string>(MUTABLE_NOTCH_EVENT_KINDS);

export const isMutableNotchEventKind = (kind: string): kind is MutableNotchEventKind => MUTABLE.has(kind);

/** O aviso deve ser escondido? Só tipos silenciáveis, e só se o usuário os silenciou. */
export function isNotchEventMuted(kind: string, muted: readonly string[]): boolean {
  return isMutableNotchEventKind(kind) && muted.includes(kind);
}

/** Duração em ms com o fator do usuário aplicado (fator inválido vale 1; limitado a 0,5x–2x). */
export function scaledNotchEventDuration(baseMs: number, scale: number): number {
  const s = Number.isFinite(scale) ? Math.min(EVENT_DURATION_SCALE_RANGE.max, Math.max(EVENT_DURATION_SCALE_RANGE.min, scale)) : 1;
  return Math.round(baseMs * s);
}

/** Lista saneada de tipos silenciados: só tipos silenciáveis, sem repetição, na ordem canônica. */
export function sanitizeMutedEvents(value: unknown, fallback: readonly MutableNotchEventKind[]): MutableNotchEventKind[] {
  if (!Array.isArray(value)) return [...fallback];
  const wanted = new Set(value.filter((v): v is string => typeof v === "string"));
  return MUTABLE_NOTCH_EVENT_KINDS.filter((kind) => wanted.has(kind));
}
