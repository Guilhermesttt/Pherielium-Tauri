import React from "react";
import { NotificationProvider } from "../components/NotificationCenter";
import { PreferencesProvider } from "../context/PreferencesContext";
import { GamepadProvider } from "../context/GamepadContext";
import { ConsolePageLayout } from "../components/ui/ConsolePageLayout";
import { FriendsSubTabs, type SocialSubTab } from "../components/social/FriendsSubTabs";
import { FriendsRoster, type RosterFilter } from "../components/friends/FriendsRoster";
import { FriendsPageActions } from "../pages/FriendsPage";
import type { Game, SocialFriend } from "../types/domain";

/**
 * Laboratório (só em desenvolvimento): a aba Amigos com dados de exemplo, sem conta nem voz.
 * Usa as mesmas peças da página real (cabeçalho, abas e quadro). Abrir: #/design-lab/friends
 */
const steamCover = (appId: number) => `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`;

const GAMES = [
  { id: "steam-1091500", title: "Cyberpunk 2077", image: steamCover(1091500), cardImage: steamCover(1091500) },
  { id: "steam-1245620", title: "Elden Ring", image: steamCover(1245620), cardImage: steamCover(1245620) },
] as unknown as Game[];

const friend = (n: number, name: string, status: SocialFriend["status"], playing?: string, lastSeen?: number): SocialFriend => ({
  id: `checkpoint:lab-${n}`,
  name,
  status,
  playing,
  source: "checkpoint",
  lastSeen,
});

const HOUR = 3_600_000;
const FRIENDS: SocialFriend[] = [
  friend(1, "Marina", "playing", "Cyberpunk 2077"),
  friend(2, "Thiago", "playing", "Cyberpunk 2077"),
  friend(3, "Beatriz", "playing", "Elden Ring"),
  friend(4, "Rafa", "online"),
  friend(5, "Lívia", "idle"),
  friend(6, "Caio", "dnd"),
  friend(7, "Duda", "offline", undefined, Date.now() - 3 * HOUR),
  friend(8, "Henrique", "offline", undefined, Date.now() - 52 * HOUR),
];

const noop = () => {};

const DesignLabFriends: React.FC = () => {
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<RosterFilter>("ALL");
  const [tab, setTab] = React.useState<SocialSubTab>("AMIGOS");
  const online = FRIENDS.filter((f) => f.status !== "offline").length;
  const playing = FRIENDS.filter((f) => f.status === "playing").length;
  return (
    <NotificationProvider>
      <PreferencesProvider>
        <GamepadProvider>
          <div className="flex h-full flex-col">
            <ConsolePageLayout
              title="Amigos"
              readings={[
                { label: "Amigos", value: FRIENDS.length },
                { label: "Online", value: online },
                { label: "Jogando", value: playing, live: true },
              ]}
              actions={<FriendsPageActions dnd={false} onToggleDnd={noop} onAddFriendClick={noop} />}
              tabs={
                <FriendsSubTabs
                  activeTab={tab}
                  onTabChange={setTab}
                  incomingRequestsCount={2}
                  totalFriendsCount={FRIENDS.length}
                  unreadCount={3}
                />
              }
            >
              <FriendsRoster
                friends={FRIENDS}
                games={GAMES}
                unreadByFriend={{ "lab-1": 2 }}
                search={search}
                onSearchChange={setSearch}
                filter={filter}
                onFilterChange={setFilter}
                isCallActiveWith={() => false}
                onOpenChat={noop}
                onViewProfile={noop}
                onRemoveFriend={noop}
                discord={{ connected: false, onConnect: noop }}
              />
            </ConsolePageLayout>
          </div>
        </GamepadProvider>
      </PreferencesProvider>
    </NotificationProvider>
  );
};

export default DesignLabFriends;
