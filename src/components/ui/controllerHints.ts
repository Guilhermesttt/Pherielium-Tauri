import type { ControllerButtonKey } from "./ControllerButtonGlyph";

export interface ControllerHint {
  button: ControllerButtonKey;
  label: string;
}

/**
 * Comandos do controle de cada página do hub.
 *
 * Só entram aqui botões que a página realmente trata (ver os `useGamepadButton`
 * de cada uma): legenda que promete um botão morto é pior do que nenhuma.
 * Os nomes seguem o layout Xbox; o glifo vira PlayStation sozinho.
 */
const NAVIGATE: ControllerHint = { button: "DPAD", label: "Navegar" };
const SELECT: ControllerHint = { button: "A", label: "Selecionar" };
const SCROLL: ControllerHint = { button: "RSTICK", label: "Rolar" };
const SIDEBAR: ControllerHint = { button: "MENU", label: "Menu lateral" };

export const PAGE_CONTROLLER_HINTS: Readonly<Record<string, ReadonlyArray<ControllerHint>>> = {
  SETTINGS: [NAVIGATE, SELECT, SCROLL, { button: "B", label: "Voltar" }, SIDEBAR],
  FRIENDS: [
    NAVIGATE,
    SELECT,
    { button: "X", label: "Conversar" },
    { button: "Y", label: "Ligar" },
    { button: "LB", label: "Aba anterior" },
    { button: "RB", label: "Próxima aba" },
    SIDEBAR,
  ],
  FEED: [NAVIGATE, SELECT, SCROLL, SIDEBAR],
  MODS: [NAVIGATE, SELECT, SCROLL, SIDEBAR],
  PROFILE: [NAVIGATE, SELECT, SCROLL, SIDEBAR],
  DEALS: [NAVIGATE, SELECT, SCROLL, SIDEBAR],
  RADAR: [NAVIGATE, SELECT, SCROLL, SIDEBAR],
};
