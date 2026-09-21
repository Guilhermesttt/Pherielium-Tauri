import { supabase } from "./supabase";
import type { ProfileVisibility } from "../types/domain";
import { getUsableSession } from "./api";

export const normalizeProfileVisibility = (value: unknown): ProfileVisibility => {
  if (value === "public" || value === "private") return value;
  throw new Error("Visibilidade de perfil inválida.");
};

export const saveProfileVisibility = async (
  requestedVisibility: ProfileVisibility,
): Promise<ProfileVisibility> => {
  const visibility = normalizeProfileVisibility(requestedVisibility);
  const session = await getUsableSession();
  if (!session?.user) {
    throw new Error("Faça login novamente para alterar a privacidade.");
  }

  const { data, error } = await supabase
    .from("profiles")
    .update({ profile_visibility: visibility })
    .eq("uid", session.user.id)
    .select("profile_visibility")
    .single();
  if (error) throw error;
  return normalizeProfileVisibility(data?.profile_visibility);
};
