import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import "@fontsource/archivo-black";
import { setLauncherInputLocked } from "../utils/launcherInputLock";
import bootAudioSrc from "../sounds/Phelierium Default/startup.mp3";
// Fundo espacial (campo de estrelas) e riscos de luz usados como "dobra espacial".
// Para trocar/adicionar fundos, aponte `BACKDROP_VIDEOS` para outros arquivos de src/assets.
import starfieldSrc from "../assets/karavanbraam_pindown.io.webm";
import streaksSrc from "../assets/BG-Video-Friend.webm";

/**
 * Intro de marca: tipografia cinética + morphing de blobs líquidos, 2D flat.
 * 7 s de animação em canvas 2D, sem dependências além do que o app já usa.
 *
 * Substitui `GameBootIntro` (mesmas props). A cena é uma função pura do tempo
 * (`drawFrame`), então o mesmo instante sempre gera o mesmo quadro.
 *
 * Fontes: Archivo Black (cartões) vem do import acima; Inter Variable (nome e
 * slogan) já é carregada em `main.tsx` via `@fontsource-variable/inter/opsz.css`.
 */

interface BrandIntroProps {
  onFinish?: () => void;
  /** Toca o áudio da intro (preferência `gameBootIntroSoundEnabled`). */
  soundEnabled?: boolean;
}

type ColorRole = "ink" | "paper" | "primary" | "accent";
type Point = [number, number];

