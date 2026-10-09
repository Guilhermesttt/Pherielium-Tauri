import type { BodyPalette } from "../mascotColor";
import type { HatId, ItemId } from "../notchConfig";
import type { MascotExtra } from "../pherieStates";
import type { MouthShape } from "../mouth";
import { SHOULDER_X, SHOULDER_Y } from "./arms";
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
  mouth: MouthShape;
  blush: number;
  extras: readonly MascotExtra[];
}

/** Crateras da lua: [x, y, raio]. Ficam longe da região do rosto (olhos em y≈-6, boca em y≈36). */
const CRATERS: ReadonlyArray<readonly [number, number, number]> = [
  [-68, 30, 15], [60, 44, 12], [-34, 70, 10], [26, 74, 13], [-76, -22, 10], [70, -34, 9], [-6, -70, 8], [38, -72, 6], [86, 6, 7], [-90, 62, 6],
];
/** Mares (manchas largas e suaves): [x, y, raio]. */
const MARIA: ReadonlyArray<readonly [number, number, number]> = [[-40, -38, 40], [46, 24, 46], [-6, 62, 34]];

/** Órbita do planetinha: centro, semi-eixos e inclinação. */
const ORBIT = { cx: 0, cy: 34, rx: 1.34 * R, ry: 0.27 * R, tilt: (-17 * Math.PI) / 180 };

/** Rajada de 0,7 s a cada 1,4 s (sobe e desce suave): 0 quando não está tocando ou na pausa. */
function ringEnvelope(eng: PherieEngine): number {
  if (!eng.scene.ringing) return 0;
  const phase = eng.time % 1.4;
  return phase < 0.7 ? Math.sin((phase / 0.7) * Math.PI) : 0;
}

/** Arcos de "tocando" dos dois lados da cabeça. */
function drawRingMarks(ctx: CanvasRenderingContext2D, k: number) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.strokeStyle = `rgba(255,255,255,${(0.75 * k).toFixed(3)})`;
  for (const side of [-1, 1] as const) {
    for (const [r, w] of [[R * 1.28, 6], [R * 1.5, 5]] as const) {
      ctx.lineWidth = w;
      ctx.beginPath();
      if (side === 1) ctx.arc(0, -10, r, -0.5, 0.5);
      else ctx.arc(0, -10, r, Math.PI - 0.5, Math.PI + 0.5);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Posição do planetinha na órbita (e se está na frente ou atrás da lua). */
function orbitPoint(eng: PherieEngine) {
  const speed = eng.scene.dancing ? 2.1 : 0.85;
  const a = eng.time * speed;
  const ex = Math.cos(a) * ORBIT.rx;
  const ey = Math.sin(a) * ORBIT.ry;
  const c = Math.cos(ORBIT.tilt);
  const s = Math.sin(ORBIT.tilt);
  return { x: ORBIT.cx + ex * c - ey * s, y: ORBIT.cy + ex * s + ey * c, front: Math.sin(a) > 0, depth: 0.5 + 0.5 * Math.sin(a) };
}

/** Planetinha com anel que gira ao redor da lua, passando por trás e pela frente. */
function drawOrbitPlanet(ctx: CanvasRenderingContext2D, eng: PherieEngine, front: boolean) {
  const o = orbitPoint(eng);
  if (o.front !== front) return;
  const scale = 0.82 + 0.3 * o.depth;
  ctx.save();
  ctx.translate(o.x, o.y);
  ctx.scale(scale, scale);
  const ringTilt = ORBIT.tilt - 0.25;
  // anel (metade de trás por baixo do planeta, a da frente por cima)
  const ring = (from: number, to: number) => {
    ctx.beginPath();
    ctx.ellipse(0, 0, 25, 7, ringTilt, from, to);
    ctx.stroke();
  };
  ctx.lineWidth = 4;
  ctx.lineCap = "round";
  ctx.strokeStyle = "#fcd34d";
  ring(Math.PI, TAU);
  const g = ctx.createRadialGradient(-5, -5, 2, 0, 0, 15);
  g.addColorStop(0, "#ddd6fe");
  g.addColorStop(1, "#7c3aed");
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(0, 0, 14, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = "#fde68a";
  ring(0, Math.PI);
  ctx.restore();
}

/** Corpo: uma lua com volume suave, mares e crateras (bordas claras embaixo, sombra em cima). */
function drawBody(ctx: CanvasRenderingContext2D, st: DrawStyle, eng: PherieEngine) {
  const p = st.palette;
  const vol = ctx.createRadialGradient(-34, -46, 8, 0, 0, R * 1.12);
  vol.addColorStop(0, p.top);
  vol.addColorStop(0.6, p.top);
  vol.addColorStop(1, p.bottom);
  const disc = new Path2D();
  disc.arc(0, 0, R, 0, TAU);
  ctx.fillStyle = vol;
  ctx.fill(disc);

  ctx.save();
  ctx.clip(disc);
  const dark = p.light ? "rgba(70,72,96," : "rgba(0,0,0,";
  for (const [x, y, r] of MARIA) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, `${dark}0.16)`);
    g.addColorStop(1, `${dark}0)`);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
  }
  for (const [x, y, r] of CRATERS) {
    ctx.fillStyle = `${dark}0.14)`;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    // sombra interna no lado da luz (alto-esquerda) e borda clara no oposto
    ctx.lineWidth = Math.max(1.6, r * 0.2);
    ctx.lineCap = "round";
    ctx.strokeStyle = `${dark}0.28)`;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.86, Math.PI * 0.95, Math.PI * 1.65);
    ctx.stroke();
    ctx.strokeStyle = p.light ? "rgba(255,255,255,0.75)" : "rgba(255,255,255,0.22)";
    ctx.beginPath();
    ctx.arc(x, y, r * 0.86, Math.PI * 0.05, Math.PI * 0.6);
    ctx.stroke();
  }
  ctx.restore();

  ctx.lineWidth = 2;
  ctx.strokeStyle = p.rim;
  ctx.stroke(disc);
}

