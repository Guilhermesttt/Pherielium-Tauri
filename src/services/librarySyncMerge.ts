import type { Game } from "../types/domain";

/**
 * Campos que a pessoa escolhe ao editar um jogo (nome, arte, executável, categoria, descrição).
 * Depois de editado, a sincronização com a Steam ou a Epic não pode devolvê-los ao valor da loja.
 */
const USER_OWNED_FIELDS = [
  "title",
  "image",
  "cardImage",
  "backgroundImage",
  "logoImage",
  "category",
  "description",
  "aboutTheGame",
  "executablePath",
] as const satisfies readonly (keyof Game)[];

/**
 * Junta o que a sincronização trouxe da loja (`synced`) com o que já existe no jogo (`existing`).
 *
 * Antes a Steam gravava só o que sabia, e a gravação em lote substitui o registro inteiro: favorito,
 * argumentos de lançamento, configurações de controle e tudo o que a pessoa mudou voltavam ao padrão a
 * cada sincronização (ao abrir o app, a cada 30 minutos e ao fechar um jogo).
 *
 * Regras: o que a loja informa atualiza (horas, conquistas, arte, data); o que só existe no jogo
 * (favorito e demais campos da pessoa) é mantido; e, em jogo editado à mão (`userEdited`), os campos
 * de apresentação ficam como a pessoa deixou.
 */
export function mergeSyncedGame<T extends Partial<Game>>(existing: Game | undefined, synced: T): T {
  if (!existing) return synced;
  const merged: Record<string, unknown> = { ...existing, ...synced };
  merged.isFavorite = existing.isFavorite ?? (synced as Partial<Game>).isFavorite ?? false;
  if (existing.userEdited) {
    for (const field of USER_OWNED_FIELDS) {
      if (existing[field] !== undefined && existing[field] !== "") merged[field] = existing[field];
    }
    merged.userEdited = true;
  }
  return merged as T;
}
