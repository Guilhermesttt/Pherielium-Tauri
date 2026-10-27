import { beforeEach, describe, expect, it, vi } from "vitest";

const rpc = vi.fn();
vi.mock("./supabase", () => ({ supabase: { rpc: (...args: unknown[]) => rpc(...args), auth: {}, from: vi.fn() } }));

import { MATCH_DISCORD_BATCH_SIZE, matchDiscordFriends, parseMatchRows } from "./discordFriendMatch";

beforeEach(() => rpc.mockReset());

describe("parseMatchRows", () => {
  it("converte linhas válidas e descarta as malformadas", () => {
    expect(
      parseMatchRows([
        { uid: "u1", discord_id: "1", display_name: "Ana", photo_url: "p.png" },
        { uid: "u2", discord_id: "2", display_name: null, photo_url: null },
        { uid: 3, discord_id: "3" },
        null,
      ]),
    ).toEqual([
      { uid: "u1", discordId: "1", displayName: "Ana", photoURL: "p.png" },
      { uid: "u2", discordId: "2", displayName: null, photoURL: null },
    ]);
    expect(parseMatchRows(undefined)).toEqual([]);
  });
});

describe("matchDiscordFriends", () => {
  it("divide em lotes do tamanho que o RPC aceita e remove duplicados", async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    const ids = Array.from({ length: MATCH_DISCORD_BATCH_SIZE + 5 }, (_, i) => String(i));
    await matchDiscordFriends([...ids, "0"]);
    expect(rpc).toHaveBeenCalledTimes(2);
    expect(rpc.mock.calls[0][1].p_discord_ids).toHaveLength(MATCH_DISCORD_BATCH_SIZE);
    expect(rpc.mock.calls[1][1].p_discord_ids).toHaveLength(5);
  });

  it("não chama o RPC sem ids e propaga erro do servidor", async () => {
    expect(await matchDiscordFriends([])).toEqual([]);
    expect(rpc).not.toHaveBeenCalled();
    rpc.mockResolvedValue({ data: null, error: new Error("boom") });
    await expect(matchDiscordFriends(["1"])).rejects.toThrow("boom");
  });
});
