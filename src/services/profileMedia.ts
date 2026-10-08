import { supabase } from "./supabase";

export type ProfileMediaKind = "avatar" | "banner";

export const PROFILE_MEDIA_BUCKET = "profile-media";

export const PROFILE_MEDIA_LIMITS = {
  avatarBytes: 8 * 1024 * 1024,
  bannerBytes: 10 * 1024 * 1024,
  types: ["image/jpeg", "image/png", "image/webp", "image/gif"],
} as const;

const mb = (bytes: number) => `${Math.round(bytes / (1024 * 1024))} MB`;

/** Valida a escolha do arquivo; devolve a mensagem de erro (ou `null` se estiver tudo certo). */
export function validateProfileMedia(kind: ProfileMediaKind, file: { type: string; size: number }): string | null {
  if (!(PROFILE_MEDIA_LIMITS.types as readonly string[]).includes(file.type)) {
    return "Use uma imagem JPG, PNG, WebP ou GIF.";
  }
  const max = kind === "banner" ? PROFILE_MEDIA_LIMITS.bannerBytes : PROFILE_MEDIA_LIMITS.avatarBytes;
  if (file.size > max) {
    return `${kind === "banner" ? "O banner" : "A foto"} deve ter no máximo ${mb(max)}.`;
  }
  return null;
}

/** GIF sobe como arquivo original: recortar no canvas acharia só o 1º quadro. */
export const isAnimatedImage = (file: { type: string }) => file.type === "image/gif";

export function extensionFor(type: string): string {
  switch (type) {
    case "image/gif":
      return "gif";
    case "image/png":
      return "png";
    case "image/jpeg":
      return "jpg";
    default:
      return "webp";
  }
}

/** Caminho no bucket: sempre dentro da pasta do dono (a policy exige `uid/...`). */
export const profileMediaPath = (uid: string, kind: ProfileMediaKind, type: string, now = Date.now()) =>
  `${uid}/${kind}-${now}.${extensionFor(type)}`;

export function dataUrlToBlob(dataUrl: string): Blob {
  const [head, body = ""] = dataUrl.split(",");
  const mime = /data:([^;]+)/.exec(head)?.[1] ?? "image/webp";
  const bin = atob(body);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

const friendlyUploadError = (message: string) =>
  /bucket not found|not found/i.test(message)
    ? "O armazenamento de mídias do perfil ainda não foi configurado (migration profile_media)."
    : /size|too large|exceed/i.test(message)
      ? "O arquivo é grande demais para enviar."
      : "Não foi possível enviar a imagem. Tente de novo.";

/**
 * Envia a foto/banner para o bucket público e devolve a URL pública. As mídias antigas do mesmo tipo
 * são removidas em seguida (melhor esforço) para a pasta do usuário não crescer sem fim.
 */
export async function uploadProfileMedia(uid: string, kind: ProfileMediaKind, blob: Blob): Promise<string> {
  const bad = validateProfileMedia(kind, blob);
  if (bad) throw new Error(bad);

  const path = profileMediaPath(uid, kind, blob.type);
  const { error } = await supabase.storage.from(PROFILE_MEDIA_BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error(friendlyUploadError(error.message || ""));

  const { data } = supabase.storage.from(PROFILE_MEDIA_BUCKET).getPublicUrl(path);

  void (async () => {
    try {
      const { data: files } = await supabase.storage.from(PROFILE_MEDIA_BUCKET).list(uid);
      const stale = (files ?? [])
        .filter((f) => f.name.startsWith(`${kind}-`) && `${uid}/${f.name}` !== path)
        .map((f) => `${uid}/${f.name}`);
      if (stale.length) await supabase.storage.from(PROFILE_MEDIA_BUCKET).remove(stale);
    } catch {
      /* limpeza é só conveniência */
    }
  })();

  return data.publicUrl;
}
