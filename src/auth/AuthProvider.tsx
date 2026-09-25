import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from "react";
import { supabase } from "../services/supabase";
import { apiUrl, getUsableSession, refreshSupabaseSessionOnce } from "../services/api";
import { cleanupAllChannels } from "../services/voiceCall";
import { markCheckpointOfflineSync } from "../services/checkpointFriends";
import type { UserProfile } from "../types/domain";

export interface AuthUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
}

export type AuthIssue = null | "session_expired" | "profile_stale";
export type SessionStatus = "ok" | "degraded" | "expired";

interface AuthContextValue {
  user: AuthUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  authIssue: AuthIssue;
  sessionStatus: SessionStatus;
  signInWithGoogle: () => Promise<void>;
  cancelGoogleBrowserAuth: () => void;
  signUpWithEmail: (email: string, pass: string) => Promise<void>;
  signInWithEmail: (email: string, pass: string) => Promise<void>;
  signOutUser: () => Promise<void>;
  refreshProfile: () => Promise<any>;
  clearAuthIssue: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const toProfile = (uid: string, data?: Record<string, any>): UserProfile => {
  const localAvatar = typeof window !== "undefined" ? localStorage.getItem(`phelierium_custom_avatar_${uid}`) : null;
  const localDisplayName = typeof window !== "undefined" ? localStorage.getItem(`phelierium_custom_display_name_${uid}`) : null;
  return {
    uid,
    email: data?.email ?? null,
    displayName: localDisplayName || data?.displayName || data?.display_name || null,
    photoURL: localAvatar || (data?.photoURL ?? data?.photo_url ?? null),
    profileVisibility:
      data?.profileVisibility === "private" || data?.profile_visibility === "private"
        ? "private"
        : "public",
    bio: data?.bio,
    location: data?.location,
    pronouns: data?.pronouns,
    website: data?.website,
    favoriteGenres: data?.favoriteGenres ?? data?.favorite_genres,
    steamId: data?.steamId ?? data?.steam_id,
    steamAvatar: data?.steamAvatar ?? data?.steam_avatar,
    steamUsername: data?.steamUsername ?? data?.steam_username,
    discordId: data?.discordId ?? data?.discord_id,
    discordUsername: data?.discordUsername ?? data?.discord_username,
    discordAvatar: data?.discordAvatar ?? data?.discord_avatar,
    retroAchievementsUlid:
      data?.retroAchievementsUlid ?? data?.retroachievements_ulid,
    retroAchievementsUsername:
      data?.retroAchievementsUsername ?? data?.retroachievements_username,
    status: data?.status,
    playing: data?.playing,
    discordFriends: data?.discordFriends ?? data?.discord_friends,
    checkpointFriends: data?.checkpointFriends ?? data?.checkpoint_friends,
    checkpointFriendRequestsIncoming: data?.checkpointFriendRequestsIncoming ?? data?.checkpoint_friend_requests_incoming,
    checkpointFriendRequestsOutgoing: data?.checkpointFriendRequestsOutgoing ?? data?.checkpoint_friend_requests_outgoing,
    createdAt: data?.createdAt ?? data?.created_at,
    updatedAt: data?.updatedAt ?? data?.updated_at,
    lastSteamSyncAt: data?.lastSteamSyncAt ?? data?.last_steam_sync_at,
    gamesMigratedAt: data?.gamesMigratedAt ?? data?.games_migrated_at,
    onboardingCompletedAt: data?.onboardingCompletedAt ?? data?.onboarding_completed_at,
    achievementSummary: data?.achievementSummary ?? data?.achievement_summary,
    librarySummary: data?.librarySummary ?? data?.library_summary,
  };
};


const isJwtAuthError = (error: { code?: string; message?: string } | null | undefined) => {
  if (!error) return false;
  return error.code === "PGRST301" || /jwt|expired|token|unauthoriz/i.test(error.message || "");
};

const isClientOnline = () => typeof navigator === "undefined" || navigator.onLine;

const toSessionStatus = (issue: AuthIssue): SessionStatus => {
  if (issue === "session_expired") return "expired";
  if (issue === "profile_stale") return "degraded";
  return "ok";
};

const wait = (ms: number) => new Promise<void>((resolve) => {
  globalThis.setTimeout(resolve, ms);
});

const isTransientSessionEstablishmentError = (error: unknown) => {
  const candidate = error as {
    name?: string;
    message?: string;
    status?: number;
    code?: string;
  } | null;

  const name = String(candidate?.name || "").toLowerCase();
  const message = String(candidate?.message || error || "").toLowerCase();
  const status = Number(candidate?.status || 0);

  return (
    status === 0
    || name.includes("retryable")
    || name.includes("fetch")
    || /failed to fetch|network|connection|econnreset|err_connection_reset|timeout|temporarily unavailable/.test(message)
  );
};

const establishSessionFromBackendTokens = async (
  accessToken: string,
  refreshToken: string,
) => {
  if (!accessToken || !refreshToken) {
    throw new Error("Backend nao retornou uma sessao Supabase completa.");
  }

  let lastError: unknown = null;

  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (attempt > 0) {
      await wait(attempt === 1 ? 500 : 1_200);
    }

    try {
      const { data, error } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken,
      });

