export type SocialPresenceStatus =
  | "online"
  | "playing"
  | "streaming"
  | "in_call"
  | "idle"
  | "dnd"
  | "offline";

const ACTIVE = new Set<SocialPresenceStatus>(["online", "playing", "streaming", "in_call", "idle", "dnd"]);

export const isPresenceActive = (status?: string | null): boolean =>
  ACTIVE.has(status as SocialPresenceStatus);

export const presenceLabel = (status?: string | null, playing?: string | null): string => {
  if (status === "playing") return playing ? `Jogando ${playing}` : "Jogando";
  if (status === "streaming") return "Transmitindo";
  if (status === "in_call") return "Em chamada";
  if (status === "idle") return "Ausente";
  if (status === "dnd") return "Não perturbe";
  if (status === "online") return "Online";
  return "Offline";
};

const DND_KEY = "checkpoint_presence_dnd";
export const PRESENCE_PREF_EVENT = "pherielium-presence-pref";

export const isManualDnd = (): boolean => {
  try {
    return localStorage.getItem(DND_KEY) === "1";
  } catch {
    return false;
  }
};

export const setManualDnd = (enabled: boolean) => {
  try {
    localStorage.setItem(DND_KEY, enabled ? "1" : "0");
    window.dispatchEvent(new Event(PRESENCE_PREF_EVENT));
  } catch {
    /* ignore */
  }
};
