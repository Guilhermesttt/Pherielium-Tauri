import { describe, expect, it } from "vitest";
import { LIVE_WIDTH, resolveLiveActivity, type LiveState } from "./liveActivity";

const none: LiveState = { incomingCall: false, callActive: false, event: false, controllerFlash: false, gameActive: false, musicPlaying: false };
const kind = (patch: Partial<LiveState>) => resolveLiveActivity({ ...none, ...patch });

describe("liveActivity", () => {
  it("ocioso quando nada acontece", () => {
    expect(kind({})).toBe("idle");
  });

  it("chamada recebida vence tudo", () => {
    expect(kind({ incomingCall: true, callActive: true, event: true, controllerFlash: true, gameActive: true, musicPlaying: true })).toBe("call-incoming");
  });

  it("aviso de controle e evento passam na frente da chamada em andamento", () => {
    expect(kind({ controllerFlash: true, callActive: true })).toBe("controller");
    expect(kind({ event: true, callActive: true })).toBe("event");
  });

  it("chamada em andamento vence jogo e música; jogo vence música", () => {
    expect(kind({ callActive: true, gameActive: true, musicPlaying: true })).toBe("call");
    expect(kind({ gameActive: true, musicPlaying: true })).toBe("game");
    expect(kind({ musicPlaying: true })).toBe("music");
  });

  it("a chamada recebida é a barra mais larga", () => {
    expect(LIVE_WIDTH["call-incoming"]).toBe(Math.max(...Object.values(LIVE_WIDTH)));
  });
});
