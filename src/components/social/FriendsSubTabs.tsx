import React from "react";
import { MessageSquare, Phone, RadioReceiver, Users, UserPlus } from "lucide-react";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import { HorizontalTabs } from "../ui/HorizontalTabs";

export type SocialSubTab = "AMIGOS" | "CHAT" | "SALAS" | "SOLICITAÇÕES";

export interface FriendsSubTabsProps {
  activeTab: SocialSubTab;
  onTabChange: (tab: SocialSubTab) => void;
  incomingRequestsCount: number;
  totalFriendsCount: number;
  unreadCount: number;
  playSound?: (type: SoundEffectType) => void;
}

export const FriendsSubTabs: React.FC<FriendsSubTabsProps> = ({
  activeTab,
  onTabChange,
  incomingRequestsCount,
  unreadCount,
  playSound,
}) => {
  const tabs = [
    { id: "AMIGOS" as SocialSubTab, label: "Amigos", icon: Users },
    { id: "CHAT" as SocialSubTab, label: "Chats", icon: MessageSquare, badge: unreadCount },
    { id: "SALAS" as SocialSubTab, label: "Canais de Voz", icon: RadioReceiver },
    { id: "SOLICITAÇÕES" as SocialSubTab, label: "Solicitações", icon: UserPlus, badge: incomingRequestsCount },
  ];

  return (
    <div className="w-full flex justify-center mb-6 z-10 relative">
      {/* Abas sobre superfície sólida */}
      <div
        className="flex items-center rounded-full px-2 py-2 ring-1 ring-[color:var(--border-subtle)]"
        style={{ background: "var(--surface-raised)" }}
      >
        {/* Abas de Navegação */}
        <HorizontalTabs
          activeId={activeTab}
          onChange={(id) => {
            if (activeTab !== id) {
              onTabChange(id as SocialSubTab);
              playSound?.("select");
            }
          }}
          className="!bg-transparent !p-0 gap-1 border-0"
          tabClassName="flex items-center gap-2 !px-6 !py-3 !h-auto text-[length:var(--step-0)] font-semibold tracking-wide"
          tabs={tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return {
              id: tab.id,
              label: (
                <div className="flex items-center gap-2" onMouseEnter={() => playSound?.("hover")}>
                  <Icon className="w-4 h-4 opacity-70" />
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && tab.badge > 0 && (
                    <span
                      className={`ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1.5 text-[length:var(--step-0)] font-bold ${isActive
                        ? "bg-[var(--tabs-badge-active-bg)] text-[var(--tabs-badge-active-text)]"
                        : "bg-[var(--tone-4)] text-[var(--ink-muted)]"
                        }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </div>
              )
            };
          })}
        />

      </div>
    </div>
  );
};