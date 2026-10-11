import { beforeEach, describe, expect, it, vi } from "vitest";

const mockApiFetch = vi.fn();
const mockFrom = vi.fn();

vi.mock("./api", () => ({
  apiFetch: (...args: unknown[]) => mockApiFetch(...args),
  apiUrl: (path: string) => `http://api.test${path}`,
  getUsableSession: vi.fn().mockResolvedValue({ user: { id: "me" }, access_token: "t" }),
}));
vi.mock("./supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null } }),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  },
}));
vi.mock("./realtimeEventBus", () => ({
  broadcastPresenceStatus: vi.fn(),
  getPresenceAudienceUids: () => [],
}));
vi.mock("./steam", () => ({ fetchSteamLibrary: vi.fn().mockResolvedValue([]) }));

import { getCheckpointFriendProfile } from "./checkpointFriends";

/** `profiles` (fallback) e `public_profiles` (enriquecimento) atendidas por nome. */
function wireTables(opts: { profiles?: unknown; publicProfiles?: unknown }) {
  mockFrom.mockImplementation((table: string) => {
    const row = table === "public_profiles" ? opts.publicProfiles : opts.profiles;
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue({ data: [], error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: row ?? null, error: null }),
    };
    return query;
  });
}

const apiReturns = (profile: unknown) => {
  mockApiFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ profile, games: [{ id: "g1", title: "Jogo" }] }),
  });
};

describe("getCheckpointFriendProfile — banner de outra pessoa", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wireTables({});
  });

  it("aceita banner_url em snake_case vindo da API", async () => {
    apiReturns({ uid: "amigo", display_name: "Omearanha", banner_url: "https://cdn/b.png" });
    const { profile } = await getCheckpointFriendProfile("amigo");
    expect(profile.bannerURL).toBe("https://cdn/b.png");
    expect(profile.displayName).toBe("Omearanha");
  });

  it("completa pelo public_profiles quando a API não conhece a coluna", async () => {
    apiReturns({ uid: "amigo", displayName: "Omearanha" }); // API antiga, sem banner
    wireTables({ publicProfiles: { uid: "amigo", banner_url: "https://cdn/pp.png" } });
    const { profile } = await getCheckpointFriendProfile("amigo");
    expect(profile.bannerURL).toBe("https://cdn/pp.png");
  });

  it("não sobrescreve o banner que a API já mandou certo", async () => {
    apiReturns({ uid: "amigo", displayName: "Omearanha", bannerURL: "https://cdn/api.png" });
    wireTables({ publicProfiles: { uid: "amigo", banner_url: "https://cdn/pp.png" } });
    const { profile } = await getCheckpointFriendProfile("amigo");
    expect(profile.bannerURL).toBe("https://cdn/api.png");
  });
});
