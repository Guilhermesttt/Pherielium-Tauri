import { describe, expect, it } from "vitest";
import { callEndMood, gameEndMood, idleMood, isLateNight } from "./situationMood";

describe("situationMood", () => {
  it("parada de dia: desperta, entediada, sonolenta, dormindo", () => {
    expect(idleMood(10_000, 14)).toBeNull();
    expect(idleMood(61_000, 14)).toBe("bored");
    expect(idleMood(160_000, 14)).toBe("drowsy");
    expect(idleMood(400_000, 14)).toBe("sleeping");
  });

  it("de madrugada cansa bem mais cedo", () => {
    expect(isLateNight(23)).toBe(true);
    expect(isLateNight(3)).toBe(true);
    expect(isLateNight(5)).toBe(false);
    expect(idleMood(25_000, 2)).toBe("drowsy");
    expect(idleMood(100_000, 2)).toBe("sleeping");
    expect(idleMood(25_000, 15)).toBeNull();
  });

  it("fim de jogo: sessão longa orgulho, média alegria, curta nada", () => {
    expect(gameEndMood(2400)).toBe("proud");
    expect(gameEndMood(600)).toBe("happy");
    expect(gameEndMood(30)).toBeNull();
  });

  it("fim de chamada: saudade só se foi longa", () => {
    expect(callEndMood(300)).toBe("sad");
    expect(callEndMood(10)).toBeNull();
  });
});
