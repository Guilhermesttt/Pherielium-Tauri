import { describe, expect, it } from "vitest";
import {
  TOUR_STEPS,
  coachPlacement,
  loadTourState,
  restartTour,
  saveTourState,
  progressOf,
  stepIndexFrom,
  tourForceKey,
  tourKey,
} from "./tourSteps";

const mem = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
};

describe("tour: passos", () => {
  it("tem ids únicos, começa e termina sem alvo e a tarefa de filtro é Alt + rolagem", () => {
    expect(new Set(TOUR_STEPS.map((s) => s.id)).size).toBe(TOUR_STEPS.length);
    expect(TOUR_STEPS[0].selector).toBeNull();
    expect(TOUR_STEPS[TOUR_STEPS.length - 1].selector).toBeNull();
    expect(TOUR_STEPS.find((s) => s.id === "platform-filter")?.advanceOn).toBe("alt-scroll");
  });

  it("pula passos cujo alvo não existe", () => {
    const present = (sel: string) => !sel.includes("Sincronizar");
    const sync = TOUR_STEPS.findIndex((s) => s.id === "sync");
    expect(stepIndexFrom(sync, 1, TOUR_STEPS, present)).toBe(sync + 1); // pula "sync"
    expect(stepIndexFrom(sync, -1, TOUR_STEPS, present)).toBe(sync - 1);
  });

  it("o último passo (sem alvo) sempre vale; fora do fim devolve null", () => {
    const last = TOUR_STEPS.length - 1;
    expect(stepIndexFrom(last, 1, TOUR_STEPS, () => false)).toBe(last);
    expect(stepIndexFrom(TOUR_STEPS.length, 1, TOUR_STEPS, () => true)).toBeNull();
    expect(stepIndexFrom(-1, -1, TOUR_STEPS, () => true)).toBeNull();
  });
});

describe("tour: persistência", () => {
  it("começa do zero sem nada salvo e com dado corrompido", () => {
    const s = mem();
    expect(loadTourState("u", s)).toEqual({ step: 0, done: false });
    s.setItem(tourKey("u"), "{lixo");
    expect(loadTourState("u", s)).toEqual({ step: 0, done: false });
  });

  it("guarda e retoma o passo, limitando ao total", () => {
    const s = mem();
    saveTourState("u", { step: 3, done: false }, s);
    expect(loadTourState("u", s)).toEqual({ step: 3, done: false });
    s.setItem(tourKey("u"), JSON.stringify({ step: 99, done: true }));
    expect(loadTourState("u", s)).toEqual({ step: TOUR_STEPS.length - 1, done: true });
  });

  it("refazer zera o progresso e liga o modo forçado", () => {
    const s = mem();
    saveTourState("u", { step: 7, done: true }, s);
    restartTour("u", s);
    expect(loadTourState("u", s)).toEqual({ step: 0, done: false });
    expect(s.getItem(tourForceKey("u"))).toBe("1");
  });
});

describe("tour: posição do balão", () => {
  const vp = { width: 1200, height: 800 };
  const coach = { width: 340, height: 170 };

  it("prefere embaixo do alvo e centraliza nele", () => {
    const p = coachPlacement({ x: 500, y: 60, width: 40, height: 40 }, vp, coach);
    expect(p.side).toBe("bottom");
    expect(p.y).toBeGreaterThan(100);
    expect(p.x + coach.width / 2).toBeCloseTo(520, 0);
  });

  it("vai para cima quando embaixo não cabe", () => {
    const p = coachPlacement({ x: 500, y: 740, width: 40, height: 40 }, vp, coach);
    expect(p.side).toBe("top");
  });

  it("nunca sai da janela", () => {
    const p = coachPlacement({ x: 1190, y: 10, width: 10, height: 10 }, vp, coach);
    expect(p.x + coach.width).toBeLessThanOrEqual(vp.width);
    expect(p.x).toBeGreaterThanOrEqual(0);
  });

  it("sem alvo, centraliza", () => {
    const p = coachPlacement(null, vp, coach);
    expect(p).toMatchObject({ side: "center", x: 430, y: 315 });
  });
});

