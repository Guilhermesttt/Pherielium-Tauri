/**
 * Registro dos motivos pelos quais uma chamada 1:1 terminou por falha de mídia (D1).
 *
 * Guarda as últimas entradas em `localStorage` e imprime um texto curto para colar. Só entram a razão, o papel
 * (quem liga ou quem atende), as tentativas e os 4 primeiros caracteres da conversa: nenhum token nem UID completo.
 *
 * Ler:  await window.pherieliumCallFailures()
 */
import type { LiveKitFailureReason } from "./livekitConnectPolicy";

const STORAGE_KEY = "pherielium_call_failures_v1";
const MAX_ENTRIES = 20;

export type CallRole = "caller" | "callee";

export interface CallFailureEntry {
  t: number;
  role: CallRole;
  reason: LiveKitFailureReason;
  attempts: number;
  /** 4 primeiros caracteres do chatId. */
  chat: string;
}

export interface FailureStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function loadFailures(storage: FailureStorage | null): CallFailureEntry[] {
  if (!storage) return [];
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as CallFailureEntry[]).slice(-MAX_ENTRIES) : [];
  } catch (error) {
    console.warn("[callFailureLog] ignorando registro ilegível:", error);
    return [];
  }
}

/** Soma uma falha ao registro e devolve a lista nova (limitada às últimas entradas). */
export function appendFailure(
  existing: CallFailureEntry[],
  input: { role: CallRole; reason: LiveKitFailureReason; attempts: number; chatId: string; now?: number },
): CallFailureEntry[] {
  return [
    ...existing,
    {
      t: input.now ?? Date.now(),
      role: input.role,
      reason: input.reason,
      attempts: input.attempts,
      chat: input.chatId.slice(0, 4),
    },
  ].slice(-MAX_ENTRIES);
}

export function saveFailures(storage: FailureStorage | null, entries: CallFailureEntry[]): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(entries));
  } catch (error) {
    console.warn("[callFailureLog] não foi possível salvar o registro:", error);
  }
}

const pad = (n: number): string => String(n).padStart(2, "0");
const stamp = (t: number): string => {
  const d = new Date(t);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
};

export function formatFailures(entries: CallFailureEntry[], appVersion: string): string {
  const lines = ["=== Pherielium call failures ===", `app=${appVersion} entries=${entries.length}`];
  if (entries.length === 0) lines.push("(nenhuma falha de mídia registrada)");
  for (const entry of entries) {
    lines.push(`${stamp(entry.t)} ${entry.role} reason=${entry.reason} attempts=${entry.attempts} chat=${entry.chat}`);
  }
  return lines.join("\n");
}

// ---- runtime -----------------------------------------------------------------------------

function browserStorage(): FailureStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch (error) {
    console.warn("[callFailureLog] localStorage indisponível:", error);
    return null;
  }
}

let installed = false;

export function logCallFailure(input: { role: CallRole; reason: LiveKitFailureReason; attempts: number; chatId: string }): void {
  const storage = browserStorage();
  const next = appendFailure(loadFailures(storage), input);
  saveFailures(storage, next);
  console.warn(`[call:failure] ${input.role} reason=${input.reason} attempts=${input.attempts}`);
}

/** Instala `window.pherieliumCallFailures()`. Idempotente. */
export function installCallFailureReport(getAppVersion: () => Promise<string>): void {
  if (installed || typeof window === "undefined") return;
  installed = true;
  (window as unknown as { pherieliumCallFailures?: () => Promise<string> }).pherieliumCallFailures = async () => {
    const text = formatFailures(loadFailures(browserStorage()), await getAppVersion());
    console.info(text);
    try {
      await navigator.clipboard.writeText(text);
    } catch (error) {
      console.warn("[callFailureLog] não foi possível copiar; copie o texto acima.", error);
    }
    return text;
  };
}
