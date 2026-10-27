/**
 * Pherielium — brand intro (p5.js)
 * 7 s · 1920×1080 · 60 fps · 2D flat: kinetic typography + liquid blob morphing.
 *
 * A linha do tempo é uma função pura do tempo (`drawFrame(t)`), então o mesmo
 * quadro sai igual ao tocar ao vivo, ao congelar (?t=3.2) ou ao gravar.
 *
 * Query params:
 *   ?theme=mono   paleta cinza/preto/branco, sem degradê, marca em DM Serif
 *   ?t=3.2        congela no segundo 3.2
 *   ?loop=0       toca uma vez e para no último quadro
 *   ?capture=1    avança exatamente 1/60 s por quadro (para gravação offline)
 */

const W = 1920;
const H = 1080;
const FPS = 60;
const DURATION = 7;
const LOOP_GAP = 0.6; // pausa antes de reiniciar, em segundos
const BLOB_POINTS = 180;
const LETTER_STAGGER = 0.035; // atraso entre letras de uma palavra, em segundos
const LETTER_DURATION = 0.45;

// Papéis de cor (não nomes de cor): o tema mono só remapeia os papéis.
const THEMES = {
  color: {
    ink: "#111111",
    paper: "#EFEBE3",
    primary: "#1F3FB5",
    accent: "#F05A28",
    gradients: true,
    brandFont: "Inter",
    brandWeight: 700,
  },
  mono: {
    ink: "#111111",
    paper: "#F2F2F2",
    primary: "#6E6E6E",
    accent: "#B8B8B8",
    gradients: false,
    brandFont: "DM Serif Display",
    brandWeight: 400,
  },
};

const TAGLINE = "universal gaming library";

// Logo oficial (mesmos paths da intro React): corpo em blob + ponto. viewBox 1017×1145.
const LOGO_BODY_PATH =
  "M546.811 0.450368C574.495 -2.67907 606.626 10.823 625.549 30.9223C642.416 48.603 651.367 72.3858 650.346 96.8034C649.75 111.603 645.769 126.069 638.71 139.089C627.991 158.929 613.409 172.317 593.916 182.963C586.864 186.811 579.76 189.916 572.727 193.986C558.538 202.045 545.351 211.744 533.421 222.881C496.013 257.724 472.336 309.851 470.466 360.989C468.862 408.479 486.129 454.671 518.485 489.458C563.272 536.862 635.436 559.136 697.608 535.709C730.013 523.498 747.621 503.1 785.88 504.379C827.262 504.751 862.431 540.121 867.309 580.433C869.849 601.377 867.499 619.447 871.964 641.413C876.659 663.518 885.702 684.476 898.562 703.056C910.57 720.432 928.237 738.698 947.068 748.457C964.741 756.742 978.504 762.46 992.235 777.196C1029.85 817.055 1021.02 877.205 982.014 912.264C923.555 964.817 840.561 925.677 825.854 853.549C822.41 836.684 824.492 823.291 823.517 807.087C818.357 721.46 740.261 645.887 654.7 642.631C607.49 640.83 560.686 660.59 526.519 691.254C487.944 725.776 464.63 774.19 461.692 825.884C458.981 880.441 483.698 937.06 532.144 964.509C553.902 976.704 574.161 982.101 591.592 1001.47C624.482 1038.01 618.274 1089.45 582.17 1121.75C564.942 1137.31 542.221 1145.32 519.055 1144.02C473.931 1142.4 432.717 1105.27 426.52 1060.54C425.278 1052.41 425.811 1043.35 424.591 1035.29C409.2 933.714 269.72 837.116 173.523 894.928C148.135 910.188 135.775 928.428 103.062 932.554C78.7883 935.423 54.3806 928.422 35.3119 913.129C7.39449 891.083 -6.1386 857.013 2.66826 822.164C16.9282 765.741 82.1114 724.525 137.24 752.852C154.191 761.909 170.279 774.045 188.677 780.261C257.114 803.361 336.225 766.108 379.376 711.865C409.935 673.78 423.991 625.052 418.41 576.539C412.519 525.267 380.818 471.216 340.471 439.625C296.691 405.346 233.542 393.111 183.664 421.144C156.332 436.506 140.804 456.751 106.695 460.397C82.296 463.006 57.3775 454.495 38.4922 439.087C19.1341 423.609 6.80584 401.001 4.27641 376.342C1.83144 351.126 12.4435 325.227 28.4884 306.121C40.4579 291.869 55.9436 280.994 73.4099 274.575C115.44 259.402 141.899 277.319 174.876 299.283C194.091 312.081 224.233 318.825 247.339 316.351C308.871 309.761 365.404 272.323 405.055 226.103C425.598 201.777 446.522 167.27 449.035 135.403C449.682 127.206 448.443 119.029 447.719 110.884C445.386 84.6811 455.082 58.617 472.003 38.7504C491.704 15.6216 516.828 3.05048 546.811 0.450368Z";
