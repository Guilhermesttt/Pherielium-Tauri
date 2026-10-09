import { describe, expect, it } from "vitest";
import { dataUrlToBlob, validateRoomMedia } from "./voiceRoomMedia";

describe("voiceRoomMedia", () => {
  it("valida tipo e tamanho", () => {
    expect(validateRoomMedia(new Blob(["x"], { type: "image/png" }))).toBeNull();
    expect(validateRoomMedia(new Blob(["x"], { type: "application/pdf" }))).toMatch(/PNG/);
    expect(validateRoomMedia(new Blob([new Uint8Array(10 * 1024 * 1024 + 1)], { type: "image/gif" }))).toMatch(/10 MB/);
  });
  it("converte data URL em Blob", () => {
    const b = dataUrlToBlob("data:image/png;base64,aGk=");
    expect(b?.type).toBe("image/png");
    expect(b?.size).toBe(2);
    expect(dataUrlToBlob("https://x/y.png")).toBeNull();
  });
});
