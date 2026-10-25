import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { setLauncherInputLocked } from "../utils/launcherInputLock";
import starfieldSrc from "../assets/karavanbraam_pindown.io.webm";
import swooshSoftSrc from "../sounds/Pherielium Intro/swoosh-soft.mp3";
import swooshAir1Src from "../sounds/Pherielium Intro/swoosh-air-1.mp3";
import swooshAir2Src from "../sounds/Pherielium Intro/swoosh-air-2.mp3";
import musicSrc from "../sounds/Phelierium Default/Intro_Music.mp3";

/**
 * Intro de abertura, no ritmo do vídeo de referência. Nos 3 primeiros segundos o campo de estrelas
 * apenas surge (a opacidade sobe aos poucos). Então aparece um cubo de ladrilhos brancos que se
 * comporta como um cubo mágico: ele gira inteiro e, a cada movimento, uma camada gira 90° com os
 * seus cantos (vértices) e centros, com anéis de órbita finos acompanhando. Depois o cubo encolhe
 * até sumir e o logo do Pherielium é "desenhado" por linhas que percorrem o seu contorno e, em
 * seguida, se preenche. O logo então vai para a esquerda e o nome desliza para fora dele.
 *
 * Tudo é desenhado em canvas 2D, como função pura do tempo (`drawFrame`): o mesmo instante sempre
 * gera o mesmo quadro. O cubo é projetado à mão (rotação + perspectiva leve + ordenação por
 * profundidade), sem biblioteca 3D. O som (efeitos nos momentos-chave e a música de abertura) é
 * disparado pelo laço de animação, nos instantes de `AUDIO_CUES`.
 *
 * A fonte (Inter Variable) já é carregada em `main.tsx`.
 */

interface GameBootCubeIntroProps {
  onFinish?: () => void;
  /** Toca o áudio da intro (preferência `gameBootIntroSoundEnabled`). */
  soundEnabled?: boolean;
}

type Vec3 = [number, number, number];
type Point = [number, number];

// --- constantes ---------------------------------------------------------------

const W = 1920;
const H = 1080;
const DURATION = 12.8; // segundos de animação
const END_HOLD = 0.8; // quadro final parado antes de entregar o controle
const FADE_OUT_MS = 500;
const REDUCED_MOTION_HOLD_MS = 1200;
const SKIP_HINT_DELAY_MS = 1200;

/** Ruído determinístico em [0, 1): o desmanche do cubo sai igual a cada execução. */
function hash(n: number): number {
  const s = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return s - Math.floor(s);
}

const BG = "#111111";
const INK = "#F4F4F4";
const FONT_BRAND = '"Inter Variable", "Inter", system-ui, sans-serif';
const BRAND_NAME = "Pherielium";
const BRAND_FONT_SIZE = 150;
const BRAND_LETTER_SPACING = -4;
/** Quanto do campo de estrelas aparece por cima do fundo escuro. */
const STARFIELD_ALPHA = 0.9;

/** Meia-aresta do cubo (px do projeto) no herói e no logotipo final. */
const HERO_SIZE = 215;
const LOCKUP_SIZE = 74;
const LOCKUP_GAP = 46;
/** Distância do observador, em unidades de escala: quanto menor, mais forte a perspectiva. */
const CAMERA = 7;
const TILE_INSET = 0.03;

const TIMING = {
  /** o campo de estrelas só ganha opacidade, sem mais nada na tela */
  stars: [0, 3.0],
  grow: [3.0, 4.0],
  /** o cubo gira para dentro e encolhe até sumir */
  cubeOut: [9.5, 10.2],
  /** as linhas percorrem o contorno do logo */
  draw: [9.95, 11.0],
  /** o miolo do logo se preenche e as linhas somem */
  fill: [10.75, 11.3],
  shrink: [11.3, 12.2],
  name: [11.6, 12.5],
} as const;

/** Uma camada do cubo (eixo 0=x 1=y 2=z; índice -1, 0 ou 1) girada 90°, como num cubo mágico. */
interface LayerTurn {
  axis: 0 | 1 | 2;
  index: -1 | 0 | 1;
  sign: 1 | -1;
}

