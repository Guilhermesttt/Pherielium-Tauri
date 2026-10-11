import { describe, expect, it } from "vitest";
import {
  CIRCULARITY_BUCKETS,
  MIN_DRIFT_SAMPLES,
  circularityReport,
  driftReport,
  type AxisSample,
} from "./stickAnalysis";

/** Pontos em volta do círculo, com o raio dado por `radiusAt(ângulo)`. */
const sweep = (radiusAt: (angle: number) => number, steps = 720): AxisSample[] =>
  Array.from({ length: steps }, (_, i) => {
    const a = (i / steps) * 2 * Math.PI;
    const r = radiusAt(a);
    return { x: Math.cos(a) * r, y: Math.sin(a) * r };
  });

describe("circularityReport", () => {
  it("círculo perfeito: erro ~0 e cobertura total", () => {
    const r = circularityReport(sweep(() => 1));
    expect(r.coverage).toBe(100);
    expect(r.errorPercent).toBeLessThan(0.5);
    expect(r.complete).toBe(true);
  });

  it("gate quadrado (diagonal chega a 1,41) dá erro alto", () => {
    // raio de um quadrado de lado 2: 1 / max(|cos|, |sin|)
    const square = sweep((a) => 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a))));
    const r = circularityReport(square);
    expect(r.errorPercent).toBeGreaterThan(25);
    expect(r.complete).toBe(true);
  });

  it("elipse (um eixo mais curto) dá erro proporcional", () => {
    const flat = circularityReport(sweep((a) => 1 / Math.hypot(Math.cos(a), Math.sin(a) / 0.8)));
    const round = circularityReport(sweep(() => 1));
    expect(flat.errorPercent).toBeGreaterThan(round.errorPercent + 5);
  });

  it("só um arco: cobertura baixa e o erro NÃO é dado como confiável", () => {
    const arc = sweep(() => 1).filter((p) => p.x > 0 && p.y > 0); // um quadrante
    const r = circularityReport(arc);
    expect(r.coverage).toBeLessThan(35);
    expect(r.complete).toBe(false);
  });

  it("ignora o que não foi até perto da borda (repouso e meio-curso)", () => {
    const r = circularityReport(sweep(() => 0.3));
    expect(r.coverage).toBe(0);
    expect(r.complete).toBe(false);
  });

  it("sem amostras não quebra", () => {
    const r = circularityReport([]);
    expect(r.coverage).toBe(0);
    expect(r.errorPercent).toBe(0);
    expect(r.radii).toHaveLength(CIRCULARITY_BUCKETS);
  });

  it("NaN vira o centro em vez de contaminar o resultado", () => {
    const r = circularityReport([{ x: Number.NaN, y: 1 }, ...sweep(() => 1)]);
    expect(Number.isFinite(r.errorPercent)).toBe(true);
  });

  it("volta rápida com poucas amostras (tela a ~15 fps) ainda conta como volta completa", () => {
    // 12 pontos por volta = um a cada 30°: sem interpolar, cobriria só 1/3 do círculo.
    // O último ponto fecha a volta em 360°; sem ele os dados simplesmente não
    // contêm o arco final, e não há o que interpolar.
    const sparse = [...sweep(() => 1, 12), { x: 1, y: 0 }];
    const r = circularityReport(sparse);
    expect(r.coverage).toBe(100);
    expect(r.complete).toBe(true);
    expect(r.errorPercent).toBeLessThan(1);
  });

  it("a interpolação não inventa cobertura: um tranco de lado a lado deixa o meio vazio", () => {
    // dois pontos opostos (180°): salto grande demais para ser um só movimento
    const r = circularityReport([
      { x: 1, y: 0 },
      { x: -1, y: 0 },
    ]);
    expect(r.coverage).toBeLessThan(10);
    expect(r.complete).toBe(false);
  });

  it("sair da borda e voltar não liga o ponto de antes ao de depois", () => {
    const r = circularityReport([
      { x: 1, y: 0 },
      { x: 0, y: 0 }, // voltou ao centro
      { x: 0, y: 1 }, // 90° adiante
    ]);
    // sem o corte no centro, o arco de 90° entre os dois seria preenchido
    expect(r.coverage).toBeLessThan(10);
  });

  it("amostragem esparsa não muda o erro de um gate quadrado de forma relevante", () => {
    const squareAt = (a: number) => 1 / Math.max(Math.abs(Math.cos(a)), Math.abs(Math.sin(a)));
    const dense = circularityReport(sweep(squareAt, 720));
    const sparse = circularityReport(sweep(squareAt, 36));
    expect(sparse.complete).toBe(true);
    expect(Math.abs(sparse.errorPercent - dense.errorPercent)).toBeLessThan(10);
  });

  it("dá a volta pelo ângulo ±π sem abrir um buraco na cobertura", () => {
    // pontos atravessando a costura do atan2 (de +179° para -179°)
    const r = circularityReport([
      { x: Math.cos((175 * Math.PI) / 180), y: Math.sin((175 * Math.PI) / 180) },
      { x: Math.cos((-175 * Math.PI) / 180), y: Math.sin((-175 * Math.PI) / 180) },
    ]);
    expect(r.coverage).toBeGreaterThan(0);
  });

  it("guarda o raio máximo de cada fatia, não o último visto", () => {
    const r = circularityReport([
      { x: 0.99, y: 0 },
      { x: 0.6, y: 0 },
    ]);
    expect(Math.max(...r.radii)).toBeCloseTo(0.99, 2);
  });
});

