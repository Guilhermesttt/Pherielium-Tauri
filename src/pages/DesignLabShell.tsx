import React from "react";
import { FriendsRail } from "../components/friends/FriendsRail";
import { HeroGame } from "../components/home/HeroGame";
import { GameDetailTrophies } from "../components/game-detail/GameDetailTrophies";
import { GameDetailModsCard } from "../components/game-detail/GameDetailModsCard";
import { calculateGameTrophyCounts } from "../utils/trophyTiers";
import CommandPalette from "../components/CommandPalette";
import { GameNightModal } from "../components/voice/GameNightModal";
import { AchievementReveal } from "../components/notch/AchievementReveal";
import type { NotchEvent } from "../components/notch/notchEvent";
import Sidebar from "../components/Sidebar";
import { GamepadProvider } from "../context/GamepadContext";
import { TooltipProvider } from "../components/ui/tooltip";
import { AmbientBackdrop } from "../components/ui/refined/AmbientBackdrop";
import { Surface } from "../components/ui/refined/Surface";
import type { Game, SocialFriend } from "../types/domain";

/**
 * Laboratório (só em desenvolvimento): peças do shell novo (painel de amigos fixo, fundo ambiente,
 * superfícies com borda interna e métricas em Geist Mono), sem conta e sem Tauri.
 * A gaveta de amigos abre ao encostar o mouse na borda direita.
 * A sidebar abre ao encostar o mouse na borda esquerda.
 * Abrir: #/design-lab/shell
 */
const FRIENDS: SocialFriend[] = [
  { id: "checkpoint:1", name: "Sacrig", status: "playing", playing: "Counter-Strike 2", source: "checkpoint" },
  { id: "checkpoint:2", name: "Octalise", status: "playing", playing: "Hades II", source: "checkpoint" },
  { id: "checkpoint:3", name: "Aqua Nova", status: "playing", playing: "Counter-Strike 2", source: "checkpoint" },
  { id: "checkpoint:4", name: "Crimson", status: "online", source: "checkpoint" },
  { id: "checkpoint:5", name: "Stellar", status: "idle", source: "checkpoint" },
  { id: "checkpoint:6", name: "Nebula Knight", status: "dnd", source: "checkpoint" },
  { id: "checkpoint:7", name: "Iam Morrisson", status: "offline", source: "checkpoint" },
  { id: "checkpoint:8", name: "Zeca", status: "offline", source: "checkpoint" },
  { id: "checkpoint:9", name: "Fabi", status: "in_call", source: "checkpoint" },
];

const HERO_GAME = {
  id: "lab-1",
  title: "Counter-Strike 2",
  hoursPlayed: 842.3,
  totalAchievements: 167,
  completedAchievements: 98,
  lastPlayedAt: "2026-10-20T10:00:00Z",
} as unknown as Game;

const REVEALS: NotchEvent[] = (["bronze", "gold", "platinum"] as const).map((tier, i) => ({
  id: `lab-${tier}`,
  kind: "achievement",
  title: ["Primeiros passos", "Mestre das armas", "Lenda de Night City"][i],
  description: "Descrição curta da conquista, em até duas linhas para caber no pop-up.",
  gameTitle: "Cyberpunk 2077",
  xp: [15, 90, 300][i],
  tier,
  queued: i === 1 ? 2 : 0,
  at: 0,
}));

const PALETTE_GAMES = [
  { id: "g1", title: "Counter-Strike 2", launcherType: "steam", category: "Tiro", lastPlayedAt: "2026-10-21T10:00:00Z" },
  { id: "g2", title: "Hades II", launcherType: "epic", category: "Ação", isFavorite: true, lastPlayedAt: "2026-10-10T10:00:00Z" },
  { id: "g3", title: "Hollow Knight", launcherType: "steam", category: "Aventura" },
] as unknown as Game[];

const LAB_COUNTS = calculateGameTrophyCounts(42, 31);
const LAB_MODS = [
  { id: "m1", name: "Seamless Co-op", enabled: true },
  { id: "m2", name: "Unlock the Fps", enabled: true },
  { id: "m3", name: "Better Loot Filter", enabled: false },
];

