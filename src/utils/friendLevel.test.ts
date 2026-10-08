import { describe, expect, it } from "vitest";
import { friendLevelFromProfile } from "./friendLevel";
import type { UserProfile } from "../types/domain";

const profile = (extra: Record<string, unknown>) => ({ uid: "u", displayName: "x", ...extra }) as unknown as UserProfile;

describe("friendLevelFromProfile", () => {
  it("sem perfil ou sem nível devolve null", () => {
    expect(friendLevelFromProfile(null)).toBeNull();
    expect(friendLevelFromProfile(profile({}))).toBeNull();
    expect(friendLevelFromProfile(profile({ level: 0 }))).toBeNull();
  });

  it("usa o nível bruto do perfil quando não há XP", () => {
    const l = friendLevelFromProfile(profile({ level: 12 }));
    expect(l?.level).toBe(12);
    expect(l?.rank).toBeTruthy();
  });

  it("prefere o XP total quando existe", () => {
    const l = friendLevelFromProfile(profile({ level: 2, levelProgress: { total_xp: 5000 } }));
    expect(l?.xp).toBeGreaterThan(0);
    expect(l?.level).toBeGreaterThan(2);
  });
});
