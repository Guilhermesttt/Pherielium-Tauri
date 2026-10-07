/**
 * Reações do mascote ao cursor (puro, testável): tontura ao chacoalhar o mouse perto do
 * notch, curiosidade quando o cursor chega ao topo e detecção de "arrastando algo" para a
 * dropzone. As métricas (`speed`, `reversals`, `dragging`) vêm do thread de cursor do Rust.
 */
export interface CursorMotion {
  x: number;
  y: number;
  /** px/s nos últimos ~150 ms */
  speed: number;
  /** inversões de direção nos últimos ~600 ms */
  reversals: number;
  /** botão esquerdo pressionado */
  dragging: boolean;
}

export interface RectLike {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** Chacoalhar = vai-e-volta rápido (>= 4 inversões em ~0,6 s a >= 700 px/s). */
export const SHAKE_MIN_REVERSALS = 4;
export const SHAKE_MIN_SPEED = 700;
/** Distância máxima do notch para a tontura valer (px). */
export const SHAKE_NEAR_PX = 280;
/** Faixa do topo (px) em que o mascote fica curioso. */
export const CURIOUS_TOP_BAND_PX = 90;
/** Quanto tempo ela fica tonta (ms). */
export const DIZZY_DURATION_MS = 2000;

/** Distância (px) de um ponto ao retângulo; 0 se estiver dentro. Sem retângulo: topo central da tela. */
export function distanceToRect(x: number, y: number, rect: RectLike | null, viewportWidth: number): number {
  const r: RectLike = rect ?? { left: viewportWidth / 2 - 70, right: viewportWidth / 2 + 70, top: 0, bottom: 40 };
  const dx = Math.max(r.left - x, 0, x - r.right);
  const dy = Math.max(r.top - y, 0, y - r.bottom);
  return Math.hypot(dx, dy);
}

export function isMouseShake(motion: Pick<CursorMotion, "speed" | "reversals">, distanceToNotch: number): boolean {
  return (
    motion.reversals >= SHAKE_MIN_REVERSALS &&
    motion.speed >= SHAKE_MIN_SPEED &&
    distanceToNotch <= SHAKE_NEAR_PX
  );
}

/** Cursor na faixa do topo e na altura do notch: a Pherie fica curiosa. */
export function isCursorAtTop(motion: Pick<CursorMotion, "x" | "y">, rect: RectLike | null, viewportWidth: number): boolean {
  if (motion.y > CURIOUS_TOP_BAND_PX) return false;
  return distanceToRect(motion.x, motion.y, rect, viewportWidth) <= 120;
}

/** Arrastando algo (botão pressionado) em direção ao notch: arma a dropzone. */
export function isDragNearNotch(
  motion: Pick<CursorMotion, "x" | "y" | "dragging">,
  rect: RectLike | null,
  viewportWidth: number,
): boolean {
  if (!motion.dragging || motion.y > 140) return false;
  return distanceToRect(motion.x, motion.y, rect, viewportWidth) <= 220;
}

/** Mensagem do resultado da dropzone (pt-BR). */
export function summarizeImport(imported: number, skipped: number): string {
  if (imported <= 0) {
    return skipped > 0 ? "Só imagens (PNG, JPG, WEBP, BMP) — nada foi salvo" : "Nada para salvar";
  }
  const saved = imported === 1 ? "1 imagem salva nas capturas" : `${imported} imagens salvas nas capturas`;
  return skipped > 0 ? `${saved} (${skipped} ignorada${skipped === 1 ? "" : "s"})` : saved;
}

/** Converte a posição física de um evento de drag do Tauri para px CSS do overlay. */
export function dragPositionToCss(position: { x: number; y: number }, scaleFactor: number): { x: number; y: number } {
  const scale = scaleFactor > 0 ? scaleFactor : 1;
  return { x: position.x / scale, y: position.y / scale };
}
