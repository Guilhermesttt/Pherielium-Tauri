import { describe, expect, it } from "vitest";
import {
  DEFAULT_FRAMING,
  clampFraming,
  framedRect,
  panFraming,
  parseFraming,
  stripFraming,
  withFraming,
} from "./mediaFraming";

const FRAME = { w: 400, h: 100 };
const WIDE = { w: 1000, h: 1000 }; // imagem quadrada numa moldura larga: sobra altura

describe("enquadramento na URL", () => {
  it("guarda e lê de volta o que foi escolhido", () => {
    const url = withFraming("https://cdn.exemplo.com/avatar-1.gif", { x: 30.04, y: 70, zoom: 1.456 });
    expect(url).toBe("https://cdn.exemplo.com/avatar-1.gif#pf=30,70,1.46");
    expect(parseFraming(url)).toEqual({ src: "https://cdn.exemplo.com/avatar-1.gif", framing: { x: 30, y: 70, zoom: 1.46 } });
  });

  it("o padrão não escreve nada na URL e troca o que havia", () => {
    expect(withFraming("https://x/a.gif#pf=10,10,2", DEFAULT_FRAMING)).toBe("https://x/a.gif");
  });

  it("uma URL sem enquadramento, ou com um inválido, volta ao padrão", () => {
    expect(parseFraming("https://x/a.gif").framing).toEqual(DEFAULT_FRAMING);
    expect(parseFraming("https://x/a.gif#pf=abc").framing).toEqual(DEFAULT_FRAMING);
    expect(parseFraming("https://x/a.gif#pf=1,2").framing).toEqual(DEFAULT_FRAMING);
    expect(parseFraming("https://x/a.gif#pf=1,2").src).toBe("https://x/a.gif");
  });

  it("valores fora do limite são puxados para dentro", () => {
    expect(parseFraming("https://x/a.gif#pf=-20,300,9").framing).toEqual({ x: 0, y: 100, zoom: 3 });
  });

  it("data URL não leva fragmento", () => {
    expect(withFraming("data:image/webp;base64,AAAA", { x: 10, y: 10, zoom: 2 })).toBe("data:image/webp;base64,AAAA");
  });

  it("stripFraming tira só o fragmento", () => {
    expect(stripFraming("https://x/a.gif?v=2#pf=1,2,3")).toBe("https://x/a.gif?v=2");
  });
});

describe("geometria da moldura", () => {
  it("no padrão a imagem cobre a moldura inteira", () => {
    const r = framedRect(FRAME, WIDE, DEFAULT_FRAMING);
    expect(r.width).toBe(400);
    expect(r.height).toBe(400);
    expect(r.top).toBe(-150);
  });

  it("escolher o topo da imagem sobe o enquadramento sem deixar borda vazia", () => {
    const top = framedRect(FRAME, WIDE, { x: 50, y: 0, zoom: 1 });
    expect(top.top).toBe(0);
    const bottom = framedRect(FRAME, WIDE, { x: 50, y: 100, zoom: 1 });
    expect(bottom.top + bottom.height).toBe(FRAME.h);
  });

  it("com zoom a imagem continua cobrindo a moldura em qualquer ponto", () => {
    for (const x of [0, 50, 100]) {
      for (const y of [0, 50, 100]) {
        const r = framedRect(FRAME, WIDE, { x, y, zoom: 2.5 });
        expect(r.left).toBeLessThanOrEqual(0);
        expect(r.top).toBeLessThanOrEqual(0);
        expect(r.left + r.width).toBeGreaterThanOrEqual(FRAME.w);
        expect(r.top + r.height).toBeGreaterThanOrEqual(FRAME.h);
      }
    }
  });

  it("arrastar para baixo mostra uma parte mais alta da imagem", () => {
    const next = panFraming({ x: 50, y: 50, zoom: 1 }, 0, 40, FRAME, WIDE);
    expect(next.y).toBeLessThan(50);
  });

  it("arrastar além do limite para no limite", () => {
    const next = panFraming({ x: 50, y: 50, zoom: 1 }, 0, 10_000, FRAME, WIDE);
    const top = framedRect(FRAME, WIDE, next).top;
    expect(top).toBe(0);
  });

  it("aproximar não deixa o ponto central fora do alcance", () => {
    const next = clampFraming(FRAME, WIDE, { x: 0, y: 0, zoom: 1 });
    expect(next.y).toBeGreaterThan(0);
  });
});