/** Retângulo visível, em coordenadas de projeto (1920×1080 centralizado). */
interface View {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Card {
  word: string;
  index: string;
  bg: ColorRole;
  fg: ColorRole;
  /** Origem da onda, como fração do retângulo visível (0..1). */
  origin: Point;
  wipe: [number, number];
  textAt: number;
  startRadius?: number;
  ambient: { x: number; y: number; r: number; from: ColorRole; to: ColorRole | null; seed: number };
}

interface Logo {
  body: Point[];
  height: number;
  dot: { x: number; y: number; r: number };
}

/** Vídeos de fundo já carregados; `null` enquanto não existem (a cena degrada para preto). */
interface Media {
  stars: HTMLVideoElement | null;
  streaks: HTMLVideoElement | null;
}

const NO_MEDIA: Media = { stars: null, streaks: null };

const BACKDROP_VIDEOS = { stars: starfieldSrc, streaks: streaksSrc } as const;

// --- constantes ---------------------------------------------------------------

const W = 1920;
const H = 1080;
const DURATION = 7; // segundos de animação
const END_HOLD = 0.35; // quadro final parado antes de entregar o controle
const FADE_OUT_MS = 400;
const REDUCED_MOTION_HOLD_MS = 1200;
const BLOB_POINTS = 180;
const LETTER_STAGGER = 0.035; // atraso entre letras de uma palavra, em segundos
const LETTER_DURATION = 0.45;
const SKIP_HINT_DELAY_MS = 1200;

// Paleta monocromática: preto (fundo principal), branco e dois cinzas. Os nomes dos papéis
// (`primary`, `accent`) são os da coreografia; aqui `primary` é o cinza médio e `accent` o claro.
const COLORS: Record<ColorRole, string> = {
  ink: "#111111",
  paper: "#F2F2F2",
  primary: "#6E6E6E",
  accent: "#B8B8B8",
};

const FONT_CARD = '"Archivo Black"';
const FONT_BRAND = '"Inter Variable", "Inter", system-ui, sans-serif';
const BRAND_NAME = "Pherielium";
const TAGLINE = "universal gaming library";

// Logo oficial (mesmos paths da intro antiga): corpo em blob + ponto. viewBox 1017×1145.
const LOGO_BODY_PATH =
  "M546.811 0.450368C574.495 -2.67907 606.626 10.823 625.549 30.9223C642.416 48.603 651.367 72.3858 650.346 96.8034C649.75 111.603 645.769 126.069 638.71 139.089C627.991 158.929 613.409 172.317 593.916 182.963C586.864 186.811 579.76 189.916 572.727 193.986C558.538 202.045 545.351 211.744 533.421 222.881C496.013 257.724 472.336 309.851 470.466 360.989C468.862 408.479 486.129 454.671 518.485 489.458C563.272 536.862 635.436 559.136 697.608 535.709C730.013 523.498 747.621 503.1 785.88 504.379C827.262 504.751 862.431 540.121 867.309 580.433C869.849 601.377 867.499 619.447 871.964 641.413C876.659 663.518 885.702 684.476 898.562 703.056C910.57 720.432 928.237 738.698 947.068 748.457C964.741 756.742 978.504 762.46 992.235 777.196C1029.85 817.055 1021.02 877.205 982.014 912.264C923.555 964.817 840.561 925.677 825.854 853.549C822.41 836.684 824.492 823.291 823.517 807.087C818.357 721.46 740.261 645.887 654.7 642.631C607.49 640.83 560.686 660.59 526.519 691.254C487.944 725.776 464.63 774.19 461.692 825.884C458.981 880.441 483.698 937.06 532.144 964.509C553.902 976.704 574.161 982.101 591.592 1001.47C624.482 1038.01 618.274 1089.45 582.17 1121.75C564.942 1137.31 542.221 1145.32 519.055 1144.02C473.931 1142.4 432.717 1105.27 426.52 1060.54C425.278 1052.41 425.811 1043.35 424.591 1035.29C409.2 933.714 269.72 837.116 173.523 894.928C148.135 910.188 135.775 928.428 103.062 932.554C78.7883 935.423 54.3806 928.422 35.3119 913.129C7.39449 891.083 -6.1386 857.013 2.66826 822.164C16.9282 765.741 82.1114 724.525 137.24 752.852C154.191 761.909 170.279 774.045 188.677 780.261C257.114 803.361 336.225 766.108 379.376 711.865C409.935 673.78 423.991 625.052 418.41 576.539C412.519 525.267 380.818 471.216 340.471 439.625C296.691 405.346 233.542 393.111 183.664 421.144C156.332 436.506 140.804 456.751 106.695 460.397C82.296 463.006 57.3775 454.495 38.4922 439.087C19.1341 423.609 6.80584 401.001 4.27641 376.342C1.83144 351.126 12.4435 325.227 28.4884 306.121C40.4579 291.869 55.9436 280.994 73.4099 274.575C115.44 259.402 141.899 277.319 174.876 299.283C194.091 312.081 224.233 318.825 247.339 316.351C308.871 309.761 365.404 272.323 405.055 226.103C425.598 201.777 446.522 167.27 449.035 135.403C449.682 127.206 448.443 119.029 447.719 110.884C445.386 84.6811 455.082 58.617 472.003 38.7504C491.704 15.6216 516.828 3.05048 546.811 0.450368Z";
const LOGO_DOT_PATH =
  "M910.963 266.954C963.837 264.292 1008.83 305.052 1011.39 357.938C1013.97 410.824 973.135 455.756 920.255 458.231C867.512 460.701 822.724 419.984 820.164 367.231C817.604 314.476 858.227 269.61 910.963 266.954Z";

// Cartões de título: cada um entra por uma "onda" líquida que nasce de um ponto.
const CARDS: Card[] = [
  {
    word: "UNIVERSAL",
    index: "01",
    bg: "paper",
    fg: "ink",
    origin: [0.5, 0.5],
    wipe: [0.2, 0.85],
    textAt: 0.65,
    startRadius: 70,
    ambient: { x: 1560, y: 900, r: 380, from: "accent", to: "primary", seed: 3 },
  },
  {
    word: "GAMING",
    index: "02",
    bg: "primary",
    fg: "paper",
    origin: [0, 1],
    wipe: [1.75, 2.4],
    textAt: 2.15,
    ambient: { x: 330, y: 190, r: 330, from: "ink", to: null, seed: 8 },
  },
  {
    word: "LIBRARY",
    index: "03",
    bg: "accent",
    fg: "ink",
    origin: [1, 0],
    wipe: [2.9, 3.5],
    textAt: 3.3,
    ambient: { x: 1560, y: 180, r: 340, from: "primary", to: null, seed: 15 },
  },
];

const INK_WIPE = { origin: [0.5, 0.5] as Point, span: [4.2, 4.8] as [number, number] };
const LOGO_TIMING = {
  seedAt: 4.6, // ponto azul nasce no centro
  morph: [5.0, 5.7] as [number, number], // blob -> logo
  dot: [5.6, 6.1] as [number, number], // ponto do logo
  rise: [5.6, 6.2] as [number, number], // logo sobe para dar espaço ao nome
  name: [5.7, 6.5] as [number, number],
  rule: [6.0, 6.5] as [number, number],
  tagline: [6.1, 6.8] as [number, number],
};
const LOGO_HEIGHT = 400;
const LOGO_REST_Y = 392;

// --- easing -------------------------------------------------------------------

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const prog = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeOutBack = (t: number, s = 1.70158): number =>
  1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
const easeOutElastic = (t: number): number =>
  t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;

// --- ruído (value noise 3D, determinístico) -------------------------------------------

function hash3(x: number, y: number, z: number): number {
  let h = (Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(z, 1274126177)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295;
}

const smooth = (t: number): number => t * t * (3 - 2 * t);

/** Ruído suave em [0, 1]; mesma entrada, mesma saída (sem estado global). */
function noise3(x: number, y: number, z: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const zi = Math.floor(z);
  const fx = smooth(x - xi);
  const fy = smooth(y - yi);
  const fz = smooth(z - zi);
  const corner = (dx: number, dy: number, dz: number): number => hash3(xi + dx, yi + dy, zi + dz);
  const x00 = lerp(corner(0, 0, 0), corner(1, 0, 0), fx);
  const x10 = lerp(corner(0, 1, 0), corner(1, 1, 0), fx);
  const x01 = lerp(corner(0, 0, 1), corner(1, 0, 1), fx);
  const x11 = lerp(corner(0, 1, 1), corner(1, 1, 1), fx);
  return lerp(lerp(x00, x10, fy), lerp(x01, x11, fy), fz);
}

// --- geometria do logo ----------------------------------------------------------------

/** Amostra um path com M/C/Z absolutos em uma polilinha densa. */
function samplePath(d: string): Point[] {
  const tokens = d.match(/[MCZ]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  const pts: Point[] = [];
  let i = 0;
  let cmd = "";
  let cx = 0;
  let cy = 0;
  const num = (): number => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[MCZ]/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === "M") {
      cx = num();
      cy = num();
      pts.push([cx, cy]);
      cmd = "C";
    } else if (cmd === "C") {
      const x1 = num();
      const y1 = num();
      const x2 = num();
      const y2 = num();
      const x3 = num();
      const y3 = num();
      for (let k = 1; k <= 28; k++) {
        const t = k / 28;
        const u = 1 - t;
        pts.push([
          u * u * u * cx + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3,
          u * u * u * cy + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3,
        ]);
      }
      cx = x3;
      cy = y3;
    } else {
      break; // Z
    }
  }
  return pts;
}

/** Reamostra por comprimento de arco para N pontos igualmente espaçados. */
function resample(pts: Point[], n: number): Point[] {
  const seg = [0];
  for (let i = 1; i < pts.length; i++) {
    seg.push(seg[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = seg[seg.length - 1];
  const out: Point[] = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total;
    while (j < seg.length - 1 && seg[j] < target) j++;
    const f = (target - seg[j - 1]) / Math.max(seg[j] - seg[j - 1], 1e-9);
    out.push([lerp(pts[j - 1][0], pts[j][0], f), lerp(pts[j - 1][1], pts[j][1], f)]);
  }
  return out;
}

function boundsOf(pts: Point[]): View {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const [x, y] of pts) {
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
    x1 = Math.max(x1, x);
    y1 = Math.max(y1, y);
  }
  return { x0, y0, x1, y1 };
}

/** Logo centralizado na origem, sentido horário, pronto para interpolar com o blob. */
function prepareLogo(): Logo {
  let body = resample(samplePath(LOGO_BODY_PATH), BLOB_POINTS);
  const b = boundsOf(body);
  const cx = (b.x0 + b.x1) / 2;
  const cy = (b.y0 + b.y1) / 2;
  // Área com sinal (y para baixo): positivo = horário na tela, o mesmo sentido do blob.
  let area = 0;
  for (let i = 0; i < body.length; i++) {
    const [x1, y1] = body[i];
    const [x2, y2] = body[(i + 1) % body.length];
    area += x1 * y2 - x2 * y1;
  }
  if (area < 0) body = body.reverse();
  // Começa no ponto mais alto, igual ao blob (ângulo -90°), para a interpolação não girar.
  let top = 0;
  body.forEach((p, i) => {
    if (p[1] < body[top][1]) top = i;
  });
  body = [...body.slice(top), ...body.slice(0, top)].map(([x, y]): Point => [x - cx, y - cy]);

  const dot = boundsOf(samplePath(LOGO_DOT_PATH));
  return {
    body,
    height: b.y1 - b.y0,
    dot: {
      x: (dot.x0 + dot.x1) / 2 - cx,
      y: (dot.y0 + dot.y1) / 2 - cy,
      r: (dot.x1 - dot.x0) / 2,
    },
  };
}

let logoCache: Logo | null = null;
const getLogo = (): Logo => (logoCache ??= prepareLogo());

// --- primitivas de desenho ----------------------------------------------------------------

function blobPoints(cx: number, cy: number, radius: number, t: number, seed: number, amp: number): Point[] {
  const pts: Point[] = [];
  for (let i = 0; i < BLOB_POINTS; i++) {
    const a = -Math.PI / 2 + (i / BLOB_POINTS) * Math.PI * 2;
    // Ruído amostrado num círculo => contorno contínuo, sem emenda.
    const n = noise3(Math.cos(a) * 1.3 + seed, Math.sin(a) * 1.3 + seed * 1.7, t * 0.55 + seed);
    const r = radius * (1 + amp * (n - 0.5) * 2.2);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

function tracePath(ctx: CanvasRenderingContext2D, pts: Point[]): void {
  const n = pts.length;
  const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[n - 1], pts[0]);
  ctx.beginPath();
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i++) {
    const end = mid(pts[i], pts[(i + 1) % n]);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], end[0], end[1]);
  }
  ctx.closePath();
}

