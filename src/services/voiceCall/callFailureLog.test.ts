import { describe, expect, it } from "vitest";
import { appendFailure, formatFailures, loadFailures, saveFailures, type FailureStorage } from "./callFailureLog";

const memory = (initial?: string): FailureStorage & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set("pherielium_call_failures_v1", initial);
  return { data, getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
};

describe("callFailureLog", () => {
  it("appends entries with a short chat id and keeps only the last 20", () => {
    let list = appendFailure([], { role: "caller", reason: "token_timeout", attempts: 3, chatId: "05f2b9c9-cb97_xxxx", now: 1 });
    expect(list[0].chat).toBe("05f2");
    for (let i = 0; i < 30; i += 1) list = appendFailure(list, { role: "callee", reason: "network", attempts: 2, chatId: "abcd", now: i });
    expect(list).toHaveLength(20);
  });

  it("round-trips through storage and tolerates corruption", () => {
    const storage = memory();
    saveFailures(storage, appendFailure([], { role: "caller", reason: "network", attempts: 3, chatId: "abcd", now: 5 }));
    expect(loadFailures(storage)).toHaveLength(1);
    expect(loadFailures(memory("{broken"))).toEqual([]);
    expect(loadFailures(memory('{"not":"an array"}'))).toEqual([]);
    expect(loadFailures(null)).toEqual([]);
  });

  it("formats a pasteable report without tokens or full ids", () => {
    const text = formatFailures(
      appendFailure([], { role: "caller", reason: "token_unauthorized", attempts: 1, chatId: "05f2b9c9-cb97", now: 1000 }),
      "1.0.3-rc.1",
    );
    expect(text).toContain("app=1.0.3-rc.1 entries=1");
    expect(text).toContain("caller reason=token_unauthorized attempts=1 chat=05f2");
    expect(text).not.toContain("05f2b9c9");
    expect(formatFailures([], "x")).toContain("nenhuma falha");
  });
});
