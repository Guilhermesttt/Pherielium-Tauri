import type { BodyPalette } from "../mascotColor";
import type { HatId, ItemId } from "../notchConfig";
import type { MascotExtra } from "../pherieStates";
import { spiralPath } from "../spiral";
import { R, type EyeState, type PherieEngine } from "./engine";

/** Metade do lado da área de desenho (o corpo tem raio 100; orelhas/halo/fones cabem em ±158). */
export const HALF = 158;

const TAU = Math.PI * 2;
let spiral: Path2D | null = null;
/** Criada sob demanda: `Path2D` não existe fora do navegador (testes em Node). */
const spiralShape = () => (spiral ??= new Path2D(spiralPath()));

export interface DrawStyle {
  palette: BodyPalette;
  faceColor: string;
  accentColor: string;
  hat: HatId;
  items: ReadonlySet<ItemId>;
  rgbHeadphones: boolean;
  showMic: boolean;
  /** volume da voz 0..1: os olhos pulsam enquanto ela fala (sem boca) */
  voice: number;
  extras: readonly MascotExtra[];
}

/** Rosto sobre a faixa preta (folha de design): olhos grandes, no alto, inclinados junto com a faixa. */
const FACE_X = 30;
const FACE_Y = -42;
const FACE_TILT = (-19 * Math.PI) / 180;
const EYE_GAP = 35;
/** Ancoragem das asas coladas ao corpo: a esquerda (maior) embaixo, a direita (menor) no alto. */
const WING_ANCHOR = { left: { x: -88, y: 26 }, right: { x: 86, y: -38 } } as const;
const WING_LEN = { left: 62, right: 50 } as const;
const WING_BASE = { left: 25, right: 20 } as const;
const WING_TIP = { left: 13, right: 11 } as const;

/** Corpo: asas atrás, disco com volume suave e a faixa preta diagonal que passa pelos olhos. */
function drawBody(ctx: CanvasRenderingContext2D, st: DrawStyle, eng: PherieEngine) {
  const p = st.palette;
  const flat = ctx.createLinearGradient(0, -110, 0, 110);
  flat.addColorStop(0, p.top);
  flat.addColorStop(1, p.bottom);

  drawWings(ctx, flat, eng);

  // disco: luz no alto-esquerda, sombra suave embaixo-direita
  const vol = ctx.createRadialGradient(-34, -46, 8, 0, 0, R * 1.12);
  vol.addColorStop(0, p.top);
  vol.addColorStop(0.62, p.top);
  vol.addColorStop(1, p.bottom);
  const disc = new Path2D();
  disc.arc(0, 0, R, 0, TAU);
  ctx.fillStyle = vol;
  ctx.fill(disc);
  ctx.lineWidth = 2;
  ctx.strokeStyle = p.rim;
  ctx.stroke(disc);

  // faixa preta: grossa à esquerda, afinando à direita; recortada pelo disco
  ctx.save();
  ctx.clip(disc);
  const dir = FACE_TILT;
  const cos = Math.cos(dir);
  const sin = Math.sin(dir);
  const at = (t: number, off: number) => [FACE_X + cos * t - sin * off, FACE_Y + sin * t + cos * off] as const;
  const [x1, y1] = at(-150, -9);
  const [x2, y2] = at(150, -4.5);
  const [x3, y3] = at(150, 4.5);
  const [x4, y4] = at(-150, 9);
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.lineTo(x4, y4);
  ctx.closePath();
  ctx.fillStyle = st.faceColor;
  ctx.fill();
  // brilho fino na borda de cima da faixa
  ctx.strokeStyle = p.light ? "rgba(255,255,255,0.22)" : "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(x1, y1 + 2);
  ctx.lineTo(x2, y2 + 2);
  ctx.stroke();
  ctx.restore();
}