const LOGO_DOT_PATH =
  "M910.963 266.954C963.837 264.292 1008.83 305.052 1011.39 357.938C1013.97 410.824 973.135 455.756 920.255 458.231C867.512 460.701 822.724 419.984 820.164 367.231C817.604 314.476 858.227 269.61 910.963 266.954Z";

// Cartões de título: cada um entra por uma "onda" líquida que nasce de um ponto.
const CARDS = [
  {
    word: "UNIVERSAL",
    index: "01",
    bg: "paper",
    fg: "ink",
    origin: [960, 540],
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
    origin: [0, 1080],
    wipe: [1.75, 2.4],
    textAt: 2.15,
    ambient: { x: 330, y: 190, r: 330, from: "ink", to: null, seed: 8 },
  },
  {
    word: "LIBRARY",
    index: "03",
    bg: "accent",
    fg: "ink",
    origin: [1920, 0],
    wipe: [2.9, 3.5],
    textAt: 3.3,
    ambient: { x: 1560, y: 180, r: 340, from: "primary", to: null, seed: 15 },
  },
];

const INK_WIPE = { origin: [960, 540], span: [4.2, 4.8] };
const LOGO_TIMING = {
  seedAt: 4.6, // ponto azul nasce no centro
  morph: [5.0, 5.7], // blob -> logo
  dot: [5.6, 6.1], // ponto do logo
  rise: [5.6, 6.2], // logo sobe para dar espaço ao nome
  name: [5.7, 6.5],
  rule: [6.0, 6.5],
  tagline: [6.1, 6.8],
};
const LOGO_HEIGHT = 400;
const LOGO_REST_Y = 392;

// --- easing -------------------------------------------------------------------

const clamp01 = (v) => Math.min(1, Math.max(0, v));
const lerp = (a, b, t) => a + (b - a) * t;
const prog = (t, a, b) => clamp01((t - a) / (b - a));
const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeOutBack = (t, s = 1.70158) => 1 + (s + 1) * Math.pow(t - 1, 3) + s * Math.pow(t - 1, 2);
const easeOutElastic = (t) =>
  t <= 0 ? 0 : t >= 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;

// --- estado -------------------------------------------------------------------

const params = new URLSearchParams(window.location.search);
const theme = THEMES[params.get("theme")] ?? THEMES.color;
const frozenAt = params.has("t") ? Number(params.get("t")) : null;
const loops = params.get("loop") !== "0";
const captureMode = params.has("capture");

let logo = null;
let ready = false;
let startMs = 0;

// --- geometria do logo ----------------------------------------------------------

