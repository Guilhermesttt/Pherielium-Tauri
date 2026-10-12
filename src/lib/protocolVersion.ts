/**
 * Versão do protocolo de comunicação do app (presença, chamadas, mensagens).
 *
 * v1 = o app 1.0.2 e anteriores (canais Realtime públicos; não enviam versão nenhuma).
 * v2 = o app que já envia `pv` e sabe pular o fast-path de DM com texto para pares v2 (1.0.3 em diante).
 *
 * Quem não envia `pv` é tratado como protocolo 1. Ver docs/backend-audit/PLAN.md §3 (convivência de versões).
 */
export const APP_PROTOCOL_VERSION = 2;

let cachedAppVersion: string | null = null;

/** Versão do app (`getVersion()` do Tauri), em cache. Fora do Tauri (testes, navegador) devolve "unknown". */
export async function getAppVersionCached(): Promise<string> {
  if (cachedAppVersion) return cachedAppVersion;
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    cachedAppVersion = await getVersion();
  } catch (error) {
    console.warn("[protocolVersion] sem versão do app (fora do Tauri?):", error);
    cachedAppVersion = "unknown";
  }
  return cachedAppVersion;
}

/** Versão já resolvida, ou `undefined` se ainda não foi lida (uso em caminhos síncronos). */
export function peekAppVersion(): string | undefined {
  return cachedAppVersion ?? undefined;
}

/** Campos de versão a anexar a um payload de evento (presença, convite). */
export function protocolFields(appVersion?: string): { pv: number; av?: string } {
  return appVersion ? { pv: APP_PROTOCOL_VERSION, av: appVersion } : { pv: APP_PROTOCOL_VERSION };
}
