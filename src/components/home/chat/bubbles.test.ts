import { describe, expect, it } from "vitest";
import { GROUP_GAP_MS, bubbleFrom, groupInfo, messageSignature } from "./bubbles";

const at = (ms: number) => new Date(Date.UTC(2026, 9, 9, 12, 0, 0) + ms).toISOString();
const m = (senderId: string, ms: number) => ({ senderId, createdAt: at(ms) });

describe("groupInfo", () => {
  it("mensagens seguidas do mesmo autor formam um bloco", () => {
    const list = [m("a", 0), m("a", 10_000), m("a", 20_000)];
    expect(groupInfo(list, 0)).toEqual({ startsGroup: true, endsGroup: false });
    expect(groupInfo(list, 1)).toEqual({ startsGroup: false, endsGroup: false });
    expect(groupInfo(list, 2)).toEqual({ startsGroup: false, endsGroup: true });
  });

  it("trocar de autor quebra o bloco", () => {
    const list = [m("a", 0), m("b", 5_000), m("a", 9_000)];
    expect(groupInfo(list, 0)).toEqual({ startsGroup: true, endsGroup: true });
    expect(groupInfo(list, 1)).toEqual({ startsGroup: true, endsGroup: true });
    expect(groupInfo(list, 2)).toEqual({ startsGroup: true, endsGroup: true });
  });

  it("pausa longa quebra o bloco", () => {
    const list = [m("a", 0), m("a", GROUP_GAP_MS + 1)];
    expect(groupInfo(list, 0).endsGroup).toBe(true);
    expect(groupInfo(list, 1).startsGroup).toBe(true);
  });

  it("virar o dia quebra o bloco", () => {
    const list = [
      { senderId: "a", createdAt: new Date(2026, 9, 9, 23, 59, 30) },
      { senderId: "a", createdAt: new Date(2026, 9, 10, 0, 0, 10) },
    ];
    expect(groupInfo(list, 0).endsGroup).toBe(true);
  });

  it("mensagem única começa e termina o bloco", () => {
    expect(groupInfo([m("a", 0)], 0)).toEqual({ startsGroup: true, endsGroup: true });
  });
});

describe("física dos balões", () => {
  it("o balão enviado sai de mais baixo e mais para a direita que o recebido", () => {
    const sent = bubbleFrom(true);
    const received = bubbleFrom(false);
    expect(sent.y).toBeGreaterThan(received.y);
    expect(sent.x).toBeGreaterThan(0);
    expect(received.x).toBeLessThan(0);
    expect(sent.opacity).toBe(0);
  });

  it("a assinatura ignora o id (o mesmo balão com id novo não anima de novo)", () => {
    expect(messageSignature({ senderId: "a", text: "oi" })).toBe(messageSignature({ senderId: "a", text: "oi", attachmentUrl: null }));
    expect(messageSignature({ senderId: "a", text: "oi" })).not.toBe(messageSignature({ senderId: "b", text: "oi" }));
  });
});
