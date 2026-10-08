import { describe, expect, it } from "vitest";
import {
  NOTCH_EVENT_QUEUE_MAX,
  enqueueNotchEvent,
  notchEventDuration,
  notchEventSubtitle,
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