/** Preenche um blob; com `to`, interpola `from`→`to` na diagonal do próprio blob. */
function fillShape(ctx: CanvasRenderingContext2D, pts: Point[], from: ColorRole, to: ColorRole | null = null): void {
  tracePath(ctx, pts);
  if (to) {
    const b = boundsOf(pts);
    const g = ctx.createLinearGradient(b.x0, b.y0, b.x1, b.y1);
    g.addColorStop(0, COLORS[from]);
    g.addColorStop(1, COLORS[to]);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = COLORS[from];
  }
  ctx.fill();
}

/** Texto letra a letra com espaçamento controlado (kerning é sacrificado de propósito). */
function drawSpaced(ctx: CanvasRenderingContext2D, text: string, cx: number, y: number, spacing: number): void {
  const chars = [...text];
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0) + spacing * (chars.length - 1);
  let x = cx - total / 2;
  ctx.textAlign = "left";
  chars.forEach((ch, i) => {
    ctx.fillText(ch, x, y);
    x += widths[i] + spacing;
  });
}

/** Palavra gigante: cada letra sobe do "chão" da linha de base com desaceleração forte. */
function kineticWord(ctx: CanvasRenderingContext2D, word: string, t: number, t0: number, color: ColorRole): void {
  ctx.font = `400 100px ${FONT_CARD}`;
  const chars = [...word];
  const unit = chars.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) / 100;
  const size = Math.min(1700 / unit, 460);
  ctx.font = `400 ${size}px ${FONT_CARD}`;
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0);
  const baseline = H / 2 + size * 0.36; // metade da altura das maiúsculas
  let x = (W - total) / 2;
  ctx.fillStyle = COLORS[color];
  ctx.textAlign = "left";
  chars.forEach((ch, i) => {
    const p = prog(t, t0 + i * LETTER_STAGGER, t0 + i * LETTER_STAGGER + LETTER_DURATION);
    if (p > 0) {
      const e = easeOutExpo(p);
      ctx.save();
      if (p < 1) {
        // Enquanto sobe, a letra emerge do "chão" da linha de base (máscara).
        ctx.beginPath();
        ctx.rect(-W, baseline - size * 0.9, W * 3, size * 0.92);
        ctx.clip();
      }
      // Depois de pousar, cada letra balança em onda, defasada da vizinha.
      const sway = p >= 1 ? Math.sin(t * 2.6 + i * 0.8) * 5 : 0;
      ctx.translate(x, baseline + (1 - e) * size * 1.15 + sway);
      ctx.rotate(-0.22 * (1 - e) + (p >= 1 ? Math.sin(t * 2.1 + i) * 0.012 : 0));
      ctx.fillText(ch, 0, 0);
      ctx.restore();
    }
    x += widths[i];
  });
}

