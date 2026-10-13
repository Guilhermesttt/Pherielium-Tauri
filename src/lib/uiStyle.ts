/**
 * Estilo visual da janela principal: "refined" (padrão: minimalista, cantos maiores, bordas discretas, movimento suave com a
 * curva de mola do iOS) ou "classic" (o visual anterior). Escolha local, guardada em `pherielium_ui_style`.
 *
 * Todo o CSS do estilo refinado fica atrás de `html[data-ui-style="refined"]` (src/index.css), então voltar ao clássico é só
 * trocar o atributo, sem recarregar tokens. O overlay (outra janela) não aplica o atributo e continua como era.
 */

export type UiStyle = "refined" | "classic";

export const UI_STYLE_STORAGE_KEY = "pherielium_ui_style";

/** Qualquer valor que não seja "classic" (ausente, lixo, outra grafia) usa o estilo refinado. */
export function resolveUiStyle(raw: string | null | undefined): UiStyle {
  return raw?.trim().toLowerCase() === "classic" ? "classic" : "refined";
}

export function readUiStyle(storage: Pick<Storage, "getItem"> | null = safeStorage()): UiStyle {
  try {
    return resolveUiStyle(storage?.getItem(UI_STYLE_STORAGE_KEY));
  } catch (error) {
    console.warn("[uiStyle] localStorage indisponível; usando o estilo refinado:", error);
    return "refined";
  }
}

export function applyUiStyle(root: Pick<HTMLElement, "setAttribute">, style: UiStyle): void {
  root.setAttribute("data-ui-style", style);
}

function safeStorage(): Storage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch {
    return null;
  }
}
