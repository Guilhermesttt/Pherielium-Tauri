/**
 * Formata erros de sistema e rede em mensagens amigáveis ao usuário final,
 * sanitizando tokens, cookies e headers de autorização sensíveis.
 */
export interface FormattedErrorResult {
  friendlyMessage: string;
  technicalDetails: string;
}

export function formatUserFacingError(
  error: unknown,
  fallbackContext: string = "Ocorreu um erro inesperado no sistema.",
): FormattedErrorResult {
  const rawMessage =
    error instanceof Error
      ? error.message || error.stack || String(error)
      : typeof error === "string"
        ? error
        : JSON.stringify(error || {});

  // Sanitização de dados sensíveis em URLs ou headers
  const sanitizedDetails = rawMessage
    .replace(/(authorization:\s*)[^\s\n]+/gi, "$1[REDACTED]")
    .replace(/(cookie:\s*)[^\s\n]+/gi, "$1[REDACTED]")
    .replace(/(key=)[^&\s\n]+/gi, "$1[REDACTED]")
    .replace(/(token=)[^&\s\n]+/gi, "$1[REDACTED]");

  let friendlyMessage = fallbackContext;

  if (/yamlexception|syntaxerror|unexpected token/i.test(sanitizedDetails)) {
    friendlyMessage =
      "Não foi possível processar a resposta do servidor. As informações recebidas estão corrompidas ou indisponíveis.";
  } else if (/net::ERR_INTERNET_DISCONNECTED|ENOTFOUND|fetch failed|network error/i.test(sanitizedDetails)) {
    friendlyMessage =
      "Conexão com a internet indisponível ou interrompida. Verifique sua rede e tente novamente.";
  } else if (/404|not found/i.test(sanitizedDetails)) {
    friendlyMessage = "O recurso solicitado não foi encontrado no servidor.";
  } else if (/401|403|unauthorized|forbidden/i.test(sanitizedDetails)) {
    friendlyMessage = "Sua sessão expirou ou você não possui permissão para esta ação.";
  } else if (/EACCES|EPERM|permission denied/i.test(sanitizedDetails)) {
    friendlyMessage = "Permissão de arquivo negada pelo Windows. Tente executar o launcher como Administrador.";
  }

  return {
    friendlyMessage,
    technicalDetails: sanitizedDetails,
  };
}