describe("driftReport", () => {
  const rest = (n: number, x = 0, y = 0, jitter = 0): AxisSample[] =>
    Array.from({ length: n }, (_, i) => ({
      x: x + (i % 2 === 0 ? jitter : -jitter),
      y: y + (i % 3 === 0 ? jitter : -jitter),
    }));

  it("poucas amostras: recusa concluir", () => {
    expect(driftReport(rest(MIN_DRIFT_SAMPLES - 1))).toBeNull();
  });

  it("stick perfeito em repouso: ok e zona morta mínima", () => {
    const r = driftReport(rest(60))!;
    expect(r.offset).toBe(0);
    expect(r.verdict).toBe("ok");
    expect(r.suggestedDeadzone).toBe(0.02);
  });

  it("offset constante vira drift estático medido", () => {
    // o caso do print do tester: 0.00392 em todos os eixos
    const r = driftReport(rest(60, 0.00392, 0.00392))!;
    expect(r.offset).toBeCloseTo(Math.hypot(0.00392, 0.00392), 5);
    expect(r.verdict).toBe("ok");
  });

  it("a zona morta sugerida cobre SEMPRE o maior raio observado", () => {
    for (const noise of [0.01, 0.034, 0.057, 0.0999, 0.121]) {
      const samples = rest(80, 0.03, -0.02, noise);
      const r = driftReport(samples)!;
      expect(r.suggestedDeadzone, `ruído ${noise}`).toBeGreaterThanOrEqual(r.maxRadius);
    }
  });

  it("arredonda a sugestão para cima em passos de 1 %", () => {
    // maxRadius 0.034 + folga 0.02 = 0.054 → sobe para 0.06 (nunca 0.05)
    const r = driftReport([{ x: 0.034, y: 0 }, ...rest(40)])!;
    expect(r.suggestedDeadzone).toBe(0.06);
  });

  it("drift grande é classificado como alto e a sugestão respeita o teto", () => {
    const high = driftReport(rest(60, 0.4, 0.4))!;
    expect(high.verdict).toBe("alto");
    expect(high.suggestedDeadzone).toBeLessThanOrEqual(0.5);

    const absurd = driftReport(rest(60, 0.9, 0.9))!;
    expect(absurd.suggestedDeadzone).toBe(0.5);
  });

  it("veredito muda nos limiares", () => {
    expect(driftReport(rest(40, 0.04, 0))!.verdict).toBe("ok");
    expect(driftReport(rest(40, 0.08, 0))!.verdict).toBe("leve");
    expect(driftReport(rest(40, 0.2, 0))!.verdict).toBe("alto");
  });
});