/**
 * Movimentos: cada um gira uma camada por 90° (`layer`) e, em alguns, o cubo inteiro por voltas
 * completas (radianos). O conjunto "cantos + centros de face" é igual depois de qualquer giro de 90°
 * (os cantos trocam de lugar entre si e os centros também), então a camada encaixa de novo no fim e
 * o cubo parece o mesmo. Tudo com curva suave (acelera e freia), e o intervalo é curto, como no
 * vídeo: o cubo quase nunca fica parado.
 */
const BURST_DURATION = 0.65;
const TWO_PI = Math.PI * 2;
const BURSTS: ReadonlyArray<{ at: number; ax: number; ay: number; az: number; layer?: LayerTurn }> = [
  { at: 3.15, ax: 0, ay: TWO_PI, az: 0 },
  { at: 3.95, ax: 0, ay: 0, az: 0, layer: { axis: 1, index: 1, sign: 1 } },
  { at: 4.75, ax: 0, ay: TWO_PI, az: 0, layer: { axis: 0, index: -1, sign: -1 } },
  { at: 5.55, ax: 0, ay: 0, az: 0, layer: { axis: 2, index: 0, sign: 1 } },
  { at: 6.35, ax: TWO_PI, ay: 0, az: 0, layer: { axis: 1, index: -1, sign: -1 } },
  { at: 7.15, ax: 0, ay: 0, az: 0, layer: { axis: 0, index: 1, sign: 1 } },
  { at: 7.95, ax: 0, ay: 0, az: TWO_PI, layer: { axis: 2, index: 1, sign: -1 } },
  { at: 8.75, ax: 0, ay: TWO_PI, az: 0, layer: { axis: 1, index: 0, sign: 1 } },
];

/** Um anel de órbita por chicotada: o arco varre o cubo enquanto ele gira. */
const RINGS = BURSTS.map((burst, i) => ({
  from: burst.at - 0.05,
  to: burst.at + 0.9,
  tilt: 0.5 + hash(i + 1) * 1.0,
  spin: hash(i + 9) * Math.PI * 2,
  speed: (i % 2 === 0 ? 1 : -1) * (4.6 + hash(i + 4) * 1.2),
  radius: 1.9 + hash(i + 6) * 0.2,
}));

type SoundId = "music" | "swooshSoft" | "swooshAir1" | "swooshAir2";

const SOUNDS: Record<SoundId, { src: string; volume: number }> = {
  music: { src: musicSrc, volume: 0.55 },
  swooshSoft: { src: swooshSoftSrc, volume: 0.9 },
  swooshAir1: { src: swooshAir1Src, volume: 0.5 },
  swooshAir2: { src: swooshAir2Src, volume: 0.5 },
};

/** Quando cada som começa (segundos desde o início da animação). */
const AUDIO_CUES: ReadonlyArray<{ at: number; sound: SoundId }> = [
  { at: 0, sound: "music" },
  { at: 3.95, sound: "swooshSoft" }, // as camadas começam a girar
  { at: 5.55, sound: "swooshSoft" },
  { at: 7.15, sound: "swooshSoft" },
  { at: 8.75, sound: "swooshSoft" },
  { at: 9.5, sound: "swooshAir1" }, // o cubo some e o logo é desenhado
  { at: 11.3, sound: "swooshAir2" }, // o logo vai para o lado e o nome aparece
];

// --- utilidades ---------------------------------------------------------------

const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const prog = (t: number, a: number, b: number): number => clamp01((t - a) / (b - a));
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const easeInCubic = (t: number): number => t * t * t;
const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOutExpo = (t: number): number => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

// --- cubo ----------------------------------------------------------------------

interface Tile {
  /** normal da face a que o ladrilho pertence (para esconder as faces de trás) */
  normal: Vec3;
  /** em que camada (-1, 0, 1) o ladrilho está, em cada eixo */
  layers: [number, number, number];
  corners: [Vec3, Vec3, Vec3, Vec3];
}

