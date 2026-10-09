/** Cor da bateria por nível: verde saudável, âmbar baixa, vermelha crítica (carregando sempre verde). */
export function batteryTone(level: number, charging = false): { rgb: string; critical: boolean } {
  if (charging) return { rgb: "48,209,88", critical: false };
  if (level <= 15) return { rgb: "255,69,58", critical: true };
  if (level <= 30) return { rgb: "255,159,10", critical: false };
  return { rgb: "48,209,88", critical: false };
}

export const clampBattery = (v: number) => Math.max(0, Math.min(100, Math.round(v)));
