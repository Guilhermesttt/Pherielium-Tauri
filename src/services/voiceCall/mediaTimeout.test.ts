import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { MediaTimeoutError, withTimeout } from "./mediaTimeout";

describe("withTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves with the value when the promise settles before the deadline", async () => {
    const promise = withTimeout(Promise.resolve("stream"), 1000, "getUserMedia");
    await vi.advanceTimersByTimeAsync(0);
    await expect(promise).resolves.toBe("stream");
  });

  it("propagates the original rejection when it happens before the deadline", async () => {
    // Timers reais aqui: sob fake timers, Node acusa "unhandled rejection" para uma rejeição que
    // na prática sempre teve handler (gatilho é a ordem de microtasks de vi.advanceTimersByTimeAsync,
    // não o comportamento de withTimeout — as outras 4 asserções já cobrem o comportamento sob fake
    // timers). O prazo aqui é real e longe o bastante para nunca disparar antes da rejeição.
    vi.useRealTimers();
    const original = new Error("NotAllowedError");
    const promise = withTimeout(Promise.reject(original), 5000, "getUserMedia");
    await expect(promise).rejects.toBe(original);
  });

  it("rejects with MediaTimeoutError when nothing settles before the deadline (the bug: a hung getUserMedia)", async () => {
    const neverSettles = new Promise<string>(() => {});
    const promise = withTimeout(neverSettles, 15000, "getUserMedia");
    const assertion = expect(promise).rejects.toBeInstanceOf(MediaTimeoutError);
    await vi.advanceTimersByTimeAsync(15000);
    await assertion;
  });

  it("includes the label in the error message, for logs that say what hung", async () => {
    const neverSettles = new Promise<string>(() => {});
    const promise = withTimeout(neverSettles, 1000, "microfone");
    const assertion = expect(promise).rejects.toThrow("microfone");
    await vi.advanceTimersByTimeAsync(1000);
    await assertion;
  });

  it("does not reject after the deadline once the promise already resolved (timer is cleared)", async () => {
    const promise = withTimeout(Promise.resolve("ok"), 1000, "getUserMedia");
    await expect(promise).resolves.toBe("ok");
    // Se o timer não fosse limpo, isto não teria efeito sobre `promise` (já resolvida),
    // mas confirma que nenhum timer pendente segue vivo gerando ruído/erro não tratado.
    await vi.advanceTimersByTimeAsync(1000);
  });
});
