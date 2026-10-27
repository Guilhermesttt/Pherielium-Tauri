import React from "react";
import { AuthProvider } from "../auth/AuthProvider";
import { NotificationProvider } from "../components/NotificationCenter";
import { PreferencesProvider } from "../context/PreferencesContext";
import { GamepadProvider } from "../context/GamepadContext";
import { TooltipProvider } from "../components/ui/tooltip";
import { GameDetailPanel } from "../components/game-detail/GameDetailPanel";
import type { Game, SocialFriend } from "../types/domain";

/**
 * Laboratório (só em desenvolvimento): o painel REAL de detalhe de jogo, aberto com um jogo de
 * exemplo e amigos fictícios, sem conta. As artes vêm do CDN público da Steam.
 * Abrir: #/design-lab/detail
 */
const steam = (appId: number, file: string) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/${file}`;

const GAME = {
  id: "steam-1245620",
  title: "Elden Ring",
  launcherType: "steam",
  steamAppId: "1245620",
  category: "ROLEPLAYING",
  image: steam(1245620, "library_600x900.jpg"),
  cardImage: steam(1245620, "library_600x900.jpg"),
  backgroundImage: steam(1245620, "library_hero.jpg"),
  hoursPlayed: 186.4,
  lastPlayedAt: "2026-10-20T21:30:00Z",
  totalAchievements: 42,
  completedAchievements: 31,
  isFavorite: true,
} as unknown as Game;

const FRIENDS: SocialFriend[] = [
  { id: "c:1", name: "Sacrig", status: "playing", playing: "Elden Ring" },
  { id: "c:2", name: "Octalise", status: "online" },
  { id: "c:3", name: "Aqua Nova", status: "offline" },
];

const DesignLabDetail: React.FC = () => (
  <NotificationProvider>
    <AuthProvider>
      <PreferencesProvider>
        <GamepadProvider>
          <TooltipProvider>
            <GameDetailPanel game={GAME} isOpen onClose={() => {}} playSound={() => {}} friends={FRIENDS} />
          </TooltipProvider>
        </GamepadProvider>
      </PreferencesProvider>
    </AuthProvider>
  </NotificationProvider>
);

export default DesignLabDetail;