function caption(ctx: CanvasRenderingContext2D, card: Card, t: number): void {
  const a = prog(t, card.textAt, card.textAt + 0.4);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = COLORS[card.fg];
  ctx.font = `500 30px ${FONT_BRAND}`;
  ctx.textAlign = "left";
  ctx.fillText("pherielium", 90, 110);
  ctx.textAlign = "right";
  ctx.fillText(`${card.index} / 03`, W - 90, 110);
  ctx.restore();
}

// --- cena ------------------------------------------------------------------------------------

const isPlayable = (v: HTMLVideoElement | null): v is HTMLVideoElement =>
  v !== null && v.readyState >= 2 && v.videoWidth > 0;

/** Desenha o vídeo cobrindo toda a área visível (cover), opcionalmente girado 90°. */
function drawVideoCover(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement | null,
  view: View,
  opts: { zoom: number; alpha: number; rotate90?: boolean; driftX?: number; driftY?: number },
): void {
  if (!isPlayable(video) || opts.alpha <= 0) return;
  const vw = view.x1 - view.x0;
  const vh = view.y1 - view.y0;
  // Ao girar 90°, largura e altura do vídeo trocam de papel.
  const srcW = opts.rotate90 ? video.videoHeight : video.videoWidth;
  const srcH = opts.rotate90 ? video.videoWidth : video.videoHeight;
  const s = Math.max(vw / srcW, vh / srcH) * opts.zoom;
  ctx.save();
  ctx.globalAlpha = opts.alpha;
  // "lighter": o preto do vídeo some e só as estrelas somam luz sobre o preto do fundo.
  ctx.globalCompositeOperation = "lighter";
  ctx.translate((view.x0 + view.x1) / 2 + (opts.driftX ?? 0), (view.y0 + view.y1) / 2 + (opts.driftY ?? 0));
  if (opts.rotate90) ctx.rotate(Math.PI / 2);
  ctx.drawImage(video, (-video.videoWidth * s) / 2, (-video.videoHeight * s) / 2, video.videoWidth * s, video.videoHeight * s);
  ctx.restore();
}

