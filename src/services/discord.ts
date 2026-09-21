import {
  AUTH_TIMEOUT_MS,
  AuthRequiredError,
  apiFetch,
  getUsableSession,
} from "./api";

type ElectronLinkedAuthResult = {
  ok?: boolean;
  provider?: string;
  requestId?: string;
  url?: string;
  opened?: boolean;
};

const getElectronApi = () =>
  typeof window !== "undefined" ? (window.electronAPI as any) : null;

/**
 * Resolve a URL de OAuth do Discord.
 *
 * No Electron, a chamada POST autenticada para /auth/discord/start e feita no
 * main process. Isso evita que o renderer empacotado (file://) dependa de CORS
 * para iniciar o OAuth.
 *
 * Mantemos o retorno da URL para compatibilidade com useAccountConnections,
 * que ja abre o navegador via electronAPI.openExternalUrl().
 */
export const getDiscordLinkUrl = async (): Promise<string> => {
  const session = await getUsableSession();
  const accessToken = session?.access_token;

  if (!accessToken) {
    throw new AuthRequiredError(
      "Sessão expirada. Entre novamente para conectar o Discord.",
    );
  }

  const electronApi = getElectronApi();
  if (typeof electronApi?.startLinkedAccountBrowser === "function") {
    const result = (await electronApi.startLinkedAccountBrowser(
      "discord",
      accessToken,
      { openBrowser: false },
    )) as ElectronLinkedAuthResult | null;

    if (!result?.ok || !result.url) {
      throw new Error(
        "O processo principal não retornou a URL de autenticação do Discord.",
      );
    }

    return result.url;
  }

  // Browser/web fallback.
  const response = await apiFetch("/auth/discord/start", {
    method: "POST",
    authenticated: true,
    timeoutMs: AUTH_TIMEOUT_MS,
  });

  const payload = (await response
    .json()
    .catch(() => ({}))) as { url?: string; error?: string };

  if (!response.ok) {
    throw new Error(
      payload.error || "Não foi possível iniciar a conexão com o Discord.",
    );
  }

  if (!payload.url) {
    throw new Error("Backend não retornou a URL de autenticação do Discord.");
  }

  return payload.url;
};

export const disconnectDiscordAccount = async () => {
  const response = await apiFetch("/api/discord/disconnect", {
    method: "POST",
    authenticated: true,
    timeoutMs: AUTH_TIMEOUT_MS,
  });

  if (!response.ok) {
    const payload = (await response
      .json()
      .catch(() => ({}))) as { error?: string };

    throw new Error(payload.error || "Falha ao desconectar Discord.");
  }
};
