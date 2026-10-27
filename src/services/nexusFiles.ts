import type { NexusModFile } from "./nexus";

/**
 * Qual arquivo de um mod da Nexus instalar. A API devolve todos (principal, atualizações,
 * opcionais e versões antigas); quem quer o mod quer o mais recente, sem escolher entre vinte
 * versões velhas. Puro, para a regra ser testada à parte.
 */
export interface NexusFileGroups {
  /** o que "Instalar" deve baixar: o arquivo principal mais recente */
  main: NexusModFile | null;
  /** extras de verdade (opcionais, miscelânea), do mais novo ao mais antigo */
  optional: NexusModFile[];
  /** versões antigas, arquivadas ou removidas: escondidas por padrão */
  old: NexusModFile[];
}

const category = (file: NexusModFile) => String(file.category || "").trim().toUpperCase();

/** Categorias que significam "não é a versão atual". */
const OLD_CATEGORIES = new Set(["OLD_VERSION", "ARCHIVED", "DELETED", "REMOVED"]);
/** Categorias que podem ser o arquivo principal. */
const MAIN_CATEGORIES = new Set(["MAIN", "UPDATE"]);

const uploadedAt = (file: NexusModFile) => (typeof file.uploadedAt === "number" ? file.uploadedAt : 0);

const newestFirst = (a: NexusModFile, b: NexusModFile) => uploadedAt(b) - uploadedAt(a);

export function groupNexusFiles(files: readonly NexusModFile[]): NexusFileGroups {
  const current = files.filter((file) => !OLD_CATEGORIES.has(category(file))).sort(newestFirst);
  const old = files.filter((file) => OLD_CATEGORIES.has(category(file))).sort(newestFirst);

  // 1) a Nexus marca o principal; 2) senão o mais novo MAIN/UPDATE; 3) senão o mais novo que sobrar
  const main =
    current.find((file) => file.primary) ??
    current.find((file) => MAIN_CATEGORIES.has(category(file))) ??
    current[0] ??
    old[0] ??
    null;

  return {
    main,
    optional: current.filter((file) => file !== main),
    // sem nenhum arquivo atual, o "principal" saiu da lista antiga e não deve repetir
    old: old.filter((file) => file !== main),
  };
}

/** "21 KB" / "1,4 MB" */
export function formatFileSize(sizeKb: number): string {
  if (!Number.isFinite(sizeKb) || sizeKb <= 0) return "";
  if (sizeKb >= 1024) return `${(sizeKb / 1024).toFixed(1).replace(".", ",")} MB`;
  return `${Math.round(sizeKb)} KB`;
}