/** Fundo espacial: estrelas em zoom lento + riscos de luz horizontais quando `streakAlpha` > 0. */
function drawSpace(ctx: CanvasRenderingContext2D, view: View, t: number, media: Media, streakAlpha: number): void {
  drawVideoCover(ctx, media.stars, view, {
    zoom: 1.04 + t * 0.012,
    alpha: 0.95,
    driftX: Math.sin(t * 0.35) * 14,
    driftY: Math.cos(t * 0.28) * 9,
  });
  drawVideoCover(ctx, media.streaks, view, { zoom: 1, alpha: streakAlpha, rotate90: true });
}

/** Intensidade dos riscos de luz: aparecem na abertura e na "viagem" até o logo. */
function streakAlphaAt(t: number): number {
  const opening = 0.5 * (1 - prog(t, 0.3, 0.85));
  const warp = 0.6 * prog(t, 4.2, 4.7) * (1 - prog(t, 5.0, 6.3));
  return Math.max(opening, warp);
}

/** Preenche um blob preto com o espaço dentro dele (estrelas "dentro" da forma líquida). */
function fillSpace(ctx: CanvasRenderingContext2D, pts: Point[], view: View, t: number, media: Media): void {
  ctx.save();
  tracePath(ctx, pts);
  ctx.clip();
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  drawSpace(ctx, view, t, media, streakAlphaAt(t));
  ctx.restore();
}

/** Palavra gigante só com contorno que desliza atrás do título (ritmo e profundidade). */
function marquee(
  ctx: CanvasRenderingContext2D,
  view: View,
  word: string,
  t: number,
  t0: number,
  dir: 1 | -1,
  baseline: number,
  color: ColorRole,
): void {
  const fade = prog(t, t0, t0 + 0.5);
  if (fade <= 0) return;
  ctx.save();
  ctx.font = `400 300px ${FONT_CARD}`;
  const unit = ctx.measureText(`${word}  `).width;
  const offset = (((t - t0) * 150 * dir) % unit + unit) % unit;
  ctx.globalAlpha = 0.17 * fade;
  ctx.strokeStyle = COLORS[color];
  ctx.lineWidth = 3;
  ctx.textAlign = "left";
  for (let x = view.x0 - unit + offset; x < view.x1; x += unit) {
    ctx.strokeText(`${word}  `, x, baseline);
  }
  ctx.restore();
}

/** Distância ao canto visível mais longe, com folga para o contorno ondulado não deixar buracos. */
function reachFrom(ox: number, oy: number, view: View): number {
  const far = [
    Math.hypot(view.x0 - ox, view.y0 - oy),
    Math.hypot(view.x1 - ox, view.y0 - oy),
    Math.hypot(view.x0 - ox, view.y1 - oy),
    Math.hypot(view.x1 - ox, view.y1 - oy),
  ];
  return 1.35 * Math.max(...far);
}

function drawWipe(
  ctx: CanvasRenderingContext2D,
  view: View,
  origin: Point,
  span: [number, number],
  t: number,
  color: ColorRole,
  seed: number,
  media: Media,
  startRadius = 0,
): boolean {
  const p = prog(t, span[0], span[1]);
  if (p <= 0) return false;
  const ox = lerp(view.x0, view.x1, origin[0]);
  const oy = lerp(view.y0, view.y1, origin[1]);
  const r = lerp(startRadius, reachFrom(ox, oy, view), easeInOutCubic(p));
  const pts = blobPoints(ox, oy, r, t, seed, 0.12);
  // A onda preta é o "espaço": carrega as estrelas dentro da forma líquida.
  if (color === "ink") fillSpace(ctx, pts, view, t, media);
  else fillShape(ctx, pts, color);
  return true;
}