      if (!error && data?.session) {
        return;
      }

      lastError = error || new Error("Supabase nao retornou uma sessao valida.");

      if (!isTransientSessionEstablishmentError(lastError)) {
        break;
      }

      console.warn(
        `[Auth] Falha transitoria ao persistir sessao Google; nova tentativa ${attempt + 2}/3.`,
      );
    } catch (error) {
      lastError = error;

      if (!isTransientSessionEstablishmentError(error)) {
        break;
      }

      console.warn(
        `[Auth] Erro de rede ao persistir sessao Google; nova tentativa ${attempt + 2}/3.`,
      );
    }
  }

  const message = lastError instanceof Error
    ? lastError.message
    : "Falha desconhecida ao persistir a sessao.";

  throw new Error(`Nao foi possivel concluir o login Google: ${message}`);
};

const loadSocialGraph = async (uid: string) => {
  const { data: relationships, error } = await supabase
    .from("friendships")
    .select("requester_id,addressee_id,status,created_at")
    .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`);
  if (error || !relationships) {
    console.warn("[Auth] Falha ao carregar social graph:", error);
    return null;
  }

  const relatedIds = [...new Set(relationships.map((relationship) =>
    relationship.requester_id === uid
      ? relationship.addressee_id
      : relationship.requester_id,
  ))];
  let publicProfiles: any[] = [];
  if (relatedIds.length > 0) {
    const { data: profilesData } = await supabase
      .from("profiles")
      .select("uid,display_name,photo_url,status,playing,presence_updated_at")
      .in("uid", relatedIds);
    if (profilesData && profilesData.length > 0) {
      publicProfiles = profilesData;
    } else {
      const { data: fallbackData } = await supabase
        .from("public_profiles")
        .select("uid,display_name,photo_url")
        .in("uid", relatedIds);
      publicProfiles = fallbackData || [];
    }
  }
  const profileById = new Map((publicProfiles || []).map((profile) => [profile.uid, profile]));
  const compact = (relatedUid: string, createdAt?: string) => {
    const profile = profileById.get(relatedUid);
    const presenceUpdatedAt = Date.parse(String(profile?.presence_updated_at || ""));
    const isFresh = Number.isFinite(presenceUpdatedAt) && Date.now() - presenceUpdatedAt < 75_000;
    const resolvedStatus: "online" | "playing" | "offline" =
      isFresh && (profile?.status === "online" || profile?.status === "playing")
        ? profile.status
        : "offline";
    const resolvedPlaying = resolvedStatus === "playing" ? (profile?.playing as any) || null : null;
    return {
      uid: relatedUid,
      displayName: String(profile?.display_name || "Jogador"),
      photoURL: profile?.photo_url || null,
      status: resolvedStatus,
      playing: resolvedPlaying,
      ...(createdAt ? { createdAt } : {}),
    };
  };

  return {
    checkpointFriends: relationships
      .filter((relationship) => relationship.status === "accepted")
      .map((relationship) => compact(
        relationship.requester_id === uid
          ? relationship.addressee_id
          : relationship.requester_id,
      )),
    checkpointFriendRequestsIncoming: relationships
      .filter((relationship) =>
        relationship.status === "pending" && relationship.addressee_id === uid,
      )
      .map((relationship) => compact(relationship.requester_id, relationship.created_at)),
    checkpointFriendRequestsOutgoing: relationships
      .filter((relationship) =>
        relationship.status === "pending" && relationship.requester_id === uid,
      )
      .map((relationship) => compact(relationship.addressee_id, relationship.created_at)),
  };
};

const mergeTransientProfile = (
  fallback: UserProfile,
  previous: UserProfile | null,
): UserProfile => ({
  ...fallback,
  steamId: fallback.steamId ?? previous?.steamId,
  steamAvatar: fallback.steamAvatar ?? previous?.steamAvatar,
  steamUsername: fallback.steamUsername ?? previous?.steamUsername,
  discordId: fallback.discordId ?? previous?.discordId,
  discordUsername: fallback.discordUsername ?? previous?.discordUsername,
  discordAvatar: fallback.discordAvatar ?? previous?.discordAvatar,
  retroAchievementsUlid:
    fallback.retroAchievementsUlid ?? previous?.retroAchievementsUlid,
  retroAchievementsUsername:
    fallback.retroAchievementsUsername ?? previous?.retroAchievementsUsername,
  checkpointFriends:
    fallback.checkpointFriends ?? previous?.checkpointFriends,
  checkpointFriendRequestsIncoming:
    fallback.checkpointFriendRequestsIncoming ?? previous?.checkpointFriendRequestsIncoming,
  checkpointFriendRequestsOutgoing:
    fallback.checkpointFriendRequestsOutgoing ?? previous?.checkpointFriendRequestsOutgoing,
});

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authIssue, setAuthIssue] = useState<AuthIssue>(null);
  const userProfileRef = useRef<UserProfile | null>(null);

  const commitUserProfile = useCallback((profile: UserProfile | null) => {
    userProfileRef.current = profile;
    setUserProfile(profile);
  }, []);

  const clearAuthIssue = useCallback(() => {
    setAuthIssue(null);
  }, []);

  // Mantem o ref coerente inclusive para atualizacoes feitas por outros handlers.
  useEffect(() => {
    userProfileRef.current = userProfile;
  }, [userProfile]);

  const fetchProfile = useCallback(async (uid: string, fallbackUser?: AuthUser): Promise<UserProfile | null> => {
    const buildCachedFallback = () => {
      let cachedData: Record<string, any> | null = null;
      let localDisplayName: string | null = null;
      try {
        localDisplayName = localStorage.getItem(`phelierium_custom_display_name_${uid}`);
        const rawCached = localStorage.getItem(`phelierium_profile_cache_${uid}`);
        if (rawCached) cachedData = JSON.parse(rawCached);
      } catch {
        // Cache corrompido/indisponivel nao deve derrubar o auth.
      }

      return toProfile(uid, {
        email: fallbackUser?.email ?? cachedData?.email,
        displayName:
          localDisplayName ??
          cachedData?.displayName ??
          cachedData?.display_name ??
          fallbackUser?.displayName ??
          fallbackUser?.email?.split("@")[0] ??
          "User",
        photoURL:
          fallbackUser?.photoURL ??
          cachedData?.photoURL ??
          cachedData?.photo_url,
        steamId: cachedData?.steamId ?? cachedData?.steam_id,
        steamAvatar: cachedData?.steamAvatar ?? cachedData?.steam_avatar,
        steamUsername: cachedData?.steamUsername ?? cachedData?.steam_username,
        discordId: cachedData?.discordId ?? cachedData?.discord_id,
        discordUsername: cachedData?.discordUsername ?? cachedData?.discord_username,
        discordAvatar: cachedData?.discordAvatar ?? cachedData?.discord_avatar,
      });
    };

    const useLastKnownProfile = (issue: AuthIssue = "profile_stale") => {
      if (issue) {
        setAuthIssue(issue);
      }
      const effectiveProfile = mergeTransientProfile(
        buildCachedFallback(),
        userProfileRef.current,
      );
      commitUserProfile(effectiveProfile);
      return effectiveProfile;
    };

    const classifyAuthFailure = async (): Promise<AuthIssue> => {
      const online = isClientOnline();
      if (!online) {
        return "profile_stale";
      }

      const usable = await getUsableSession();
      if (!usable) {
        return "session_expired";
      }

      return "profile_stale";
    };

    try {
      let { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("uid", uid)
        .maybeSingle();

      // Se o PostgREST indicar JWT expirado/invalido, tenta UM refresh compartilhado
      // e repete a leitura uma unica vez.
      if (error && isJwtAuthError(error)) {
        const refreshedSession = await refreshSupabaseSessionOnce();
        if (refreshedSession) {
          const retryRes = await supabase
            .from("profiles")
            .select("*")
            .eq("uid", uid)
            .maybeSingle();
          data = retryRes.data;
          error = retryRes.error;
        } else {
          const issue = await classifyAuthFailure();
          console.warn("[Auth] JWT invalido e refresh falhou; marcando", issue);
          return useLastKnownProfile(issue);
        }
      }

      if (error || !data) {
        if (error) {
          console.warn("[Auth] Perfil indisponivel; usando ultimo estado conhecido:", error.message);
          const issue = isJwtAuthError(error)
            ? await classifyAuthFailure()
            : "profile_stale";
          return useLastKnownProfile(issue);
        }

        // Linha ausente ainda nao significa sessao degradada — usa cache local.
        const effectiveProfile = mergeTransientProfile(
          buildCachedFallback(),
          userProfileRef.current,
        );
        commitUserProfile(effectiveProfile);
        return effectiveProfile;
      }

      try {
        localStorage.setItem(`phelierium_profile_cache_${uid}`, JSON.stringify(data));
      } catch {
        // Falha de cache nao invalida um perfil carregado com sucesso.
      }

      const socialGraph = await loadSocialGraph(uid);
      const baseProfile = toProfile(uid, data);
      const previous = userProfileRef.current;

      const prof: UserProfile = socialGraph
        ? {
          ...baseProfile,
          ...socialGraph,
        }
        : {
          ...baseProfile,
          checkpointFriends: previous?.checkpointFriends,
          checkpointFriendRequestsIncoming: previous?.checkpointFriendRequestsIncoming,
          checkpointFriendRequestsOutgoing: previous?.checkpointFriendRequestsOutgoing,
        };

      // Uma resposta valida do banco e autoritativa. Se steam_id/discord_id vier null,
      // a desconexao e real e NAO deve ser sobrescrita pelo cache anterior.
      setAuthIssue(null);
      commitUserProfile(prof);
      return prof;
    } catch (err) {
      console.error("[Auth] Falha ao carregar perfil do Supabase Postgres:", err);
      const issue = await classifyAuthFailure();
      return useLastKnownProfile(issue);
    }
  }, [commitUserProfile]);

  const refreshProfile = useCallback(async (): Promise<UserProfile | null> => {
    if (!user?.uid) return null;
    return await fetchProfile(user.uid, user);
  }, [user, fetchProfile]);

  const googleAbortControllerRef = useRef<AbortController | null>(null);

  const cancelGoogleBrowserAuth = useCallback(() => {
    if (googleAbortControllerRef.current) {
      googleAbortControllerRef.current.abort();
      googleAbortControllerRef.current = null;
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (window.electronAPI) {
      const abortController = new AbortController();
      googleAbortControllerRef.current = abortController;
      const { signal } = abortController;

      try {
        const res = await (window.electronAPI as any).startGoogleBrowserAuth();
        if (signal.aborted) return;
        const state = res?.state;
        const pollSecret = res?.pollSecret;
        if (!state || !pollSecret) throw new Error("Falha ao iniciar autenticação Google.");

        const deadline = Date.now() + 120_000;

        while (Date.now() < deadline) {
          if (signal.aborted) return;
          await wait(1_500);
          if (signal.aborted) return;

          let data: any = null;

          try {
            if (typeof (window.electronAPI as any).pollGoogleBrowserAuth === "function") {
              data = await (window.electronAPI as any).pollGoogleBrowserAuth(state, pollSecret);
            } else {
              const statusRes = await fetch(
                apiUrl(
                  `/auth/desktop/google/status?state=${encodeURIComponent(state)}&pollSecret=${encodeURIComponent(pollSecret)}`,
                ),
                { signal },
              );

              if (statusRes.status === 401) {
                throw new Error("Sessão de login Google inválida. Tente novamente.");
              }

              if (!statusRes.ok) {
                throw new Error(`Falha ao consultar login Google (HTTP ${statusRes.status}).`);
              }

              data = await statusRes.json();
            }
          } catch (pollError: any) {
            if (signal.aborted || pollError?.name === "AbortError") {
              return;
            }
            // Oscilacoes de rede durante o polling podem ser tentadas novamente.
            if (isTransientSessionEstablishmentError(pollError)) {
              continue;
            }
            throw pollError;
          }

          if (signal.aborted) return;

          if (!data || data.status === "pending") {
            continue;
          }

          if (data.status === "error") {
            throw new Error(data.error || "Falha na autenticação do Google.");
          }

          if (data.status !== "complete") {
            throw new Error(`Status inesperado no login Google: ${String(data.status || "desconhecido")}.`);
          }

          if (!data.accessToken || !data.refreshToken) {
            throw new Error(
              "O backend concluiu o login Google sem retornar uma sessão Supabase válida.",
            );
          }

          /*
           * O backend ja consumiu o token hash one-time e criou a sessao.
           * O renderer NUNCA deve chamar verifyOtp novamente com esse mesmo token.
           */
          await establishSessionFromBackendTokens(
            String(data.accessToken),
            String(data.refreshToken),
          );

          return;
        }

        if (!signal.aborted) {
          throw new Error("Tempo limite excedido aguardando login do Google. Tente novamente.");
        }
      } finally {
        if (googleAbortControllerRef.current === abortController) {
          googleAbortControllerRef.current = null;
        }
      }
      return;
    }

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) throw error;
  }, []);

  const signUpWithEmail = useCallback(async (email: string, pass: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password: pass,
    });
    if (error) throw error;
  }, []);

  const signInWithEmail = useCallback(async (email: string, pass: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password: pass,
    });
    if (error) throw error;
  }, []);

  const signOutUser = useCallback(async () => {
    try {
      if (user?.uid) {
        markCheckpointOfflineSync(
          user.uid,
          userProfile?.displayName || user.displayName || undefined,
          userProfile?.photoURL || user.photoURL || null,
        );
        if (window.electronAPI && typeof (window.electronAPI as any).clearLocalSteamId === "function") {
          await (window.electronAPI as any).clearLocalSteamId(user.uid).catch((e: unknown) => console.warn("[Auth] clearLocalSteamId error:", e));
        }
        if (window.electronAPI && typeof (window.electronAPI as any).logoutEpic === "function") {
          await (window.electronAPI as any).logoutEpic().catch((e: unknown) => console.warn("[Auth] logoutEpic error:", e));
        }
        try {
          localStorage.removeItem("checkpoint_epic_linked_uid");
          localStorage.removeItem(`checkpoint_epic_user_${user.uid}`);
          localStorage.removeItem(`phelierium_profile_cache_${user.uid}`);
        } catch { }
      }
    } catch (e) {
      console.warn("Erro ao limpar cache de logout:", e);
    }
    await supabase.auth.signOut().catch((e) => console.warn("[Auth] signOut error:", e));
    cleanupAllChannels();
    setUser(null);
    commitUserProfile(null);
    setAuthIssue(null);
  }, [user, userProfile, commitUserProfile]);

  useEffect(() => {
    let isMounted = true;

    // Safety timeout: nunca prender a interface em carregamento indefinido se o auth demorar.
    const safetyTimeoutId = window.setTimeout(() => {
      if (isMounted) setLoading(false);
    }, 6000);

    const toAuthUser = (session: any): AuthUser => {
      const sessionUid = session.user.id;
      const localName = typeof window !== "undefined"
        ? localStorage.getItem(`phelierium_custom_display_name_${sessionUid}`)
        : null;
      const localAvatar = typeof window !== "undefined"
        ? localStorage.getItem(`phelierium_custom_avatar_${sessionUid}`)
        : null;

      return {
        uid: sessionUid,
        email: session.user.email,
        displayName:
          localName ||
          session.user.user_metadata?.custom_display_name ||
          session.user.user_metadata?.displayName ||
          session.user.user_metadata?.display_name ||
          session.user.user_metadata?.full_name ||
          session.user.user_metadata?.name ||
          session.user.email?.split("@")[0] ||
          "Jogador",
        photoURL:
          localAvatar ||
          session.user.user_metadata?.avatar_url ||
          session.user.user_metadata?.picture ||
          null,
      };
    };

    const hydrateFromSession = async (session: any) => {
      if (!isMounted || !session?.user) return;
      const authUser = toAuthUser(session);
      setUser(authUser);
      await fetchProfile(session.user.id, authUser);
      if (isMounted) {
        window.clearTimeout(safetyTimeoutId);
        setLoading(false);
      }
    };

    // 1. Recuperacao proativa no mount. Se o refresh falhar por rede, mantemos a
    // sessao persistida para conseguir hidratar o perfil/cache local offline.
    const fetchInitialSession = async () => {
      if (typeof supabase?.auth?.getSession !== "function") {
        if (isMounted) setLoading(false);
        return;
      }

      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn("[Auth] Falha ao recuperar sessao:", error.message);
        }

        let session = data?.session;
        if (!isMounted) return;

        if (!session?.user) {
          setLoading(false);
          return;
        }

        const expiresSoon =
          Boolean(session.expires_at) &&
          session.expires_at! * 1000 < Date.now() + 30_000;

        if (expiresSoon) {
          const refreshed = await refreshSupabaseSessionOnce();
          if (refreshed) {
            session = refreshed;
          } else {
            const remainingMs = session.expires_at
              ? session.expires_at * 1000 - Date.now()
              : 0;
            if (remainingMs <= 0 && isClientOnline()) {
              console.warn("[Auth] Sessao inicial expirada e refresh falhou.");
              setAuthIssue("session_expired");
            } else {
              console.warn("[Auth] Refresh inicial indisponivel; mantendo sessao local conhecida.");
              if (isClientOnline()) {
                setAuthIssue("profile_stale");
              }
            }
          }
        }

        await hydrateFromSession(session);
      } catch (error) {
        console.warn("[Auth] Recuperacao inicial falhou:", error);
        if (isMounted) setLoading(false);
      }
    };

    void fetchInitialSession();

    // 2. O callback do Supabase deve permanecer SINCRONO. Fazer await de outra API
    // Supabase dentro de onAuthStateChange pode bloquear o cliente. Chamadas que
    // precisam acessar PostgREST sao adiadas para o proximo tick.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;

      if (event === "INITIAL_SESSION") {
        return;
      }

      if (event === "SIGNED_OUT") {
        setUser(null);
        commitUserProfile(null);
        setAuthIssue(null);
        window.clearTimeout(safetyTimeoutId);
        setLoading(false);
        return;
      }

      if (!session?.user) {
        return;
      }

      const authUser = toAuthUser(session);
      setUser(authUser);

      // Rotacao de access token nao significa alteracao do perfil Steam/Discord.
      if (event === "TOKEN_REFRESHED") {
        window.clearTimeout(safetyTimeoutId);
        setLoading(false);
        return;
      }

      window.setTimeout(() => {
        if (!isMounted) return;

        void fetchProfile(session.user.id, authUser)
          .catch((error) => {
            console.warn("[Auth] Falha ao atualizar perfil apos evento:", event, error);
          })
          .finally(() => {
            if (isMounted) {
              window.clearTimeout(safetyTimeoutId);
              setLoading(false);
            }
          });
      }, 0);
    });

    return () => {
      isMounted = false;
      window.clearTimeout(safetyTimeoutId);
      subscription.unsubscribe();
    };
  }, [fetchProfile, commitUserProfile]);

  useEffect(() => {
    if (!user?.uid || typeof (supabase as any)?.channel !== "function") return;

    const channel = supabase
      .channel(`friendships_realtime_${user.uid}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
          filter: `requester_id=eq.${user.uid}`,
        },
        () => {
          void refreshProfile();
        },
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "friendships",
          filter: `addressee_id=eq.${user.uid}`,
        },
        () => {
          void refreshProfile();
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.uid, refreshProfile]);

  // Sincronização periódica inteligente de amizades e solicitações (fallback em caso de oscilação do WebSocket)
  useEffect(() => {
    if (!user?.uid) return;

    const refreshIfSessionUsable = async () => {
      const online = isClientOnline();
      if (!online) return;

      const session = await getUsableSession();
      if (!session) {
        setAuthIssue("session_expired");
        return;
      }

      void refreshProfile();
    };

    const interval = window.setInterval(() => {
      if (document.hasFocus() && isClientOnline()) {
        void refreshIfSessionUsable();
      }
    }, 60_000);

    const onFocus = () => {
      void refreshIfSessionUsable();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refreshIfSessionUsable();
      }
    };
    const onOnline = () => {
      void refreshIfSessionUsable();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
    };
  }, [user?.uid, refreshProfile]);

  useEffect(() => {
    const handleProfileUpdated = (event: Event) => {
      const customEvent = event as CustomEvent<{
        uid: string;
        displayName?: string;
        photoURL?: string;
        bio?: string;
        favoriteGenres?: string[];
      }>;
      const detail = customEvent.detail;
      if (!detail) return;
      setUserProfile((prev) => {
        if (!prev) return prev;
        if (detail.uid && prev.uid && detail.uid !== prev.uid) return prev;
        const next = {
          ...prev,
          displayName: detail.displayName || prev.displayName,
          photoURL: detail.photoURL !== undefined ? detail.photoURL : prev.photoURL,
          bio: detail.bio !== undefined ? detail.bio : prev.bio,
          favoriteGenres: detail.favoriteGenres !== undefined ? detail.favoriteGenres : prev.favoriteGenres,
        };
        userProfileRef.current = next;
        return next;
      });
      setUser((prev) => {
        if (!prev) return prev;
        if (detail.uid && prev.uid && detail.uid !== prev.uid) return prev;
        return {
          ...prev,
          displayName: detail.displayName || prev.displayName,
          photoURL: detail.photoURL !== undefined ? detail.photoURL : prev.photoURL,
        };
      });
    };

    window.addEventListener("checkpoint:profile-updated", handleProfileUpdated);
    return () => {
      window.removeEventListener("checkpoint:profile-updated", handleProfileUpdated);
    };
  }, []);

  const sessionStatus = toSessionStatus(authIssue);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      userProfile,
      loading,
      authIssue,
      sessionStatus,
      signInWithGoogle,
      cancelGoogleBrowserAuth,
      signUpWithEmail,
      signInWithEmail,
      signOutUser,
      refreshProfile,
      clearAuthIssue,
    }),
    [
      user,
      userProfile,
      loading,
      authIssue,
      sessionStatus,
      signInWithGoogle,
      cancelGoogleBrowserAuth,
      signUpWithEmail,
      signInWithEmail,
      signOutUser,
      refreshProfile,
      clearAuthIssue,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useOptionalAuth = () => {
  return useContext(AuthContext);
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    // Retorna fallback gracioso quando renderizado fora do AuthProvider (ex: testes unitários)
    return {
      user: null,
      userProfile: null,
      loading: false,
      authIssue: null,
      sessionStatus: "ok",
      signInWithGoogle: async () => { },
      cancelGoogleBrowserAuth: () => { },
      signUpWithEmail: async () => { },
      signInWithEmail: async () => { },
      signOutUser: async () => { },
      refreshProfile: async () => null,
      clearAuthIssue: () => { },
    };
  }
  return ctx;
};
