import { describe, expect, it } from "vitest";
import {
  PROFILE_MEDIA_LIMITS,
  dataUrlToBlob,
  extensionFor,
  isAnimatedImage,
  profileMediaPath,
  validateProfileMedia,
} from "./profileMedia";

describe("validateProfileMedia", () => {
  it("aceita jpg/png/webp/gif dentro do limite", () => {
    for (const type of PROFILE_MEDIA_LIMITS.types) {
      expect(validateProfileMedia("avatar", { type, size: 1000 })).toBeNull();
    }
  });

  it("rejeita tipos que não são imagem suportada", () => {
    expect(validateProfileMedia("banner", { type: "image/svg+xml", size: 10 })).toMatch(/JPG, PNG, WebP ou GIF/);
    expect(validateProfileMedia("banner", { type: "video/mp4", size: 10 })).not.toBeNull();
  });

  it("o banner aceita arquivos maiores que a foto", () => {
    const size = PROFILE_MEDIA_LIMITS.avatarBytes + 1;
    expect(validateProfileMedia("avatar", { type: "image/gif", size })).toMatch(/8 MB/);
    expect(validateProfileMedia("banner", { type: "image/gif", size })).toBeNull();
    expect(validateProfileMedia("banner", { type: "image/gif", size: PROFILE_MEDIA_LIMITS.bannerBytes + 1 })).toMatch(/10 MB/);
  });
});

describe("caminho e tipo", () => {
  it("o caminho começa pela pasta do dono (exigência da policy)", () => {
    expect(profileMediaPath("u-1", "banner", "image/gif", 123)).toBe("u-1/banner-123.gif");
    expect(profileMediaPath("u-1", "avatar", "image/webp", 5)).toBe("u-1/avatar-5.webp");
  });

  it("só GIF é tratado como animado (vai sem recorte)", () => {
    expect(isAnimatedImage({ type: "image/gif" })).toBe(true);
    expect(isAnimatedImage({ type: "image/png" })).toBe(false);
    expect(extensionFor("image/jpeg")).toBe("jpg");
  });

  it("converte data URL em Blob com o mime certo", () => {
    const blob = dataUrlToBlob("data:image/png;base64,iVBORw0KGgo=");
    expect(blob.type).toBe("image/png");
    expect(blob.size).toBeGreaterThan(0);
  });
});