function drawCard(
  ctx: CanvasRenderingContext2D,
  view: View,
  card: Card,
  t: number,
  seed: number,
  media: Media,
): void {
  // Antes da onda, o primeiro cartão aparece como uma gota que pulsa no escuro.
  if (card.startRadius && t < card.wipe[0]) {
    const drop = easeOutElastic(prog(t, 0.02, 0.22));
    if (drop > 0) fillShape(ctx, blobPoints(W / 2, H / 2, card.startRadius * drop, t, seed, 0.1), card.bg);
    return;
  }
  if (!drawWipe(ctx, view, card.origin, card.wipe, t, card.bg, seed, media, card.startRadius ?? 0)) return;
  if (t < card.textAt - 0.1) return;

  // "Câmera": o conteúdo do cartão faz um push-in lento, sempre em movimento.
  const zoom = 1 + 0.05 * easeOutCubic(prog(t, card.textAt - 0.1, card.textAt + 1.6));
  ctx.save();
  ctx.translate(W / 2, H / 2);
  ctx.scale(zoom, zoom);
  ctx.translate(-W / 2, -H / 2);

  // Palavras gigantes só de contorno, em sentidos opostos, atrás do título.
  const dir = seed % 2 === 0 ? 1 : -1;
  marquee(ctx, view, card.word, t, card.textAt, dir, 290, card.fg);
  marquee(ctx, view, card.word, t, card.textAt, dir === 1 ? -1 : 1, 1010, card.fg);

  const a = card.ambient;
  const grow = easeOutBack(prog(t, card.textAt - 0.1, card.textAt + 0.6));
  // O blob decorativo orbita devagar em vez de ficar parado.
  const ax = a.x + Math.cos(t * 0.9 + a.seed) * 46;
  const ay = a.y + Math.sin(t * 0.7 + a.seed) * 34;
  if (grow > 0) {
    const pts = blobPoints(ax, ay, a.r * grow, t, a.seed, 0.2);
    if (a.from === "ink") fillSpace(ctx, pts, view, t, media);
    else fillShape(ctx, pts, a.from, a.to);
  }
  kineticWord(ctx, card.word, t, card.textAt, card.fg);
  ctx.restore();

  caption(ctx, card, t);
}