/** Amostra um path com M/C/Z absolutos em uma polilinha densa. */
function samplePath(d) {
  const tokens = d.match(/[MCZ]|-?\d*\.?\d+(?:e-?\d+)?/g);
  const pts = [];
  let i = 0;
  let cmd = "";
  let cx = 0;
  let cy = 0;
  const num = () => Number(tokens[i++]);
  while (i < tokens.length) {
    if (/[MCZ]/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === "M") {
      cx = num();
      cy = num();
      pts.push([cx, cy]);
      cmd = "C";
    } else if (cmd === "C") {
      const [x1, y1, x2, y2, x3, y3] = [num(), num(), num(), num(), num(), num()];
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
function resample(pts, n) {
  const seg = [0];
  for (let i = 1; i < pts.length; i++) {
    seg.push(seg[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  }
  const total = seg[seg.length - 1];
  const out = [];
  let j = 1;
  for (let k = 0; k < n; k++) {
    const target = (k / n) * total;
    while (j < seg.length - 1 && seg[j] < target) j++;
    const f = (target - seg[j - 1]) / Math.max(seg[j] - seg[j - 1], 1e-9);
    out.push([lerp(pts[j - 1][0], pts[j][0], f), lerp(pts[j - 1][1], pts[j][1], f)]);
  }
  return out;
}

const boundsOf = (pts) => {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return { x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys) };
};

/** Logo centralizado na origem, sentido horário, pronto para interpolar com o blob. */
function prepareLogo() {
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
  body = [...body.slice(top), ...body.slice(0, top)].map(([x, y]) => [x - cx, y - cy]);

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

// --- primitivas de desenho ---------------------------------------------------------

function blobPoints(cx, cy, radius, t, seed, amp) {
  const pts = [];
  for (let i = 0; i < BLOB_POINTS; i++) {
    const a = -Math.PI / 2 + (i / BLOB_POINTS) * Math.PI * 2;
    // Ruído amostrado num círculo => contorno contínuo, sem emenda.
    const n = noise(Math.cos(a) * 0.9 + seed, Math.sin(a) * 0.9 + seed * 1.7, t * 0.55);
    const r = radius * (1 + amp * (n - 0.5) * 2.6);
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

function tracePath(ctx, pts) {
  const n = pts.length;
  const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const start = mid(pts[n - 1], pts[0]);
  ctx.beginPath();
  ctx.moveTo(start[0], start[1]);
  for (let i = 0; i < n; i++) {
    const end = mid(pts[i], pts[(i + 1) % n]);
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], end[0], end[1]);
  }
  ctx.closePath();
}

/** Preenche um blob; com degradê, interpola `from`→`to` na diagonal do próprio blob. */
function fillShape(ctx, pts, from, to) {
  tracePath(ctx, pts);
  if (to && theme.gradients) {
    const b = boundsOf(pts);
    const g = ctx.createLinearGradient(b.x0, b.y0, b.x1, b.y1);
    g.addColorStop(0, theme[from]);
    g.addColorStop(1, theme[to]);
    ctx.fillStyle = g;
  } else {
    ctx.fillStyle = theme[from];
  }
  ctx.fill();
}

/** Texto letra a letra com espaçamento controlado (kerning é sacrificado de propósito). */
function drawSpaced(ctx, text, cx, y, spacing) {
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
function kineticWord(ctx, word, t, t0, color) {
  ctx.font = '400 100px "Archivo Black"';
  const chars = [...word];
  const unit = chars.reduce((sum, ch) => sum + ctx.measureText(ch).width, 0) / 100;
  const size = Math.min(1700 / unit, 460);
  ctx.font = `400 ${size}px "Archivo Black"`;
  const widths = chars.map((ch) => ctx.measureText(ch).width);
  const total = widths.reduce((a, b) => a + b, 0);
  const baseline = H / 2 + size * 0.36; // metade da altura das maiúsculas
  let x = (W - total) / 2;
  ctx.fillStyle = theme[color];
  ctx.textAlign = "left";
  chars.forEach((ch, i) => {
    const p = prog(t, t0 + i * LETTER_STAGGER, t0 + i * LETTER_STAGGER + LETTER_DURATION);
    if (p > 0) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, baseline - size * 0.9, W, size * 0.92); // máscara: a letra emerge do chão
      ctx.clip();
      ctx.fillText(ch, x, baseline + (1 - easeOutExpo(p)) * size * 1.15);
      ctx.restore();
    }
    x += widths[i];
  });
}

function caption(ctx, card, t) {
  const a = prog(t, card.textAt, card.textAt + 0.4);
  if (a <= 0) return;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = theme[card.fg];
  ctx.font = '500 30px "Inter"';
  ctx.textAlign = "left";
  ctx.fillText("pherielium", 90, 110);
  ctx.textAlign = "right";
  ctx.fillText(`${card.index} / 03`, W - 90, 110);
  ctx.restore();
}

// --- cena ------------------------------------------------------------------------------

function reachFrom([ox, oy]) {
  // Distância ao canto mais longe, com folga para o contorno ondulado nunca deixar buracos.
  return 1.35 * Math.max(Math.hypot(ox, oy), Math.hypot(W - ox, oy), Math.hypot(ox, H - oy), Math.hypot(W - ox, H - oy));
}

function drawWipe(ctx, origin, span, t, color, seed, startRadius = 0) {
  const p = prog(t, span[0], span[1]);
  if (p <= 0) return false;
  const r = lerp(startRadius, reachFrom(origin), easeInOutCubic(p));
  fillShape(ctx, blobPoints(origin[0], origin[1], r, t, seed, 0.12), color);
  return true;
}

function drawCard(ctx, card, t, seed) {
  // Antes da onda, o primeiro cartão aparece como uma gota que pulsa no escuro.
  if (card.startRadius && t < card.wipe[0]) {
    const drop = easeOutElastic(prog(t, 0.02, 0.22));
    if (drop > 0) fillShape(ctx, blobPoints(960, 540, card.startRadius * drop, t, seed, 0.1), card.bg);
    return;
  }
  if (!drawWipe(ctx, card.origin, card.wipe, t, card.bg, seed, card.startRadius ?? 0)) return;
  if (t < card.textAt - 0.1) return;

  const a = card.ambient;
  const grow = easeOutBack(prog(t, card.textAt - 0.1, card.textAt + 0.6));
  if (grow > 0) fillShape(ctx, blobPoints(a.x, a.y, a.r * grow, t, a.seed, 0.2), a.from, a.to);
  caption(ctx, card, t);
  kineticWord(ctx, card.word, t, card.textAt, card.fg);
}

function drawLockup(ctx, t) {
  const T = LOGO_TIMING;
  if (t < T.seedAt) return;
  const scale = LOGO_HEIGHT / logo.height;
  const grow = easeOutElastic(prog(t, T.seedAt, T.seedAt + 0.55));
  const morph = easeInOutCubic(prog(t, T.morph[0], T.morph[1]));
  const rise = easeInOutCubic(prog(t, T.rise[0], T.rise[1]));
  const float = Math.sin((t * Math.PI * 2) / 3.2) * 6 * prog(t, T.rise[1], T.rise[1] + 0.4);
  const cx = W / 2;
  const cy = lerp(H / 2, LOGO_REST_Y, rise) + float;

  const blob = blobPoints(cx, cy, 150 * grow, t, 11, 0.14);
  const shape = blob.map((b, i) => [
    lerp(b[0], cx + logo.body[i][0] * scale * grow, morph),
    lerp(b[1], cy + logo.body[i][1] * scale * grow, morph),
  ]);
  fillShape(ctx, shape, "primary");
  if (theme.gradients && morph > 0) {
    ctx.save();
    ctx.globalAlpha = morph;
    fillShape(ctx, shape, "primary", "accent");
    ctx.restore();
  }

  const dot = easeOutElastic(prog(t, T.dot[0], T.dot[1]));
  if (dot > 0) {
    ctx.beginPath();
    ctx.arc(cx + logo.dot.x * scale, cy + logo.dot.y * scale, logo.dot.r * scale * dot, 0, Math.PI * 2);
    ctx.fillStyle = theme.paper;
    ctx.fill();
  }

  // Nome da marca: tracking-in (letras largas -> bloco fechado) + subida suave.
  const nameP = easeOutCubic(prog(t, T.name[0], T.name[1]));
  if (nameP > 0) {
    ctx.save();
    ctx.globalAlpha = nameP;
    ctx.fillStyle = theme.paper;
    ctx.font = `${theme.brandWeight} 150px "${theme.brandFont}"`;
    drawSpaced(ctx, "Pherielium", W / 2, 790 + (1 - nameP) * 28, lerp(90, -2, nameP));
    ctx.restore();
  }

  const ruleP = easeOutCubic(prog(t, T.rule[0], T.rule[1]));
  if (ruleP > 0) {
    ctx.fillStyle = theme.accent;
    const w = 140 * ruleP;
    ctx.fillRect(W / 2 - w / 2, 850, w, 5);
  }

  const tagP = easeOutCubic(prog(t, T.tagline[0], T.tagline[1]));
  if (tagP > 0) {
    ctx.save();
    ctx.globalAlpha = tagP * 0.85;
    ctx.fillStyle = theme.paper;
    ctx.font = '500 40px "Inter"';
    drawSpaced(ctx, TAGLINE, W / 2, 925 + (1 - tagP) * 16, lerp(30, 14, tagP));
    ctx.restore();
  }
}

/** Desenha o quadro do instante `t` (segundos). Sem estado: mesmo t, mesmo quadro. */
function drawFrame(t) {
  const ctx = drawingContext;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.fillStyle = theme.ink;
  ctx.fillRect(0, 0, W, H);

  CARDS.forEach((card, i) => drawCard(ctx, card, t, 5 + i * 7));
  drawWipe(ctx, INK_WIPE.origin, INK_WIPE.span, t, "ink", 21);
  drawLockup(ctx, t);
}

// --- p5 ----------------------------------------------------------------------------------

function setup() {
  pixelDensity(1);
  createCanvas(W, H);
  frameRate(FPS);
  noiseSeed(7);
  logo = prepareLogo();

  const fonts = [
    '400 100px "Archivo Black"',
    '500 100px "Inter"',
    `${theme.brandWeight} 100px "${theme.brandFont}"`,
  ];
  Promise.all(fonts.map((f) => document.fonts.load(f)))
    .catch((err) => console.warn("Fontes não carregaram; usando fallback do sistema.", err))
    .finally(() => {
      ready = true;
      startMs = millis();
      window.__introReady = true;
    });
}

function draw() {
  if (!ready) {
    background(theme.ink);
    return;
  }
  if (frozenAt !== null) {
    drawFrame(frozenAt);
    noLoop();
    return;
  }
  const elapsed = captureMode ? frameCount / FPS : (millis() - startMs) / 1000;
  if (elapsed > DURATION + LOOP_GAP && loops && !captureMode) {
    startMs = millis();
    return;
  }
  drawFrame(Math.min(elapsed, DURATION));
  window.__introDone = elapsed >= DURATION;
  if (captureMode && window.__introDone) noLoop();
}

function keyPressed() {
  if (key === " ") startMs = millis();
}

window.renderAt = (t) => {
  noiseSeed(7);
  drawFrame(t);
};