/** Cada face é uma grade 3×3; só as posições de "tabuleiro" (cantos + centro) têm ladrilho. */
function buildTiles(): Tile[] {
  const axes: Array<[Vec3, Vec3, Vec3]> = [
    [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    [[-1, 0, 0], [0, 1, 0], [0, 0, 1]],
    [[0, 1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, -1, 0], [1, 0, 0], [0, 0, 1]],
    [[0, 0, 1], [1, 0, 0], [0, 1, 0]],
    [[0, 0, -1], [1, 0, 0], [0, 1, 0]],
  ];
  const cell = 2 / 3;
  const half = cell / 2 - TILE_INSET;
  const tiles: Tile[] = [];
  for (const [n, u, v] of axes) {
    for (let i = 0; i < 3; i += 1) {
      for (let j = 0; j < 3; j += 1) {
        if ((i + j) % 2 !== 0) continue;
        const a = (i - 1) * cell;
        const b = (j - 1) * cell;
        const at = (du: number, dv: number): Vec3 => [
          n[0] + u[0] * (a + du) + v[0] * (b + dv),
          n[1] + u[1] * (a + du) + v[1] * (b + dv),
          n[2] + u[2] * (a + du) + v[2] * (b + dv),
        ];
        const center = at(0, 0);
        const layerOf = (value: number): number => Math.max(-1, Math.min(1, Math.round(value / cell)));
        tiles.push({
          normal: n,
          layers: [layerOf(center[0]), layerOf(center[1]), layerOf(center[2])],
          corners: [at(-half, -half), at(half, -half), at(half, half), at(-half, half)],
        });
      }
    }
  }
  return tiles;
}

const TILES = buildTiles();

/** Gira um vetor `angle` radianos em torno de um dos eixos do cubo. */
function turnAbout([x, y, z]: Vec3, axis: 0 | 1 | 2, angle: number): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  if (axis === 0) return [x, y * c - z * s, y * s + z * c];
  if (axis === 1) return [x * c + z * s, y, -x * s + z * c];
  return [x * c - y * s, x * s + y * c, z];
}

/** Rotação Z·X·Y de um vetor. */
function rotate([x, y, z]: Vec3, ax: number, ay: number, az: number): Vec3 {
  const cy = Math.cos(ay);
  const sy = Math.sin(ay);
  const x1 = x * cy + z * sy;
  const z1 = -x * sy + z * cy;
  const cx = Math.cos(ax);
  const sx = Math.sin(ax);
  const y2 = y * cx - z1 * sx;
  const z2 = y * sx + z1 * cx;
  const cz = Math.cos(az);
  const sz = Math.sin(az);
  return [x1 * cz - y2 * sz, x1 * sz + y2 * cz, z2];
}

/** Perspectiva leve: pontos mais perto do observador (z maior) ficam um pouco maiores. */
function project([x, y, z]: Vec3, cx: number, cy: number, size: number): Point {
  const k = CAMERA / (CAMERA - z);
  return [cx + x * k * size, cy - y * k * size];
}

/** Posição de repouso: o cubo visto pela quina, como o hexágono do logotipo. */
const REST_AX = Math.atan(1 / Math.SQRT2);
const REST_AY = Math.PI / 4;

interface CubePose {
  cx: number;
  cy: number;
  size: number;
  /** 1 = cubo inteiro, 0 = sumiu (o logo não usa) */
  cubeScale: number;
  ax: number;
  ay: number;
  az: number;
  /** giro de camada em andamento (nenhum entre as chicotadas) */
  turn: { layer: LayerTurn; angle: number } | null;
}

function poseAt(t: number, lockupLeft: number): CubePose {
  const grow = easeOutExpo(prog(t, TIMING.grow[0], TIMING.grow[1]));
  const shrink = easeInOutCubic(prog(t, TIMING.shrink[0], TIMING.shrink[1]));
  // Giro de entrada: uma volta e meia que assenta enquanto o cubo cresce.
  const settle = 1 - easeOutCubic(prog(t, TIMING.grow[0], TIMING.grow[1] + 0.4));

  let ax = REST_AX + settle * Math.PI * 0.9;
  let ay = REST_AY + settle * Math.PI * 3;
  let az = settle * 0.5;
  let layerTurn: CubePose["turn"] = null;
  for (const burst of BURSTS) {
    const turn = easeInOutCubic(prog(t, burst.at, burst.at + BURST_DURATION));
    ax += burst.ax * turn;
    ay += burst.ay * turn;
    az += burst.az * turn;
    // Fora da janela do giro a camada já voltou a encaixar (90° leva cantos a cantos): nada a aplicar.
    if (burst.layer && turn > 0 && turn < 1) layerTurn = { layer: burst.layer, angle: burst.layer.sign * (Math.PI / 2) * turn };
  }

  // Saída do cubo: gira para dentro e some. O logo usa o mesmo `size` como referência de tamanho.
  const out = easeInCubic(prog(t, TIMING.cubeOut[0], TIMING.cubeOut[1]));
  ay += out * Math.PI;
  az += out * Math.PI * 0.5;

  return {
    cx: lerp(W / 2, lockupLeft + LOCKUP_SIZE * 1.05, shrink),
    cy: H / 2,
    size: lerp(lerp(HERO_SIZE * 0.1, HERO_SIZE, grow), LOCKUP_SIZE, shrink),
    cubeScale: 1 - out,
    ax,
    ay,
    az,
    turn: layerTurn,
  };
}

