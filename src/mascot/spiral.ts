/** Espiral de Arquimedes em coordenadas locais (raio 1, centro na origem) — olhos "espirais" da tontura. */
export function spiralPath(turns = 2.4, steps = 56): string {
  const total = Math.max(2, Math.round(steps));
  const parts: string[] = [];
  for (let i = 0; i <= total; i++) {
    const t = i / total;
    const angle = t * turns * Math.PI * 2;
    const x = (t * Math.cos(angle)).toFixed(3);
    const y = (t * Math.sin(angle)).toFixed(3);
    parts.push(`${i === 0 ? "M" : "L"} ${x} ${y}`);
  }
  return parts.join(" ");
}
