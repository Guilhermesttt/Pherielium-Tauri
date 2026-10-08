import { beforeEach, describe, expect, it } from "vitest";
import { PERSONA_CACHE_MAX, getCachedPersona, setCachedPersona, trackKey } from "./personaCache";

const mem = new Map<string, string>();
beforeEach(() => {
  mem.clear();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, v),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
    key: () => null,
    length: 0,
  } as Storage;
});

describe("personaCache", () => {
  it("chave ignora maiúsculas e espaços extras", () => {
    expect(trackKey("  Enter  Sandman ", "METALLICA")).toBe(trackKey("enter sandman", "metallica"));
  });

  it("guarda e lê a persona da faixa", () => {
    expect(getCachedPersona("a|b")).toBeNull();
    setCachedPersona("a|b", "metal");
    expect(getCachedPersona("a|b")).toBe("metal");
  });

  it("valor corrompido vira null", () => {
    mem.set("pherielium_music_persona_cache_v1", JSON.stringify({ "x|y": "banana" }));
    expect(getCachedPersona("x|y")).toBeNull();
    mem.set("pherielium_music_persona_cache_v1", "{lixo");
    expect(getCachedPersona("x|y")).toBeNull();
  });

  it("limita o tamanho descartando as mais antigas", () => {
    for (let i = 0; i < PERSONA_CACHE_MAX + 20; i++) setCachedPersona(`t${i}|a`, "pop");
    expect(getCachedPersona("t0|a")).toBeNull();
    expect(getCachedPersona(`t${PERSONA_CACHE_MAX + 19}|a`)).toBe("pop");
    expect(Object.keys(JSON.parse(mem.get("pherielium_music_persona_cache_v1")!)).length).toBe(PERSONA_CACHE_MAX);
  });
});
