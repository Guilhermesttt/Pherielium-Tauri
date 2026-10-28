import React from "react";
import { AuthProvider } from "../auth/AuthProvider";
import { NotificationProvider } from "../components/NotificationCenter";
import { PreferencesProvider } from "../context/PreferencesContext";
import { GamepadProvider } from "../context/GamepadContext";
import { TooltipProvider } from "../components/ui/tooltip";
import UserProfilePage from "../components/UserProfilePage";
import ProfileFramingModal from "../components/ProfileFramingModal";
import { DEFAULT_FRAMING } from "../services/mediaFraming";
import type { Game, UserProfile } from "../types/domain";

/**
 * Laboratório (só em desenvolvimento): a página REAL de Perfil com dados de exemplo, sem conta.
 * Abrir: #/design-lab/profile (com ?framing=banner ou ?framing=avatar, abre o ajuste de enquadramento)
 */
const steamCover = (appId: number) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`;

const sample = (id: number, title: string, total: number, completed: number, hours: number, favorite = false): Game =>
  ({
    id: `steam-${id}`,
    title,
    image: steamCover(id),
    cardImage: steamCover(id),
    launcherType: "steam",
    totalAchievements: total,
    completedAchievements: completed,
    hoursPlayed: hours,
    isFavorite: favorite,
  }) as unknown as Game;

const GAMES: Game[] = [
  sample(1245620, "Elden Ring", 42, 42, 186, true),
  sample(1091500, "Cyberpunk 2077", 57, 41, 94, true),
  sample(292030, "The Witcher 3: Wild Hunt", 78, 31, 120),
  sample(367520, "Hollow Knight", 63, 12, 38, true),
  sample(413150, "Stardew Valley", 40, 0, 4),
];

const PROFILE = {
  uid: "lab-user",
  displayName: "JavaXcript",
  bannerURL: "https://cdn.cloudflare.steamstatic.com/steam/apps/1245620/library_hero.jpg#pf=60,40,1.5",
  bio: "Platinando o que dá e abandonando o resto.",
  steamId: "76561198000000000",
  steamUsername: "javaxcript",
  discordId: "1",
  discordUsername: "javaxcript",
  favoriteGenres: ["RPG", "Ação", "Indie"],
} as unknown as UserProfile;

const DesignLabProfile: React.FC = () => {
  const framing = new URLSearchParams(window.location.hash.split("?")[1] ?? "").get("framing");
  return (
  <NotificationProvider>
    <AuthProvider>
      <PreferencesProvider>
        <GamepadProvider>
          <TooltipProvider>
            <div className="flex h-full flex-col">
              <UserProfilePage userProfile={PROFILE} user={null} games={GAMES} editable={false} />
              {framing && (
                <ProfileFramingModal
                  isOpen
                  kind={framing === "avatar" ? "avatar" : "banner"}
                  src={PROFILE.bannerURL as string}
                  initial={DEFAULT_FRAMING}
                  onApply={() => undefined}
                  onClose={() => undefined}
                />
              )}
            </div>
          </TooltipProvider>
        </GamepadProvider>
      </PreferencesProvider>
    </AuthProvider>
  </NotificationProvider>
  );
};

export default DesignLabProfile;
