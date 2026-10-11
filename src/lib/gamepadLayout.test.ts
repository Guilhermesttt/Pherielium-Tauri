import { describe, expect, it } from "vitest";
import {
  STANDARD_BUTTONS,
  buttonIdOf,
  buttonLabel,
  describePressed,
  parseGamepadId,
  pressedButtons,
  stickPoint,
  type ButtonSample,
} from "./gamepadLayout";

const idle = (n = 18): ButtonSample[] => Array.from({ length: n }, () => ({ pressed: false, value: 0 }));

describe("labels por família", () => {
  it("o mesmo índice muda só o rótulo, não o botão", () => {
    expect(buttonLabel(0, "xbox")).toBe("A");
    expect(buttonLabel(0, "playstation")).toBe("✕");
    expect(buttonIdOf(0)).toBe("face_bottom");
    expect(buttonLabel(2, "xbox")).toBe("X");
    expect(buttonLabel(2, "playstation")).toBe("□");
  });

  it("gatilhos e bumpers seguem a nomenclatura de cada família", () => {
    expect(buttonLabel(4, "xbox")).toBe("LB");
    expect(buttonLabel(4, "playstation")).toBe("L1");
    expect(buttonLabel(7, "xbox")).toBe("RT");
    expect(buttonLabel(7, "playstation")).toBe("R2");
  });

  it("índice desconhecido não quebra", () => {
    expect(buttonLabel(99, "xbox")).toBe("Botão 99");
    expect(buttonIdOf(99)).toBeNull();
  });

  it("a tabela não repete índice nem id", () => {
    const indexes = STANDARD_BUTTONS.map((b) => b.index);
    const ids = STANDARD_BUTTONS.map((b) => b.id);
    expect(new Set(indexes).size).toBe(indexes.length);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("cobre os 18 botões do print do gamepad tester (B0..B17)", () => {
    for (let i = 0; i <= 17; i += 1) expect(buttonIdOf(i), `B${i}`).not.toBeNull();
  });
});

describe("pressedButtons / describePressed", () => {
  it("nada apertado devolve vazio", () => {
    expect(pressedButtons(idle(), "xbox")).toEqual([]);
    expect(describePressed([])).toBe("");
  });

  it("detecta botão digital e nomeia pela família", () => {
    const b = idle();
    b[0] = { pressed: true, value: 1 };
    expect(describePressed(pressedButtons(b, "playstation"))).toBe("✕");
    expect(describePressed(pressedButtons(b, "xbox"))).toBe("A");
  });

  it("gatilho analógico só conta depois do limiar e mostra a porcentagem", () => {
    const b = idle();
    b[7] = { pressed: false, value: 0.3 };
    expect(pressedButtons(b, "playstation")).toEqual([]);
    b[7] = { pressed: false, value: 0.62 };
    expect(describePressed(pressedButtons(b, "playstation"))).toBe("R2 (62%)");
  });

  it("combinação sai na ordem do índice", () => {
    const b = idle();
    b[7] = { pressed: true, value: 1 };
    b[0] = { pressed: true, value: 1 };
    expect(describePressed(pressedButtons(b, "xbox"))).toBe("A + RT (100%)");
  });

  it("buraco no array (controle com menos botões) não quebra", () => {
    const sparse = [{ pressed: true, value: 1 }, undefined as unknown as ButtonSample];
    expect(pressedButtons(sparse, "xbox")).toHaveLength(1);
  });
});

describe("stickPoint", () => {
  it("dentro do círculo fica como veio", () => {
    expect(stickPoint(0.3, 0.4)).toEqual({ x: 0.3, y: 0.4, magnitude: 0.5 });
  });

  it("diagonal de eixo quadrado é trazida para o círculo unitário", () => {
    const p = stickPoint(1, 1);
    expect(p.magnitude).toBe(1);
    expect(Math.hypot(p.x, p.y)).toBeCloseTo(1, 6);
  });

  it("NaN vira o centro", () => {
    expect(stickPoint(Number.NaN, 0.5).x).toBe(0);
  });
});

describe("parseGamepadId", () => {
  it("reconhece o DualShock 4 do print (054c:09cc)", () => {
    const d = parseGamepadId("Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)");
    expect(d.vendor).toBe("054c");
    expect(d.product).toBe("09cc");
    expect(d.kind).toBe("dualshock4");
    expect(d.name).toBe("Wireless Controller");
    expect(d.standardMapping).toBe(true);
  });

  it("reconhece DualSense pelo PID", () => {
    expect(parseGamepadId("DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)").kind).toBe(
      "dualsense",
    );
  });

  it("Sony com PID desconhecido NÃO é rotulado como DS4 nem DualSense", () => {
    expect(parseGamepadId("Mystery (STANDARD GAMEPAD Vendor: 054c Product: ffff)").kind).toBe("generic");
  });

  it("Xbox via XInput (sem VID/PID) é reconhecido pelo nome", () => {
    const d = parseGamepadId("Xbox 360 Controller (XInput STANDARD GAMEPAD)");
    expect(d.kind).toBe("xbox");
    expect(d.vendor).toBeNull();
  });

  it("Xbox por VID da Microsoft", () => {
    expect(parseGamepadId("Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)").kind).toBe("xbox");
  });

  it("mapeamento não-standard é sinalizado", () => {
    expect(parseGamepadId("Generic USB Joystick (Vendor: 1234 Product: 5678)").standardMapping).toBe(false);
  });

  it("id vazio não explode", () => {
    expect(parseGamepadId("").name).toBe("Controle");
  });
});
