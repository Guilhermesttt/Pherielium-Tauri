import { beforeEach, describe, expect, it, vi } from "vitest";

type Handler = (event: { payload: unknown }) => void;

const registered: Array<{ handler: Handler; unlisten: ReturnType<typeof vi.fn>; resolve: () => void }> = [];

vi.mock("@tauri-apps/api/event", () => ({
  // listen() só resolve quando o teste mandar (simula o IPC assíncrono do Tauri)
  listen: (_event: string, handler: Handler) =>
    new Promise<() => void>((resolveListen) => {
      const unlisten = vi.fn();
      registered.push({ handler, unlisten, resolve: () => resolveListen(unlisten) });
    }),
}));

import { makeListen } from "./tauriListen";

const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  registered.length = 0;
});

describe("makeListen", () => {
  it("entrega eventos ao callback e desfaz o listener no cleanup", async () => {
    const cb = vi.fn();
    const stop = makeListen<string>("overlay:panel-action", cb);
    registered[0].resolve();
    await flush();

    registered[0].handler({ payload: "voice-mute" });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith("voice-mute");

    stop();
    expect(registered[0].unlisten).toHaveBeenCalledTimes(1);
  });

  it("cleanup ANTES do listen() resolver não vaza o listener (bug do mute duplicado)", async () => {
    const cb = vi.fn();
    const stop = makeListen<string>("overlay:panel-action", cb);
    // StrictMode / re-registro: o efeito é desmontado antes de listen() resolver
    stop();
    registered[0].resolve();
    await flush();

    // o listener recém-resolvido é desfeito na hora...
    expect(registered[0].unlisten).toHaveBeenCalledTimes(1);
    // ...e, mesmo que ainda receba um evento, o callback não roda
    registered[0].handler({ payload: "voice-mute" });
    expect(cb).not.toHaveBeenCalled();
  });

  it("montar duas vezes (StrictMode) deixa só UM listener ativo: uma ação = um callback", async () => {
    const cb = vi.fn();
    const stopFirst = makeListen<string>("overlay:panel-action", cb);
    stopFirst(); // desmonta antes de resolver
    makeListen<string>("overlay:panel-action", cb); // remonta
    registered[0].resolve();
    registered[1].resolve();
    await flush();

    for (const r of registered) r.handler({ payload: "voice-mute" });
    expect(cb).toHaveBeenCalledTimes(1);
  });

  it("cleanup duplicado é inofensivo", async () => {
    const stop = makeListen("evt", () => undefined);
    registered[0].resolve();
    await flush();
    stop();
    stop();
    expect(registered[0].unlisten).toHaveBeenCalledTimes(1);
  });
});
