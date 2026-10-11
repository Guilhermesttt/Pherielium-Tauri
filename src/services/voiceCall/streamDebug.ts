/**
 * Opt-in debug logging for the voice/screen-share pipeline.
 *
 * Enable at runtime with `localStorage.setItem("pherielium_stream_debug", "1")`
 * and reload. Not a user-facing feature: no UI, no persistence of log data, and
 * everything is a no-op when the flag is off.
 */
const FLAG_KEY = "pherielium_stream_debug";

export function isStreamDebugEnabled(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage.getItem(FLAG_KEY) === "1";
  } catch (error) {
    // Storage can throw in locked-down webviews; treat as "flag off".
    console.warn("[streamDebug] localStorage unavailable:", error);
    return false;
  }
}

export function streamDebugLog(scope: string, data: unknown): void {
  if (!isStreamDebugEnabled()) return;
  console.info(`[stream-debug:${scope}]`, data);
}
