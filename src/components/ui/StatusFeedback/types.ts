export type ErrorKind = "network" | "auth" | "timeout" | "business" | "unknown";

export interface AppErrorDetails {
  kind: ErrorKind;
  title?: string;
  message: string;
  code?: string;
  retry?: () => void | Promise<void>;
  actionLabel?: string;
}

export function categorizeError(error: unknown): AppErrorDetails {
  if (!error) {
    return { kind: "unknown", message: "Ocorreu um erro desconhecido." };
  }

  const err = error as any;
  const msg = String(err.message || err.error_description || err.error || err || "").toLowerCase();

  if (
    msg.includes("network") ||
    msg.includes("failed to fetch") ||
    msg.includes("offline") ||
    msg.includes("connection refused") ||
    msg.includes("econnrefused") ||
    msg.includes("net::err")
  ) {
    return {
      kind: "network",
      title: "Falha de Conexão",
      message: "Não foi possível se comunicar com o servidor. Verifique sua conexão com a internet.",
      actionLabel: "Tentar novamente",
    };
  }

  if (
    msg.includes("unauthorized") ||
    msg.includes("jwt") ||
    msg.includes("token expired") ||
    msg.includes("invalid refresh token") ||
    msg.includes("auth") ||
    msg.includes("401") ||
    msg.includes("403")
  ) {
    return {
      kind: "auth",
      title: "Sessão Expirada",
      message: "Sua sessão expirou ou não possui autorização. Por favor, autentique-se novamente.",
      actionLabel: "Fazer login",
    };
  }

  if (msg.includes("timeout") || msg.includes("timed out") || msg.includes("deadline exceeded") || msg.includes("504")) {
    return {
      kind: "timeout",
      title: "Tempo Limite Excedido",
      message: "A requisição demorou muito para responder. O serviço pode estar sobrecarregado.",
      actionLabel: "Tentar novamente",
    };
  }

  return {
    kind: "business",
    title: "Aviso do Sistema",
    message: err.message || "Não foi possível completar a operação solicitada.",
    actionLabel: "Recarregar",
  };
}
