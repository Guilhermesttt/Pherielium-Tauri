import { readdirSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../sounds/PS2 System Sounds/", import.meta.url);
const hook = readFileSync(new URL("./useSoundEffects.ts", import.meta.url), "utf8");
const app = readFileSync(new URL("../App.tsx", import.meta.url), "utf8");
const ps2Block = hook.slice(hook.indexOf("  ps2: {"), hook.indexOf("  gamecube: {"));
const roles = (name: string) => new RegExp(`^\\s+${name}: (\\w+),`, "m").exec(ps2Block)?.[1];

describe("pacote de sons do PS2", () => {
  const wavs = readdirSync(root).filter((f) => f.endsWith(".wav"));

  it("todo som do pacote é importado e usado por algum papel (nada fica órfão)", () => {
    expect(wavs.length).toBe(15);
    for (const file of wavs) {
      expect(hook, file).toContain(`PS2 System Sounds/${file}`);
    }
    const imported = [...hook.matchAll(/import (ps2\w+) from "..\/sounds\/PS2 System Sounds/g)].map((m) => m[1]);
    for (const name of imported) {
      expect(ps2Block.match(new RegExp(`\\b${name}\\b`, "g"))?.length, name).toBeGreaterThan(0);
    }
  });

  it("papéis de abrir e fechar são pares: show_modal ↔ hide_modal, fly_in ↔ fly_out, into ↔ out of detail", () => {
    expect(roles("showModal")).toBe("ps2ShowModalSound");
    expect(roles("modalClose")).toBe("ps2EditModalSound"); // arquivo deck_ui_hide_modal.wav
    expect(hook).toMatch(/ps2EditModalSound from ".*deck_ui_hide_modal\.wav"/);
    expect(roles("sidebarOpen")).toBe("ps2FlyInSound");
    expect(roles("sidebarClose")).toBe("ps2FlyOutSound");
    expect(roles("detailOpen")).toBe("ps2DetailOpenSound");
    expect(roles("back")).toBe("ps2BackSound");
  });

  it("ações frequentes (hover, teclar, bater na borda, abas, busca) usam sons curtos", () => {
    const size = (f: string) => statSync(new URL(f, root)).size;
    // wav estéreo 44,1 kHz: sons curtos pesam menos de ~0,5 MB
    expect(size("deck_ui_misc_10.wav")).toBeLessThan(500_000);
    expect(size("deck_ui_tab_transition_01.wav")).toBeLessThan(500_000);
    expect(size("deck_ui_switch_toggle_on.wav")).toBeLessThan(500_000);
    for (const role of ["hover", "edgeBump", "keyTyping"]) expect(roles(role)).toBe("ps2HoverSound");
    for (const role of ["select", "menuClick", "tabSwitch", "search", "edit"]) expect(roles(role)).toBe("ps2ActivationSound");
  });

  it("o tema tem música de fundo, nivelada para o pico ficar perto de -2 dB", () => {
    expect(readdirSync(root)).toContain("Background_Music.mp3");
    expect(app).toMatch(/ps2: \(\) =>\s*import\("\.\/sounds\/PS2 System Sounds\/Background_Music\.mp3"\)/);
    expect(app).toMatch(/ps2: 6,/);
    expect(app).not.toMatch(/ps2: \(\) => Promise\.resolve\(null\)/);
  });
});
