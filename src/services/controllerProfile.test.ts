import { describe, expect, it } from "vitest";
import {
  CONTROLLER_PRESETS,
  EMULATION_BLOCK_HINT,
  EMULATION_ENGINE_READY,
  FACTORY_SETTINGS,
  emulationBlock,
  type ControllerDriverStatus,
} from "./controllerProfile";

const drivers = (vigem: boolean, hidHide: boolean): ControllerDriverStatus => ({
  vigem: { installed: vigem, supported: true, detail: null },
  hidHide: { installed: hidHide, supported: true, detail: null },
  emulationReady: vigem && hidHide,
});

describe("emulationBlock", () => {
  it("sem informação de driver (fora do desktop) bloqueia", () => {
    expect(emulationBlock(null, true)).toBe("unknown");
  });

  it("o driver que falta é apontado antes do motor, porque dá para a pessoa resolver", () => {
    expect(emulationBlock(drivers(false, false), false)).toBe("vigem");
    expect(emulationBlock(drivers(true, false), false)).toBe("hidhide");
  });

  it("com os dois drivers mas sem motor, bloqueia por motor", () => {
    expect(emulationBlock(drivers(true, true), false)).toBe("engine");
  });

  it("só libera com drivers E motor", () => {
    expect(emulationBlock(drivers(true, true), true)).toBeNull();
  });

  it("nunca libera sem o HidHide, mesmo com motor (entrada duplicada)", () => {
    expect(emulationBlock(drivers(true, false), true)).toBe("hidhide");
  });

  it("o motor ainda não existe: o padrão tem de ser bloqueado", () => {
    // Se este teste falhar, alguém virou a chave sem ligar o motor.
    expect(EMULATION_ENGINE_READY).toBe(false);
    expect(emulationBlock(drivers(true, true))).toBe("engine");
  });

  it("todo bloqueio tem uma mensagem", () => {
    for (const reason of ["unknown", "vigem", "hidhide", "engine"] as const) {
      expect(EMULATION_BLOCK_HINT[reason].length).toBeGreaterThan(0);
    }
  });
});

describe("presets", () => {
  it("nenhum preset liga a emulação sozinho", () => {
    for (const [name, preset] of Object.entries(CONTROLLER_PRESETS)) {
      expect(preset.emulateXinput, name).toBe(false);
    }
  });

  it("o preset padrão é exatamente a fábrica", () => {
    expect(CONTROLLER_PRESETS.padrao).toEqual(FACTORY_SETTINGS);
  });

  it("todos ficam dentro das faixas que o Rust aceita", () => {
    for (const [name, p] of Object.entries(CONTROLLER_PRESETS)) {
      expect(p.deadzoneLeft, name).toBeGreaterThanOrEqual(0);
      expect(p.deadzoneLeft, name).toBeLessThanOrEqual(0.5);
      expect(p.deadzoneRight, name).toBeLessThanOrEqual(0.5);
      expect(p.sensitivity, name).toBeGreaterThanOrEqual(0.25);
      expect(p.sensitivity, name).toBeLessThanOrEqual(3);
      expect(p.triggerThreshold, name).toBeLessThanOrEqual(0.9);
    }
  });
});
