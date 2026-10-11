/**
 * Análise de stick: circularidade e drift.
 *
 * Tudo puro (sem DOM, sem relógio), para dar para testar com dados sintéticos.
 * As entradas são os valores CRUS dos eixos (-1..1), sem a zona morta do perfil:
 * medir o hardware com a zona morta aplicada esconderia o próprio defeito que o
 * teste procura.
 */

export interface AxisSample {
  x: number;
  y: number;
}

const finite = (n: number) => (Number.isFinite(n) ? n : 0);

// ── Circularidade ───────────────────────────────────────────────────────────

/** Fatias de ângulo em que o círculo é dividido (10° cada). */
export const CIRCULARITY_BUCKETS = 36;

/** Só conta o raio de quem foi empurrado até perto da borda. */
const OUTER_RADIUS_MIN = 0.5;

export interface CircularityReport {
  /** Quanto do círculo foi percorrido, 0..100. */
  coverage: number;
  /**
   * Erro de circularidade em %: variação do raio máximo entre os ângulos,
   * `(maior − menor) / média`. 0 = círculo perfeito; um gate quadrado dá ~40.
   */
  errorPercent: number;
  /** Raio máximo atingido em cada fatia (0 onde não passou). */
  radii: number[];
  /** Cobertura suficiente para o erro ser confiável. */
  complete: boolean;
}

/** Cobertura mínima para o erro valer: abaixo disso é só um arco. */
export const MIN_RELIABLE_COVERAGE = 90;

const bucketOfAngle = (angle: number): number => {
  // `angle` em qualquer volta: normaliza para 0..1 antes de fatiar.
  const turns = (((angle + Math.PI) / (2 * Math.PI)) % 1 + 1) % 1;
  return Math.min(CIRCULARITY_BUCKETS - 1, Math.floor(turns * CIRCULARITY_BUCKETS));
};

/**
 * Maior salto de ângulo entre duas amostras que ainda é tratado como o MESMO
 * movimento contínuo. Acima disso (um tranco de um lado ao outro) não se
 * inventa trajeto no meio.
 */
const MAX_INTERPOLATED_ARC = Math.PI / 2;

/** Menor diferença angular de `from` até `to`, em (-π, π]. */
const angleDelta = (from: number, to: number): number => {
  let d = to - from;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d <= -Math.PI) d += 2 * Math.PI;
  return d;
};

export function circularityReport(samples: ReadonlyArray<AxisSample>): CircularityReport {
  const radii = new Array<number>(CIRCULARITY_BUCKETS).fill(0);
  const record = (angle: number, r: number) => {
    const b = bucketOfAngle(angle);
    if (r > radii[b]) radii[b] = r;
  };

  // A Gamepad API só entrega o estado ATUAL, sem histórico: se a tela roda a
  // 15 fps (notebook fraco, launcher pesado), uma volta rápida vira poucos
  // pontos e a cobertura sairia baixa sem a pessoa ter feito nada errado.
  // Entre amostras consecutivas perto da borda, preenche o arco que o stick
  // necessariamente percorreu (o raio é interpolado linearmente).
  let prev: { angle: number; r: number } | null = null;
  for (const sample of samples) {
    const x = finite(sample.x);
    const y = finite(sample.y);
    const r = Math.hypot(x, y);
    if (r < OUTER_RADIUS_MIN) {
      prev = null; // saiu da borda: não liga o ponto de antes ao de depois
      continue;
    }
    const angle = Math.atan2(y, x);
    record(angle, r);

    if (prev) {
      const delta = angleDelta(prev.angle, angle);
      if (Math.abs(delta) <= MAX_INTERPOLATED_ARC) {
        // Meia largura de balde: todo balde que o arco atravessa recebe ao menos um
        // ponto. Com a largura inteira, pontos interpolados caíam exatamente na
        // fronteira entre baldes e o arredondamento os jogava para o vizinho.
        const steps = Math.ceil(Math.abs(delta) / (Math.PI / CIRCULARITY_BUCKETS));
        for (let k = 1; k < steps; k += 1) {
          const t = k / steps;
          record(prev.angle + delta * t, prev.r + (r - prev.r) * t);
        }
      }
    }
    prev = { angle, r };
  }

  const covered = radii.filter((r) => r > 0);
  const coverage = (covered.length / CIRCULARITY_BUCKETS) * 100;
  if (covered.length < 2) {
    return { coverage, errorPercent: 0, radii, complete: false };
  }
  const max = Math.max(...covered);
  const min = Math.min(...covered);
  const mean = covered.reduce((a, b) => a + b, 0) / covered.length;
  return {
    coverage,
    errorPercent: mean > 0 ? ((max - min) / mean) * 100 : 0,
    radii,
    complete: coverage >= MIN_RELIABLE_COVERAGE,
  };
}

// ── Drift ───────────────────────────────────────────────────────────────────

export interface DriftReport {
  samples: number;
  /** Posição média em repouso (o offset do centro). */
  meanX: number;
  meanY: number;
  /** Distância do centro da posição média: o drift estático. */
  offset: number;
  /** Maior distância do centro vista durante a medição (inclui ruído). */
  maxRadius: number;
  /** Zona morta sugerida (0..0.5) que esconde o drift medido com folga. */
  suggestedDeadzone: number;
  /** Classificação para a UI não ter de inventar limiares. */
  verdict: "ok" | "leve" | "alto";
}

/** Folga somada ao maior raio observado, para o ruído do dia seguinte não vazar. */
const DEADZONE_MARGIN = 0.02;
const DEADZONE_STEP = 0.01;
const DEADZONE_MIN = 0.02;
const DEADZONE_MAX = 0.5;

/** Limiares do veredito, em raio máximo em repouso. */
const DRIFT_LIGHT = 0.05;
const DRIFT_HIGH = 0.15;

/** Poucas amostras não dizem nada; abaixo disto a análise recusa concluir. */
export const MIN_DRIFT_SAMPLES = 20;

export function driftReport(samples: ReadonlyArray<AxisSample>): DriftReport | null {
  if (samples.length < MIN_DRIFT_SAMPLES) return null;

  let sx = 0;
  let sy = 0;
  let maxRadius = 0;
  for (const s of samples) {
    const x = finite(s.x);
    const y = finite(s.y);
    sx += x;
    sy += y;
    maxRadius = Math.max(maxRadius, Math.hypot(x, y));
  }
  const meanX = sx / samples.length;
  const meanY = sy / samples.length;

  // Arredonda PARA CIMA no passo de 1 %: arredondar para baixo deixaria o
  // drift medido passar pela zona morta sugerida.
  const raw = maxRadius + DEADZONE_MARGIN;
  const stepped = Math.ceil(raw / DEADZONE_STEP - 1e-9) * DEADZONE_STEP;
  const suggestedDeadzone = Math.min(DEADZONE_MAX, Math.max(DEADZONE_MIN, round2(stepped)));

  return {
    samples: samples.length,
    meanX,
    meanY,
    offset: Math.hypot(meanX, meanY),
    maxRadius,
    suggestedDeadzone,
    verdict: maxRadius >= DRIFT_HIGH ? "alto" : maxRadius >= DRIFT_LIGHT ? "leve" : "ok",
  };
}

const round2 = (n: number) => Math.round(n * 100) / 100;
