import { describe, expect, it } from "vitest";
import { spotlightMotion } from "./spotlight";

describe("spotlightMotion", () => {
  it("quem fala cresce e fica à frente; os outros recuam", () => {
    const speaker = spotlightMotion(true, true, false);
    const other = spotlightMotion(false, true, false);
    expect(speaker.scale).toBeGreaterThan(1);
    expect(speaker.opacity).toBe(1);
    expect(other.scale).toBeLessThan(1);
    expect(other.opacity).toBeLessThan(1);
  });

  it("ninguém falando: todos iguais", () => {
    expect(spotlightMotion(false, false, false)).toEqual({ scale: 1, opacity: 1 });
  });

  it("movimento reduzido: nada muda, mesmo com alguém falando", () => {
    expect(spotlightMotion(true, true, true)).toEqual({ scale: 1, opacity: 1 });
    expect(spotlightMotion(false, true, true)).toEqual({ scale: 1, opacity: 1 });
  });
});