function drawCube(ctx: CanvasRenderingContext2D, pose: CubePose): void {
  if (pose.cubeScale <= 0.01) return;
  // Faces viradas para longe não são desenhadas: o cubo lê como sólido, sem os ladrilhos de trás
  // aparecendo pelos vãos do tabuleiro.
  const projected = TILES.flatMap((tile) => {
    // A camada que está girando leva seus ladrilhos junto antes da rotação do cubo inteiro.
    const turning = pose.turn !== null && tile.layers[pose.turn.layer.axis] === pose.turn.layer.index;
    const twist = (v: Vec3): Vec3 => (turning && pose.turn ? turnAbout(v, pose.turn.layer.axis, pose.turn.angle) : v);
    if (rotate(twist(tile.normal), pose.ax, pose.ay, pose.az)[2] <= 0.02) return [];
    const rotated = tile.corners.map((c) => rotate(twist(c), pose.ax, pose.ay, pose.az));
    const depth = rotated.reduce((sum, c) => sum + c[2], 0) / 4;
    return [{ depth, points: rotated.map((c) => project(c, pose.cx, pose.cy, pose.size * pose.cubeScale)) }];
  });
  // Pintor: do fundo para a frente. Os vãos entre ladrilhos deixam ver os de trás.
  projected.sort((a, b) => a.depth - b.depth);

  ctx.fillStyle = INK;
  ctx.strokeStyle = BG;
  ctx.lineWidth = Math.max(1, pose.size * pose.cubeScale * 0.012);
  ctx.lineJoin = "round";
  for (const tile of projected) {
    ctx.beginPath();
    tile.points.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
}

// --- logo ----------------------------------------------------------------------

// Logo oficial (viewBox 536×604): corpo e ponto.
const LOGO_W = 536;
const LOGO_H = 604;
const LOGO_BODY_D =
  "M288.391 0.23775C302.992 -1.41429 319.938 5.71348 329.918 16.3239C338.814 25.6576 343.535 38.2126 342.996 51.1026C342.682 58.9154 340.582 66.5519 336.859 73.4253C331.206 83.8989 323.515 90.9667 313.235 96.5864C309.515 98.618 305.768 100.257 302.06 102.405C294.576 106.66 287.621 111.78 281.329 117.659C261.6 136.053 249.113 163.571 248.127 190.567C247.28 215.637 256.387 240.021 273.452 258.386C297.073 283.41 335.133 295.169 367.922 282.802C385.013 276.356 394.299 265.587 414.477 266.262C436.303 266.459 454.851 285.131 457.423 306.411C458.763 317.468 457.523 327.007 459.879 338.603C462.355 350.272 467.124 361.336 473.906 371.145C480.24 380.317 489.557 389.96 499.489 395.112C508.81 399.485 516.069 402.504 523.31 410.283C543.146 431.325 538.491 463.078 517.92 481.586C487.088 509.328 443.316 488.667 435.56 450.59C433.744 441.687 434.842 434.616 434.327 426.063C431.606 380.86 390.418 340.965 345.292 339.246C320.394 338.295 295.709 348.727 277.689 364.914C257.344 383.138 245.049 408.696 243.499 435.985C242.069 464.786 255.105 494.676 280.656 509.166C292.131 515.604 302.816 518.452 312.009 528.676C329.355 547.969 326.081 575.12 307.039 592.176C297.954 600.387 285.97 604.615 273.752 603.927C249.954 603.077 228.218 583.473 224.949 559.862C224.294 555.568 224.575 550.786 223.932 546.53C215.814 492.909 142.252 441.915 91.5171 472.434C78.127 480.49 71.6084 490.119 54.3554 492.297C41.5534 493.811 28.6806 490.115 18.6237 482.042C3.89989 470.404 -3.23753 452.419 1.40725 434.022C8.92801 404.236 43.306 382.478 72.381 397.432C81.3214 402.213 89.8063 408.62 99.5093 411.901C135.603 424.095 177.327 404.429 200.085 375.795C216.202 355.69 223.615 329.966 220.672 304.356C217.565 277.289 200.846 248.755 179.566 232.078C156.476 213.983 123.171 207.524 96.8654 222.323C82.4503 230.432 74.2606 241.12 56.2717 243.044C43.4034 244.422 30.2612 239.929 20.301 231.795C10.0914 223.624 3.58944 211.689 2.2554 198.672C0.965912 185.36 6.56279 171.688 15.0249 161.602C21.3377 154.078 29.5049 148.337 38.7168 144.949C60.8837 136.939 74.8384 146.397 92.2306 157.992C102.365 164.748 118.261 168.308 130.448 167.002C162.9 163.524 192.716 143.76 213.628 119.36C224.463 106.518 235.498 88.302 236.824 71.4795C237.165 67.1521 236.511 62.8355 236.129 58.5358C234.899 44.7033 240.013 30.944 248.937 20.4564C259.327 8.24668 272.578 1.61036 288.391 0.23775Z";
const LOGO_DOT_D =
  "M480.484 141.065C508.101 139.661 531.599 161.158 532.94 189.05C534.284 216.942 512.957 240.638 485.337 241.944C457.79 243.246 434.397 221.773 433.06 193.951C431.723 166.128 452.94 142.466 480.484 141.065Z";
const LOGO_BODY = new Path2D(LOGO_BODY_D);
const LOGO_DOT = new Path2D(LOGO_DOT_D);

/** Comprimento de cada contorno do logo, para o traço poder ser "desenhado" aos poucos. */
let logoLengths: { body: number; dot: number } | null = null;

function measureLogo(): { body: number; dot: number } {
  if (logoLengths) return logoLengths;
  const length = (d: string): number => {
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", d);
    return path.getTotalLength();
  };
  logoLengths = { body: length(LOGO_BODY_D), dot: length(LOGO_DOT_D) };
  return logoLengths;
}

/**
 * O logo nasce do contorno: uma linha o percorre (`drawn` 0..1) e depois o miolo se preenche
 * (`filled` 0..1) enquanto a linha some.
 */
function drawLogo(ctx: CanvasRenderingContext2D, pose: CubePose, drawn: number, filled: number): void {
  if (drawn <= 0) return;
  const lengths = measureLogo();
  const scale = (pose.size * 2.3) / LOGO_H;
  ctx.save();
  ctx.translate(pose.cx, pose.cy);
  ctx.scale(scale, scale);
  ctx.translate(-LOGO_W / 2, -LOGO_H / 2);

  if (filled > 0) {
    ctx.globalAlpha = filled;
    ctx.fillStyle = INK;
    ctx.fill(LOGO_BODY);
    ctx.fill(LOGO_DOT);
  }

  ctx.globalAlpha = 1 - filled;
  ctx.strokeStyle = INK;
  ctx.lineWidth = 5;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";
  for (const [path, length] of [[LOGO_BODY, lengths.body], [LOGO_DOT, lengths.dot]] as const) {
    ctx.setLineDash([length, length]);
    ctx.lineDashOffset = length * (1 - drawn);
    ctx.stroke(path);
  }
  ctx.restore();
}

// --- anéis ---------------------------------------------------------------------

const RING_SEGMENTS = 36;
const RING_ARC = Math.PI * 1.15;

/** Arco fino que dá a volta no cubo; a cauda some aos poucos. */
function drawRing(ctx: CanvasRenderingContext2D, ring: (typeof RINGS)[number], t: number, pose: CubePose): void {
  if (t < ring.from || t > ring.to) return;
  const life = prog(t, ring.from, ring.to);
  const envelope = Math.sin(life * Math.PI);
  const head = (t - ring.from) * ring.speed;
  const tilt = ring.tilt + life * 0.5;
  const spin = ring.spin + life * 1.2;

  ctx.lineCap = "round";
  ctx.lineWidth = Math.max(1.2, pose.size * 0.01);
  for (let i = 0; i < RING_SEGMENTS; i += 1) {
    const fade = 1 - i / RING_SEGMENTS;
    const a0 = head - (i / RING_SEGMENTS) * RING_ARC * Math.sign(ring.speed);
    const a1 = head - ((i + 1) / RING_SEGMENTS) * RING_ARC * Math.sign(ring.speed);
    const seg = [a0, a1].map((angle) =>
      project(rotate([Math.cos(angle) * ring.radius, 0, Math.sin(angle) * ring.radius], tilt, spin, 0), pose.cx, pose.cy, pose.size),
    );
    ctx.globalAlpha = envelope * fade * 0.95;
    ctx.strokeStyle = INK;
    ctx.beginPath();
    ctx.moveTo(seg[0][0], seg[0][1]);
    ctx.lineTo(seg[1][0], seg[1][1]);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// --- nome da marca -------------------------------------------------------------

function setBrandFont(ctx: CanvasRenderingContext2D): void {
  ctx.font = `800 ${BRAND_FONT_SIZE}px ${FONT_BRAND}`;
  ctx.letterSpacing = `${BRAND_LETTER_SPACING}px`;
  ctx.textBaseline = "middle";
}

/** O nome desliza para fora do logo, da esquerda para a direita, revelado por uma janela. */
function drawBrandName(ctx: CanvasRenderingContext2D, t: number, left: number, width: number): void {
  const reveal = easeOutCubic(prog(t, TIMING.name[0], TIMING.name[1]));
  if (reveal <= 0) return;

  const lineHeight = BRAND_FONT_SIZE * 1.3;
  ctx.save();
  ctx.beginPath();
  ctx.rect(left - 4, H / 2 - lineHeight / 2, (width + 8) * reveal, lineHeight);
  ctx.clip();
  ctx.fillStyle = INK;
  setBrandFont(ctx);
  ctx.textAlign = "left";
  ctx.fillText(BRAND_NAME, left - (1 - reveal) * 90, H / 2 + BRAND_FONT_SIZE * 0.04);
  ctx.restore();
}

// --- fundo ---------------------------------------------------------------------

const isPlayable = (v: HTMLVideoElement | null): v is HTMLVideoElement =>
  v !== null && v.readyState >= 2 && v.videoWidth > 0;

/** Desenha o vídeo cobrindo todo o retângulo visível (como `object-fit: cover`). */
function drawStarfield(
  ctx: CanvasRenderingContext2D,
  video: HTMLVideoElement | null,
  view: { x0: number; y0: number; x1: number; y1: number },
  alpha: number,
): void {
  if (!isPlayable(video) || alpha <= 0) return;
  const vw = view.x1 - view.x0;
  const vh = view.y1 - view.y0;
  const scale = Math.max(vw / video.videoWidth, vh / video.videoHeight);
  const dw = video.videoWidth * scale;
  const dh = video.videoHeight * scale;
  ctx.globalAlpha = alpha;
  ctx.drawImage(video, view.x0 + (vw - dw) / 2, view.y0 + (vh - dh) / 2, dw, dh);
  ctx.globalAlpha = 1;
}

// --- quadro ----------------------------------------------------------------------

/** Posições do logotipo final (logo + nome), centralizado no quadro. */
function lockupLayout(ctx: CanvasRenderingContext2D): { left: number; textLeft: number; textWidth: number } {
  ctx.save();
  setBrandFont(ctx);
  const textWidth = ctx.measureText(BRAND_NAME).width;
  ctx.restore();
  const cubeWidth = LOCKUP_SIZE * 2.1;
  const left = (W - (cubeWidth + LOCKUP_GAP + textWidth)) / 2;
  return { left, textLeft: left + cubeWidth + LOCKUP_GAP, textWidth };
}

/**
 * Desenha o quadro do instante `t` (segundos). `ctx` já deve estar com a escala e o
 * deslocamento que colocam o espaço de projeto 1920×1080 no centro do canvas.
 */
function drawFrame(
  ctx: CanvasRenderingContext2D,
  t: number,
  view: { x0: number; y0: number; x1: number; y1: number },
  starfield: HTMLVideoElement | null = null,
): void {
  ctx.globalAlpha = 1;
  ctx.fillStyle = BG;
  ctx.fillRect(view.x0, view.y0, view.x1 - view.x0, view.y1 - view.y0);

  drawStarfield(ctx, starfield, view, STARFIELD_ALPHA * easeInOutCubic(prog(t, TIMING.stars[0], TIMING.stars[1])));
  if (t >= TIMING.grow[0]) {
    const layout = lockupLayout(ctx);
    const pose = poseAt(t, layout.left);
    for (const ring of RINGS) drawRing(ctx, ring, t, pose);
    drawCube(ctx, pose);
    drawLogo(ctx, pose, easeInOutCubic(prog(t, TIMING.draw[0], TIMING.draw[1])), easeOutCubic(prog(t, TIMING.fill[0], TIMING.fill[1])));
    drawBrandName(ctx, t, layout.textLeft, layout.textWidth);
  }
}

// --- áudio e vídeo ---------------------------------------------------------------------------

function fadeOutAudio(audio: HTMLAudioElement, durationMs = 450): void {
  const startVolume = audio.volume;
  if (audio.paused || startVolume <= 0) {
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

function createStarfield(src: string): HTMLVideoElement {
  const video = document.createElement("video");
  video.src = src;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.preload = "auto";
  video.play().catch((err: unknown) => {
    // Sem vídeo a intro continua: o fundo simplesmente fica escuro.
    console.warn("Vídeo de fundo da intro não pôde tocar:", err);
  });
  return video;
}

// --- componente ------------------------------------------------------------------------------

const GameBootCubeIntro: React.FC<GameBootCubeIntroProps> = ({ onFinish, soundEnabled = true }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const audioRef = useRef<Partial<Record<SoundId, HTMLAudioElement>>>({});
  const starfieldRef = useRef<HTMLVideoElement | null>(null);
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
    Object.values(audioRef.current).forEach((audio) => fadeOutAudio(audio));
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

  // Sons: criados já na abertura para estarem carregados quando chegar o momento; mudo por
  // preferência mantém o resto do fluxo igual.
  useEffect(() => {
    const created: Partial<Record<SoundId, HTMLAudioElement>> = {};
    (Object.keys(SOUNDS) as SoundId[]).forEach((id) => {
      const audio = new Audio(SOUNDS[id].src);
      audio.preload = "auto";
      audio.volume = SOUNDS[id].volume;
      audio.muted = !soundEnabled;
      created[id] = audio;
    });
    audioRef.current = created;
    return () => {
      Object.values(created).forEach((audio) => audio.pause());
      audioRef.current = {};
    };
  }, [soundEnabled]);

  useEffect(() => {
    const video = createStarfield(starfieldSrc);
    starfieldRef.current = video;
    return () => {
      starfieldRef.current = null;
      video.pause();
      video.removeAttribute("src");
      video.load(); // libera o decoder
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
    let nextCue = 0;

    const render = (t: number): void => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const cw = Math.round(window.innerWidth * dpr);
      const ch = Math.round(window.innerHeight * dpr);
      if (canvas.width !== cw || canvas.height !== ch) {
        canvas.width = cw;
        canvas.height = ch;
      }
      // O espaço de projeto 1920×1080 é "contido" na janela; o resto é preenchido pela cor de fundo.
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
        starfieldRef.current,
      );
    };

    const playDueCues = (t: number): void => {
      while (nextCue < AUDIO_CUES.length && AUDIO_CUES[nextCue].at <= t) {
        const audio = audioRef.current[AUDIO_CUES[nextCue].sound];
        if (audio) audio.currentTime = 0;
        audio?.play().catch((err: unknown) => {
          console.warn("Som da intro bloqueado ou pendente de interação:", err);
        });
        nextCue += 1;
      }
    };

    const tick = (now: number): void => {
      if (cancelled) return;
      if (startMs === null) startMs = now;
      const t = (now - startMs) / 1000;
      playDueCues(t);
      render(Math.min(t, DURATION));
      if (t >= DURATION + END_HOLD) {
        handleFinish();
        return;
      }
      rafId = requestAnimationFrame(tick);
    };

    document.fonts
      .load(`800 100px ${FONT_BRAND}`)
      .catch((err: unknown) => {
        console.warn("Fonte da intro não carregou; usando fallback do sistema.", err);
      })
      .finally(() => {
        if (cancelled) return;
        if (reducedMotion) {
          // Sem movimento (e sem som): mostra só o quadro final e segue.
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
        backgroundColor: BG,
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

export default GameBootCubeIntro;