describe("tour: passos com tarefa e espera", () => {
  it("o passo de soltar o Alt espera o seletor abrir em vez de ser pulado", () => {
    const release = TOUR_STEPS.findIndex((s) => s.id === "release-alt");
    expect(TOUR_STEPS[release].waitForTargetMs).toBeGreaterThan(0);
    expect(stepIndexFrom(release, 1, TOUR_STEPS, () => false)).toBe(release);
  });

  it("não existe mais o passo 'filtre do seu jeito': o Alt segura o seletor e solta para escolher", () => {
    expect(TOUR_STEPS.some((s) => s.id === "filters-panel")).toBe(false);
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(ids.indexOf("release-alt")).toBe(ids.indexOf("platform-filter") + 1);
  });

  it("soltar o Alt cedo demais não conta, e a Pherie fica fora da frente do seletor", () => {
    const release = TOUR_STEPS.find((s) => s.id === "release-alt")!;
    expect(release.minOpenMs).toBeGreaterThan(0);
    expect(release.interactive).toBe(true);
    expect(release.coachAt).toBe("bottom-center");
    expect(release.advanceOn).toBe("target-gone");
  });

  it("todo passo com tarefa avança por uma ação do usuário, nunca por 'Próximo'", () => {
    for (const s of TOUR_STEPS.filter((s) => s.task)) expect(s.advanceOn).not.toBe("next");
  });
});

describe("tour: roteiro completo da plataforma", () => {
  it("mostra o hub universal, o overlay (Ctrl+Shift+O e botão do meio) e a emulação Xbox", () => {
    const byId = (id: string) => TOUR_STEPS.find((s) => s.id === id)!;
    expect(byId("universal").text).toMatch(/Steam/);
    expect(byId("universal").text).toMatch(/Epic/);
    expect(byId("overlay").text).toContain("Ctrl + Shift + O");
    expect(byId("overlay").text.toLowerCase()).toContain("botão do meio");
    expect(byId("xinput").text).toContain("XInput");
    expect(byId("xinput").text.toLowerCase()).toContain("volta ao normal");
  });

  it("as etapas de controle vêm antes do overlay, que cita o botão do meio", () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(ids.indexOf("controller-hold")).toBeLessThan(ids.indexOf("overlay"));
    expect(ids.indexOf("overlay")).toBeLessThan(ids.indexOf("xinput"));
  });
});

describe("tour: cenas e gaveta", () => {
  it("cenas em tela cheia não têm alvo (ocupam a tela inteira)", () => {
    const scenes = TOUR_STEPS.filter((s) => s.scene);
    expect(scenes.length).toBeGreaterThanOrEqual(3);
    for (const s of scenes) expect(s.selector).toBeNull();
  });

  it("os passos que apontam para a gaveta lateral pedem que ela abra", () => {
    for (const s of TOUR_STEPS.filter((s) => s.selector?.includes("data-sidebar-item"))) expect(s.sidebar).toBe(true);
  });

  it("a notch é configurada no tutorial, logo depois de ser apresentada", () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    expect(ids.indexOf("notch-setup")).toBe(ids.indexOf("notch") + 1);
    expect(TOUR_STEPS.find((s) => s.id === "notch-setup")?.panel).toBe("notch-setup");
  });
});

describe("tour: micro-tarefas do Alt e da notch", () => {
  it("escolher a plataforma é soltar o Alt: o passo termina quando o seletor fecha", () => {
    const release = TOUR_STEPS.find((s) => s.id === "release-alt")!;
    expect(release.advanceOn).toBe("target-gone");
    expect(release.visual).toBe("release-alt");
    expect(release.text.toLowerCase()).toContain("solte o alt");
  });

  it("abrir a notch é uma tarefa que termina quando o overlay avisa que ela abriu", () => {
    const notch = TOUR_STEPS.find((s) => s.id === "notch")!;
    expect(notch.advanceOn).toBe("notch-open");
    expect(notch.task).toBeTruthy();
    expect(notch.scene).toBeFalsy();
  });
});

