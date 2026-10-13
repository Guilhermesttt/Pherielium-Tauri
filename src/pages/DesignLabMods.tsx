import React from "react";
import { AuthProvider } from "../auth/AuthProvider";
import { NotificationProvider } from "../components/NotificationCenter";
import { PreferencesProvider } from "../context/PreferencesContext";
import { GamepadProvider } from "../context/GamepadContext";
import { TooltipProvider } from "../components/ui/tooltip";
import ModsPage from "./ModsPage";
import type { Game } from "../types/domain";

/**
 * Laboratório (só em desenvolvimento): a página REAL de Mods com jogos de exemplo, sem conta.
 * Usa um uid próprio ("design-lab"), então pastas e mods salvos aqui não se misturam com os de uma conta.
 * Abrir: #/design-lab/mods
 */
const sample = (appId: number, title: string): Game =>
  ({
    id: `steam-${appId}`,
    title,
    image: `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`,
    steamAppId: appId,
    launcherType: "steam",
  }) as unknown as Game;

const GAMES: Game[] = [
  sample(1245620, "Elden Ring"),
  sample(1091500, "Cyberpunk 2077"),
  sample(292030, "The Witcher 3: Wild Hunt"),
  sample(489830, "The Elder Scrolls V: Skyrim Special Edition"),
  sample(413150, "Stardew Valley"),
  sample(1174180, "Red Dead Redemption 2"),
  sample(377160, "Fallout 4"),
  sample(1086940, "Baldur's Gate 3"),
];

const DesignLabMods: React.FC = () => (
  <NotificationProvider>
    <AuthProvider>
      <PreferencesProvider>
        <GamepadProvider>
          <TooltipProvider>
            <div className="flex h-full flex-col">
              <ModsPage uid="design-lab" games={GAMES} />
            </div>
          </TooltipProvider>
        </GamepadProvider>
      </PreferencesProvider>
    </AuthProvider>
  </NotificationProvider>
);

export default DesignLabMods;
