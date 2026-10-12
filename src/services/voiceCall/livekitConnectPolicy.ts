/**
 * Política de conexão ao LiveKit para chamadas 1:1 (D1): classificar a falha, tentar de novo com recuo e,
 * se esgotar, falhar de forma clara em vez de cair em silêncio para outro transporte.
 *
 * Pura de propósito (sem React, rede ou armazenamento): o relógio e o `sleep` são injetáveis nos testes.
 * Decisão registrada em docs/decisions/0006-chamada-sem-fallback-p2p-silencioso.md.
 */

export type LiveKitFailureReason =
  | "livekit_disabled"
  | "token_unauthorized"
  | "token_timeout"
  | "network"
  | "room_invalid"
  | "media_error";

export const MAX_LIVEKIT_ATTEMPTS = 3;
/** Espera entre tentativas (ms): 1 s antes da 2ª, 2 s antes da 3ª. */
export const LIVEKIT_RETRY_DELAYS_MS: readonly number[] = [1000, 2000];

const errorName = (error: unknown): string => (error instanceof Error ? error.name : "");
const errorText = (error: unknown): string =>
  (error instanceof Error ? error.message : String(error ?? "")).toLowerCase();

/** Agrupa o erro numa razão estável, usada para decidir se vale tentar de novo e para o registro. */
export function classifyLiveKitError(error: unknown): LiveKitFailureReason {
  const name = errorName(error);
  const text = errorText(error);
  if (name === "AuthRequiredError") return "token_unauthorized";
  if (name === "RequestTimeoutError") return "token_timeout";
  if (text.includes("não habilitado") || text.includes("nao habilitado") || text.includes("disabled")) return "livekit_disabled";
  if (text.includes("identificador de sala")) return "room_invalid";
  if (
    text.includes("autenticacao invalido") ||
    text.includes("autenticação inválida") ||
    text.includes("unauthorized") ||
    text.includes("sessao expirada") ||
    text.includes("sessão expirada") ||
    text.includes("sessao de autenticacao")
  ) {
    return "token_unauthorized";
  }
  if (text.includes("timeout") || text.includes("timed out") || text.includes("excedeu")) return "token_timeout";
  if (text.includes("failed to fetch") || text.includes("networkerror") || text.includes("network request failed") || text.includes("load failed")) {
    return "network";
  }
  return "media_error";
}

/** Repetir não adianta quando o servidor recusou de propósito ou o pedido é inválido. */
export function isRetryableReason(reason: LiveKitFailureReason): boolean {
  return reason !== "token_unauthorized" && reason !== "room_invalid" && reason !== "livekit_disabled";
}

const MESSAGES: Record<LiveKitFailureReason, string> = {
  livekit_disabled: "O servidor de voz está desativado no momento.",
  token_unauthorized: "Sua sessão expirou. Entre novamente para fazer chamadas.",
  token_timeout: "O servidor de voz demorou para responder. Tente de novo em instantes.",
  network: "Sem conexão com o servidor de voz. Verifique sua internet.",
  room_invalid: "Não foi possível identificar esta chamada.",
  media_error: "Não foi possível conectar ao servidor de voz.",
};

/** Mensagem curta, em português, para mostrar ao usuário. */
export function describeLiveKitFailure(reason: LiveKitFailureReason): string {
  return MESSAGES[reason];
}

/** Erro final de `connectWithRetry`: guarda a razão, quantas tentativas foram feitas e a causa original. */
export class LiveKitConnectError extends Error {
  readonly reason: LiveKitFailureReason;
  readonly attempts: number;
  readonly cause: unknown;

  constructor(reason: LiveKitFailureReason, attempts: number, cause: unknown) {
    super(describeLiveKitFailure(reason));
    this.name = "LiveKitConnectError";
    this.reason = reason;
    this.attempts = attempts;
    this.cause = cause;
  }
}

/** A chamada foi encerrada pelo usuário enquanto a conexão ainda tentava: não é uma falha para mostrar. */
export class ConnectCancelledError extends Error {
  constructor() {
    super("Conexão cancelada.");
    this.name = "ConnectCancelledError";
  }
}

export interface RetryOptions {
  /** Devolve `true` quando a chamada foi encerrada; checado antes de cada tentativa e depois de cada espera. */
  isCancelled?: () => boolean;
  maxAttempts?: number;
  delaysMs?: readonly number[];
  sleep?: (ms: number) => Promise<void>;
  /** Chamado antes de esperar para a próxima tentativa (log). */
  onRetry?: (info: { attempt: number; reason: LiveKitFailureReason; waitMs: number }) => void;
}

const realSleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Executa `run` até `maxAttempts` vezes. Falhas que não adiantam repetir (sessão inválida, sala inválida, LiveKit desligado)
 * encerram na hora. Ao esgotar, lança `LiveKitConnectError`.
 */
export async function connectWithRetry<T>(run: (attempt: number) => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxAttempts = options.maxAttempts ?? MAX_LIVEKIT_ATTEMPTS;
  const delays = options.delaysMs ?? LIVEKIT_RETRY_DELAYS_MS;
  const sleep = options.sleep ?? realSleep;

  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    if (options.isCancelled?.()) throw new ConnectCancelledError();
    try {
      return await run(attempt);
    } catch (error) {
      lastError = error;
      if (options.isCancelled?.()) throw new ConnectCancelledError();
      const reason = classifyLiveKitError(error);
      if (!isRetryableReason(reason) || attempt === maxAttempts) {
        throw new LiveKitConnectError(reason, attempt, error);
      }
      const waitMs = delays[Math.min(attempt - 1, delays.length - 1)] ?? 0;
      options.onRetry?.({ attempt, reason, waitMs });
      await sleep(waitMs);
    }
  }
  // Inalcançável (o laço sempre retorna ou lança); mantém o tipo satisfeito sem `unwrap`.
  throw new LiveKitConnectError(classifyLiveKitError(lastError), maxAttempts, lastError);
}
