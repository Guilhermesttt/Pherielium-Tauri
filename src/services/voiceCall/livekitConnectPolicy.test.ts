import { describe, expect, it, vi } from "vitest";
import {
  classifyLiveKitError,
  ConnectCancelledError,
  connectWithRetry,
  describeLiveKitFailure,
  isRetryableReason,
  LiveKitConnectError,
} from "./livekitConnectPolicy";

const named = (name: string, message = ""): Error => {
  const error = new Error(message);
  error.name = name;
  return error;
};

describe("classifyLiveKitError", () => {
  it.each([
    [new Error("Token de autenticacao invalido."), "token_unauthorized"],
    [named("AuthRequiredError", "Sessao de autenticacao necessaria."), "token_unauthorized"],
    [named("RequestTimeoutError", "A requisicao excedeu 15000ms."), "token_timeout"],
    [new Error("LiveKit não habilitado no backend. Usando WebRTC P2P."), "livekit_disabled"],
    [new Error("Identificador de sala inválido: x_y"), "room_invalid"],
    [new TypeError("Failed to fetch"), "network"],
    [new Error("could not establish signal connection: timeout"), "token_timeout"],
    [new Error("algo inesperado do livekit"), "media_error"],
  ])("%s -> %s", (error, expected) => {
    expect(classifyLiveKitError(error)).toBe(expected);
  });
});

describe("isRetryableReason", () => {
  it("does not retry deliberate refusals", () => {
    expect(isRetryableReason("token_unauthorized")).toBe(false);
    expect(isRetryableReason("room_invalid")).toBe(false);
    expect(isRetryableReason("livekit_disabled")).toBe(false);
    expect(isRetryableReason("token_timeout")).toBe(true);
    expect(isRetryableReason("network")).toBe(true);
    expect(isRetryableReason("media_error")).toBe(true);
  });
});

describe("connectWithRetry", () => {
  it("returns on the first success without waiting", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    await expect(connectWithRetry(async () => "ok", { sleep })).resolves.toBe("ok");
    expect(sleep).not.toHaveBeenCalled();
  });

  it("retries transient failures with backoff and then succeeds", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    const run = vi.fn<(attempt: number) => Promise<string>>()
      .mockRejectedValueOnce(named("RequestTimeoutError", "timeout"))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce("connected");
    await expect(connectWithRetry(run, { sleep })).resolves.toBe("connected");
    expect(run).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map((c) => c[0])).toEqual([1000, 2000]);
  });

  it("gives up after 3 attempts with a typed error carrying the reason and attempts", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    const run = vi.fn(async () => {
      throw named("RequestTimeoutError", "timeout");
    });
    const error = await connectWithRetry(run, { sleep }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LiveKitConnectError);
    expect((error as LiveKitConnectError).reason).toBe("token_timeout");
    expect((error as LiveKitConnectError).attempts).toBe(3);
    expect(run).toHaveBeenCalledTimes(3);
  });

  it("stops immediately on a non-retryable failure", async () => {
    const sleep = vi.fn<(ms: number) => Promise<void>>().mockResolvedValue(undefined);
    const run = vi.fn(async () => {
      throw new Error("Token de autenticacao invalido.");
    });
    const error = (await connectWithRetry(run, { sleep }).catch((e: unknown) => e)) as LiveKitConnectError;
    expect(error.reason).toBe("token_unauthorized");
    expect(error.attempts).toBe(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  it("reports each retry through onRetry", async () => {
    const onRetry = vi.fn();
    const run = vi.fn<(attempt: number) => Promise<string>>()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce("ok");
    await connectWithRetry(run, { sleep: async () => undefined, onRetry });
    expect(onRetry).toHaveBeenCalledWith({ attempt: 1, reason: "network", waitMs: 1000 });
  });
});

describe("connectWithRetry cancellation", () => {
  it("stops retrying when the call was ended meanwhile", async () => {
    let cancelled = false;
    const run = vi.fn(async () => {
      cancelled = true; // o usuário desligou durante a 1ª tentativa
      throw new TypeError("Failed to fetch");
    });
    const error = await connectWithRetry(run, { isCancelled: () => cancelled, sleep: async () => undefined }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ConnectCancelledError);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("does not even start when already cancelled", async () => {
    const run = vi.fn(async () => "x");
    await expect(connectWithRetry(run, { isCancelled: () => true })).rejects.toBeInstanceOf(ConnectCancelledError);
    expect(run).not.toHaveBeenCalled();
  });
});

describe("describeLiveKitFailure", () => {
  it("has a message for every reason", () => {
    for (const reason of ["livekit_disabled", "token_unauthorized", "token_timeout", "network", "room_invalid", "media_error"] as const) {
      expect(describeLiveKitFailure(reason).length).toBeGreaterThan(10);
    }
  });
});
