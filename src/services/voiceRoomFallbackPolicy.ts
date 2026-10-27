/**
 * Quando uma chamada à API de salas de voz falha, o app tenta o RPC do Supabase como contingência.
 * Esta política decide **pelo status HTTP**, não pelo texto da mensagem.
 *
 * Bug anterior: a decisão procurava "auth" na mensagem, mas o servidor responde "Token de autenticacao invalido." (sem "auth"),
 * então um 401 caía no RPC mesmo assim; um 403 de senha errada também caía no RPC e era reavaliado por outro caminho.
 *
 * Cai no fallback: sem resposta (rede, timeout, cold start), 408, 429 e 5xx. Não cai: 400, 401, 403, 404, 409, 422 e demais 4xx
 * (o servidor respondeu e recusou de propósito) e erros de sessão local.
 *
 * Exceção: 400/422 com a mensagem genérica "Validação falhou". É o validador de formulário da API do Render, que já recusou
 * nomes e campos que o banco aceita (ao editar sala e ao criar uma "Noite de jogo"). Não diz o motivo, então não há
 * decisão de negócio a respeitar: o RPC do Supabase revalida de verdade (nome vazio, sala privada sem senha) e devolve
 * o erro real se houver.
 */

/** Erro de uma resposta HTTP da API de salas: guarda o status para a decisão de fallback. */
export class VoiceRoomApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "VoiceRoomApiError";
    this.status = status;
  }
}

const RETRYABLE_4XX = new Set([408, 429]);

/** "Validação falhou" / "Validacao falhou." sem o motivo: o validador genérico da API, não uma regra de negócio. */
const isGenericValidationFailure = (error: VoiceRoomApiError) =>
  (error.status === 400 || error.status === 422) &&
  /^valida[cç][aã]o falhou\.?$/i.test(error.message.trim());

export function shouldFallbackToSupabase(error: unknown): boolean {
  if (error instanceof VoiceRoomApiError) {
    return error.status >= 500 || RETRYABLE_4XX.has(error.status) || isGenericValidationFailure(error);
  }
  const name = error instanceof Error ? error.name : "";
  if (name === "AuthRequiredError") return false; // sessão local inválida: o RPC também falharia
  if (name === "RequestTimeoutError") return true; // Render frio
  // Erros sem tipo (rede, JSON ilegível). A checagem por texto é o último recurso e cobre os dois idiomas.
  const text = String((error as { message?: string })?.message ?? error ?? "").toLowerCase();
  if (
    text.includes("sessao expirada") ||
    text.includes("sessão expirada") ||
    text.includes("autenticacao") ||
    text.includes("autenticação") ||
    text.includes("auth")
  ) {
    return false;
  }
  return true;
}
