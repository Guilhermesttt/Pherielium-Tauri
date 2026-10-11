/**
 * Mensagem de erro para quem está depurando.
 *
 * Vários caminhos críticos (entrar em chamada, editar sala, áudio do screen
 * share) mostravam um toast genérico e descartavam a exceção real, então não
 * dava para saber a causa sem instrumentar de novo. Aqui a causa vai sempre
 * para o console com um prefixo pesquisável, e só em dev ela entra no texto
 * visível — em produção a pessoa continua vendo a mensagem amigável.
 */
export const causeText = (error: unknown): string => {
  if (error instanceof Error) {
    const code = (error as { code?: string }).code;
    return code ? `${code}: ${error.message}` : error.message;
  }
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const e = error as { code?: string; message?: string; error?: string };
    const msg = e.message || e.error;
    if (msg) return e.code ? `${e.code}: ${msg}` : msg;
    try {
      return JSON.stringify(error);
    } catch {
      return String(error);
    }
  }
  return String(error);
};

/**
 * Loga a causa com um prefixo pesquisável e devolve o texto a exibir.
 * Em dev acrescenta a causa à mensagem amigável; em produção devolve só ela.
 */
export const reportFailure = (scope: string, friendly: string, error: unknown): string => {
  const cause = causeText(error);
  console.error(`[${scope}] ${friendly}`, { cause, error });
  return import.meta.env.DEV && cause ? `${friendly} (${cause})` : friendly;
};
