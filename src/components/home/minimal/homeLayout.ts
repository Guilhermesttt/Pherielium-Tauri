/**
 * Layout da Home. "minimal" é a Home em duas zonas (jogo em foco + grade da biblioteca);
 * "classic" é a anterior (faixa de recentes, herói e carrossel). Fica gravado neste aparelho.
 * Lógica pura (sem React) para poder ser testada.
 */
export type HomeLayout = "minimal" | "classic";

export const HOME_LAYOUT_STORAGE_KEY = "pherielium_home_layout";
export const HOME_LAYOUT_TOGGLE_EVENT = "pherielium:toggle-home-layout";

export const DEFAULT_HOME_LAYOUT: HomeLayout = "classic";

export const isHomeLayout = (value: unknown): value is HomeLayout => value === "minimal" || value === "classic";

/** Lê o valor gravado; qualquer coisa que não seja um layout conhecido cai no padrão. */
export const parseHomeLayout = (stored: string | null | undefined): HomeLayout =>
  isHomeLayout(stored) ? stored : DEFAULT_HOME_LAYOUT;

export const otherHomeLayout = (layout: HomeLayout): HomeLayout => (layout === "minimal" ? "classic" : "minimal");
