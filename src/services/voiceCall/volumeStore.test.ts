import { describe, expect, it } from "vitest";
import { loadVolumes, saveVolumes, VOLUME_STORAGE_KEY, type StorageLike } from "./volumeStore";

function memoryStorage(initial?: string): StorageLike & { data: Map<string, string> } {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set(VOLUME_STORAGE_KEY, initial);
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

describe("volumeStore", () => {
  it("round-trips volumes", () => {
    const storage = memoryStorage();
    expect(saveVolumes({ "voice:abc": 80, "screen:abc": 35 }, storage)).toEqual({ ok: true });
    expect(loadVolumes(storage)).toEqual({ "voice:abc": 80, "screen:abc": 35 });
  });

  it("uses the versioned key", () => {
    expect(VOLUME_STORAGE_KEY).toBe("pherielium:volumes:v1");
  });

  it("returns empty for empty storage, corrupted JSON and wrong shapes", () => {
    expect(loadVolumes(memoryStorage())).toEqual({});
    expect(loadVolumes(memoryStorage("{not json"))).toEqual({});
    expect(loadVolumes(memoryStorage("[1,2]"))).toEqual({});
    expect(loadVolumes(memoryStorage("null"))).toEqual({});
  });

  it("drops invalid entries and clamps to [0, 200]", () => {
    const storage = memoryStorage(
      JSON.stringify({ "voice:a": 999, "voice:b": -4, "screen:c": "loud", "other:d": 50, "screen:e": 33.4 }),
    );
    expect(loadVolumes(storage)).toEqual({ "voice:a": 200, "voice:b": 0, "screen:e": 33 });
  });

  it("does not throw when reading fails", () => {
    const broken: StorageLike = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => undefined,
    };
    expect(loadVolumes(broken)).toEqual({});
  });

  it("reports quota errors instead of throwing", () => {
    const full: StorageLike = {
      getItem: () => null,
      setItem: () => {
        throw new Error("QuotaExceededError");
      },
    };
    expect(saveVolumes({ "voice:a": 10 }, full)).toEqual({ ok: false, reason: "quota" });
  });

  it("reports unavailable storage", () => {
    expect(loadVolumes(null)).toEqual({});
    expect(saveVolumes({}, null)).toEqual({ ok: false, reason: "unavailable" });
  });
});
