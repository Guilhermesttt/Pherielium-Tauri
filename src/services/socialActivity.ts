import { supabase } from "./supabase";
import type { SocialActivity, UserProfile } from "../types/domain";
import { apiUrl, getUsableSession } from "./api";

type ActivityInput = Omit<SocialActivity, "id" | "userId" | "userName" | "userAvatar" | "audienceIds" | "createdAt"> & {
  dedupeKey?: string;
};

export const publishSocialActivity = async (
  uid: string,
  _profile: UserProfile | null | undefined,
  input: ActivityInput,
) => {
  const session = await getUsableSession();
  if (!session?.access_token || session.user.id !== uid) {
    throw new Error("Sessão expirada. Entre novamente para publicar no feed.");
  }

  const activity = { ...input };
  delete activity.dedupeKey;

  const response = await fetch(apiUrl("/api/social/activity"), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(activity),
  });

  if (!response.ok) {
    let message = "Não foi possível publicar a atividade.";
    try {
      const payload = await response.json() as { error?: string };
      if (payload.error) message = payload.error;
    } catch {
      // Mantém a mensagem genérica quando o backend não retorna JSON.
    }
    throw new Error(message);
  }
};

export const subscribeSocialFeed = (
  viewerId: string,
  onChange: (activities: SocialActivity[]) => void,
  _onError?: (error: Error) => void,
) => {
  void _onError;
  if (!viewerId) {
    onChange([]);
    return () => undefined;
  }

  supabase
    .from("activities")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(60)
    .then(({ data }) => {
      if (data) {
        onChange(data.map((item) => ({
          id: String(item.id),
          userId: item.user_id,
          userName: item.user_name,
          userAvatar: item.user_avatar,
          kind: item.kind,
          gameId: item.game_id,
          gameTitle: item.game_title,
          gameImage: item.game_image,
          achievementId: item.achievement_id,
          achievementName: item.achievement_name,
          achievementIcon: item.achievement_icon,
          caption: item.caption,
          audienceIds: item.audience_ids || [],
          createdAt: item.created_at,
        })));
      }
    });

  const channel = supabase
    .channel("activities_feed")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "activities" },
      () => {
        supabase
          .from("activities")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(60)
          .then(({ data }) => {
            if (data) {
              onChange(data.map((item) => ({
                id: String(item.id),
                userId: item.user_id,
                userName: item.user_name,
                userAvatar: item.user_avatar,
                kind: item.kind,
                gameId: item.game_id,
                gameTitle: item.game_title,
                gameImage: item.game_image,
                achievementId: item.achievement_id,
                achievementName: item.achievement_name,
                achievementIcon: item.achievement_icon,
                caption: item.caption,
                audienceIds: item.audience_ids || [],
                createdAt: item.created_at,
              })));
            }
          });
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};
