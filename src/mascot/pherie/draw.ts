import type { BodyPalette } from "../mascotColor";
import type { EarsId, ItemId } from "../notchConfig";
import type { MascotExtra } from "../pherieStates";
import type { MouthShape } from "../mouth";
import { spiralPath } from "../spiral";
import { PROFILE_SAMPLES } from "../engine/profiles";
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
  ears: EarsId;
  earAccent: string;
  items: ReadonlySet<ItemId>;
  rgbHeadphones: boolean;
  showMic: boolean;
  mouth: MouthShape;
  blush: number;
  extras: readonly MascotExtra[];
}

function bodyPath(radii: readonly number[]): Path2D {
  const n = PROFILE_SAMPLES;
  const pt = (i: number) => {
    const a = ((i % n) / n) * TAU;
    const r = radii[i % n] * R;
    return [Math.cos(a) * r, Math.sin(a) * r] as const;
  };
  const path = new Path2D();
  const [sx, sy] = pt(0);
  const [nx, ny] = pt(1);
  path.moveTo((sx + nx) / 2, (sy + ny) / 2);
  for (let i = 1; i <= n; i++) {
    const [cx, cy] = pt(i);
    const [ex, ey] = pt(i + 1);
    path.quadraticCurveTo(cx, cy, (cx + ex) / 2, (cy + ey) / 2);
  }
  path.closePath();
  return path;
}

function drawEars(ctx: CanvasRenderingContext2D, variant: EarsId, fill: string, stroke: string, accent: string) {
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  switch (variant) {
    case "bear":
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      for (const x of [-68, 68]) {
        ctx.beginPath();
        ctx.arc(x, -94, 27, 0, TAU);
        ctx.fill();
        ctx.stroke();
        ctx.globalAlpha = 0.45;
        ctx.fillStyle = stroke;
        ctx.beginPath();
        ctx.arc(x, -94, 12, 0, TAU);
        ctx.fill();
        ctx.globalAlpha = 1;
        ctx.fillStyle = fill;
      }
      break;
    case "robot":
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 6;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(s * 52, -98);
        ctx.lineTo(s * 64, -142);
        ctx.stroke();
      }
      ctx.lineWidth = 3;
      ctx.fillStyle = accent;
      for (const s of [-1, 1]) {
        ctx.beginPath();
        ctx.arc(s * 65, -148, 10, 0, TAU);
        ctx.fill();
        ctx.stroke();
      }
      break;
    case "demon": {
      ctx.fillStyle = accent;
      ctx.strokeStyle = stroke;
      const l = new Path2D("M -74 -80 C -102 -108 -98 -144 -62 -158 C -70 -130 -60 -104 -46 -90 Z");
      const r = new Path2D("M 74 -80 C 102 -108 98 -144 62 -158 C 70 -130 60 -104 46 -90 Z");
      for (const p of [l, r]) {
        ctx.fill(p);
        ctx.stroke(p);
      }
      break;
    }
    default: {
      ctx.fillStyle = fill;
      ctx.strokeStyle = stroke;
      const l = new Path2D("M -88 -66 C -100 -104 -78 -128 -58 -104 Z");
      const r = new Path2D("M 88 -66 C 100 -104 78 -128 58 -104 Z");
      for (const p of [l, r]) {
        ctx.fill(p);
        ctx.stroke(p);
      }
    }
  }
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

function drawEye(ctx: CanvasRenderingContext2D, eye: EyeState, cx: number, cy: number, open: number, color: string, time: number) {
  const { shape } = eye.spec;
  const w = Math.max(1, eye.w.value);
  const baseH = Math.max(1, eye.h.value);
  const lid = eye.lid.value;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineCap = "round";

  const arcEye = (up: boolean) => {
    ctx.lineWidth = 8;
    ctx.beginPath();
    if (up) ctx.arc(0, baseH * 0.35, w * 0.5, Math.PI * 1.12, Math.PI * 1.88);
    else ctx.arc(0, -baseH * 0.5, w * 0.5, Math.PI * 0.12, Math.PI * 0.88);
    ctx.stroke();
  };

  if (shape === "happy") arcEye(true);
  else if (shape === "closed") arcEye(false);
  else if (shape === "spiral") {
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

  const p = st.palette;
  const breathe = 1 + 0.014 * Math.sin(eng.time * 2.1);
  const sy = eng.squashY.value * breathe;
  const sx = eng.squashX.value * (2 - breathe);

  ctx.save();
  // squash apoiado na base do corpo
  ctx.translate(0, R * 0.9);
  ctx.scale(sx, sy);
  ctx.translate(0, -R * 0.9);

  drawEars(ctx, st.ears, p.ear, p.earStroke, st.earAccent);

  const body = bodyPath(eng.radii);
  const grad = ctx.createLinearGradient(0, -110, 0, 110);
  grad.addColorStop(0, p.top);
  grad.addColorStop(1, p.bottom);
  ctx.fillStyle = grad;
  ctx.fill(body);
  ctx.lineWidth = 3;
  ctx.strokeStyle = p.rim;
  ctx.stroke(body);

  // rosto: acompanha o olhar com leve paralaxe (olhos andam mais que a boca)
  const lx = eng.lookX.value;
  const ly = eng.lookY.value;
  const eyeX = lx * 14;
  const eyeY = -6 + ly * 9;
  const open = Math.max(0, Math.min(1, eng.open.value));
  const sleepy = eng.sleepy;
  const lids = sleepy ? Math.min(open, 0.15) : open;
  drawEye(ctx, eng.left, -34 + eyeX, eyeY, lids, st.faceColor, eng.time);
  drawEye(ctx, eng.right, 34 + eyeX, eyeY, lids, st.faceColor, eng.time);

  if (st.blush > 0.02) {
    ctx.fillStyle = p.cheek;
    ctx.globalAlpha = Math.min(1, st.blush * p.cheekScale);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 62 + lx * 10, 22 + ly * 6, 14, 8, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.translate(lx * 9, 36 + ly * 5);
  ctx.scale(64, 64);
  const mouth = new Path2D(st.mouth.d);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (st.mouth.fill) {
    ctx.fillStyle = st.faceColor;
    ctx.fill(mouth);
  } else {
    ctx.strokeStyle = st.faceColor;
    ctx.lineWidth = st.mouth.stroke;
    ctx.stroke(mouth);
  }
  ctx.restore();

  if (st.items.has("sunglasses") && eng.mood !== "dizzy") {
    ctx.save();
    ctx.translate(eyeX, eyeY);
    ctx.fillStyle = "rgba(11,11,14,0.94)";
    roundRect(ctx, -86, -26, 68, 52, 16);
    ctx.fill();
    roundRect(ctx, 18, -26, 68, 52, 16);
    ctx.fill();
    ctx.strokeStyle = "#0b0b0e";
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-20, -8);
    ctx.quadraticCurveTo(0, -20, 20, -8);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-74, -12);
    ctx.lineTo(-52, -12);
    ctx.moveTo(30, -12);
    ctx.lineTo(52, -12);
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

  drawHeadphones(ctx, st, eng);
  drawExtras(ctx, st, eng.time);
  ctx.restore();

  drawParticles(ctx, eng, st);
}
