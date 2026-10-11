/**
 * Abre um link no navegador padrão.
 *
 * No app desktop `target="_blank"` não abre nada de forma confiável (a WebView
 * não tem para onde abrir uma aba), então o caminho certo é o comando do shell.
 * Fora do desktop (dev no navegador, e2e) cai para `window.open`.
 */
export async function openExternal(url: string): Promise<void> {
  if (!/^https?:\/\//i.test(url)) return; // nunca abre esquema que não seja web
  const api = typeof window !== "undefined" ? window.electronAPI : undefined;
  if (api?.openExternalUrl) {
    await api.openExternalUrl(url);
    return;
  }
  if (typeof window !== "undefined") window.open(url, "_blank", "noopener,noreferrer");
}
