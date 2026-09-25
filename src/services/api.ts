import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

const PROD_BACKEND_URL = "https://checkpoint-launcher.onrender.com";
const DEFAULT_TIMEOUT_MS = 15_000;
export const AUTH_TIMEOUT_MS = 35_000;
const SESSION_REFRESH_THRESHOLD_MS = 30_000;

const normalizeUrl = (value: string) => value.replace(/\/+$/, "");

const isLocalHostname = (hostname: string) =>
  hostname === "localhost" ||
  hostname === "127.0.0.1" ||
  hostname === "0.0.0.0" ||
  hostname === "tauri.localhost" ||
  hostname.endsWith(".localhost");

export const resolveBackendUrl = (
  envUrl: string | undefined = import.meta.env.VITE_BACKEND_URL,
  isProd: boolean = import.meta.env.PROD,
  origin: string = typeof window !== "undefined" && window.location ? window.location.origin : "",
  hostname: string = typeof window !== "undefined" && window.location ? window.location.hostname : "",
) => {
  const configured = envUrl?.trim() ? normalizeUrl(envUrl.trim()) : "";

  if (isProd) {
    if (configured) {
      try {
        const url = new URL(configured);
        if (url.protocol === "https:" && !isLocalHostname(url.hostname)) {
          return normalizeUrl(url.toString());
        }
      } catch {
        console.warn("[API] VITE_BACKEND_URL invalida:", configured);
      }
    }

    // Aplicacao web hospedada em uma origem HTTP(S) remota (ex: Vercel, Netlify).
    // No Tauri / Electron empacotado, a origin e tauri://localhost, http://tauri.localhost ou file://
    const isDesktopShell =
      origin.startsWith("tauri://") ||
      origin.includes("tauri.localhost") ||
      origin.startsWith("file:") ||
      origin === "null";

    if (
      !isDesktopShell &&
      origin &&
      /^https?:\/\//i.test(origin) &&
      hostname &&
      !isLocalHostname(hostname)
    ) {
      return normalizeUrl(origin);
    }

    // Desktop empacotado (Tauri / Electron).
    return configured || PROD_BACKEND_URL;
  }

  if (configured === "http://localhost:8787" || configured === "https://localhost:8787") {
    return "http://localhost:8787";
  }

  // Em desenvolvimento local rodando via Vite dev server (localhost:1420),
  // retornamos "" para que apiUrl("/api/...") use o proxy do Vite dev server,
  // eliminando bloqueios de CORS do navegador em chamadas ao backend Render.
  if (isLocalHostname(hostname)) {
    return "";
  }

  if (configured) {
    return configured;
  }

  return PROD_BACKEND_URL;
};

const API_BASE_URL = resolveBackendUrl();

