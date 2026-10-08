import React from "react";
import { createRoot } from "react-dom/client";
import { FriendsRoster, type RosterFilter } from "../../src/components/friends/FriendsRoster";
import { ChatsPanel } from "../../src/components/friends/ChatsPanel";
import { RequestsPanel } from "../../src/components/friends/RequestsPanel";
import type { CheckpointFriendRequest, SocialFriend } from "../../src/types/domain";

const friends: SocialFriend[] = [
  { id: "cp:1", name: "Ana Souza", status: "playing", playing: "Hades II", level: 24, source: "checkpoint" },
  { id: "cp:2", name: "Leo", status: "playing", playing: "Counter-Strike 2", level: 12, source: "checkpoint" },
  { id: "cp:3", name: "Bia Martins", status: "online", level: 8, source: "checkpoint" },
  { id: "d:4", name: "Caio", status: "idle", source: "discord_friend" },
  { id: "cp:5", name: "Duda", status: "offline", lastSeen: Date.now() - 3 * 3600_000, source: "checkpoint" },
  { id: "cp:6", name: "Edu", status: "offline", lastSeen: Date.now() - 2 * 86400_000, source: "checkpoint" },
];

const Host: React.FC = () => {
  const [search, setSearch] = React.useState("");
  const [filter, setFilter] = React.useState<RosterFilter>("ALL");
  return (
    <FriendsRoster
      friends={friends}
      unreadByFriend={{ 1: 3 }}
      search={search}
      onSearchChange={setSearch}
      filter={filter}
      onFilterChange={setFilter}
      isCallActiveWith={() => false}
      onOpenChat={() => {}}
      onStartVoiceCall={() => {}}
      onViewProfile={() => {}}
      onRemoveFriend={() => {}}
      discord={{ connected: false, onConnect: () => {} }}
    />
  );
};

const requests = [
  { uid: "r1", displayName: "Marina Lopes" },
  { uid: "r2", displayName: "Tiago" },
] as unknown as CheckpointFriendRequest[];

const Stack: React.FC = () => (
  <div className="flex flex-col gap-8">
    <Host />
    <ChatsPanel
      friends={friends.filter((f) => f.source === "checkpoint")}
      unreadByFriend={{ 1: 3, 3: 1 }}
      onOpenChat={() => {}}
      onStartVoiceCall={() => {}}
      onAddFriend={() => {}}
    />
    <RequestsPanel requests={requests} onAccept={() => {}} onReject={() => {}} onAddFriend={() => {}} />
  </div>
);

export function mount(el: HTMLElement) {
  createRoot(el).render(<Stack />);
}
