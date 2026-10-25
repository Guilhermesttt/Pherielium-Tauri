import { describe, expect, it } from "vitest";
import type { SteamAchievement } from "../../../services/steam";
import { formatAgo, formatSession, pickLastUnlocked, resolveSessionStart } from "./consoleInfo";

const ach = (apiName: string, extra: Partial<SteamAchievement>): SteamAchievement => ({
  apiName,
  achieved: false,
  unlockTime: 0,
  name: apiName,
  description: "",
  icon: "",
  iconGray: "",
  hidden: false,
  ...extra,
});

describe("pickLastUnlocked", () => {
  it("pega o desbloqueado mais recente e converte para milissegundos", () => {
    const last = pickLastUnlocked([
      ach("a", { achieved: true, unlockTime: 100 }),
      ach("b", { achieved: true, unlockTime: 900, name: "Sobrevivente" }),
      ach("c", { achieved: false, unlockTime: 5000 }),
    ]);
    expect(last).toEqual({ name: "Sobrevivente", unlockedAtMs: 900_000 });
  });

  it("ignora obtidos sem data (retroativos) e lista vazia", () => {
    expect(pickLastUnlocked([ach("a", { achieved: true, unlockTime: 0 })])).toBeNull();
    expect(pickLastUnlocked([])).toBeNull();
  });
});

describe("formatAgo", () => {
  const NOW = 1_800_000_000_000;
  const MIN = 60_000;
  const H = 60 * MIN;
  const D = 24 * H;
  it("faixas de tempo", () => {
    expect(formatAgo(NOW - 20_000, NOW)).toBe("agora");
    expect(formatAgo(NOW - 5 * MIN, NOW)).toBe("há 5 min");
    expect(formatAgo(NOW - 3 * H, NOW)).toBe("há 3 h");
    expect(formatAgo(NOW - D - H, NOW)).toBe("ontem");
    expect(formatAgo(NOW - 12 * D, NOW)).toBe("há 12 d");
    expect(formatAgo(NOW - 120 * D, NOW)).toBe("há 4 meses");
    expect(formatAgo(NOW - 800 * D, NOW)).toBe("há 2 anos");
    expect(formatAgo(NOW + 5 * H, NOW)).toBe("agora");
  });
});

describe("formatSession", () => {
  it("minutos, horas e minutos com dois dígitos", () => {
    expect(formatSession(20_000)).toBe("agora");
    expect(formatSession(12 * 60_000)).toBe("12 min");
    expect(formatSession(72 * 60_000)).toBe("1h12");
    expect(formatSession(185 * 60_000)).toBe("3h05");
    expect(formatSession(-5)).toBe("agora");
  });
});

describe("resolveSessionStart", () => {
  const NOW = Date.parse("2026-10-24T20:00:00Z");
  it("prefere o instante observado", () => {
    expect(resolveSessionStart(123, "2026-10-24T19:00:00Z", NOW)).toBe(123);
  });
  it("sem observação, usa lastPlayedAt recente e válido", () => {
    expect(resolveSessionStart(undefined, "2026-10-24T19:00:00Z", NOW)).toBe(Date.parse("2026-10-24T19:00:00Z"));
  });
  it("lastPlayedAt antigo, futuro, inválido ou ausente: sem duração", () => {
    expect(resolveSessionStart(undefined, "2026-10-20T19:00:00Z", NOW)).toBeNull();
    expect(resolveSessionStart(undefined, "2026-10-24T22:00:00Z", NOW)).toBeNull();
    expect(resolveSessionStart(undefined, "ontem", NOW)).toBeNull();
    expect(resolveSessionStart(undefined, undefined, NOW)).toBeNull();
  });
});
