import React, { useEffect, useMemo, useState } from "react";
import { GamepadProvider } from "../context/GamepadContext";
import { PreferencesProvider } from "../context/PreferencesContext";
import { ConsoleHome } from "../components/home/console/ConsoleHome";
import { GameEnvironment } from "../components/home/GameEnvironment";
import { HomeTopNav } from "../components/home/HomeTopNav";
import { TooltipProvider } from "../components/ui/tooltip";
import {
  buildConsoleRow,
  resolveWallFocus,
  stepColumn,
  stepRow,
} from "../components/home/console/consoleRows";
import type { Game } from "../types/domain";

/**
 * Laboratório (só em desenvolvimento): a Home estilo console (arte em tela cheia + fileira de capas) com jogos de exemplo,
 * sem conta e sem Tauri. Setas andam pelas capas; Enter/clique no pôster em foco não faz nada aqui.
 * As artes vêm do CDN público da Steam.
 * Abrir: #/design-lab/console (opcional: ?game=steam-440&trophy=1&running=1)
 */
const steam = (appId: number, file: string) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/${file}`;

const sample = (
  appId: number,
  title: string,
  extra: Partial<Game> & { hoursPlayed?: number } = {},
): Game =>
  ({
    id: `steam-${appId}`,
    title,
    launcherType: "steam",
    steamAppId: String(appId),
    image: steam(appId, "library_600x900.jpg"),
    cardImage: steam(appId, "library_600x900.jpg"),
    backgroundImage: steam(appId, "library_hero.jpg"),
    ...extra,
  }) as unknown as Game;

const GAMES: Game[] = [
  sample(1245620, "Elden Ring", { hoursPlayed: 186.4, totalAchievements: 42, completedAchievements: 31, isFavorite: true, lastPlayedAt: "2026-10-20T21:30:00Z" }),
  sample(1091500, "Cyberpunk 2077", { hoursPlayed: 77.8, lastPlayedAt: "2026-10-18T20:00:00Z" }),
  sample(550, "Left 4 Dead 2", { hoursPlayed: 70.3, lastPlayedAt: "2026-10-12T20:00:00Z" }),
  sample(730, "Counter-Strike 2", { hoursPlayed: 842.8, isFavorite: true, lastPlayedAt: "2026-10-22T20:00:00Z" }),
  sample(1145360, "Hades", { hoursPlayed: 31.2, totalAchievements: 49, completedAchievements: 12 }),
  sample(413150, "Stardew Valley", { hoursPlayed: 120.5, isFavorite: true }),
  sample(1086940, "Baldur's Gate 3", { hoursPlayed: 96.1 }),
  sample(440, "Team Fortress 2", { hoursPlayed: 12.4 }),
  sample(2050650, "Resident Evil 4", { launcherType: "epic" } as Partial<Game>),
  sample(252950, "Rocket League", { launcherType: "epic", hoursPlayed: 54 } as Partial<Game>),
  sample(2379780, "Balatro", { launcherType: "local" } as Partial<Game>),
];

const DesignLabConsole: React.FC = () => {
  const recent = useMemo(
    () => GAMES.filter((g) => g.lastPlayedAt).sort((a, b) => String(b.lastPlayedAt).localeCompare(String(a.lastPlayedAt))),
    [],
  );
  const rows = useMemo(() => buildConsoleRow(GAMES, recent, { isAllCategory: true, title: "Biblioteca" }), [recent]);
  // ?row=2&game=steam-440 abre já numa fileira e num jogo (útil para capturas sem transição)
  const params = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
  const [activeRow, setActiveRow] = useState(() => Number(params.get("row")) || 0);
  const [gameId, setGameId] = useState<string | undefined>(() => params.get("game") ?? recent[0]?.id);
  const focus = resolveWallFocus(rows, activeRow, gameId);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        const game = stepColumn(rows, focus, event.key === "ArrowRight" ? 1 : -1);
        if (game) setGameId(game.id);
      } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        const next = stepRow(rows, focus, event.key === "ArrowDown" ? 1 : -1);
        if (next) {
          setActiveRow(next.row);
          setGameId(next.game.id);
        }
      } else return;
      event.preventDefault();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rows, focus]);

  return (
    <PreferencesProvider>
      <GamepadProvider>
        <TooltipProvider>
        <GameEnvironment
          sharp
          artwork={rows[focus.row]?.games[focus.col]?.backgroundImage}
          className="left-0"
        />
        <div className="relative z-10 flex h-screen flex-col overflow-hidden">
          <HomeTopNav
            activeCategory="ALL"
            onSelectCategory={() => {}}
            games={GAMES}
            searchTerm=""
            onSearchChange={() => {}}
            searchOpen={false}
            onToggleSearch={() => {}}
            onOpenAddGame={() => {}}
            onOpenFilterModal={() => {}}
            onSyncLibraries={() => {}}
            userDisplay="JavaXcript"
            playSound={() => {}}
            onOpenProfile={() => {}}
            onOpenSettings={() => {}}
            onLogout={() => {}}
          />
          <ConsoleHome
            rows={rows}
            focus={focus}
            // ?trophy=1 e ?running=1 simulam o último troféu e a sessão (o laboratório não tem conta)
            focusedIsRunning={params.get("running") === "1"}
            lastTrophy={params.get("trophy") === "1" ? { name: "Sobrevivente do Apocalipse", unlockedAtMs: Date.now() - 2 * 86_400_000 } : undefined}
            sessionStartedAt={params.get("running") === "1" ? Date.now() - 72 * 60_000 : null}
            onFocus={(row, game) => {
              setActiveRow(row);
              setGameId(game.id);
            }}
            onOpenDetails={() => {}}
            onMenuAction={() => {}}
            onStep={(delta) => {
              const game = stepColumn(rows, focus, delta);
              if (game) setGameId(game.id);
            }}
            playSound={() => {}}
          />
        </div>
        </TooltipProvider>
      </GamepadProvider>
    </PreferencesProvider>
  );
};

export default DesignLabConsole;