describe("tour: controle", () => {
  it("só os passos que dependem do controle somem quando a pessoa não tem um", () => {
    const connect = TOUR_STEPS.findIndex((s) => s.id === "controller-connect");
    const noController = (s: (typeof TOUR_STEPS)[number]) => Boolean(s.requiresController);
    const next = stepIndexFrom(connect + 1, 1, TOUR_STEPS, () => true, noController)!;
    expect(TOUR_STEPS[next].requiresController).toBeFalsy();
    expect(TOUR_STEPS[next].id).not.toBe("controller-move");
    // com controle, o passo seguinte é o do direcional
    expect(TOUR_STEPS[stepIndexFrom(connect + 1, 1, TOUR_STEPS, () => true)!].id).toBe("controller-move");
  });

  it("o passo de conectar vem antes dos que exigem controle e não exige um", () => {
    const ids = TOUR_STEPS.map((s) => s.id);
    const connect = ids.indexOf("controller-connect");
    expect(TOUR_STEPS[connect].requiresController).toBeFalsy();
    for (const s of TOUR_STEPS.filter((s) => s.requiresController)) expect(ids.indexOf(s.id)).toBeGreaterThan(connect);
  });

  it("segurar X para iniciar é prática com o controle (não um demo parado)", () => {
    const hold = TOUR_STEPS.find((s) => s.id === "controller-hold")!;
    expect(hold.advanceOn).toBe("practice");
    expect(hold.panel).toBe("controller-hold");
  });
});

describe("tour: progresso", () => {
  const noController = (s: (typeof TOUR_STEPS)[number]) => Boolean(s.requiresController);

  it("sem pular nada, a posição é a do passo na lista", () => {
    const last = TOUR_STEPS.length - 1;
    expect(progressOf(TOUR_STEPS, TOUR_STEPS[0].id)).toEqual({ index: 0, total: TOUR_STEPS.length });
    expect(progressOf(TOUR_STEPS, TOUR_STEPS[last].id)).toEqual({ index: last, total: TOUR_STEPS.length });
  });

  it("quem não tem controle não conta os passos dele: o último passo continua fechando a barra", () => {
    const skipped = TOUR_STEPS.filter(noController).length;
    expect(skipped).toBeGreaterThan(0);
    const last = progressOf(TOUR_STEPS, TOUR_STEPS[TOUR_STEPS.length - 1].id, noController);
    expect(last.total).toBe(TOUR_STEPS.length - skipped);
    expect(last.index).toBe(last.total - 1);
  });

  it("o passo atual sempre aparece, mesmo se estiver marcado como pulado", () => {
    expect(progressOf(TOUR_STEPS, "controller-move", noController).total).toBe(TOUR_STEPS.length - TOUR_STEPS.filter(noController).length + 1);
  });
});

describe("tour: simular novo usuário (dev)", () => {
  it("apaga o progresso e as marcas da conta e força o tutorial", async () => {
    const { resetOnboardingForUser } = await import("./tourSteps");
    const store = mem();
    store.setItem(tourKey("u1"), JSON.stringify({ step: 5, done: true }));
    store.setItem("checkpoint_onboarding_u1", "1");
    store.setItem("phelierium_welcome_modal_seen_u1", "true");
    store.setItem("checkpoint_onboarding_u2", "1");
    resetOnboardingForUser("u1", store);
    expect(store.getItem(tourKey("u1"))).toBeNull();
    expect(store.getItem("checkpoint_onboarding_u1")).toBeNull();
    expect(store.getItem("phelierium_welcome_modal_seen_u1")).toBeNull();
    expect(store.getItem(tourForceKey("u1"))).toBe("1");
    // outra conta não é afetada
    expect(store.getItem("checkpoint_onboarding_u2")).toBe("1");
  });
});
