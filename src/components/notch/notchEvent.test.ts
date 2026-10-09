import { describe, expect, it } from "vitest";
import {
  NOTCH_EVENT_QUEUE_MAX,
  enqueueNotchEvent,
  notchEventDuration,
  notchEventSubtitle,
  notchEventWaves,
  parseNotchEvent,
  type NotchEvent,
} from "./notchEvent";

const ev = (over: Partial<NotchEvent>): NotchEvent => ({
  id: Math.random().toString(36),
  kind: "message",
  title: "Ana",
  at: 0,
  ...over,
});

describe("parseNotchEvent", () => {
  it("aceita um evento válido e limpa campos", () => {
    const e = parseNotchEvent({ kind: "achievement", title: "  Platina  ", tier: "platinum", id: "x", at: 5 });
    expect(e).toMatchObject({ kind: "achievement", title: "Platina", tier: "platinum", id: "x", at: 5 });
  });

  it("aceita o evento de boas-vindas e a Pherie acena nele", () => {
    expect(parseNotchEvent({ kind: "welcome", title: "Divirta-se" })?.kind).toBe("welcome");
    expect(notchEventWaves("welcome")).toBe(true);
    expect(notchEventWaves("message")).toBe(false);
  });

  it("rejeita tipo desconhecido, sem título e não-objeto", () => {
    expect(parseNotchEvent(null)).toBeNull();
    expect(parseNotchEvent({ kind: "poof", title: "x" })).toBeNull();
    expect(parseNotchEvent({ kind: "message", title: "   " })).toBeNull();
  });

  it("ignora tier inválido e limita a contagem", () => {
    const e = parseNotchEvent({ kind: "message", title: "x", tier: "diamante", count: 500 });
    expect(e?.tier).toBeUndefined();
    expect(e?.count).toBe(99);
  });
});

describe("enqueueNotchEvent", () => {
  it("não repete o mesmo id (CustomEvent + Tauri emit na mesma janela)", () => {
    const a = ev({ id: "1" });
    expect(enqueueNotchEvent([a], { ...a })).toHaveLength(1);
  });

  it("agrupa mensagens do mesmo amigo numa só barra com contagem", () => {
    let q: NotchEvent[] = [];
    q = enqueueNotchEvent(q, ev({ friendId: "f1", subtitle: "oi" }));
    q = enqueueNotchEvent(q, ev({ friendId: "f1", subtitle: "tá aí?" }));
    q = enqueueNotchEvent(q, ev({ friendId: "f1", subtitle: "ei" }));
    expect(q).toHaveLength(1);
    expect(q[0].count).toBe(3);
    expect(q[0].subtitle).toBe("ei");
    expect(notchEventSubtitle(q[0])).toBe("3 mensagens novas");
  });

  it("amigos diferentes ficam em fila", () => {
    let q: NotchEvent[] = [];
    q = enqueueNotchEvent(q, ev({ friendId: "f1" }));
    q = enqueueNotchEvent(q, ev({ friendId: "f2" }));
    expect(q).toHaveLength(2);
  });

  it("limita a fila preservando a barra atual", () => {
    let q: NotchEvent[] = [];
    for (let i = 0; i < 9; i++) q = enqueueNotchEvent(q, ev({ id: `e${i}`, kind: "friend-request" }));
    expect(q).toHaveLength(NOTCH_EVENT_QUEUE_MAX);
    expect(q[0].id).toBe("e0");
    expect(q[q.length - 1].id).toBe("e8");
  });
});

describe("duração", () => {
  it("pedido de amizade fica mais tempo (dá para ler e agir)", () => {
    expect(notchEventDuration("friend-request")).toBeGreaterThan(notchEventDuration("message"));
  });
});

import { TIER_STYLES, achievementBoxShadow, sparkPositions } from "./achievementTier";
import { notchEventIsExpanded } from "./notchEvent";

describe("conquista no notch", () => {
  it("conquista abre o notch inteiro; os outros eventos ficam na barra", () => {
    expect(notchEventIsExpanded("achievement")).toBe(true);
    expect(notchEventIsExpanded("message")).toBe(false);
  });

  it("todos os tiers ficam o mesmo tempo; quanto mais raro, mais faíscas", () => {
    const order = ["iron", "bronze", "silver", "gold", "platinum"] as const;
    for (const t of order) expect(notchEventDuration("achievement", t)).toBe(TIER_STYLES.iron.durationMs);
    for (let i = 1; i < order.length; i++) {
      expect(TIER_STYLES[order[i]].sparks).toBeGreaterThanOrEqual(TIER_STYLES[order[i - 1]].sparks);
    }
  });

  it("cada tier tem um efeito diferente entre ouro e platina", () => {
    expect(TIER_STYLES.gold.effect).not.toBe(TIER_STYLES.platinum.effect);
    expect(TIER_STYLES.platinum.pulses).toBeGreaterThan(TIER_STYLES.gold.pulses);
  });

  it("o aro estático tem 4 camadas (a mola interpola) e usa a cor do tier", () => {
    const shadow = achievementBoxShadow("gold");
    expect(shadow.split("), ").length + shadow.split("0 0 0 0 rgba(0,0,0,0)").length - 1).toBeGreaterThanOrEqual(4);
    expect(shadow).toContain(TIER_STYLES.gold.rgb);
  });

  it("faíscas são determinísticas", () => {
    expect(sparkPositions(5)).toEqual(sparkPositions(5));
    expect(sparkPositions(0)).toEqual([]);
  });

  it("aceita descrição, jogo e XP da conquista", () => {
    const e = parseNotchEvent({ kind: "achievement", title: "x", description: "d", gameTitle: "g", xp: 60.4, tier: "gold" });
    expect(e).toMatchObject({ description: "d", gameTitle: "g", xp: 60, tier: "gold" });
  });
});

describe("novos eventos da ilha", () => {
  it("amigo entrou e captura salva são aceitos, têm duração e o amigo acena", () => {
    expect(parseNotchEvent({ kind: "friend-online", title: "Ana entrou", id: "a", at: 1 })).toMatchObject({ kind: "friend-online" });
    expect(parseNotchEvent({ kind: "capture-saved", title: "Captura salva", id: "b", at: 1 })).toMatchObject({ kind: "capture-saved" });
    expect(notchEventDuration("friend-online")).toBeGreaterThan(0);
    expect(notchEventDuration("capture-saved")).toBeGreaterThan(0);
    expect(notchEventWaves("friend-online")).toBe(true);
    expect(notchEventWaves("capture-saved")).toBe(false);
  });
});
