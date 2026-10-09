import { describe, expect, it } from "vitest";
import { MASCOT_MOODS } from "../moods";
import { FACES, faceFor } from "./face";
import { PherieEngine } from "./engine";
import { Spring } from "./spring";
import { SHAPES } from "../engine/skins";
import { PROFILE_SAMPLES } from "../engine/profiles";

const run = (e: PherieEngine, seconds: number, dt = 1 / 60) => {
  for (let t = 0; t < seconds; t += dt) e.update(dt);
};

describe("Pherie face", () => {
  it("todo humor das configs tem um rosto", () => {
    for (const m of MASCOT_MOODS) expect(FACES[m.id], m.id).toBeDefined();
    expect(faceFor("nao-existe" as never)).toBe(FACES.idle);
  });

  it("a forma do olho conta a emoção", () => {
    expect(FACES.happy.left.shape).toBe("happy");
    expect(FACES.dizzy.left.shape).toBe("spiral");
    expect(FACES.sleeping.left.shape).toBe("closed");
    // bravo e triste inclinam a pálpebra em sentidos opostos; os dois olhos são espelhados
    expect(FACES.angry.left.lid).toBeGreaterThan(0);
    expect(FACES.sad.left.lid).toBeLessThan(0);
    expect(FACES.angry.right.lid).toBe(-FACES.angry.left.lid);
  });
});

describe("PherieEngine", () => {
  const seeded = () => {
    let n = 0.3;
    return () => ((n = (n * 9301 + 49297) % 233280) / 233280);
  };

  it("setMood leva os olhos ao novo formato por mola", () => {
    const e = new PherieEngine("idle", undefined, seeded());
    e.setMood("surprised");
    run(e, 2);
    expect(e.left.h.value).toBeCloseTo(FACES.surprised.left.h, 0);
    expect(e.left.spec.shape).toBe("wide");
  });

  it("o corpo morfa para a nova forma sem saltar", () => {
    const e = new PherieEngine("idle", "cercle", seeded());
    const before = e.radii[10];
    e.setShape("triangle");
    e.update(1 / 60);
    expect(Math.abs(e.radii[10] - before)).toBeLessThan(0.1);
    run(e, 2);
    const e2 = new PherieEngine("idle", "triangle");
    expect(e.radii[10]).toBeCloseTo(e2.radii[10], 2);
  });

  it("pisca sozinha e volta a abrir", () => {
    const e = new PherieEngine("idle", undefined, seeded());
    let min = 1;
    for (let t = 0; t < 8; t += 1 / 60) {
      e.update(1 / 60);
      min = Math.min(min, e.open.value);
    }
    expect(min).toBeLessThan(0.6);
    expect(e.open.value).toBeGreaterThan(0.9);
  });

  it("dormindo solta zzz; feliz não", () => {
    const sleepy = new PherieEngine("sleeping", undefined, seeded());
    run(sleepy, 3);
    expect(sleepy.particles.some((p) => p.kind === "z")).toBe(true);
    const happy = new PherieEngine("idle", undefined, seeded());
    run(happy, 3);
    expect(happy.particles.length).toBe(0);
  });

  it("o olhar segue o cursor e volta ao humor", () => {
    const e = new PherieEngine("idle", undefined, seeded());
    e.setLook(1, -1);
    run(e, 2);
    expect(e.lookX.value).toBeCloseTo(1, 1);
    e.setLook(null, null);
    run(e, 2);
    expect(e.lookX.value).toBeCloseTo(0, 1);
  });

  it("fones entram de cima e saem de cena", () => {
    const e = new PherieEngine("idle", undefined, seeded());
    e.setHeadphones(true, false);
    expect(e.phY.value).toBe(-120);
    e.setHeadphones(true, true);
    run(e, 2);
    expect(e.phY.value).toBeCloseTo(0, 0);
    expect(e.phA.value).toBeCloseTo(1, 1);
  });
});

describe("Spring", () => {
  it("converge sem explodir mesmo com dt grande", () => {
    const s = new Spring(0, 0.3, 0.6);
    s.target = 10;
    for (let i = 0; i < 40; i++) s.step(0.064);
    expect(s.value).toBeCloseTo(10, 1);
    expect(Number.isFinite(s.value)).toBe(true);
  });
});

describe("formas do corpo", () => {
  it("todas as formas têm um raio por amostra e são finitas e positivas", () => {
    for (const shape of SHAPES) {
      expect(shape.radii, shape.id).toHaveLength(PROFILE_SAMPLES);
      expect(shape.radii.every((r) => Number.isFinite(r) && r > 0.3), shape.id).toBe(true);
    }
  });
});

import { armTargets, REST, type ArmScene } from "./arms";

const calm: ArmScene = { gaming: false, dancing: false, muteX: false, fume: false, wave: 0, putOn: 0, celebrate: 0, beat: 0 };

