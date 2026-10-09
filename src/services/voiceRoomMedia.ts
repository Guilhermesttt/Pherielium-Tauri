import { supabase } from "./supabase";

export const VOICE_ROOM_MEDIA_BUCKET = "voice-room-media";
export const VOICE_ROOM_MEDIA_MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
const EXT: Record<string, string> = { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp", "image/gif": "gif" };

/** Mensagem de erro em português ou `null` se o arquivo serve. */
export function validateRoomMedia(blob: Blob): string | null {
  if (!(ALLOWED as readonly string[]).includes(blob.type)) return "Use uma imagem PNG, JPG, WebP ou GIF.";
  if (blob.size > VOICE_ROOM_MEDIA_MAX_BYTES) return "A imagem deve ter no máximo 10 MB.";
  return null;
}

/** `data:image/...;base64,...` (ícone antigo guardado inline) vira Blob; outros valores devolvem null. */
export function dataUrlToBlob(value: string): Blob | null {
  const m = /^data:(image\/[a-z+]+);base64,(.+)$/i.exec(value);
  if (!m) return null;
  const bin = atob(m[2]);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: m[1].toLowerCase() });
}

/** Envia a imagem para a pasta do usuário e devolve a URL pública. */
export async function uploadRoomMedia(uid: string, kind: "banner" | "icon", blob: Blob): Promise<string> {
  const bad = validateRoomMedia(blob);
  if (bad) throw new Error(bad);
  const path = `${uid}/${kind}-${Date.now()}.${EXT[blob.type]}`;
  const { error } = await supabase.storage.from(VOICE_ROOM_MEDIA_BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: "31536000",
    upsert: false,
  });
  if (error) throw new Error("Não foi possível enviar a imagem. Tente de novo.");
  return supabase.storage.from(VOICE_ROOM_MEDIA_BUCKET).getPublicUrl(path).data.publicUrl;
}
