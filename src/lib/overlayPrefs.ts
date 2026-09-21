import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export type OverlayPrefs = {
  achievements: boolean;
  social: boolean;
  fluidAnimations: boolean;
  highContrast: boolean;
  muteAll: boolean;
  perfMonitor: boolean;
  captureShortcut: string;
  overlayShortcut: string;
};

export const DEFAULT_OVERLAY_PREFS: OverlayPrefs = {
  achievements: true,
  social: true,
  fluidAnimations: true,
  highContrast: false,
  muteAll: false,
  perfMonitor: false,
  captureShortcut: "F8",
  overlayShortcut: "Ctrl+Shift+O",
};

const LS_KEY = "pherielium-overlay-prefs";
const PREFS_EVENT = "pherielium-overlay-prefs";

function fromUnknown(raw: unknown): OverlayPrefs {
  const value = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    achievements: value.achievements !== false,
    social: value.social !== false,
    fluidAnimations: value.fluidAnimations !== false,
    highContrast: value.highContrast === true,
    muteAll: value.muteAll === true,
    perfMonitor: value.perfMonitor === true,
    captureShortcut: readShortcut(value.captureShortcut, DEFAULT_OVERLAY_PREFS.captureShortcut),
    overlayShortcut: readShortcut(value.overlayShortcut, DEFAULT_OVERLAY_PREFS.overlayShortcut),
  };
}

function readShortcut(raw: unknown, fallback: string): string {
  return typeof raw === "string" && raw.trim() ? raw.trim() : fallback;
}

function readLocal(): OverlayPrefs {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return DEFAULT_OVERLAY_PREFS;
    return fromUnknown(JSON.parse(raw));
  } catch {
    return DEFAULT_OVERLAY_PREFS;
  }
}

function writeLocal(prefs: OverlayPrefs) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(prefs));
  } catch {
    /* ignore */
  }
}

function notifyLocal(prefs: OverlayPrefs) {
  writeLocal(prefs);
  try {
    window.dispatchEvent(new CustomEvent(PREFS_EVENT, { detail: prefs }));
  } catch {
    /* ignore */
  }
}

export async function loadOverlayPrefs(): Promise<OverlayPrefs> {
  try {
    const remote = await invoke<unknown>("overlay_prefs_get");
    const prefs = fromUnknown(remote);
    writeLocal(prefs);
    return prefs;
  } catch {
    return readLocal();
  }
}

export async function saveOverlayPrefs(patch: Partial<OverlayPrefs>): Promise<OverlayPrefs> {
  const current = await loadOverlayPrefs();
  const next = { ...current, ...patch };
  try {
    const remote = await invoke<unknown>("overlay_prefs_set", { prefs: next });
    const merged = fromUnknown(remote);
    notifyLocal(merged);
    return merged;
  } catch {
    return current;
  }
}

export function onOverlayPrefsChanged(handler: (prefs: OverlayPrefs) => void): () => void {
  const onLocal = (event: Event) => {
    handler(fromUnknown((event as CustomEvent).detail));
  };
  window.addEventListener(PREFS_EVENT, onLocal);

  let cancelled = false;
  let unlisten: UnlistenFn | undefined;
  void listen<unknown>("overlay:prefs", (event) => {
    const prefs = fromUnknown(event.payload);
    writeLocal(prefs);
    handler(prefs);
  }).then((fn) => {
    if (cancelled) {
      fn();
      return;
    }
    unlisten = fn;
  });
  return () => {
    cancelled = true;
    window.removeEventListener(PREFS_EVENT, onLocal);
    unlisten?.();
  };
}

export type SystemPerfSnapshot = {
  cpu: number;
  ramUsed: number;
  ramTotal: number;
  ramPercent: number;
};

export async function loadSystemPerfSnapshot(): Promise<SystemPerfSnapshot | null> {
  try {
    const raw = await invoke<SystemPerfSnapshot>("system_perf_snapshot");
    if (!raw || typeof raw.cpu !== "number") return null;
    return raw;
  } catch {
    return null;
  }
}

export function formatShortcutLabel(spec: string): string {
  return spec
    .split("+")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" + ");
}

export function shortcutFromKeyboardEvent(event: KeyboardEvent): string | null {
  if (["Control", "Shift", "Alt", "Meta"].includes(event.key)) return null;
  if (event.key === "Escape") return null;
  const key = keyTokenFromEvent(event);
  if (!key) return null;
  const mods: string[] = [];
  if (event.ctrlKey || event.metaKey) mods.push("Ctrl");
  if (event.altKey) mods.push("Alt");
  if (event.shiftKey) mods.push("Shift");
  return [...mods, key].join("+");
}

function keyTokenFromEvent(event: KeyboardEvent): string | null {
  const { code } = event;
  if (/^F([1-9]|1[0-2])$/.test(code)) return code;
  if (code === "PrintScreen") return "PrintScreen";
  if (code === "Tab") return "Tab";
  if (code === "Space") return "Space";
  if (code === "Enter") return "Enter";
  if (code.startsWith("Key") && code.length === 4) return code.slice(3);
  if (code.startsWith("Digit") && code.length === 6) return code.slice(5);
  const named = [
    "Minus",
    "Equal",
    "Comma",
    "Period",
    "Slash",
    "Backslash",
    "Semicolon",
    "Quote",
    "Backquote",
    "BracketLeft",
    "BracketRight",
    "Home",
    "End",
    "PageUp",
    "PageDown",
    "Insert",
    "Delete",
    "Backspace",
    "ArrowUp",
    "ArrowDown",
    "ArrowLeft",
    "ArrowRight",
  ];
  if (named.includes(code)) return code;
  const key = event.key.toUpperCase();
  if (/^[A-Z0-9]$/.test(key)) return key;
  return null;
}
