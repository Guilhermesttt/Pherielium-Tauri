import type { VoiceRoom } from "../types/voice-governance";

/**
 * Junta duas listas de salas (a da API e as privadas lidas do banco) sem repetir nenhuma.
 * Em caso de repetição vale a da primeira lista (a API traz as contagens de participantes).
 * O resultado fica do mais novo para o mais antigo, como a lista da API.
 */
export function mergeVoiceRooms(primary: readonly VoiceRoom[], extra: readonly VoiceRoom[]): VoiceRoom[] {
  const seen = new Set(primary.map((room) => room.id));
  const merged = [...primary, ...extra.filter((room) => !seen.has(room.id))];
  return merged.sort((a, b) => (Date.parse(b.createdAt) || 0) - (Date.parse(a.createdAt) || 0));
}
