/**
 * Braços da Pherie: cada mão é um alvo (x, y) em unidades do corpo (raio 100); o desenho
 * liga o ombro à mão com uma curva e as molas do engine suavizam o caminho. As cenas
 * (acenar, segurar o controle, colocar os fones, dançar, bufar de raiva) são só uma tabela
 * de alvos em função do tempo — pura e testável.
 */
export interface Hand {
  x: number;
  y: number;
}

export interface ArmTargets {
  left: Hand;
  right: Hand;
  /** 0..1: o controle aparece entre as mãos */
  controller: number;
}

export interface ArmScene {
  gaming: boolean;
  dancing: boolean;
  /** microfone mutado: X na boca */
  muteX: boolean;
  /** tentou falar mutado: irritada, punhos para cima */
  fume: boolean;
  /** segundos restantes do aceno / de "pôr os fones" (0 = inativo) */
  wave: number;
  putOn: number;
  /** envelope da batida 0..1 (dança acompanha a música) */
  beat: number;
}

export const SHOULDER_X = 94;
export const SHOULDER_Y = 34;

export const REST: ArmTargets = {
  left: { x: -120, y: 74 },
  right: { x: 120, y: 74 },
  controller: 0,
};

const mirror = (h: Hand): Hand => ({ x: -h.x, y: h.y });

/** Alvos das mãos no instante `t` (segundos). */
export function armTargets(scene: ArmScene, t: number): ArmTargets {
  let left: Hand = { ...REST.left };
  let right: Hand = { ...REST.right };
  let controller = 0;

  if (scene.fume) {
    // punhos para cima, tremendo
    const shake = Math.sin(t * 38) * 4;
    left = { x: -104 + shake, y: -4 + Math.cos(t * 31) * 3 };
    right = mirror({ x: left.x, y: left.y });
    right.x = 104 - shake;
  } else if (scene.putOn > 0) {
    // mãos sobem até os fones nas orelhas
    left = { x: -118, y: -2 };
    right = { x: 118, y: -2 };
  } else if (scene.dancing) {
    const swing = Math.sin(t * 6.5);
    const pump = 0.6 + 0.4 * scene.beat;
    left = { x: -124, y: 18 - 62 * swing * pump };
    right = { x: 124, y: 18 + 62 * swing * pump };
  } else if (scene.gaming) {
    // as duas mãos seguram o controle, polegares mexendo
    const thumb = Math.sin(t * 9) * 2;
    left = { x: -40, y: 80 + thumb };
    right = { x: 40, y: 80 - thumb };
    controller = 1;
  }

  if (scene.wave > 0 && !scene.fume && scene.putOn <= 0 && !scene.dancing && !scene.gaming) {
    right = { x: 132 + Math.sin(t * 13) * 14, y: -40 + Math.cos(t * 13) * 4 };
  }
  return { left, right, controller };
}
