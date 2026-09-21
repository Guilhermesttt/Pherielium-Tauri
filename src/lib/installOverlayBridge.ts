/**
 * Overlay window bridge — mirrors Electron `achievementOverlay` preload via Tauri events.
 */
import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

type OverlayCallback = (payload: unknown) => void;

function bindEvent(channel: string, callback: OverlayCallback): () => void {
  let unlisten: UnlistenFn | null = null;
  let cancelled = false;

  void listen<unknown>(channel, (event) => {
    callback(event.payload);
  }).then((fn) => {
    if (cancelled) {
      void fn();
      return;
    }
    unlisten = fn;
  });

  return () => {
    cancelled = true;
    if (unlisten) void unlisten();
  };
}

export function installOverlayBridge(): void {
  if ((window as unknown as { achievementOverlay?: unknown }).achievementOverlay) return;

  (window as unknown as { achievementOverlay: Record<string, unknown> }).achievementOverlay = {
    onUnlock: (callback: OverlayCallback) => bindEvent("achievement:unlock", callback),
    onWelcome: (callback: OverlayCallback) => bindEvent("achievement:welcome", callback),
    onSocial: (callback: OverlayCallback) => bindEvent("overlay:social", callback),
    onPlaySound: (callback: OverlayCallback) => bindEvent("overlay:play-sound", callback),
    onPanelVisibility: (callback: OverlayCallback) =>
      bindEvent("overlay:panel-visibility", callback),
    onPanelState: (callback: OverlayCallback) => bindEvent("overlay:panel-state", callback),
    onPanelCommand: (callback: OverlayCallback) => bindEvent("overlay:panel-command", callback),
    panelAction: (action: unknown) => invoke("overlay_panel_action", { action }),
  };
}
