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
  onlineCount: number;
  unreadCount: number;
  playSound?: (type: SoundEffectType) => void;
}

export const FriendsSubTabs: React.FC<FriendsSubTabsProps> = ({
  activeTab,
  onTabChange,
  incomingRequestsCount,
  onlineCount,
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
      {/* Container de fundo translúcido escuro (estilo "Pill" da imagem 1) */}
      <div
        className="flex items-center justify-between px-2 py-1.5 rounded-full border border-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_30px_rgba(0,0,0,0.6)]"
        style={{
          background: "rgba(255, 255, 255, 0.02)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
          minWidth: "720px", // Garante a largura ampla vista na referência
        }}
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
          tabClassName="flex items-center gap-2 px-5 py-2 !h-auto text-[13px] font-semibold tracking-wide"
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
                      className={`ml-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold ${isActive
                          ? "bg-white/20 text-white"
                          : "bg-white/10 text-white/70"
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

        {/* Status Badge "ONLINE X" à direita */}
        <div className="pl-4 pr-2">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/[0.03] border border-white/[0.05] shadow-inner">
            <span className="w-2 h-2 rounded-full bg-white animate-pulse shadow-[0_0_8px_rgba(255,255,255,0.8)]" />
            <span className="text-[11px] font-bold text-white/80 tracking-widest uppercase">
              Online {onlineCount}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};