/** Asa colada ao corpo: lóbulo afilado e arredondado, da âncora até a ponta (mola do engine). */
function drawWings(ctx: CanvasRenderingContext2D, fill: CanvasGradient, eng: PherieEngine) {
  ctx.fillStyle = fill;
  for (const side of ["left", "right"] as const) {
    const a = WING_ANCHOR[side];
    const tx = side === "left" ? eng.lhx.value : eng.rhx.value;
    const ty = side === "left" ? eng.lhy.value : eng.rhy.value;
    let dx = tx - a.x;
    let dy = ty - a.y;
    const dist = Math.hypot(dx, dy) || 1;
    const len = Math.min(WING_LEN[side], dist);
    dx /= dist;
    dy /= dist;
    const nx = -dy;
    const ny = dx;
    const wb = WING_BASE[side];
    const rt = WING_TIP[side];
    const tipX = a.x + dx * len;
    const tipY = a.y + dy * len;
    const ang = Math.atan2(dy, dx);
    ctx.beginPath();
    ctx.moveTo(a.x + nx * wb, a.y + ny * wb);
    ctx.quadraticCurveTo(a.x + dx * len * 0.55 + nx * wb * 0.95, a.y + dy * len * 0.55 + ny * wb * 0.95, tipX + nx * rt, tipY + ny * rt);
    ctx.arc(tipX, tipY, rt, ang + Math.PI / 2, ang - Math.PI / 2, true);
    ctx.quadraticCurveTo(a.x + dx * len * 0.55 - nx * wb * 0.95, a.y + dy * len * 0.55 - ny * wb * 0.95, a.x - nx * wb, a.y - ny * wb);
    ctx.closePath();
    ctx.fill();
  }
}

