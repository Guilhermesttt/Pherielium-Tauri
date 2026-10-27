import { describe, expect, it } from "vitest";
import { shouldFallbackToSupabase, VoiceRoomApiError } from "./voiceRoomFallbackPolicy";

const named = (name: string, message: string): Error => {
  const error = new Error(message);
  error.name = name;
  return error;
};

describe("shouldFallbackToSupabase", () => {
  it.each([
    [401, false], // regressão: "Token de autenticacao invalido." não contém "auth"
    [403, false],
    [404, false],
    [409, false],
    [422, false],
    [400, false],
    [408, true],
    [429, true],
    [500, true],
    [502, true],
    [503, true],
  ])("HTTP %s -> fallback=%s", (status, expected) => {
    expect(shouldFallbackToSupabase(new VoiceRoomApiError("Token de autenticacao invalido.", status))).toBe(expected);
  });

  // Regressão: criar uma "Noite de jogo" recebia 400 "Validação falhou" da API do Render, que recusa
  // o que o banco aceita (o mesmo já acontecia ao editar sala). O RPC do Supabase é a fonte de verdade.
  it("falls back when the Render API rejects with its generic 'Validação falhou' (400/422)", () => {
    for (const status of [400, 422]) {
      expect(shouldFallbackToSupabase(new VoiceRoomApiError("Validação falhou", status))).toBe(true);
      expect(shouldFallbackToSupabase(new VoiceRoomApiError("Validacao falhou.", status))).toBe(true);
    }
  });

  it("keeps real 400s (a specific reason) from falling back", () => {
    expect(shouldFallbackToSupabase(new VoiceRoomApiError("Senha da sala incorreta.", 400))).toBe(false);
    expect(shouldFallbackToSupabase(new VoiceRoomApiError("Validação falhou", 401))).toBe(false);
  });

  it("falls back on timeouts and plain network errors", () => {
    expect(shouldFallbackToSupabase(named("RequestTimeoutError", "A requisicao excedeu 15000ms."))).toBe(true);
    expect(shouldFallbackToSupabase(new TypeError("Failed to fetch"))).toBe(true);
  });

  it("does not fall back when the local session is invalid", () => {
    expect(shouldFallbackToSupabase(named("AuthRequiredError", "Sessao de autenticacao necessaria."))).toBe(false);
    expect(shouldFallbackToSupabase(new Error("Sessao expirada. Entre novamente."))).toBe(false);
  });

  it("recognizes the Portuguese auth message even without a typed status (text safety net)", () => {
    expect(shouldFallbackToSupabase(new Error("Token de autenticacao invalido."))).toBe(false);
  });
});
