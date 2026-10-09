import type { BodyPalette } from "../mascotColor";
import type { EarsId, ItemId } from "../notchConfig";
import type { MascotExtra } from "../pherieStates";
import type { MouthShape } from "../mouth";
import { spiralPath } from "../spiral";
import { SHOULDER_X, SHOULDER_Y } from "./arms";
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

/** Posição e inclinação do rosto: sobre a borda superior do anel, como no logo do Pherielium. */
const FACE_X = 24;
const FACE_Y = -15;
const FACE_TILT = (-17 * Math.PI) / 180;
const EYE_GAP = 25;
/** Anel: elipse inclinada que atravessa o planeta e sai dos dois lados. */
const RING = { cx: 0, cy: 19, rx: 120, ry: 20 };
const RING_GAP = 7;

/** Inclinação do anel por humor: balança ao dançar, gira tonta, deita quando dorme. */
function ringAngle(eng: PherieEngine): number {
  const base = (-23 * Math.PI) / 180;
  if (eng.mood === "dizzy") return base + Math.sin(eng.time * 9) * 0.5;
  if (eng.mood === "sleeping") return base * 0.35;
  if (eng.scene.dancing) return base + Math.sin(eng.time * 5) * 0.12;
  return base + Math.sin(eng.time * 1.3) * 0.025;
}

/**
 * O corpo do Pherielium: um planeta (disco) cortado por um anel inclinado. Só a borda de cima do
 * anel tem a fresta (um recorte transparente); embaixo o anel se funde com o planeta. O recorte é
 * feito com clip (não com composição), então nada que já foi desenhado é apagado.
 */
function drawPlanet(ctx: CanvasRenderingContext2D, st: DrawStyle, eng: PherieEngine) {
  const p = st.palette;
  const angle = ringAngle(eng);
  const grad = ctx.createLinearGradient(0, -110, 0, 110);
  grad.addColorStop(0, p.top);
  grad.addColorStop(1, p.bottom);

  // fresta = metade de cima da elipse "inchada" (o anel é desenhado por cima dela)
  const halo = new Path2D();
  halo.ellipse(RING.cx, RING.cy, RING.rx + RING_GAP, RING.ry + RING_GAP, angle, Math.PI, TAU);
  halo.closePath();

  ctx.save();
  const outside = new Path2D();
  outside.rect(-400, -400, 800, 800);
  outside.addPath(halo);
  ctx.clip(outside, "evenodd");
  const disc = new Path2D();
  disc.arc(0, 0, R, 0, TAU);
  ctx.fillStyle = grad;
  ctx.fill(disc);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = p.rim;
  ctx.stroke(disc);
  ctx.restore();

  const ring = new Path2D();
  ring.ellipse(RING.cx, RING.cy, RING.rx, RING.ry, angle, 0, TAU);
  ctx.fillStyle = grad;
  ctx.fill(ring);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = p.rim;
  // contorno só onde o anel está fora do planeta (dentro dele funde com o branco)
  ctx.save();
  const outsideDisc = new Path2D();
  outsideDisc.rect(-400, -400, 800, 800);
  outsideDisc.arc(0, 0, R, 0, TAU);
  ctx.clip(outsideDisc, "evenodd");
  ctx.stroke(ring);
  ctx.restore();
}

