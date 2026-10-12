import { describe, expect, it } from "vitest";
import { findDoublePlayback, type ElementInfo } from "./audioInventory";
import { applySinkId, desiredSinkId, effectiveVideoMuted, type MediaTransport } from "./feedAudioPolicy";

describe("effectiveVideoMuted", () => {
  it.each([
    // [pedido do chamador, transporte, esperado]
    [false, "livekit", true], // regressão: <video> remoto tocava a mesma trilha do <audio> do slider
    [true, "livekit", true],
    [false, "p2p", false], // P2P: comportamento anterior (o <video> é quem toca)
    [false, "echo", false],
    [false, "none", true], // antes de o transporte ser marcado, as primeiras trilhas LiveKit já podem existir
    [true, "p2p", true], // feed local continua mutado
  ] as Array<[boolean, MediaTransport, boolean]>)("requested=%s transport=%s -> muted=%s", (requested, transport, expected) => {
    expect(effectiveVideoMuted(requested, transport)).toBe(expected);
  });
});

describe("invariante: no máximo um elemento audível por trilha", () => {
  const audioElement = (trackId: string, volume: number): ElementInfo => ({
    tag: "audio",
    origin: "livekit",
    label: "screen_share_audio abcd",
    volume,
    muted: false,
    paused: false,
    audioTrackIds: [trackId],
    videoTrackCount: 0,
    sinkId: "",
  });
  const videoElement = (trackId: string, transport: MediaTransport): ElementInfo => ({
    tag: "video",
    origin: "dom",
    label: "stage",
    volume: 1,
    muted: effectiveVideoMuted(false, transport),
    paused: false,
    audioTrackIds: [trackId],
    videoTrackCount: 1,
    sinkId: "",
  });

  it("LiveKit: o <audio> do slider e o <video> do palco não tocam a mesma trilha ao mesmo tempo", () => {
    const elements = [audioElement("screen-audio", 0.2), videoElement("screen-audio", "livekit")];
    expect(findDoublePlayback(elements)).toEqual([]);
  });

  it("sem a regra (transporte tratado como não-LiveKit) o duplo aparece, o que o teste anterior impede", () => {
    const elements = [audioElement("screen-audio", 0.2), videoElement("screen-audio", "p2p")];
    expect(findDoublePlayback(elements)).toHaveLength(1);
  });

  it("voz com câmera ligada: <audio> da voz + <video> da câmera/miniatura/tela cheia = um só audível", () => {
    const elements = [
      audioElement("voice", 1),
      videoElement("voice", "livekit"), // câmera no palco
      videoElement("voice", "livekit"), // miniatura
      videoElement("voice", "livekit"), // tela cheia
    ];
    expect(findDoublePlayback(elements)).toEqual([]);
  });
});

describe("desiredSinkId / applySinkId", () => {
  it("maps default and empty to the system default", () => {
    expect(desiredSinkId("default")).toBe("");
    expect(desiredSinkId("")).toBe("");
    expect(desiredSinkId(undefined)).toBe("");
    expect(desiredSinkId("dev-a")).toBe("dev-a");
  });

  it("sets the chosen device, skips when unchanged and reverts to the default", () => {
    const calls: string[] = [];
    const element = { sinkId: "", setSinkId: async (id: string) => void calls.push(id) };
    applySinkId(element, "dev-a");
    expect(calls).toEqual(["dev-a"]);
    applySinkId({ ...element, sinkId: "dev-a" }, "dev-a");
    expect(calls).toEqual(["dev-a"]); // sem mudança: não chama de novo
    applySinkId({ ...element, sinkId: "dev-a" }, "default"); // regressão: voltar ao padrão
    expect(calls).toEqual(["dev-a", ""]);
  });

  it("ignores elements without setSinkId", () => {
    expect(() => applySinkId({}, "dev-a")).not.toThrow();
  });
});
