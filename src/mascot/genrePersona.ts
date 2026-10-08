/**
 * Persona da Pherie a partir dos gêneros que a AudD devolve. Pura e testável.
 * Prioridade: metal > pop > chill > padrão (se vier "Metal" e "Electronic", ganha o metal).
 */
export type Persona = "metal" | "pop" | "chill" | "padrao";

const METAL = ["metal", "heavy metal", "hardcore", "grunge", "nu metal", "nu-metal", "thrash", "death metal", "metalcore"];
const POP = ["pop", "dance", "disco", "electronic", "electronica", "edm", "house", "techno", "eurodance", "synthpop", "synth-pop"];
const CHILL = ["lofi", "lo-fi", "lo fi", "jazz", "chill", "classical", "classica", "ambient", "downtempo", "new age", "instrumental", "bossa nova"];

/** Minúsculas, sem acento, espaços normalizados. */
export function normalizeGenre(g: string): string {
  return g
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[_/&,;]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Palavra inteira (ou frase) dentro do gênero: "hip hop" não casa "pop", "popular" não casa "pop". */
function has(genre: string, keyword: string): boolean {
  const re = new RegExp(`(^|[^a-z0-9])${keyword.replace(/[-\s]/g, "[-\\s]?")}([^a-z0-9]|$)`);
  return re.test(genre);
}

export function mapGenreToPersona(genres: readonly string[] | null | undefined): Persona {
  const list = (genres ?? []).map(normalizeGenre).filter(Boolean);
  if (list.length === 0) return "padrao";
  const any = (words: readonly string[]) => list.some((g) => words.some((w) => has(g, w)));
  if (any(METAL)) return "metal";
  if (any(POP)) return "pop";
  if (any(CHILL)) return "chill";
  return "padrao";
}
