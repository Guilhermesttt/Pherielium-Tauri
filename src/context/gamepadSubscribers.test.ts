import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GAMEPAD_PRIORITY,
  fireGamepadButton,
  pickSubscribers,
  registerGamepadSubscriber,
  resetGamepadSubscribers,
} from "./gamepadSubscribers";
import { DEFAULT_NAVIGATION_PRIORITY } from "../hooks/useGamepadNavigation";

beforeEach(() => {
  resetGamepadSubscribers();
});

describe("quem responde a um aperto", () => {
  it("só a maior prioridade responde", () => {
    const home = vi.fn();
    const page = vi.fn();
    registerGamepadSubscriber("X", { callback: home, priority: GAMEPAD_PRIORITY.base });
    registerGamepadSubscriber("X", { callback: page, priority: GAMEPAD_PRIORITY.page });
    expect(fireGamepadButton("X")).toBe(1);
    expect(page).toHaveBeenCalledTimes(1);
    expect(home).not.toHaveBeenCalled();
  });

  it("botões diferentes não se misturam e sem ouvinte não dispara nada", () => {
    const o = vi.fn();
    registerGamepadSubscriber("O", { callback: o, priority: 0 });
    expect(fireGamepadButton("X")).toBe(0);
    expect(o).not.toHaveBeenCalled();
  });

  it("depois de remover o ouvinte de cima, o de baixo volta a responder", () => {
    const home = vi.fn();
    const overlay = vi.fn();
    registerGamepadSubscriber("R1", { callback: home, priority: GAMEPAD_PRIORITY.base });
    const unsubscribe = registerGamepadSubscriber("R1", { callback: overlay, priority: GAMEPAD_PRIORITY.overlay });
    fireGamepadButton("R1");
    unsubscribe();
    fireGamepadButton("R1");
    expect(overlay).toHaveBeenCalledTimes(1);
    expect(home).toHaveBeenCalledTimes(1);
  });

  it("pickSubscribers devolve todos os empatados na maior prioridade", () => {
    const a = { callback: () => {}, priority: 3 };
    const b = { callback: () => {}, priority: 3 };
    const c = { callback: () => {}, priority: 1 };
    expect(pickSubscribers([a, b, c])).toEqual([a, b]);
    expect(pickSubscribers([])).toEqual([]);
  });
});

describe("o X na página aberta sobre a Home (o clique em dobro)", () => {
  it("a navegação da página tem prioridade acima da Home, senão os dois clicam no item em foco", () => {
    expect(DEFAULT_NAVIGATION_PRIORITY).toBe(GAMEPAD_PRIORITY.page);
    expect(DEFAULT_NAVIGATION_PRIORITY).toBeGreaterThan(GAMEPAD_PRIORITY.base);
  });

  it("a escala de camadas é estritamente crescente: Home < página < atalhos < painel < modal", () => {
    const { base, page, pageTabs, overlay, modal } = GAMEPAD_PRIORITY;
    expect([base, page, pageTabs, overlay, modal]).toEqual([...new Set([base, page, pageTabs, overlay, modal])].sort((x, y) => x - y));
  });
});
