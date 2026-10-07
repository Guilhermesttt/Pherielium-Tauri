import { describe, expect, it } from "vitest";
import { controllerFlashCopy, parseControllerFlash } from "./controllerFlash";

describe("controllerFlash", () => {
  it("parses valid payloads and clamps the battery", () => {
    expect(parseControllerFlash({ kind: "connected", link: "USB", battery: 140, at: 5 })).toEqual({
      kind: "connected",
      link: "USB",
      battery: 100,
      at: 5,
    });
  });

  it("rejects unknown kinds and non-objects", () => {
    expect(parseControllerFlash(null)).toBeNull();
    expect(parseControllerFlash("connected")).toBeNull();
    expect(parseControllerFlash({ kind: "batteryLow" })).toBeNull();
  });

  it("writes the copy for connect, with and without details, and disconnect", () => {
    expect(controllerFlashCopy({ kind: "connected", link: "BLUETOOTH", battery: 80, at: 0 })).toEqual({
      title: "Controle conectado",
      subtitle: "BLUETOOTH • 80%",
    });
    expect(controllerFlashCopy({ kind: "connected", at: 0 }).subtitle).toBe("Pronto para jogar");
    expect(controllerFlashCopy({ kind: "disconnected", at: 0 })).toEqual({
      title: "Controle desconectado",
      subtitle: "Sem sinal",
    });
  });
});