/** Braço-pílula solto: só aparece (alpha) quando ela gesticula. */
function drawArms(ctx: CanvasRenderingContext2D, st: DrawStyle, eng: PherieEngine) {
  const alpha = Math.max(0, Math.min(1, eng.armA.value));
  if (alpha < 0.02) return;
  const p = st.palette;
  ctx.save();
  ctx.globalAlpha = alpha;
  drawController(ctx, st, eng);
  ctx.lineCap = "round";
  for (const s of [-1, 1] as const) {
    const hx = s === -1 ? eng.lhx.value : eng.rhx.value;
    const hy = s === -1 ? eng.lhy.value : eng.rhy.value;
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
    const [freq, amp] = style === "calm" ? [2.2, 0.035] : [6.5, 0.05 + 0.05 * eng.scene.beat];
    ctx.rotate(Math.sin(eng.time * freq) * amp);
  }
  ctx.scale(sx, sy);
  ctx.translate(0, -R * 0.9);

  // chamada tocando: rajadas de vibração (como um celular) com pausas, e ondas dos dois lados
  const ring = ringEnvelope(eng);
  if (eng.scene.ringing && ring > 0) {
    ctx.translate(0, R * 0.9);
    ctx.rotate(Math.sin(eng.time * 42) * 0.1 * ring);
    ctx.translate(Math.sin(eng.time * 53) * 3 * ring, -R * 0.9);
    drawRingMarks(ctx, ring);
  }

  drawOrbitPlanet(ctx, eng, false);
  drawBody(ctx, st, eng);

  // rosto: acompanha o olhar com leve paralaxe (olhos andam mais que a boca)
  const lx = eng.lookX.value;
  const ly = eng.lookY.value;
  const eyeX = lx * 14;
  const eyeY = -6 + ly * 9;
  const open = Math.max(0, Math.min(1, eng.open.value));
  const lids = eng.sleepy ? Math.min(open, 0.15) : open;
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

  // boca: só em chamada (mexe com a voz); fora dela o rosto é só olhos
  if (st.showMic) {
    ctx.save();
    ctx.translate(lx * 9, 36 + ly * 5);
    ctx.scale(64, 64);
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
  } else if (eng.scene.muteX) {
    // mutado fora de chamada: o X vermelho no meio do corpo
    ctx.strokeStyle = "#f4505e";
    ctx.lineWidth = 7;
    ctx.lineCap = "round";
    ctx.beginPath();
    ctx.moveTo(-12, 30);
    ctx.lineTo(12, 54);
    ctx.moveTo(12, 30);
    ctx.lineTo(-12, 54);
    ctx.stroke();
  }

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

  drawArms(ctx, st, eng);
  drawHeadphones(ctx, st, eng);
  drawHat(ctx, st.hat, eng);
  drawOrbitPlanet(ctx, eng, true);
  drawExtras(ctx, st, eng.time);
  ctx.restore();

  drawParticles(ctx, eng, st);
}
