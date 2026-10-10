import { describe, expect, it } from "vitest";
import {
  AUTO_SYNC_MIN_INTERVAL_MS,
  isSyncDue,
  lastSyncKey,
  platformOfGame,
  readLastSync,
  writeLastSync,
} from "./autoLibrarySync";

const mem = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
};

describe("autoLibrarySync", () => {
  it("só sincroniza depois do intervalo mínimo", () => {
    expect(isSyncDue(5_000, 6_000, AUTO_SYNC_MIN_INTERVAL_MS)).toBe(false);
    expect(isSyncDue(1_000, 1_000 + AUTO_SYNC_MIN_INTERVAL_MS - 1, AUTO_SYNC_MIN_INTERVAL_MS)).toBe(false);
    expect(isSyncDue(1_000, 1_000 + AUTO_SYNC_MIN_INTERVAL_MS, AUTO_SYNC_MIN_INTERVAL_MS)).toBe(true);
  });

  it("nunca sincronizado conta como vencido", () => {
    const s = mem();
    expect(readLastSync("u", "steam", s)).toBe(0);
    expect(isSyncDue(readLastSync("u", "steam", s), Date.now(), AUTO_SYNC_MIN_INTERVAL_MS)).toBe(true);
  });

  it("guarda por usuário e plataforma", () => {
    const s = mem();
    writeLastSync("u", "steam", 123, s);
    expect(readLastSync("u", "steam", s)).toBe(123);
    expect(readLastSync("u", "epic", s)).toBe(0);
    expect(readLastSync("outro", "steam", s)).toBe(0);
    expect(lastSyncKey("u", "epic")).toBe("pherielium_last_sync:epic:u");
  });

  it("descobre a plataforma do jogo", () => {
    expect(platformOfGame({ launcherType: "steam" })).toBe("steam");
    expect(platformOfGame({ launcherType: "local", steamAppId: "123" })).toBe("steam");
    expect(platformOfGame({ launcherType: "epic" })).toBe("epic");
    expect(platformOfGame({ epicCatalogId: "ns:item" })).toBe("epic");
    expect(platformOfGame({ launcherType: "local" })).toBeNull();
  });
});
