import { beforeEach, describe, expect, it } from "vitest";
import {
  getPeerProtocol,
  recordPeerProtocol,
  resetPeerProtocolForTests,
  shouldUseTextFastPath,
  type PeerStorage,
} from "./peerProtocol";

function memoryStorage(initial?: string): PeerStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set("pherielium_peer_protocol_v1", initial);
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

describe("peerProtocol", () => {
  beforeEach(() => resetPeerProtocolForTests());

  it("returns null for unknown peers", () => {
    expect(getPeerProtocol("u1", 1000, memoryStorage())).toBeNull();
  });

  it("remembers a recorded protocol and persists it", () => {
    const storage = memoryStorage();
    recordPeerProtocol("u1", 2, 1000, storage);
    expect(getPeerProtocol("u1", 2000, storage)).toBe(2);
    expect(storage.data.get("pherielium_peer_protocol_v1")).toContain("u1");
  });

  it("expires entries after 14 days", () => {
    const storage = memoryStorage();
    recordPeerProtocol("u1", 2, 0, storage);
    expect(getPeerProtocol("u1", 14 * 24 * 60 * 60 * 1000 + 1, storage)).toBeNull();
  });

  it("ignores invalid protocol values", () => {
    const storage = memoryStorage();
    for (const bad of [undefined, "2", 0, -1, 1.5, 100, Number.NaN]) recordPeerProtocol("u1", bad, 1000, storage);
    expect(getPeerProtocol("u1", 1000, storage)).toBeNull();
  });

  it("loads a saved cache and tolerates a corrupted one", () => {
    const saved = memoryStorage(JSON.stringify({ u9: { pv: 2, at: 500 } }));
    expect(getPeerProtocol("u9", 1000, saved)).toBe(2);
    resetPeerProtocolForTests();
    expect(getPeerProtocol("u9", 1000, memoryStorage("{broken"))).toBeNull();
  });
});

describe("shouldUseTextFastPath", () => {
  it.each([
    [null, true, true], // desconhecido: payload completo (compatível com o app antigo)
    [1, true, true],
    [2, true, false], // par v2: sem texto no broadcast
    [3, true, false],
    [2, false, true], // flag desligada: comportamento antigo
  ])("peer=%s pingOnly=%s -> textFastPath=%s", (peer, flag, expected) => {
    expect(shouldUseTextFastPath(peer, flag)).toBe(expected);
  });
});
