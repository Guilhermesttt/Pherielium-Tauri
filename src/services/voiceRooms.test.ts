import { describe, expect, it } from "vitest";
import { friendlyRoomError } from "./voiceRooms";

describe("friendlyRoomError", () => {
  it("names the missing migration when the database still has the old 4-person constraint (23514)", () => {
    const pgMessage =
      'new row for relation "voice_rooms" violates check constraint "voice_rooms_max_participants_check"';
    expect(friendlyRoomError(pgMessage, "23514")).toContain("20261009140000_voice_rooms_max_participants");
  });

  it("also catches it by message when the driver doesn't surface a SQLSTATE code", () => {
    expect(
      friendlyRoomError('violates check constraint "voice_rooms_max_participants_check"', undefined),
    ).toContain("20261009140000_voice_rooms_max_participants");
  });

  it("still flags a missing RPC function (PGRST202) as an outdated database", () => {
    expect(friendlyRoomError("function does not exist", "PGRST202")).toBe(
      "O banco está desatualizado: aplique as migrations de sala de voz.",
    );
  });

  it("falls back to the raw message for anything it doesn't recognize", () => {
    expect(friendlyRoomError("algo bem específico deu errado", "XXYYY")).toBe(
      "algo bem específico deu errado",
    );
  });

  it("returns an empty string for no message at all", () => {
    expect(friendlyRoomError(undefined, undefined)).toBe("");
  });
});
