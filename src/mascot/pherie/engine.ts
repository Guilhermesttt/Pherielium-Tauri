import { PROFILE_SAMPLES } from "../engine/profiles";
import { SHAPE_BY_ID } from "../engine/skins";
import { armTargets, REST, type ArmScene } from "./arms";
import { faceFor, type EyeSpec, type FaceSpec } from "./face";
import { Spring } from "./spring";
import type { MascotMood } from "../moods";

/** Raio do corpo em unidades de desenho. */
export const R = 100;

export interface Particle {
  kind: "z" | "heart" | "spark" | "note";
  /** nota musical: qual desenho (0 = colcheia, 1 = duas colcheias) e a cor (0 calma, 1 animada, 2 pesada) */
  variant?: number;
  tone?: number;
  rot?: number;
  spin?: number;
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
  /** mãos (x, y) e controle */
  readonly lhx = new Spring(REST.left.x, 0.24, 0.55);
  readonly lhy = new Spring(REST.left.y, 0.24, 0.55);
  readonly rhx = new Spring(REST.right.x, 0.24, 0.55);
  readonly rhy = new Spring(REST.right.y, 0.24, 0.55);
  readonly ctl = new Spring(0, 0.3, 0.7);
  /** visibilidade dos braços 0..1: só aparecem ao gesticular (olá, fones, controle...) */
  readonly armA = new Spring(0, 0.22, 0.8);
  readonly scene: ArmScene = { gaming: false, dancing: false, muteX: false, fume: false, wave: 0, putOn: 0, celebrate: 0, beat: 0 };
  particles: Particle[] = [];
  time = 0;
  private blinkIn = 2.2;
  private override: FaceSpec | null = null;
  private noteIn = 0;
  private prevBeat = 0;
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

  /** Rosto fixo por cima do humor (ex.: cara de mau na música pesada); `null` volta ao humor. */
  setFaceOverride(face: FaceSpec | null) {
    if (face === this.override) return;
    this.override = face;
    this.applyFace(face ?? faceFor(this.mood));
  }

  private applyFace(next: FaceSpec) {
    const prev = this.face;
    this.face = next;
    for (const [state, spec] of [[this.left, next.left], [this.right, next.right]] as const) {
      state.spec = spec;
      state.w.target = spec.w;
      state.h.target = spec.h;
      state.lid.target = spec.lid;
    }
    if (prev.left.shape !== next.left.shape || prev.right.shape !== next.right.shape) this.blink();
    this.syncGaze();
  }

  setMood(mood: MascotMood) {
    if (mood === this.mood) return;
    if (this.override) {
      // o rosto fixo manda; só guarda o humor para quando ele sair
      this.mood = mood;
      return;
    }
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

  setScene(next: Partial<Pick<ArmScene, "gaming" | "dancing" | "danceStyle" | "muteX" | "fume" | "beat">>) {
    Object.assign(this.scene, next);
  }

  /** Mãos para cima, revelando algo (conquista) por `seconds`. */
  celebrate(seconds = 2.2) {
    this.scene.celebrate = seconds;
  }

  /** Acena por `seconds` (olá!). */
  wave(seconds = 1.8) {
    this.scene.wave = seconds;
  }

  setHeadphones(visible: boolean, drop: boolean | undefined) {
    // colocou os fones: as mãos sobem às orelhas enquanto eles descem
    if (visible && this.phA.target < 0.5 && drop !== false) this.scene.putOn = 0.9;
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

    this.scene.wave = Math.max(0, this.scene.wave - dt);
    this.scene.putOn = Math.max(0, this.scene.putOn - dt);
    this.scene.celebrate = Math.max(0, this.scene.celebrate - dt);
    const hands = armTargets(this.scene, this.time);
    this.lhx.target = hands.left.x;
    this.lhy.target = hands.left.y;
    this.rhx.target = hands.right.x;
    this.rhy.target = hands.right.y;
    this.ctl.target = hands.controller;
    const s = this.scene;
    this.armA.target = s.gaming || s.fume || s.wave > 0 || s.putOn > 0 || s.celebrate > 0 ? 1 : 0;
    for (const sp of [this.lhx, this.lhy, this.rhx, this.rhy, this.ctl, this.armA]) sp.step(dt);

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
    this.emitNotes(dt);
    this.particles = this.particles.filter((p) => {
      p.age += dt;
      p.x += p.vx * dt + (p.kind === "note" ? Math.sin(p.age * 5 + (p.rot ?? 0) * 9) * 6 * dt : 0);
      p.y += p.vy * dt;
      if (p.kind === "note") p.rot = (p.rot ?? 0) + (p.spin ?? 0) * dt;
      return p.age < p.life;
    });
  }

  /** Notas musicais saindo dos fones enquanto ela dança: mais e mais fortes quanto mais pesada a música. */
  private emitNotes(dt: number) {
    const s = this.scene;
    const beatHit = s.beat > 0.9 && this.prevBeat <= 0.9;
    this.prevBeat = s.beat;
    if (!s.dancing || this.phA.value < 0.5) return;
    const style = s.danceStyle ?? "groove";
    const tone = style === "calm" ? 0 : style === "headbang" ? 2 : 1;
    const every = style === "calm" ? 0.85 : style === "headbang" ? 0.22 : 0.42;
    this.noteIn -= dt;
    const burst = beatHit && style !== "calm";
    if (this.noteIn > 0 && !burst) return;
    this.noteIn = every;
    const count = burst && style === "headbang" ? 2 : 1;
    for (let i = 0; i < count; i++) {
      const side = this.rng() < 0.5 ? -1 : 1;
      this.particles.push({
        kind: "note",
        variant: this.rng() < 0.35 ? 1 : 0,
        tone,
        rot: (this.rng() - 0.5) * 0.5,
        spin: (this.rng() - 0.5) * 1.2,
        x: side * 117,
        y: 0 + this.rng() * 14,
        vx: side * (3 + this.rng() * 6),
        vy: -(28 + this.rng() * 22 + tone * 8),
        age: 0,
        life: 1.9,
      });
    }
  }

  private emit(dt: number) {
    this.spawnIn -= dt;
    if (this.spawnIn > 0) return;
    if (this.sleepy) {
      this.spawnIn = 1.1;
      this.particles.push({ kind: "z", x: 70, y: -70, vx: 10, vy: -26, age: 0, life: 2.2 });
    } else if (this.mood === "excited" || this.mood === "music") {
      // música pesada solta faíscas o tempo todo; a calma quase não
      const style = this.scene.danceStyle;
      this.spawnIn = style === "headbang" ? 0.16 : style === "calm" ? 1.4 : 0.45;
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
      this.scene.gaming ||
      this.scene.dancing ||
      this.scene.fume ||
      this.scene.wave > 0 ||
      this.scene.putOn > 0 ||
      this.scene.celebrate > 0 ||
      !this.lhx.settled ||
      !this.rhx.settled ||
      !this.lhy.settled ||
      !this.rhy.settled ||
      !this.ctl.settled ||
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