/** Anéis orbitais com planetas girando ao redor do logo (estética espacial). */
function drawOrbits(ctx: CanvasRenderingContext2D, t: number, cx: number, cy: number): void {
  const appear = easeOutCubic(prog(t, 5.5, 6.5));
  if (appear <= 0) return;
  const rings = [
    { rx: 330, ry: 120, tilt: -0.5 + t * 0.1, speed: 0.9, planet: 7 },
    { rx: 470, ry: 210, tilt: 0.35 - t * 0.07, speed: -0.55, planet: 5 },
  ];
  ctx.save();
  ctx.translate(cx, cy);
  ctx.strokeStyle = COLORS.paper;
  ctx.fillStyle = COLORS.paper;
  ctx.lineWidth = 2;
  for (const ring of rings) {
    ctx.save();
    ctx.rotate(ring.tilt);
    ctx.globalAlpha = 0.38 * appear;
    ctx.beginPath();
    // O anel se desenha ao aparecer (arco crescente).
    ctx.ellipse(0, 0, ring.rx, ring.ry, 0, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * appear);
    ctx.stroke();
    ctx.globalAlpha = appear;
    const theta = t * ring.speed;
    ctx.beginPath();
    ctx.arc(Math.cos(theta) * ring.rx, Math.sin(theta) * ring.ry, ring.planet, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.restore();
}

function drawLockup(ctx: CanvasRenderingContext2D, t: number): void {
  const T = LOGO_TIMING;
  if (t < T.seedAt) return;
  const logo = getLogo();
  const scale = LOGO_HEIGHT / logo.height;
  const grow = easeOutElastic(prog(t, T.seedAt, T.seedAt + 0.55));
  const morph = easeInOutCubic(prog(t, T.morph[0], T.morph[1]));
  const rise = easeInOutCubic(prog(t, T.rise[0], T.rise[1]));
  const float = Math.sin((t * Math.PI * 2) / 3.2) * 6 * prog(t, T.rise[1], T.rise[1] + 0.4);
  const cx = W / 2;
  const cy = lerp(H / 2, LOGO_REST_Y, rise) + float;

  drawOrbits(ctx, t, cx, cy);

  const blob = blobPoints(cx, cy, 150 * grow, t, 11, 0.14);
  const shape = blob.map(
    (b, i): Point => [
      lerp(b[0], cx + logo.body[i][0] * scale * grow, morph),
      lerp(b[1], cy + logo.body[i][1] * scale * grow, morph),
    ],
  );
  // O logo oscila levemente em torno do próprio centro, como se flutuasse no espaço.
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(Math.sin(t * 1.1) * 0.045 * prog(t, T.rise[0], T.rise[1] + 0.4));
  ctx.translate(-cx, -cy);
  fillShape(ctx, shape, "primary");
  if (morph > 0) {
    ctx.save();
    ctx.globalAlpha = morph;
    fillShape(ctx, shape, "paper", "primary");
    ctx.restore();
  }

  const dot = easeOutElastic(prog(t, T.dot[0], T.dot[1]));
  if (dot > 0) {
    ctx.beginPath();
    ctx.arc(cx + logo.dot.x * scale, cy + logo.dot.y * scale, logo.dot.r * scale * dot, 0, Math.PI * 2);
    ctx.fillStyle = COLORS.paper;
    ctx.fill();
  }
  ctx.restore();

  // Nome da marca: tracking-in (letras largas -> bloco fechado) + subida suave.
  const nameP = easeOutCubic(prog(t, T.name[0], T.name[1]));
  if (nameP > 0) {
    ctx.save();
    ctx.globalAlpha = nameP;
    ctx.fillStyle = COLORS.paper;
    ctx.font = `700 150px ${FONT_BRAND}`;
    drawSpaced(ctx, BRAND_NAME, W / 2, 790 + (1 - nameP) * 28, lerp(90, -2, nameP));
    ctx.restore();
  }

  const ruleP = easeOutCubic(prog(t, T.rule[0], T.rule[1]));
  if (ruleP > 0) {
    ctx.fillStyle = COLORS.accent;
    const w = 140 * ruleP;
    ctx.fillRect(W / 2 - w / 2, 850, w, 5);
  }

  const tagP = easeOutCubic(prog(t, T.tagline[0], T.tagline[1]));
  if (tagP > 0) {
    ctx.save();
    ctx.globalAlpha = tagP * 0.85;
    ctx.fillStyle = COLORS.paper;
    ctx.font = `500 40px ${FONT_BRAND}`;
    drawSpaced(ctx, TAGLINE, W / 2, 925 + (1 - tagP) * 16, lerp(30, 14, tagP));
    ctx.restore();
  }
}

/**
 * Desenha o quadro do instante `t` (segundos). `ctx` já deve estar com a escala e o
 * deslocamento que colocam o espaço de projeto 1920×1080 no centro do canvas.
 */
function drawFrame(ctx: CanvasRenderingContext2D, t: number, view: View, media: Media = NO_MEDIA): void {
  ctx.globalAlpha = 1;
  ctx.fillStyle = COLORS.ink;
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);
  // Só a abertura mostra o espaço direto; depois o primeiro cartão o cobre por completo.
  if (t < CARDS[0].wipe[1]) drawSpace(ctx, view, t, media, streakAlphaAt(t));

  CARDS.forEach((card, i) => drawCard(ctx, view, card, t, 5 + i * 7, media));
  drawWipe(ctx, view, INK_WIPE.origin, INK_WIPE.span, t, "ink", 21, media);
  drawLockup(ctx, t);
}

// --- áudio -------------------------------------------------------------------------------------

function fadeOutAudio(audio: HTMLAudioElement, durationMs = 350): void {
  const startVolume = audio.volume;
  if (startVolume <= 0) {
    audio.pause();
    return;
  }
  const startTime = performance.now();
  const step = (now: number): void => {
    const t = Math.min((now - startTime) / durationMs, 1);
    audio.volume = startVolume * (1 - t);
    if (t < 1) requestAnimationFrame(step);
    else audio.pause();
  };
  requestAnimationFrame(step);
}

// --- vídeo -------------------------------------------------------------------------------------

function createLoopingVideo(src: string): HTMLVideoElement {
  const video = document.createElement("video");
  video.src = src;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";
  video.play().catch((err: unknown) => {
    // Sem vídeo a intro continua: o fundo simplesmente fica preto.
    console.warn("Vídeo de fundo da intro não pôde tocar:", err);
  });
  return video;
}

function releaseVideo(video: HTMLVideoElement): void {
  video.pause();
  video.removeAttribute("src");
  video.load(); // libera o decoder
}

// --- componente ------------------------------------------------------------------------------

const BrandIntro: React.FC<BrandIntroProps> = ({ onFinish, soundEnabled = true }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mediaRef = useRef<Media>(NO_MEDIA);
  const finishedRef = useRef(false);
  const onFinishRef = useRef(onFinish);
  const [isExiting, setIsExiting] = useState(false);
  const [showSkipHint, setShowSkipHint] = useState(false);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  // Estável de propósito: o efeito de animação não pode reiniciar se `onFinish` mudar.
  const handleFinish = useCallback(() => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    setIsExiting(true);
    if (audioRef.current && !audioRef.current.paused) fadeOutAudio(audioRef.current);
    window.setTimeout(() => onFinishRef.current?.(), FADE_OUT_MS);
  }, []);

  // Bloqueia o launcher enquanto a intro roda; qualquer tecla pula.
  useLayoutEffect(() => {
    setLauncherInputLocked(true);
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

    const blockInteraction = (event: Event): void => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const blockedEvents = ["keyup", "keypress"];
    blockedEvents.forEach((name) => {
      window.addEventListener(name, blockInteraction, { capture: true, passive: false });
    });
    const handleKeySkip = (): void => handleFinish();
    window.addEventListener("keydown", handleKeySkip, { capture: true });

    return () => {
      setLauncherInputLocked(false);
      blockedEvents.forEach((name) => {
        window.removeEventListener(name, blockInteraction, { capture: true });
      });
      window.removeEventListener("keydown", handleKeySkip, { capture: true });
    };
  }, [handleFinish]);

  // Áudio: mudo por preferência mantém o resto do fluxo igual.
  useEffect(() => {
    const audio = new Audio(bootAudioSrc);
    audio.preload = "auto";
    audio.volume = 0.35;
    audio.muted = !soundEnabled;
    audioRef.current = audio;
    audio.play().catch((err: unknown) => {
      console.warn("Áudio da intro bloqueado ou pendente de interação:", err);
    });
    return () => {
      audio.pause();
      audioRef.current = null;
    };
  }, [soundEnabled]);

  // Vídeos de fundo: criados fora do DOM e lidos pelo canvas a cada quadro.
  useEffect(() => {
    const stars = createLoopingVideo(BACKDROP_VIDEOS.stars);
    const streaks = createLoopingVideo(BACKDROP_VIDEOS.streaks);
    mediaRef.current = { stars, streaks };
    return () => {
      mediaRef.current = NO_MEDIA;
      releaseVideo(stars);
      releaseVideo(streaks);
    };
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => setShowSkipHint(true), SKIP_HINT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, []);

  // Laço de animação no canvas.
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    let rafId = 0;
    let cancelled = false;
    let startMs: number | null = null;

    const render = (t: number): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.round(window.innerWidth * dpr);
      const ch = Math.round(window.innerHeight * dpr);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      // O espaço de projeto 1920×1080 é "contido" na janela; o resto é preenchido pelas cores.
      const scale = Math.min(cw / W, ch / H);
      const offsetX = (cw - W * scale) / 2;
      const offsetY = (ch - H * scale) / 2;
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
      drawFrame(
        ctx,
        t,
        {
          x0: -offsetX / scale,
          y0: -offsetY / scale,
          x1: (cw - offsetX) / scale,
          y1: (ch - offsetY) / scale,
        },
        mediaRef.current,
      );
    };

    const tick = (now: number): void => {
      if (cancelled) return;
      if (startMs === null) startMs = now;
      const t = (now - startMs) / 1000;
      render(Math.min(t, DURATION));
      if (t >= DURATION + END_HOLD) {
        handleFinish();
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    const fonts = [
      `400 100px ${FONT_CARD}`,
      `500 100px ${FONT_BRAND}`,
      `700 100px ${FONT_BRAND}`,
    ];
    Promise.all(fonts.map((f) => document.fonts.load(f)))
      .catch((err: unknown) => {
        console.warn("Fontes da intro não carregaram; usando fallback do sistema.", err);
      })
      .finally(() => {
        if (cancelled) return;
        if (reducedMotion) {
          // Sem movimento: mostra só o quadro final e segue.
          render(DURATION);
          window.setTimeout(handleFinish, REDUCED_MOTION_HOLD_MS);
          return;
        }
        rafId = requestAnimationFrame(tick);
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
    };
  }, [handleFinish]);

  const onSkipClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      handleFinish();
    },
    [handleFinish],
  );

  return (
    <div
      className="fixed inset-0 z-500 overflow-hidden select-none cursor-default"
      style={{
        backgroundColor: COLORS.ink,
        opacity: isExiting ? 0 : 1,
        transition: `opacity ${FADE_OUT_MS}ms cubic-bezier(0.65, 0, 0.25, 1)`,
      }}
      role="presentation"
      onClick={handleFinish}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full pointer-events-none" />

      {showSkipHint && !isExiting && (
        <button
          type="button"
          onClick={onSkipClick}
          className="absolute bottom-8 right-8 md:bottom-10 md:right-12 z-30 group flex items-center gap-2.5 px-4 py-2 rounded-[var(--corner-sm)] border border-white/20 bg-white/4 hover:bg-white/10 hover:border-white/40 transition-all duration-200 cursor-pointer backdrop-blur-md active:scale-95"
        >
          <span className="text-[length:var(--step-0)] font-mono tracking-[0.16em] uppercase text-[var(--ink-muted)] group-hover:text-white transition-colors">
            Pular Introdução
          </span>
          <span className="text-xs text-[var(--ink-muted)] group-hover:text-white transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </button>
      )}
    </div>
  );
};

export default BrandIntro;
