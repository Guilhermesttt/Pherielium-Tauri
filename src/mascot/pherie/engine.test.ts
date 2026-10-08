import { describe, expect, it } from "vitest";
import { MASCOT_MOODS } from "../moods";
import { FACES, faceFor } from "./face";
import { PherieEngine } from "./engine";
import { Spring } from "./spring";

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
