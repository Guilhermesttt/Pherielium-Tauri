import { describe, expect, it } from "vitest";
import {
  DEFAULT_NOTCH_CONFIG,
  NOTCH_BODY_PRESETS,
  NOTCH_SHAPES,
  effectiveNotchConfig,
  notchConfigsEqual,
  sanitizeNotchConfig,
} from "./notchConfig";
import { SHAPES } from "./engine/skins";
import { normalizeHex } from "./mascotColor";

describe("sanitizeNotchConfig", () => {
  it("lixo vira o padrão", () => {
    expect(sanitizeNotchConfig(undefined)).toEqual(DEFAULT_NOTCH_CONFIG);
    expect(sanitizeNotchConfig("x")).toEqual(DEFAULT_NOTCH_CONFIG);
    expect(sanitizeNotchConfig(42)).toEqual(DEFAULT_NOTCH_CONFIG);
  });

  it("mantém booleanos válidos e descarta tipos errados", () => {
    const c = sanitizeNotchConfig({ enabled: false, autoHide: "sim", showClock: false, followCursor: 1 });
    expect(c.enabled).toBe(false);
    expect(c.autoHide).toBe(DEFAULT_NOTCH_CONFIG.autoHide);
    expect(c.showClock).toBe(false);
    expect(c.followCursor).toBe(DEFAULT_NOTCH_CONFIG.followCursor);
  });

  it("normaliza cor e aceita null como 'padrão'", () => {
    expect(sanitizeNotchConfig({ bodyColor: "#3B82F6" }).bodyColor).toBe("#3b82f6");
    expect(sanitizeNotchConfig({ bodyColor: "#abc" }).bodyColor).toBe("#aabbcc");
    expect(sanitizeNotchConfig({ bodyColor: null }).bodyColor).toBeNull();
    expect(sanitizeNotchConfig({ bodyColor: "azul" }).bodyColor).toBeNull();
    // ausente = herda da base (importante no merge parcial)
    expect(sanitizeNotchConfig({}, { ...DEFAULT_NOTCH_CONFIG, bodyColor: "#112233" }).bodyColor).toBe("#112233");
  });

  it("rejeita forma desconhecida", () => {
    expect(sanitizeNotchConfig({ shape: "cercle" }).shape).toBe("cercle");
    expect(sanitizeNotchConfig({ shape: "dragão" }).shape).toBe(DEFAULT_NOTCH_CONFIG.shape);
  });
});

describe("effectiveNotchConfig (migração da cor legada)", () => {
  it("sem config gravada, migra a cor escolhida antes", () => {
    expect(effectiveNotchConfig(null, "#10B981").bodyColor).toBe("#10b981");
    expect(effectiveNotchConfig(undefined, "#F43F5E").bodyColor).toBe("#f43f5e");
  });

  it("o branco legado (padrão antigo) não vira corpo branco", () => {
    expect(effectiveNotchConfig(null, "#FFFFFF").bodyColor).toBeNull();
    expect(effectiveNotchConfig(null, null).bodyColor).toBeNull();
  });

  it("com config gravada, ela vence a legada (inclusive 'padrão' = null)", () => {
    expect(effectiveNotchConfig({ bodyColor: null }, "#10B981").bodyColor).toBeNull();
    expect(effectiveNotchConfig({ bodyColor: "#3b93f0" }, "#10B981").bodyColor).toBe("#3b93f0");
  });
});

describe("catálogos", () => {
  it("toda forma listada existe no engine e vice-versa", () => {
    expect(NOTCH_SHAPES.map((s) => s.id).sort()).toEqual(SHAPES.map((s) => s.id).sort());
  });

  it("presets de cor são hex válidos (exceto o 'padrão')", () => {
    for (const p of NOTCH_BODY_PRESETS) {
      if (p.hex !== null) expect(normalizeHex(p.hex, null), p.label).toBe(p.hex);
    }
    expect(NOTCH_BODY_PRESETS[0].hex).toBeNull();
  });

  it("notchConfigsEqual compara campo a campo", () => {
    expect(notchConfigsEqual(DEFAULT_NOTCH_CONFIG, { ...DEFAULT_NOTCH_CONFIG })).toBe(true);
    expect(notchConfigsEqual(DEFAULT_NOTCH_CONFIG, { ...DEFAULT_NOTCH_CONFIG, enabled: false })).toBe(false);
  });
});
