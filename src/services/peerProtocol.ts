/**
 * Memória da versão de protocolo de cada amigo, aprendida dos eventos que ele envia (campo `pv`).
 *
 * Serve para decidir, por par, se dá para pular o fast-path de DM com texto: só quando o amigo é protocolo >= 2
 * (receberá a mensagem pelo Postgres Changes, que respeita RLS). Amigo desconhecido é tratado como v1.
 *
 * O `pv` vem de eventos em canais públicos e é forjável. O pior caso de um `pv` forjado é um amigo v1 receber a DM
 * só pelo Postgres Changes (mais lento), nunca perder a mensagem: o INSERT continua chegando pelo banco.
 */
import { isFlagOn } from "../lib/featureFlags";

const STORAGE_KEY = "pherielium_peer_protocol_v1";
const TTL_MS = 14 * 24 * 60 * 60 * 1000;
/** Protocolo mínimo do par para pular o fast-path com texto. */
export const DM_PING_ONLY_MIN_PROTOCOL = 2;

export interface PeerStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface Entry {
  pv: number;
  at: number;
}

const memory = new Map<string, Entry>();
let loaded = false;

function defaultStorage(): PeerStorage | null {
  try {
    return typeof localStorage === "undefined" ? null : localStorage;
  } catch (error) {
    console.warn("[peerProtocol] localStorage indisponível:", error);
    return null;
  }
}

function load(storage: PeerStorage | null): void {
  if (loaded) return;
  loaded = true;
  if (!storage) return;
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return;
    for (const [uid, value] of Object.entries(parsed)) {
      const entry = value as Partial<Entry>;
      if (typeof entry?.pv === "number" && typeof entry?.at === "number") memory.set(uid, { pv: entry.pv, at: entry.at });
    }
  } catch (error) {
    console.warn("[peerProtocol] ignorando cache ilegível:", error);
  }
}

function persist(storage: PeerStorage | null): void {
  if (!storage) return;
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(Object.fromEntries(memory)));
  } catch (error) {
    console.warn("[peerProtocol] não foi possível salvar o cache:", error);
  }
}

/** Registra o `pv` de um amigo. Valores que não são inteiros positivos são ignorados. */
export function recordPeerProtocol(
  uid: string,
  pv: unknown,
  now = Date.now(),
  storage: PeerStorage | null = defaultStorage(),
): void {
  if (!uid || typeof pv !== "number" || !Number.isInteger(pv) || pv < 1 || pv > 99) return;
  load(storage);
  const previous = memory.get(uid);
  memory.set(uid, { pv, at: now });
  if (!previous || previous.pv !== pv) persist(storage);
}

/** Protocolo conhecido do amigo, ou `null` se desconhecido ou vencido. */
export function getPeerProtocol(uid: string, now = Date.now(), storage: PeerStorage | null = defaultStorage()): number | null {
  load(storage);
  const entry = memory.get(uid);
  if (!entry || now - entry.at > TTL_MS) return null;
  return entry.pv;
}

/** Decisão pura: usar o fast-path com texto? `false` só quando a flag está ligada e o par é protocolo >= 2. */
export function shouldUseTextFastPath(peerProtocol: number | null, pingOnlyEnabled: boolean): boolean {
  if (!pingOnlyEnabled) return true;
  return peerProtocol === null || peerProtocol < DM_PING_ONLY_MIN_PROTOCOL;
}

/** Flag `pherielium_dm_ping_only` (padrão ligada): "1"/"0" para ligar/desligar sem lançar versão. */
export function isDmPingOnlyEnabled(): boolean {
  return isFlagOn("dm_ping_only", true);
}

/** Só para testes. */
export function resetPeerProtocolForTests(): void {
  memory.clear();
  loaded = false;
}