function drawEars(ctx: CanvasRenderingContext2D, variant: EarsId, fill: string, stroke: string, accent: string) {
  if (variant === "none") return;
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

/** Mão fazendo o sinal de rock (🤘): indicador e mindinho de pé, polegar sobre os dedos do meio. */
function drawRockHand(ctx: CanvasRenderingContext2D, x: number, y: number, side: -1 | 1, p: BodyPalette) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(side * 0.22);
  ctx.scale(1.35, 1.35);
  ctx.lineCap = "round";
  const finger = (x1: number, y1: number, x2: number, y2: number, w: number, color: string) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = w;
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  };
  for (const [color, grow] of [[p.rim, 5], [p.earStroke, 0]] as const) {
    // dedos esticados (chifres)
    finger(-8, -2, -9.5, -22, 8 + grow, color);
    finger(8, -2, 10.5, -19, 7 + grow, color);
    // palma
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(-14 - grow / 2, -5 - grow / 2, 28 + grow, 26 + grow, 11);
    ctx.fill();
  }
  // dedos do meio dobrados + polegar por cima
  ctx.fillStyle = p.top;
  for (const cx of [-2.5, 3.5]) {
    ctx.beginPath();
    ctx.arc(cx, 2, 3.4, 0, TAU);
    ctx.fill();
  }
  ctx.fillStyle = p.earStroke;
  ctx.strokeStyle = p.rim;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.ellipse(0, 11, 8.5, 5.2, -0.25, 0, TAU);
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawArms(ctx: CanvasRenderingContext2D, st: DrawStyle, eng: PherieEngine) {
  const p = st.palette;
  drawController(ctx, st, eng);
  ctx.lineCap = "round";
  const rock = eng.scene.dancing && eng.scene.danceStyle === "headbang";
  for (const s of [-1, 1] as const) {
    const hx = s === -1 ? eng.lhx.value : eng.rhx.value;
    const hy = s === -1 ? eng.lhy.value : eng.rhy.value;
    // música pesada: as duas mãos fazem o sinal de rock
    if (rock) {
      drawRockHand(ctx, hx, hy, s, p);
      continue;
    }
    // braço-pílula solto (sem ligação com o corpo): uma cápsula apontando do ombro para a mão
    const ang = Math.atan2(hy - SHOULDER_Y, hx - s * SHOULDER_X);
    const dx = Math.cos(ang) * 11;
    const dy = Math.sin(ang) * 11;
    const pill = new Path2D();
    pill.moveTo(hx - dx, hy - dy);
    pill.lineTo(hx + dx, hy + dy);
    ctx.strokeStyle = p.rim;
    ctx.lineWidth = 25;
    ctx.stroke(pill);
    ctx.strokeStyle = p.earStroke;
    ctx.lineWidth = 21;
    ctx.stroke(pill);
  }
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

  const p = st.palette;
  const breathe = 1 + 0.014 * Math.sin(eng.time * 2.1);
  const sy = eng.squashY.value * breathe;
  const sx = eng.squashX.value * (2 - breathe);

  ctx.save();
  // squash apoiado na base do corpo
  ctx.translate(0, R * 0.9);
  if (eng.scene.dancing) {
    const style = eng.scene.danceStyle ?? "groove";
    // calma: balanço lento e curto; balanço normal; pesada: cabeça e corpo batendo mais rápido
    const [freq, amp] = style === "calm" ? [2.2, 0.035] : style === "headbang" ? [11, 0.06 + 0.06 * eng.scene.beat] : [6.5, 0.05 + 0.05 * eng.scene.beat];
    ctx.rotate(Math.sin(eng.time * freq) * amp);
  }
  ctx.scale(sx, sy);
  ctx.translate(0, -R * 0.9);

  drawEars(ctx, st.ears, p.ear, p.earStroke, st.earAccent);

  drawPlanet(ctx, st, eng);

  // rosto: fica sobre a borda do anel (como no logo), inclinado junto; acompanha o olhar com paralaxe
  const lx = eng.lookX.value;
  const ly = eng.lookY.value;
  const eyeX = lx * 14;
  const eyeY = ly * 9;
  const open = Math.max(0, Math.min(1, eng.open.value));
  const sleepy = eng.sleepy;
  const lids = sleepy ? Math.min(open, 0.15) : open;
  ctx.save();
  ctx.translate(FACE_X, FACE_Y);
  ctx.rotate(FACE_TILT);
  drawEye(ctx, eng.left, -EYE_GAP + eyeX, eyeY, lids, st.faceColor, eng.time);
  drawEye(ctx, eng.right, EYE_GAP + eyeX, eyeY, lids, st.faceColor, eng.time);

  if (st.blush > 0.02) {
    ctx.fillStyle = p.cheek;
    ctx.globalAlpha = Math.min(1, st.blush * p.cheekScale);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.ellipse(s * 50 + lx * 10, 20 + ly * 6, 11, 6.5, 0, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  ctx.save();
  ctx.translate(EYE_GAP * 0.0 + lx * 9, 34 + ly * 5);
  ctx.scale(52, 52);
  const mouth = new Path2D(st.mouth.d);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  if (eng.scene.muteX) {
    // microfone mutado: um X vermelho no lugar da boca
    ctx.strokeStyle = "#f4505e";
    ctx.lineWidth = 0.12;
    ctx.beginPath();
    ctx.moveTo(-0.16, -0.14);
    ctx.lineTo(0.16, 0.14);
    ctx.moveTo(0.16, -0.14);
    ctx.lineTo(-0.16, 0.14);
    ctx.stroke();
  } else if (st.mouth.fill) {
    ctx.fillStyle = st.faceColor;
    ctx.fill(mouth);
  } else {
    ctx.strokeStyle = st.faceColor;
    ctx.lineWidth = st.mouth.stroke;
    ctx.stroke(mouth);
  }
  ctx.restore();
  ctx.restore();

  if (st.items.has("sunglasses") && eng.mood !== "dizzy") {
    ctx.save();
    ctx.translate(FACE_X + eyeX, FACE_Y + eyeY);
    ctx.rotate(FACE_TILT);
    ctx.fillStyle = "rgba(11,11,14,0.94)";
    roundRect(ctx, -EYE_GAP - 24, -20, 48, 40, 13);
    ctx.fill();
    roundRect(ctx, EYE_GAP - 24, -20, 48, 40, 13);
    ctx.fill();
    ctx.strokeStyle = "#0b0b0e";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(-EYE_GAP + 24, -6);
    ctx.quadraticCurveTo(0, -14, EYE_GAP - 24, -6);
    ctx.stroke();
    ctx.strokeStyle = "rgba(255,255,255,0.4)";
    ctx.lineWidth = 4;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-EYE_GAP - 14, -9);
    ctx.lineTo(-EYE_GAP + 2, -9);
    ctx.moveTo(EYE_GAP - 14, -9);
    ctx.lineTo(EYE_GAP + 2, -9);
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

  // mão de rock fica na frente dos fones; os braços normais ficam atrás
  const rockHands = eng.scene.dancing && eng.scene.danceStyle === "headbang";
  if (!rockHands) drawArms(ctx, st, eng);
  drawHeadphones(ctx, st, eng);
  if (rockHands) drawArms(ctx, st, eng);
  drawExtras(ctx, st, eng.time);
  ctx.restore();

  drawParticles(ctx, eng, st);
}