describe("braços", () => {
  it("em repouso as mãos ficam caídas dos lados", () => {
    const h = armTargets(calm, 1);
    expect(h.left).toEqual(REST.left);
    expect(h.right).toEqual(REST.right);
    expect(h.controller).toBe(0);
  });

  it("acenar só mexe a mão direita, para cima", () => {
    const h = armTargets({ ...calm, wave: 1 }, 0.3);
    expect(h.right.y).toBeLessThan(0);
    expect(h.left).toEqual(REST.left);
  });

  it("jogando segura o controle com as duas mãos na frente", () => {
    const h = armTargets({ ...calm, gaming: true }, 0.5);
    expect(h.controller).toBe(1);
    expect(Math.abs(h.left.x)).toBeLessThan(60);
    expect(h.left.y).toBeGreaterThan(60);
  });

  it("dançando as mãos se alternam", () => {
    const h = armTargets({ ...calm, dancing: true, beat: 1 }, 0.1);
    expect(Math.sign(h.left.y - 18)).toBe(-Math.sign(h.right.y - 18));
  });

  it("música calma balança os braços devagar e perto do corpo", () => {
    const a = armTargets({ ...calm, dancing: true, danceStyle: "calm" }, 0.3);
    const b = armTargets({ ...calm, dancing: true, danceStyle: "groove", beat: 1 }, 0.1);
    expect(a.left.y).toBeGreaterThan(10); // mãos abaixo do ombro
    expect(Math.abs(a.left.y - 40)).toBeLessThan(Math.abs(b.left.y - 18) + 30);
  });

  it("música pesada ergue os dois punhos e sobem mais na batida", () => {
    const quiet = armTargets({ ...calm, dancing: true, danceStyle: "headbang", beat: 0 }, 0.2);
    const hit = armTargets({ ...calm, dancing: true, danceStyle: "headbang", beat: 1 }, 0.2);
    expect(quiet.left.y).toBeLessThan(0);
    expect(hit.left.y).toBeLessThan(quiet.left.y);
    expect(hit.right.y).toBeLessThan(quiet.right.y);
  });

  it("irritada ergue os punhos e eles tremem", () => {
    const a = armTargets({ ...calm, fume: true }, 0.01);
    const b = armTargets({ ...calm, fume: true }, 0.05);
    expect(a.left.y).toBeLessThan(20);
    expect(a.left.x).not.toBe(b.left.x);
  });

  it("tcharam: as duas mãos sobem para os lados", () => {
    const h = armTargets({ ...calm, celebrate: 1 }, 0.2);
    expect(h.left.y).toBeLessThan(0);
    expect(h.right.y).toBeLessThan(0);
    expect(h.left.x).toBeLessThan(-100);
    expect(h.right.x).toBeGreaterThan(100);
  });

  it("colocar os fones tem prioridade sobre jogar e dançar", () => {
    const h = armTargets({ ...calm, gaming: true, dancing: true, putOn: 0.5 }, 1);
    expect(h.left.y).toBeLessThan(10);
    expect(h.controller).toBe(0);
  });
});

describe("cenas no engine", () => {
  it("colocar fones faz as mãos subirem e depois voltarem", () => {
    const e = new PherieEngine("idle");
    e.setHeadphones(true, true);
    for (let t = 0; t < 0.6; t += 1 / 60) e.update(1 / 60);
    expect(e.lhy.value).toBeLessThan(30);
    for (let t = 0; t < 2.5; t += 1 / 60) e.update(1 / 60);
    expect(e.lhy.value).toBeGreaterThan(60);
  });
});

describe("notas musicais e cara de música pesada", () => {
  const dance = (style: "calm" | "groove" | "headbang", seconds = 4) => {
    const e = new PherieEngine("music", undefined, seeded());
    e.phA.set(1);
    e.setScene({ dancing: true, danceStyle: style, beat: 0 });
    let notes = 0;
    for (let t = 0; t < seconds; t += 1 / 60) {
      e.setScene({ beat: Math.floor(t * 3) % 2 === 0 && t % (1 / 3) < 0.05 ? 1 : 0 });
      const before = e.particles.filter((p) => p.kind === "note").length;
      e.update(1 / 60);
      notes += Math.max(0, e.particles.filter((p) => p.kind === "note").length - before);
    }
    return notes;
  };
  const seeded = () => {
    let n = 0.37;
    return () => ((n = (n * 9301 + 49297) % 233280) / 233280);
  };

  it("sai nota dos fones quando ela dança, e mais na música pesada", () => {
    const calmNotes = dance("calm");
    const heavy = dance("headbang");
    expect(calmNotes).toBeGreaterThan(0);
    expect(heavy).toBeGreaterThan(calmNotes * 2);
  });

  it("sem fones ou sem dançar não sai nota", () => {
    const e = new PherieEngine("music", undefined, seeded());
    e.setScene({ dancing: true, danceStyle: "headbang" });
    for (let t = 0; t < 3; t += 1 / 60) e.update(1 / 60);
    expect(e.particles.some((p) => p.kind === "note")).toBe(false);
    e.phA.set(1);
    e.setScene({ dancing: false });
    for (let t = 0; t < 3; t += 1 / 60) e.update(1 / 60);
    expect(e.particles.some((p) => p.kind === "note")).toBe(false);
  });

  it("as notas sobem e somem", () => {
    const e = new PherieEngine("music", undefined, seeded());
    e.phA.set(1);
    e.setScene({ dancing: true, danceStyle: "groove" });
    for (let t = 0; t < 1; t += 1 / 60) e.update(1 / 60);
    const n = e.particles.find((p) => p.kind === "note")!;
    expect(n.vy).toBeLessThan(0);
    e.setScene({ dancing: false });
    for (let t = 0; t < 3; t += 1 / 60) e.update(1 / 60);
    expect(e.particles.some((p) => p.kind === "note")).toBe(false);
  });
});
