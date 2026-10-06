export type MascotMood =
  | "idle"
  | "sleeping"
  | "music"
  | "calling"
  | "muted"
  | "gaming"
  | "happy"
  | "surprised"
  | "excited"
  | "angry"
  | "sad"
  | "scared"
  | "suspicious"
  | "confused"
  | "curious"
  | "proud"
  | "shy"
  | "bored"
  | "drowsy"
  | "attentive"
  | "wink"
  | "thinking"
  | "annoyed"
  | "dizzy";

export const MASCOT_MOODS: { id: MascotMood; label: string }[] = [
  { id: "idle", label: "Tranquilo" },
  { id: "happy", label: "Feliz" },
  { id: "excited", label: "Animado" },
  { id: "surprised", label: "Surpreso" },
  { id: "attentive", label: "Atento" },
  { id: "curious", label: "Curioso" },
  { id: "thinking", label: "Pensando" },
  { id: "confused", label: "Confuso" },
  { id: "suspicious", label: "Desconfiado" },
  { id: "proud", label: "Orgulhoso" },
  { id: "shy", label: "Tímido" },
  { id: "sad", label: "Triste" },
  { id: "angry", label: "Bravo" },
  { id: "scared", label: "Assustado" },
  { id: "bored", label: "Entediado" },
  { id: "drowsy", label: "Sonolento" },
  { id: "sleeping", label: "Dormindo" },
  { id: "wink", label: "Piscadela" },
  { id: "music", label: "Na música" },
  { id: "gaming", label: "Jogando" },
  { id: "calling", label: "Em chamada" },
  { id: "muted", label: "Mutado" },
  { id: "annoyed", label: "Irritado" },
  { id: "dizzy", label: "Tonto" },
];

const MASCOT_MOOD_KEY = "pherielium_mascot_mood";

/** Expressão base escolhida nas configs — aplicada ao mascote quando ocioso. */
export function getMascotBaseMood(): MascotMood | null {
  try {
    const stored = localStorage.getItem(MASCOT_MOOD_KEY);
    if (stored && MASCOT_MOODS.some((m) => m.id === stored)) return stored as MascotMood;
  } catch {}
  return null;
}

export function setMascotBaseMood(mood: MascotMood | null): void {
  try {
    if (mood) localStorage.setItem(MASCOT_MOOD_KEY, mood);
    else localStorage.removeItem(MASCOT_MOOD_KEY);
    window.dispatchEvent(new CustomEvent("pherielium:mascot-mood-changed"));
  } catch {}
}