/** Anel e órbitas roxas que pulsam ao redor dela enquanto toca música ("Pulsando"). */
function drawPulse(ctx: CanvasRenderingContext2D, eng: PherieEngine) {
  const beat = 0.5 + 0.5 * Math.sin(eng.time * 5);
  ctx.save();
  ctx.strokeStyle = `rgba(192,132,252,${(0.35 + 0.35 * beat).toFixed(3)})`;
  ctx.shadowColor = "#c084fc";
  ctx.shadowBlur = 14;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, R * (1.2 + 0.03 * beat), 0, TAU);
  ctx.stroke();
  ctx.fillStyle = "#e9d5ff";
  for (let i = 0; i < 3; i++) {
    const a = eng.time * 1.6 + (i * TAU) / 3;
    ctx.beginPath();
    ctx.arc(Math.cos(a) * R * 1.2, Math.sin(a) * R * 1.2, 4.5, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Chapéu no topo da cabeça (no lugar das orelhas). */
function drawHat(ctx: CanvasRenderingContext2D, id: HatId, eng: PherieEngine) {
  if (id === "none") return;
  ctx.save();
  ctx.translate(-6, -90);
  ctx.rotate((-9 * Math.PI) / 180 + Math.sin(eng.time * 1.7) * 0.015);
  ctx.scale(0.8, 0.8); // cabe na área de desenho (HALF)
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  const fillPath = (d: string, color: string) => {
    ctx.fillStyle = color;
    ctx.fill(new Path2D(d));
  };
  switch (id) {
    case "witch":
      fillPath("M -40 0 C -34 -38 -10 -62 26 -80 C 20 -60 38 -38 44 0 Z", "#6d28d9");
      fillPath("M -41 -6 L 44 -6 L 44 -22 C 20 -30 -16 -30 -40 -22 Z", "#f97316");
      fillPath("M -82 4 C -60 -14 60 -14 84 4 C 62 22 -62 22 -82 4 Z", "#5b21b6");
      break;
    case "party":
      fillPath("M -36 0 L 36 0 L 0 -80 Z", "#f472b6");
      fillPath("M -20 -52 L 20 -52 L 28 -36 L -28 -36 Z", "#fde047");
      ctx.fillStyle = "#fde047";
      ctx.beginPath();
      ctx.arc(0, -82, 9, 0, TAU);
      ctx.fill();
      break;
    case "crown":
      fillPath("M -48 6 L -48 -40 L -24 -16 L 0 -50 L 24 -16 L 48 -40 L 48 6 Z", "#fbbf24");
      ctx.fillStyle = "#ef4444";
      for (const x of [-26, 0, 26]) {
        ctx.beginPath();
        ctx.arc(x, -6, 5, 0, TAU);
        ctx.fill();
      }
      break;
    case "beanie":
      fillPath("M -56 0 C -58 -44 -18 -66 0 -66 C 18 -66 58 -44 56 0 Z", "#ef4444");
      fillPath("M -60 6 L 60 6 L 60 -16 L -60 -16 Z", "#b91c1c");
      ctx.fillStyle = "#fee2e2";
      ctx.beginPath();
      ctx.arc(0, -70, 11, 0, TAU);
      ctx.fill();
      break;
    case "top":
      fillPath("M -66 8 C -40 -4 40 -4 66 8 C 40 20 -40 20 -66 8 Z", "#18181b");
      fillPath("M -40 4 L -40 -80 L 40 -80 L 40 4 Z", "#27272a");
      fillPath("M -40 -8 L 40 -8 L 40 -26 L -40 -26 Z", "#dc2626");
      break;
  }
  ctx.restore();
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawEye(ctx: CanvasRenderingContext2D, eye: EyeState, cx: number, cy: number, open: number, color: string, time: number, gloss: boolean, scale: number, halo: string) {
  const { shape } = eye.spec;
  const w = Math.max(1, eye.w.value) * scale;
  const baseH = Math.max(1, eye.h.value) * scale;
  const lid = eye.lid.value;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";

  // olhos que não são "bolinhas" (arcos, sonolento, espiral) ganham um halo da cor do corpo:
  // sem ele sumiriam na faixa preta
  const cutout = (draw: () => void) => {
    const keep = ctx.fillStyle;
    const keepStroke = ctx.strokeStyle;
    ctx.fillStyle = halo;
    ctx.strokeStyle = halo;
    draw();
    ctx.fillStyle = keep;
    ctx.strokeStyle = keepStroke;
  };
  const arcEye = (up: boolean) => {
    cutout(() => {
      ctx.lineWidth = 17;
      ctx.beginPath();
      if (up) ctx.arc(0, baseH * 0.35, w * 0.5, Math.PI * 1.12, Math.PI * 1.88);
      else ctx.arc(0, -baseH * 0.5, w * 0.5, Math.PI * 0.12, Math.PI * 0.88);
      ctx.stroke();
    });
    ctx.lineWidth = 8;
    ctx.beginPath();
    if (up) ctx.arc(0, baseH * 0.35, w * 0.5, Math.PI * 1.12, Math.PI * 1.88);
    else ctx.arc(0, -baseH * 0.5, w * 0.5, Math.PI * 0.12, Math.PI * 0.88);
    ctx.stroke();
  };

  if (shape === "happy") arcEye(true);
  else if (shape === "closed") arcEye(false);
  else if (shape === "star") {
    // olho de estrela: pulsa de leve
    const R2 = (w / 2) * (1 + Math.sin(time * 5) * 0.08);
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const ang = -Math.PI / 2 + (i * Math.PI) / 5;
      const rad = i % 2 === 0 ? R2 : R2 * 0.45;
      if (i === 0) ctx.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
      else ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
    }
    ctx.closePath();
    ctx.fill();
  }
  else if (shape === "spiral") {
    cutout(() => {
      ctx.beginPath();
      ctx.arc(0, 0, w * 0.58, 0, TAU);
      ctx.fill();
    });
    ctx.rotate(time * 7);
    ctx.scale(w * 0.5, w * 0.5);
    ctx.lineWidth = 0.26;
    ctx.stroke(spiralShape());
  } else {
    if (lid !== 0) {
      // pálpebra: corta o topo com uma reta inclinada (bravo/triste/entediado)
      ctx.save();
      ctx.rotate((lid * Math.PI) / 180);
      ctx.beginPath();
      ctx.rect(-w * 2, -baseH * 0.12, w * 4, baseH * 2);
      ctx.restore();
      ctx.clip();
    }
    const h = baseH * Math.max(0.06, open);
    if (shape === "dot") {
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, (w / 2) * Math.max(0.1, open), 0, 0, TAU);
      ctx.fill();
    } else if (shape === "wide") {
      ctx.beginPath();
      ctx.ellipse(0, 0, w / 2, h / 2, 0, 0, TAU);
      ctx.fill();
    } else if (shape === "tired") {
      cutout(() => {
        roundRect(ctx, -w / 2 - 4, -h / 2 - 4, w + 8, h + 8, w / 2 + 4);
        ctx.fill();
      });
      ctx.save();
      ctx.beginPath();
      ctx.rect(-w, -h * 0.05, w * 2, h);
      ctx.clip();
      roundRect(ctx, -w / 2, -h / 2, w, h, w / 2);
      ctx.fill();
      ctx.restore();
    } else {
      roundRect(ctx, -w / 2, -h / 2, w, h, w / 2);
      ctx.fill();
    }
    // reflexo: dá o brilho de "bolinha de vidro" dos olhos da folha
    if (gloss && (shape === "pill" || shape === "wide" || shape === "dot") && open > 0.35) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(-w * 0.17, -h * 0.2, Math.max(2, w * 0.1), 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

/** Controle entre as mãos (aparece ao jogar). */
function drawController(ctx: CanvasRenderingContext2D, st: DrawStyle, eng: PherieEngine) {
  const a = Math.max(0, Math.min(1, eng.ctl.value));
  if (a < 0.02) return;
  const cx = (eng.lhx.value + eng.rhx.value) / 2;
  const cy = (eng.lhy.value + eng.rhy.value) / 2 - 2;
  ctx.save();
  ctx.globalAlpha = a;
  ctx.translate(cx, cy);
  ctx.scale(0.7 + 0.3 * a, 0.7 + 0.3 * a);
  ctx.fillStyle = "#2b2b33";
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 3;
  roundRect(ctx, -46, -17, 92, 36, 17);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = st.palette.light ? "#f5a524" : "#9fe3ff";
  for (const [x, y] of [[-24, -3], [24, 6]] as const) {
    ctx.beginPath();
    ctx.arc(x, y, 6, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.fillRect(-30, -3, 12, 3.5);
  ctx.fillRect(-26, -7, 3.5, 12);
  for (const [x, y] of [[26, -8], [34, -3]] as const) {
    ctx.beginPath();
    ctx.arc(x, y, 2.8, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawHeadphones(ctx: CanvasRenderingContext2D, st: DrawStyle, eng: PherieEngine) {
  const alpha = Math.max(0, Math.min(1, eng.phA.value));
  if (alpha < 0.01) return;
  const p = st.palette;
  const hue = `hsl(${(eng.time * 90) % 360} 90% 65%)`;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(0, eng.phY.value);
  ctx.lineCap = "round";
  ctx.strokeStyle = st.rgbHeadphones ? "#a78bfa" : p.headphoneBand;
  ctx.lineWidth = 9;
  ctx.stroke(new Path2D("M -112 6 C -118 -150 118 -150 112 6"));
  ctx.lineWidth = 3;
  ctx.fillStyle = st.rgbHeadphones ? hue : p.headphoneCup;
  ctx.strokeStyle = st.rgbHeadphones ? "#0b0b0e" : p.headphoneStroke;
  for (const x of [-128, 106]) {
    roundRect(ctx, x, -24, 22, 62, 11);
    ctx.fill();
    ctx.stroke();
  }
  if (st.showMic) {
    const mic = p.light ? p.headphoneBand : st.accentColor;
    ctx.strokeStyle = mic;
    ctx.fillStyle = mic;
    ctx.lineWidth = 5;
    ctx.stroke(new Path2D("M -112 34 C -104 82 -64 96 -36 80"));
    ctx.beginPath();
    ctx.arc(-34, 80, 8, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawExtras(ctx: CanvasRenderingContext2D, st: DrawStyle, time: number) {
  const has = (e: MascotExtra) => st.extras.includes(e);
  if (has("sweat")) {
    ctx.fillStyle = "rgba(125,211,252,0.9)";
    ctx.fill(new Path2D("M 92 -76 C 102 -56 106 -44 92 -34 C 78 -44 82 -56 92 -76 Z"));
  }
  if (has("tear")) {
    ctx.fillStyle = "rgba(125,211,252,0.9)";
    ctx.fill(new Path2D("M -62 26 C -54 42 -52 52 -62 60 C -72 52 -70 42 -62 26 Z"));
  }
  if (has("anger")) {
    ctx.strokeStyle = "#F87171";
    ctx.lineWidth = 9;
    ctx.lineCap = "round";
    ctx.stroke(new Path2D("M 82 -104 L 102 -84 M 102 -104 L 82 -84"));
  }
  if (has("thought")) {
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    for (const [x, y, r] of [[96, -70, 7], [112, -96, 10], [104, -130, 14]] as const) {
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
  }
  if (has("dizzy")) {
    ctx.save();
    ctx.translate(0, -118);
    ctx.rotate(time * 2.9);
    ctx.fillStyle = st.accentColor === st.palette.face && st.palette.light ? "#ffffff" : st.accentColor;
    for (const [x, y, r, a] of [[0, -28, 8, 1], [36, 8, 6, 0.7], [-36, 8, 6, 0.7]] as const) {
      ctx.globalAlpha = a;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, TAU);
      ctx.fill();
    }
    ctx.restore();
  }
  if (has("ticks")) {
    // surpreso: três tracinhos de susto acima da cabeça
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    for (const [x, y, ang] of [[40, -118, -0.5], [62, -124, 0], [84, -116, 0.5]] as const) {
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(ang);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(0, -16);
      ctx.stroke();
      ctx.restore();
    }
  }
  if (has("sparkle")) {
    // animado: dois tracinhos de brilho de cada lado
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    for (const s of [-1, 1] as const) {
      for (const [dx, dy, ex, ey] of [[96, -78, 112, -92], [104, -58, 124, -62]] as const) {
        ctx.beginPath();
        ctx.moveTo(s * dx, dy);
        ctx.lineTo(s * ex, ey);
        ctx.stroke();
      }
    }
  }
  if (has("stars")) {
    // empolgado: faíscas de quatro pontas ao redor
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    for (const [x, y, r, ph] of [[-110, -76, 12, 0], [112, -96, 10, 1.3], [-118, 40, 8, 2.1], [108, 52, 9, 3.2]] as const) {
      const k = 0.75 + 0.25 * Math.sin(time * 4 + ph);
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(k, k);
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.quadraticCurveTo(0, 0, r, 0);
      ctx.quadraticCurveTo(0, 0, 0, r);
      ctx.quadraticCurveTo(0, 0, -r, 0);
      ctx.quadraticCurveTo(0, 0, 0, -r);
      ctx.fill();
      ctx.restore();
    }
  }
  if (has("question")) {
    ctx.fillStyle = "rgba(255,255,255,0.78)";
    ctx.font = "bold 58px system-ui, sans-serif";
    ctx.fillText("?", 84, -78);
  }
}

function drawParticles(ctx: CanvasRenderingContext2D, eng: PherieEngine, st: DrawStyle) {
  for (const p of eng.particles) {
    const t = p.age / p.life;
    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, t < 0.2 ? t / 0.2 : 1 - (t - 0.2) / 0.8));
    ctx.translate(p.x, p.y);
    if (p.kind === "z") {
      ctx.fillStyle = "rgba(255,255,255,0.7)";
      ctx.font = `bold ${20 + t * 10}px system-ui, sans-serif`;
      ctx.fillText("z", 0, 0);
    } else if (p.kind === "heart") {
      ctx.fillStyle = "#f472b6";
      ctx.scale(0.9 + t * 0.5, 0.9 + t * 0.5);
      ctx.fill(new Path2D("M 0 8 C -14 -2 -12 -14 -5 -14 C -1 -14 0 -10 0 -10 C 0 -10 1 -14 5 -14 C 12 -14 14 -2 0 8 Z"));
    } else if (p.kind === "note") {
      // cor pelo estilo: calma azul-clara, animada rosa/violeta, pesada vermelho-fogo
      const colors = ["#7dd3fc", "#f0abfc", "#fb7185"] as const;
      const color = colors[Math.min(2, Math.max(0, p.tone ?? 1))];
      ctx.rotate(p.rot ?? 0);
      const grow = 0.85 + Math.min(1, t * 3) * 0.35;
      ctx.scale(grow * 1.5, grow * 1.5);
      ctx.fillStyle = color;
      ctx.strokeStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 7;
      ctx.lineWidth = 2.4;
      ctx.lineCap = "round";
      if (p.variant === 1) {
        // duas colcheias ligadas (♫)
        for (const x of [-7, 7]) {
          ctx.beginPath();
          ctx.ellipse(x, 9, 5.2, 3.9, -0.4, 0, Math.PI * 2);
          ctx.fill();
          ctx.beginPath();
          ctx.moveTo(x + 4.6, 8);
          ctx.lineTo(x + 4.6, -12);
          ctx.stroke();
        }
        ctx.lineWidth = 3.4;
        ctx.beginPath();
        ctx.moveTo(-2.4, -12);
        ctx.lineTo(11.6, -12);
        ctx.stroke();
      } else {
        // colcheia (♪)
        ctx.beginPath();
        ctx.ellipse(0, 9, 5.4, 4, -0.4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(4.8, 8);
        ctx.lineTo(4.8, -12);
        ctx.quadraticCurveTo(12, -9, 11, -2);
        ctx.stroke();
      }
    } else {
      ctx.fillStyle = st.palette.light ? "#f5a524" : "#fde68a";
      ctx.rotate(t * 2);
      ctx.fill(new Path2D("M 0 -9 L 2.6 -2.6 L 9 0 L 2.6 2.6 L 0 9 L -2.6 2.6 L -9 0 L -2.6 -2.6 Z"));
    }
    ctx.restore();
  }
}

/**
 * Desenha a Pherie. `px` = lado do canvas em pixels CSS; `dpr` = densidade. A área de
 * desenho vai de -HALF a +HALF (corpo = raio 100), como o antigo viewBox do SVG.
 */
export function drawPherie(ctx: CanvasRenderingContext2D, eng: PherieEngine, st: DrawStyle, px: number, dpr: number) {
  const k = (px * dpr) / (HALF * 2);
  ctx.setTransform(k, 0, 0, k, (px * dpr) / 2, (px * dpr) / 2);
  ctx.clearRect(-HALF, -HALF, HALF * 2, HALF * 2);

  const breathe = 1 + 0.014 * Math.sin(eng.time * 2.1);
  const sy = eng.squashY.value * breathe;
  const sx = eng.squashX.value * (2 - breathe);

  ctx.save();
  // squash apoiado na base do corpo
  ctx.translate(0, R * 0.9);
  if (eng.scene.dancing) {
    const style = eng.scene.danceStyle ?? "groove";
    const [freq, amp] = style === "calm" ? [2.2, 0.035] : [6.5, 0.05 + 0.05 * eng.scene.beat];
    ctx.rotate(Math.sin(eng.time * freq) * amp);
  }
  ctx.scale(sx, sy);
  ctx.translate(0, -R * 0.9);

  if (eng.scene.dancing) drawPulse(ctx, eng);
  drawBody(ctx, st, eng);

  // rosto: olhos sobre a faixa, inclinados junto; acompanham o olhar com paralaxe. Sem boca.
  const lx = eng.lookX.value;
  const ly = eng.lookY.value;
  const eyeX = lx * 12;
  const eyeY = ly * 8;
  const open = Math.max(0, Math.min(1, eng.open.value));
  const lids = eng.sleepy ? Math.min(open, 0.15) : open;
  const pulse = 1 + Math.min(1, Math.max(0, st.voice || 0)) * 0.16;
  ctx.save();
  ctx.translate(FACE_X, FACE_Y);
  ctx.rotate(FACE_TILT);
  drawEye(ctx, eng.left, -EYE_GAP + eyeX, eyeY, lids, st.faceColor, eng.time, st.palette.light, pulse, st.palette.top);
  drawEye(ctx, eng.right, EYE_GAP + eyeX, eyeY, lids, st.faceColor, eng.time, st.palette.light, pulse, st.palette.top);
  ctx.restore();

  if (eng.scene.muteX) {
    // microfone mutado: um X vermelho no meio do corpo
    ctx.strokeStyle = "#f4505e";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-14, 34);
    ctx.lineTo(14, 62);
    ctx.moveTo(14, 34);
    ctx.lineTo(-14, 62);
    ctx.stroke();
  }

  if (st.items.has("sunglasses") && eng.mood !== "dizzy") {
    ctx.save();
    ctx.translate(FACE_X + eyeX, FACE_Y + eyeY);
    ctx.rotate(FACE_TILT);
    ctx.fillStyle = "rgba(11,11,14,0.94)";
    roundRect(ctx, -EYE_GAP - 26, -22, 52, 44, 14);
    ctx.fill();
    roundRect(ctx, EYE_GAP - 26, -22, 52, 44, 14);
    ctx.fill();
    ctx.strokeStyle = "#0b0b0e";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-EYE_GAP + 26, -6);
    ctx.quadraticCurveTo(0, -14, EYE_GAP - 26, -6);
    ctx.stroke();
    ctx.restore();
  }

  if (st.items.has("halo")) {
    ctx.save();
    ctx.shadowColor = "#7df9ff";
    ctx.shadowBlur = 10;
    ctx.strokeStyle = "#7df9ff";
    ctx.globalAlpha = 0.78 + 0.22 * Math.sin(eng.time * 2.9);
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.ellipse(0, -150, 50, 11, 0, 0, TAU);
    ctx.stroke();
    ctx.restore();
  }

  drawController(ctx, st, eng);
  drawHeadphones(ctx, st, eng);
  drawHat(ctx, st.hat, eng);
  drawExtras(ctx, st, eng.time);
  ctx.restore();

  drawParticles(ctx, eng, st);
}