const DesignLabShell: React.FC = () => {
  const [paletteOpen, setPaletteOpen] = React.useState(false);
  const [nightOpen, setNightOpen] = React.useState(false);
  const [empty, setEmpty] = React.useState(false);
  const [category, setCategory] = React.useState("TROPHIES");
  return (
    <GamepadProvider>
    <TooltipProvider>
    <div className="relative flex h-screen w-full overflow-hidden bg-[var(--surface-base)] text-[var(--ink)]">
      <AmbientBackdrop color="rgb(88, 101, 242)" intensity={0.3} />
      <main className="relative z-10 flex min-w-0 flex-1 flex-col gap-6 overflow-y-auto p-8">
        <header className="flex items-end justify-between">
          <div>
            <p className="text-[length:var(--step-0)] text-[var(--ink-muted)]">Retomar</p>
            <h1 className="font-display text-[length:var(--step-5)] leading-none">Counter-Strike 2</h1>
          </div>
          <button
            type="button"
            onClick={() => setNightOpen(true)}
            className="rounded-[var(--node)] bg-[var(--tone-2)] px-4 py-2 text-[length:var(--step-0)] hover:bg-[var(--tone-3)]"
          >
            Noite de jogo
          </button>
          <button
            type="button"
            onClick={() => setPaletteOpen(true)}
            className="rounded-[var(--node)] bg-[var(--tone-2)] px-4 py-2 text-[length:var(--step-0)] hover:bg-[var(--tone-3)]"
          >
            Abrir paleta
          </button>
          <button
            type="button"
            onClick={() => setEmpty((v) => !v)}
            className="rounded-[var(--node)] bg-[var(--tone-2)] px-4 py-2 text-[length:var(--step-0)] hover:bg-[var(--tone-3)]"
          >
            {empty ? "Com amigos" : "Sem amigos online"}
          </button>
        </header>

        <div className="relative h-[260px]">
          <HeroGame game={HERO_GAME} onOpenDetails={() => {}} onPlay={() => {}} />
        </div>

        <div className="grid grid-cols-3 gap-4">
          {[
            ["Ping", "24 ms"],
            ["FPS", "144"],
            ["Tempo jogado", "842,3 h"],
          ].map(([label, value]) => (
            <Surface key={label} tone={2} edge className="p-5">
              <p className="text-[length:var(--step-0)] text-[var(--ink-muted)]">{label}</p>
              <p className="font-metric mt-1 text-[length:var(--step-4)] text-[var(--ink)]">{value}</p>
            </Surface>
          ))}
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <GameDetailTrophies counts={LAB_COUNTS} unlocked={31} total={42} onOpenAll={() => {}} />
          <GameDetailModsCard mods={LAB_MODS} onOpenMods={() => {}} />
        </div>

        <div className="flex flex-wrap items-start gap-4">
          {REVEALS.map((event) => (
            <div key={event.id} className="w-[392px] rounded-[40px] bg-black p-4">
              <AchievementReveal event={event} />
            </div>
          ))}
        </div>

        <div className="flex flex-wrap gap-3">
          {(["iron", "bronze", "silver", "gold", "platinum"] as const).map((tier) => (
            <span
              key={tier}
              className="rounded-[var(--node)] px-3 py-1.5 text-[length:var(--step-0)] font-semibold"
              style={{
                color: `rgb(var(--tier-${tier}))`,
                backgroundColor: `rgb(var(--tier-${tier}) / 0.14)`,
              }}
            >
              {tier}
            </span>
          ))}
        </div>

        <Surface tone={1} edge corner="md" className="panel-glass p-5">
          <p className="text-[length:var(--step-1)] font-semibold">Painel em vidro</p>
          <p className="text-[length:var(--step-0)] text-[var(--ink-muted)]">Só para painéis que flutuam sobre imagem.</p>
        </Surface>
      </main>

      <FriendsRail
        friends={empty ? FRIENDS.filter((f) => f.status === "offline") : FRIENDS}
        pendingRequests={2}
        onOpenFriend={() => {}}
        onOpenFriends={() => {}}
        onOpenGameNight={() => setNightOpen(true)}
      />
      <GameNightModal
        isOpen={nightOpen}
        onClose={() => setNightOpen(false)}
        games={PALETTE_GAMES}
        friends={FRIENDS}
        hostName="JavaXcript"
        onCreateRoom={async () => ({ id: "lab-room" })}
        onSendInvite={async () => {}}
        notify={() => {}}
      />
      <CommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        games={PALETTE_GAMES}
        friends={FRIENDS}
      />
      <Sidebar
        activeCategory={category}
        onCategory={setCategory}
        settingsLabel="Ajustes"
        playSound={() => {}}
        notificationCount={3}
        userDisplay="JavaXcript"
        userLevel={6}
      />
    </div>
    </TooltipProvider>
    </GamepadProvider>
  );
};

export default DesignLabShell;
