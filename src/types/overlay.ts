export type AchievementNotificationPosition =
  | "top-right"
  | "top-left"
  | "top-center"
  | "bottom-right"
  | "bottom-left";

export interface OverlaySettings {
  achievementVolume?: number;
  achievementSoundTheme?: string;
  visualTheme?: string;
  themeAccent?: string;
  achievementNotificationsEnabled?: boolean;
  achievementNotificationPosition?: AchievementNotificationPosition;
  autoContrast?: boolean;
}

export interface OverlayPlayingGame {
  id?: string;
  title?: string;
  image?: string;
  platform?: string;
  category?: string;
  developer?: string;
  releaseDate?: string;
  executableName?: string;
  totalPlaytimeMinutes?: number;
  sessionStartedAt?: string;
  windowMode?: string;
  resolution?: string;
  monitoring?: string;
}

export interface OverlayPanelState {
  language?: string;
  gameTitle?: string;
  userDisplay?: string;
  userAvatar?: string;
  playingGame?: OverlayPlayingGame | null;
  currentGame?: OverlayPlayingGame | null;
  profile?: {
    name?: string;
    avatar?: string;
    discordConnected?: boolean;
    discordUsername?: string;
    achievements?: number;
  };
  settings?: OverlaySettings;
  friends?: unknown[];
  achievements?: unknown;
  chat?: unknown;
  voiceCall?: unknown;
  gamepad?: unknown;
  playerLevel?: unknown;
}

export function normalizeOverlayPanelState<T extends OverlayPanelState>(payload: T): T {
  const currentGame = payload.currentGame ?? payload.playingGame ?? null;
  const profileName = payload.profile?.name ?? payload.userDisplay;
  const profileAvatar = payload.profile?.avatar ?? payload.userAvatar;

  return {
    ...payload,
    gameTitle: payload.gameTitle ?? currentGame?.title,
    userDisplay: profileName,
    userAvatar: profileAvatar,
    playingGame: currentGame,
    profile: payload.profile
      ? {
          ...payload.profile,
          name: profileName,
          avatar: profileAvatar,
        }
      : profileName
        ? { name: profileName, avatar: profileAvatar }
        : payload.profile,
  };
}
