// Minimal asset downloader stub used by the runtime to ensure large assets are available.
// Real download and extraction should be implemented in the Electron main process and
// exposed via the electronAPI bridge (window.electronAPI.downloadAssets).

export async function ensureAssetsAvailable(manifestPath = "/assets/manifest.json") {
  const electronApi = typeof window !== "undefined" ? (window as unknown as { electronAPI?: { downloadAssets?: (path: string) => Promise<unknown> } }).electronAPI : undefined;
  if (electronApi?.downloadAssets) {
    try {
      return await electronApi.downloadAssets(manifestPath);
    } catch (e) {
      console.warn("[assets] Falha ao baixar assets via electronAPI:", e);
      throw e;
    }
  }

  const globalProcess = (globalThis as unknown as { process?: { versions?: { node?: string } } }).process;
  if (globalProcess?.versions?.node) {
    console.warn(
      "[assets] Em ambiente Node sem electron bridge: implemente um instalador de assets ou instale manualmente."
    );
    return false;
  }

  // Browser fallback: nada a fazer
  return false;
}
