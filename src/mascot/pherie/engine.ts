import { PROFILE_SAMPLES } from "../engine/profiles";
import { SHAPE_BY_ID } from "../engine/skins";
import { faceFor, type EyeSpec, type FaceSpec } from "./face";
import { Spring } from "./spring";
import type { MascotMood } from "../moods";

/** Raio do corpo em unidades de desenho. */
export const R = 100;

export interface Particle {
  kind: "z" | "heart" | "spark";
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
}

export interface EyeState {
  spec: EyeSpec;
  w: Spring;
  h: Spring;
  lid: Spring;
}

const DEFAULT_SHAPE = "squircle";
const radiiFor = (id?: string) => (SHAPE_BY_ID.get(id ?? DEFAULT_SHAPE) ?? SHAPE_BY_ID.get(DEFAULT_SHAPE)!).radii;

const eyeState = (spec: EyeSpec): EyeState => {
  const mk = (v: number) => new Spring(v, 0.28, 0.62);
  return { spec, w: mk(spec.w), h: mk(spec.h), lid: mk(spec.lid) };
};

/**
 * Pherie: corpo radial que morfa entre formas, olhos que mudam de forma por humor,
 * piscar, respiração e partículas — tudo movido por molas (estilo do Coucou). Sem DOM:
 * o `draw.ts` só lê este estado.
 */
export class PherieEngine {
  mood: MascotMood = "idle";
  face: FaceSpec;
  readonly radii: number[];
  private targetRadii: number[];
  readonly left: EyeState;
  readonly right: EyeState;
  /** olhar: -1..1 (cursor + humor) */
  readonly lookX = new Spring(0, 0.3, 0.8);
  readonly lookY = new Spring(0, 0.3, 0.8);
  /** abertura do olho: 1 = aberto; o piscar leva a 0 e volta */
  readonly open = new Spring(1, 0.12, 0.9);
  /** squash & stretch do corpo (1 = repouso) */
  readonly squashX = new Spring(1, 0.34, 0.45);
  readonly squashY = new Spring(1, 0.34, 0.45);
  /** fones: queda de entrada (y em unidades) e opacidade */
  readonly phY = new Spring(0, 0.5, 0.62);
  readonly phA = new Spring(0, 0.25, 1);
  particles: Particle[] = [];
  time = 0;
  private blinkIn = 2.2;
  private blinkHold = 0;
  private spawnIn = 0;
  private gazeFromPointerX = 0;
  private gazeFromPointerY = 0;
  private rng: () => number;

  constructor(mood: MascotMood = "idle", shape?: string, rng: () => number = Math.random) {
    this.rng = rng;
    this.mood = mood;
    this.face = faceFor(mood);
    this.radii = [...radiiFor(shape)];
    this.targetRadii = [...this.radii];
    this.left = eyeState(this.face.left);
    this.right = eyeState(this.face.right);
  }

  setShape(shape?: string) {
    this.targetRadii = [...radiiFor(shape)];
  }

  setMood(mood: MascotMood) {
    if (mood === this.mood) return;
    const prev = this.face;
    this.mood = mood;
    this.face = faceFor(mood);
    for (const [state, spec] of [[this.left, this.face.left], [this.right, this.face.right]] as const) {
      state.spec = spec;
      state.w.target = spec.w;
      state.h.target = spec.h;
      state.lid.target = spec.lid;
    }
    // trocar de forma de olho "pisca" para a troca não ser seca
    if (prev.left.shape !== this.face.left.shape || prev.right.shape !== this.face.right.shape) this.blink();
    this.syncGaze();
    // reação corporal: pequena batida de squash na mudança
    this.squashY.velocity -= 3;
    this.squashX.velocity += 2;
  }

  /** Olhar para o cursor (-1..1); `null` volta ao olhar do humor. */
  setLook(x: number | null, y: number | null) {
    this.gazeFromPointerX = x ?? 0;
    this.gazeFromPointerY = y ?? 0;
    this.syncGaze();
  }

  private syncGaze() {
    const k = (v: number) => Math.max(-1, Math.min(1, v));
    this.lookX.target = k(this.face.gazeX + this.gazeFromPointerX);
    this.lookY.target = k(this.face.gazeY + this.gazeFromPointerY);
  }

  setHeadphones(visible: boolean, drop: boolean | undefined) {
    if (drop === false && this.phA.value < 0.01) this.phY.set(-120);
    this.phA.target = visible ? 1 : 0;
    // `drop === false`: fones fora de cena (acima da cabeça); senão encaixados
    this.phY.target = drop === false ? -120 : 0;
    if (drop === false) this.phA.target = 0;
  }

  blink() {
    this.open.target = 0;
    this.blinkHold = 0.09;
  }

  /** Cutucar: achata e pula. */
  poke() {
    this.squashX.velocity += 7;
    this.squashY.velocity -= 9;
    this.blink();
  }

  get sleepy(): boolean {
    return this.mood === "sleeping" || this.mood === "drowsy";
  }

  update(dt: number) {
    if (dt <= 0) return;
    this.time += dt;

    // corpo: cada raio persegue o alvo (morph) — decaimento exponencial, estável em qualquer dt
    const k = 1 - Math.exp(-dt * 9);
    for (let i = 0; i < PROFILE_SAMPLES; i++) this.radii[i] += (this.targetRadii[i] - this.radii[i]) * k;

    for (const eye of [this.left, this.right]) {
      eye.w.step(dt);
      eye.h.step(dt);
      eye.lid.step(dt);
    }
    this.lookX.step(dt);
    this.lookY.step(dt);
    this.squashX.step(dt);
    this.squashY.step(dt);
    this.phY.step(dt);
    this.phA.step(dt);

    // piscar: sono mantém fechado; senão a cada 2.5–5 s
    this.open.step(dt);
    if (this.blinkHold > 0) {
      this.blinkHold -= dt;
      if (this.blinkHold <= 0) this.open.target = 1;
    }
    this.blinkIn -= dt;
    if (this.blinkIn <= 0) {
      this.blink();
      this.blinkIn = 2.5 + this.rng() * 2.5;
    }

    this.emit(dt);
    this.particles = this.particles.filter((p) => {
      p.age += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      return p.age < p.life;
    });
  }

  private emit(dt: number) {
    this.spawnIn -= dt;
    if (this.spawnIn > 0) return;
    if (this.sleepy) {
      this.spawnIn = 1.1;
      this.particles.push({ kind: "z", x: 70, y: -70, vx: 10, vy: -26, age: 0, life: 2.2 });
    } else if (this.mood === "excited" || this.mood === "music") {
      this.spawnIn = 0.45;
      const side = this.rng() < 0.5 ? -1 : 1;
      this.particles.push({ kind: "spark", x: side * (90 + this.rng() * 20), y: -60 + this.rng() * 40, vx: side * 8, vy: -18, age: 0, life: 0.9 });
    } else if (this.mood === "shy" || this.mood === "proud") {
      this.spawnIn = 0.8;
      this.particles.push({ kind: "heart", x: 76 + this.rng() * 14, y: -60, vx: 6, vy: -24, age: 0, life: 1.4 });
    } else {
      this.spawnIn = 0.5;
    }
  }

  /** Há algo ainda se movendo? (permite pular quadros quando tudo está em repouso). */
  get animating(): boolean {
    return (
      this.particles.length > 0 ||
      !this.open.settled ||
      !this.squashX.settled ||
      !this.squashY.settled ||
      !this.lookX.settled ||
      !this.lookY.settled ||
      !this.left.w.settled ||
      !this.left.h.settled ||
      !this.phA.settled ||
      !this.phY.settled
    );
  }
}
