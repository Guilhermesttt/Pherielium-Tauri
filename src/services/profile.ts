import { supabase } from "./supabase";
import type { EditableProfile } from "../types/domain";
import { invalidate } from "../lib/queryCache";

export const PROFILE_LIMITS = {
  displayName: 50,
  bio: 280,
  website: 300,
  location: 80,
  pronouns: 40,
  genres: 6,
  genre: 32,
  avatarBytes: 5 * 1024 * 1024,
} as const;

const clean = (value: string, limit: number) =>
  value.trim().replace(/\s+/g, " ").slice(0, limit);

export const normalizeEditableProfile = (
  input: EditableProfile,
): EditableProfile => {
  const website = input.website.trim();
  if (website && !/^https:\/\/[^\s]+$/i.test(website)) {
    throw new Error("O site precisa começar com https://.");
  }

  const displayName = clean(input.displayName, PROFILE_LIMITS.displayName);
  if (displayName.length < 2) {
    throw new Error("Informe um nome com pelo menos 2 caracteres.");
  }

  return {
    displayName,
    bio: input.bio.trim().slice(0, PROFILE_LIMITS.bio),
    location: clean(input.location || "", PROFILE_LIMITS.location),
    pronouns: clean(input.pronouns || "", PROFILE_LIMITS.pronouns),
    website: website.slice(0, PROFILE_LIMITS.website),
    favoriteGenres: [...new Set(input.favoriteGenres
      .map((genre) => clean(genre, PROFILE_LIMITS.genre))
      .filter(Boolean))]
      .slice(0, PROFILE_LIMITS.genres),
  };
};

export const saveCurrentUserProfile = async ({
  profile,
  userId,
}: {
  profile: EditableProfile;
  userId?: string;
}) => {
  let uid = userId;
  if (!uid) {
    const sessionRes = await supabase.auth.getSession();
    uid = sessionRes.data.session?.user?.id;
  }
  if (!uid) {
    const userRes = await supabase.auth.getUser();
    uid = userRes.data.user?.id;
  }
  if (!uid) {
    throw new Error("Faça login novamente para editar o perfil.");
  }

  const normalized = normalizeEditableProfile(profile);
  const photoURL = profile.photoURL || "";

  const payload: Record<string, any> = {
    uid,
    display_name: normalized.displayName,
    bio: normalized.bio,
    website: normalized.website,
    favorite_genres: normalized.favoriteGenres,
    photo_url: photoURL || null,
  };

  if (normalized.location) payload.location = normalized.location;
  if (normalized.pronouns) payload.pronouns = normalized.pronouns;

  let dbSaved = false;
  try {
    const { error: upsertError } = await supabase
      .from("profiles")
      .upsert(payload, { onConflict: "uid" });

    if (!upsertError) {
      dbSaved = true;
    }
  } catch {}

  if (!dbSaved) {
    // Fallback: se o upsert falhar (ex: restrição onConflict ou colunas opcionais), tenta verificar se a linha existe
    const safePayload: Record<string, any> = {
      uid,
      display_name: normalized.displayName,
      bio: normalized.bio,
      website: normalized.website,
      favorite_genres: normalized.favoriteGenres,
      photo_url: photoURL || null,
    };

    try {
      const { data: existingRow } = await supabase
        .from("profiles")
        .select("uid")
        .eq("uid", uid)
        .maybeSingle();

      if (existingRow) {
        const { error: updateErr } = await supabase
          .from("profiles")
          .update(payload)
          .eq("uid", uid);
        if (updateErr) {
          await supabase.from("profiles").update(safePayload).eq("uid", uid);
        }
      } else {
        const { error: insertErr } = await supabase
          .from("profiles")
          .insert(payload);
        if (insertErr) {
          await supabase.from("profiles").insert(safePayload);
        }
      }
    } catch (dbErr) {
      console.warn("[saveCurrentUserProfile] Aviso ao sincronizar com tabela profiles:", dbErr);
    }
  }

  // Sincroniza também com public_profiles
  try {
    await supabase.from("public_profiles").upsert({
      uid,
      display_name: normalized.displayName,
      photo_url: photoURL || null,
      bio: normalized.bio,
      website: normalized.website,
      favorite_genres: normalized.favoriteGenres,
      updated_at: new Date().toISOString(),
    }, { onConflict: "uid" });
  } catch {}

  if (uid) {
    try {
      localStorage.setItem(`phelierium_custom_display_name_${uid}`, normalized.displayName);
      if (photoURL) {
        localStorage.setItem(`phelierium_custom_avatar_${uid}`, photoURL);
      }
      localStorage.setItem(`phelierium_profile_cache_${uid}`, JSON.stringify({
        displayName: normalized.displayName,
        display_name: normalized.displayName,
        photoURL,
        photo_url: photoURL,
        bio: normalized.bio,
        location: normalized.location,
        pronouns: normalized.pronouns,
        website: normalized.website,
        favoriteGenres: normalized.favoriteGenres,
        favorite_genres: normalized.favoriteGenres,
      }));
    } catch {}

    // Atualiza metadados do Supabase Auth para consistência
    try {
      await supabase.auth.updateUser({
        data: {
          custom_display_name: normalized.displayName,
          displayName: normalized.displayName,
          display_name: normalized.displayName,
          full_name: normalized.displayName,
          name: normalized.displayName,
          avatar_url: photoURL || undefined,
          picture: photoURL || undefined,
        },
      });
    } catch (authMetaErr) {
      console.warn("[saveCurrentUserProfile] Aviso ao atualizar user_metadata do auth:", authMetaErr);
    }
  }

  try {
    invalidate("profile");
    invalidate("trophies");
  } catch {}

  // Emite evento global para que todo o app (Home, Perfil, Dropdowns) atualize a imagem instantaneamente
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("checkpoint:profile-updated", {
        detail: {
          uid,
          displayName: normalized.displayName,
          photoURL,
          bio: normalized.bio,
          favoriteGenres: normalized.favoriteGenres,
        },
      })
    );
  }

  return { ...normalized, photoURL };
};
