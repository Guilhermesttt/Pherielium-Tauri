import React from "react";
import { AuthProvider } from "../auth/AuthProvider";
import { NotificationProvider } from "../components/NotificationCenter";
import { PreferencesProvider } from "../context/PreferencesContext";
import { GamepadProvider } from "../context/GamepadContext";
import { TooltipProvider } from "../components/ui/tooltip";
import TrophiesPage from "../components/TrophiesPage";
import type { Game } from "../types/domain";

/**
 * Laboratório (só em desenvolvimento): a página REAL de Troféus com jogos de exemplo, sem conta.
 * As capas vêm do CDN público da Steam (as mesmas URLs que o app usa para jogos da Steam).
 * Abrir: #/design-lab/trophies
 */
const steamCover = (appId: number) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`;

const sample = (id: number, title: string, total: number, completed: number, hours: number): Game =>
  ({
    id: `steam-${id}`,
    title,
    image: steamCover(id),
    cardImage: steamCover(id),
    launcherType: "steam",
    totalAchievements: total,
    completedAchievements: completed,
    hoursPlayed: hours,
  }) as unknown as Game;

const GAMES: Game[] = [
  sample(1245620, "Elden Ring", 42, 42, 186),
  sample(1091500, "Cyberpunk 2077", 57, 41, 94),
  sample(292030, "The Witcher 3: Wild Hunt", 78, 31, 120),
  sample(367520, "Hollow Knight", 63, 12, 38),
  sample(413150, "Stardew Valley", 40, 0, 4),
];

const DesignLabTrophies: React.FC = () => (
  <NotificationProvider>
    <AuthProvider>
      <PreferencesProvider>
        <GamepadProvider>
          <TooltipProvider>
            <div className="flex h-full flex-col">
              <TrophiesPage games={GAMES} />
            </div>
          </TooltipProvider>
        </GamepadProvider>
      </PreferencesProvider>
    </AuthProvider>
  </NotificationProvider>
);

export default DesignLabTrophies;