export const apiUrl = (path: string) => {
  if (!path) return API_BASE_URL || (typeof window !== "undefined" && window.location ? window.location.origin : "");
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

export const getApiBaseUrl = () => API_BASE_URL;

export class RequestTimeoutError extends Error {
  public readonly timeoutMs: number;
  constructor(timeoutMs: number) {
    super(`A requisicao excedeu ${timeoutMs}ms.`);
    this.timeoutMs = timeoutMs;
    this.name = "RequestTimeoutError";
  }
}

export class AuthRequiredError extends Error {
  constructor(message = "Sessao de autenticacao necessaria.") {
    super(message);
    this.name = "AuthRequiredError";
  }
}

export class ApiError extends Error {
  public readonly status?: number;
  public readonly code?: string;
  constructor(message: string, status?: number, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
    this.name = "ApiError";
  }
}

export const fetchWithTimeout = async (
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs: number = DEFAULT_TIMEOUT_MS,
): Promise<Response> => {
  const controller = new AbortController();
  const parentSignal = init.signal;

  const abortFromParent = () => {
    controller.abort(
      parentSignal?.reason ?? new DOMException("Request aborted", "AbortError"),
    );
  };

  if (parentSignal?.aborted) {
    abortFromParent();
  } else {
    parentSignal?.addEventListener("abort", abortFromParent, { once: true });
  }

  const timer = globalThis.setTimeout(() => {
    controller.abort(new RequestTimeoutError(timeoutMs));
  }, timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    globalThis.clearTimeout(timer);
    parentSignal?.removeEventListener("abort", abortFromParent);
  }
};

let refreshPromise: Promise<Session | null> | null = null;

/**
 * Garante que apenas um refresh de sessao rode por vez.
 * Requests concorrentes aguardam a mesma Promise em vez de disparar varios
 * refreshSession() simultaneamente.
 */
export const refreshSupabaseSessionOnce = async (): Promise<Session | null> => {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        console.warn("[Auth] Nao foi possivel renovar a sessao:", error.message);
        return null;
      }

      return data.session ?? null;
    } catch (error) {
      // Falha de rede nao equivale automaticamente a refresh token revogado.
      console.warn("[Auth] Falha de rede renovando sessao:", error);
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/**
 * Retorna uma sessao utilizavel para chamadas protegidas.
 * Se o token estiver perto de vencer, tenta um unico refresh compartilhado.
 * Se o refresh falhar mas o access token atual ainda for valido, ele continua
 * sendo usado ate expirar.
 */
export const getUsableSession = async (): Promise<Session | null> => {
  let session: Session | null = null;

  try {
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      console.warn("[Auth] Nao foi possivel ler a sessao:", error.message);
    }
    session = data.session ?? null;
  } catch (error) {
    console.warn("[Auth] Falha de rede lendo a sessao:", error);
    return null;
  }

  if (!session) {
    return null;
  }

  if (!session.expires_at) {
    return session;
  }

  const remainingMs = session.expires_at * 1000 - Date.now();

  if (remainingMs > SESSION_REFRESH_THRESHOLD_MS) {
    return session;
  }

  const refreshed = await refreshSupabaseSessionOnce();
  if (refreshed) {
    return refreshed;
  }

  // Se houve oscilacao de rede, ainda podemos usar o token enquanto nao venceu.
  if (remainingMs > 0) {
    return session;
  }

  return null;
};

export const getAuthHeaders = async (
  withJson = false,
): Promise<Record<string, string>> => {
  const session = await getUsableSession();
  const headers: Record<string, string> = {};

  if (withJson) {
    headers["Content-Type"] = "application/json";
  }

  if (session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  return headers;
};

export const getRequiredAuthHeaders = async (
  withJson = false,
): Promise<Record<string, string>> => {
  const session = await getUsableSession();

  if (!session?.access_token) {
    throw new AuthRequiredError();
  }

  return {
    ...(withJson ? { "Content-Type": "application/json" } : {}),
    Authorization: `Bearer ${session.access_token}`,
  };
};

export interface ApiFetchOptions extends RequestInit {
  authenticated?: boolean;
  timeoutMs?: number;
}

/**
 * Wrapper central para requests ao backend.
 * Em requests autenticados, um 401 dispara um unico refresh compartilhado e
 * retenta a chamada uma vez com headers atualizados. Um segundo 401 nao
 * tenta de novo (flag de retry evita loop infinito).
 */
export const apiFetch = async (
  path: string,
  options: ApiFetchOptions = {},
): Promise<Response> => {
  const {
    authenticated = false,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    headers: suppliedHeaders,
    ...requestInit
  } = options;

  const requestUrl = apiUrl(path);

  const buildHeaders = async () => {
    const headers = new Headers(suppliedHeaders);
    if (authenticated) {
      const authHeaders = await getRequiredAuthHeaders();
      for (const [key, value] of Object.entries(authHeaders)) {
        headers.set(key, value);
      }
    }
    return headers;
  };

  const execute = async (hasRetried: boolean): Promise<Response> => {
    const headers = await buildHeaders();
    const response = await fetchWithTimeout(
      requestUrl,
      {
        ...requestInit,
        headers,
      },
      timeoutMs,
    );

    if (
      authenticated &&
      response.status === 401 &&
      !hasRetried
    ) {
      const refreshed = await refreshSupabaseSessionOnce();
      if (refreshed) {
        return execute(true);
      }
    }

    return response;
  };

  try {
    return await execute(false);
  } catch (error) {
    // Nunca logar Authorization, access token ou refresh token.
    console.error("[API] Network request failed", {
      path,
      method: requestInit.method ?? "GET",
      backend: API_BASE_URL,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }
};

export const isBackendHealthy = async (timeoutMs = 3500) => {
  try {
    const response = await fetchWithTimeout(apiUrl("/health"), undefined, timeoutMs);
    return response.ok;
  } catch {
    return false;
  }
};
