import { mkdirSync } from "node:fs";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { installHarness } from "./fixtures";

const outDir = path.resolve(import.meta.dirname, "screenshots", process.env.SHOTS_LABEL ?? "after");

test("pherie: os 24 humores desenham sem erro", async ({ browser }) => {
  mkdirSync(outDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1100, height: 760 } });
  await installHarness(context, { tauri: false });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", (e) => {
    if (!/transformCallback|invoke/.test(e.message)) errors.push(e.message);
  });
  await page.goto("/");
  await page.waitForTimeout(3000);

  await page.evaluate(async () => {
    const eng = await import("/src/mascot/pherie/engine.ts");
    const draw = await import("/src/mascot/pherie/draw.ts");
    const moods = await import("/src/mascot/moods.ts");
    const states = await import("/src/mascot/pherieStates.ts");
    const mouth = await import("/src/mascot/mouth.ts");
    const color = await import("/src/mascot/mascotColor.ts");
    document.body.innerHTML = "";
    const grid = document.createElement("div");
    grid.style.cssText =
      "position:fixed;inset:0;z-index:99999;background:#1b1b20;display:grid;grid-template-columns:repeat(6,1fr);gap:4px;padding:8px;font:11px system-ui;color:#aaa";
    document.body.appendChild(grid);
    const palette = color.deriveBodyPalette(null);
    const items = new Set<string>();
    for (const m of moods.MASCOT_MOODS) {
      const cell = document.createElement("div");
      cell.style.textAlign = "center";
      const c = document.createElement("canvas");
      const size = 150;
      const dpr = 1;
      c.width = size;
      c.height = size;
      c.style.width = size + "px";
      cell.appendChild(c);
      cell.appendChild(document.createTextNode(m.id));
      grid.appendChild(cell);
      const e = new eng.PherieEngine(m.id, "squircle", () => 0.5);
      for (let t = 0; t < 2.5; t += 1 / 60) e.update(1 / 60);
      const spec = states.MOOD_SPECS[m.id];
      draw.drawPherie(
        c.getContext("2d")!,
        e,
        {
          palette,
          faceColor: palette.face,
          accentColor: palette.accent,
          ears: "cat",
          earAccent: "#e8483f",
          items: items as never,
          rgbHeadphones: m.id === "gaming",
          showMic: m.id === "calling",
          mouth: mouth.mouthShape(spec.mouth, 0),
          blush: spec.blush,
          extras: spec.extras ?? [],
        },
        size,
        dpr,
      );
    }
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, "pherie-moods.png") });
  expect(errors).toEqual([]);
  await context.close();
});

test("pherie: cenas dos braços (olá, jogar, dançar, fones, mutado, irritada)", async ({ browser }) => {
  mkdirSync(outDir, { recursive: true });
  const context = await browser.newContext({ viewport: { width: 1000, height: 440 } });
  await installHarness(context, { tauri: false });
  const page = await context.newPage();
  await page.goto("/");
  await page.waitForTimeout(3000);
  await page.evaluate(async () => {
    const eng = await import("/src/mascot/pherie/engine.ts");
    const draw = await import("/src/mascot/pherie/draw.ts");
    const states = await import("/src/mascot/pherieStates.ts");
    const mouth = await import("/src/mascot/mouth.ts");
    const color = await import("/src/mascot/mascotColor.ts");
    const faces = await import("/src/mascot/pherie/face.ts");
    document.body.innerHTML = "";
    const grid = document.createElement("div");
    grid.style.cssText =
      "position:fixed;inset:0;z-index:99999;background:#1b1b20;display:grid;grid-template-columns:repeat(6,1fr);gap:4px;padding:8px;font:12px system-ui;color:#aaa";
    document.body.appendChild(grid);
    const palette = color.deriveBodyPalette(null);
    const scenes = [
      { name: "olá", mood: "happy", wave: 2, t: 0.45 },
      { name: "jogando", mood: "gaming", gaming: true, hp: true, t: 1.2 },
      { name: "dançando", mood: "music", dancing: true, hp: true, beat: 0.8, t: 1.0 },
      { name: "fones", mood: "idle", putOn: true, t: 0.35 },
      { name: "mutada", mood: "muted", muteX: true, hp: true, t: 1.5 },
      { name: "irritada", mood: "angry", muteX: true, fume: true, hp: true, t: 1.5 },
      { name: "música calma", mood: "music", dancing: true, style: "calm", hp: true, t: 1.2 },
      { name: "música animada", mood: "music", dancing: true, style: "groove", hp: true, beat: 0.8, t: 1.0 },
      { name: "música pesada", mood: "music", dancing: true, style: "headbang", hp: true, beat: 1, t: 1.0 },
    ];
    for (const sc of scenes) {
      const cell = document.createElement("div");
      cell.style.textAlign = "center";
      const c = document.createElement("canvas");
      const size = 160;
      c.width = size;
      c.height = size;
      c.style.width = size + "px";
      cell.appendChild(c);
      cell.appendChild(document.createTextNode(sc.name));
      grid.appendChild(cell);
      const e = new eng.PherieEngine(sc.mood as never, "squircle", () => 0.5);
      e.setScene({ gaming: !!sc.gaming, dancing: !!sc.dancing, danceStyle: (sc as { style?: string }).style as never, muteX: !!sc.muteX, fume: !!sc.fume, beat: sc.beat ?? 0 });
      if (sc.wave) e.wave(sc.wave);
      if (sc.putOn) e.setHeadphones(true, true);
      else if (sc.hp) {
        e.phA.set(1);
        e.phA.target = 1;
      }
      const heavy = (sc as { style?: string }).style === "headbang";
      if (heavy) e.setFaceOverride(faces.HEADBANG_FACE);
      const steps = Math.round((sc.t < 2 ? 2.2 : sc.t) * 60);
      for (let i = 0; i < steps; i++) {
        if ((sc as { style?: string }).style) e.setScene({ beat: i % 18 < 3 ? 1 : 0 });
        e.update(1 / 60);
      }
      const spec = states.MOOD_SPECS[sc.mood as never] as never as { mouth: never; blush: number; extras?: never[] };
      draw.drawPherie(
        c.getContext("2d")!,
        e,
        {
          palette,
          faceColor: palette.face,
          accentColor: palette.accent,
          ears: "cat",
          earAccent: "#e8483f",
          items: new Set() as never,
          rgbHeadphones: sc.mood === "gaming",
          showMic: false,
          mouth: mouth.mouthShape(heavy ? ("grin" as never) : spec.mouth, 0),
          blush: heavy ? 0.04 : spec.blush,
          extras: spec.extras ?? [],
        },
        size,
        1,
      );
    }
  });
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(outDir, "pherie-scenes.png"), clip: { x: 0, y: 0, width: 1000, height: 420 } });
  await context.close();
});
