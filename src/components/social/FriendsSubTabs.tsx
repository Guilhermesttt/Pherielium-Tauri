import React from "react";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import { useGamepad } from "../../context/GamepadContext";
import { ControllerButtonGlyph } from "../ui/ControllerButtonGlyph";
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

/**
 * Abas da página de Amigos no formato das abas da Home: caixa alta pequena, a ativa com contorno
 * de tinta e, com controle conectado, os chips LB e RB nas pontas (os mesmos que trocam de aba).
 */
export const FriendsSubTabs: React.FC<FriendsSubTabsProps> = ({
  activeTab,
  onTabChange,
  incomingRequestsCount,
  unreadCount,
  playSound,
}) => {
  const gamepad = useGamepad();
  const family = gamepad?.gamepadFamily || "xbox";
  const connected = Boolean(gamepad?.isGamepadConnected);

  const tabs: { id: SocialSubTab; label: string; badge?: number }[] = [
    { id: "AMIGOS", label: "Amigos" },
    { id: "CHAT", label: "Chats", badge: unreadCount },
    { id: "SALAS", label: "Canais de voz" },
    { id: "SOLICITAÇÕES", label: "Solicitações", badge: incomingRequestsCount },
  ];

  return (
    <div className="console-tabs flex max-w-full min-w-0 items-center gap-2" role="tablist" aria-label="Seções de amigos">
      {connected && (
        <span className="console-bumper" title="Aba anterior" aria-hidden="true">
          <ControllerButtonGlyph button="LB" gamepadFamily={family} size={16} />
        </span>
      )}
      <HorizontalTabs
        activeId={activeTab}
        onChange={(id) => {
          if (id === activeTab) return;
          onTabChange(id as SocialSubTab);
          playSound?.("select");
        }}
        className="t-tabs--squircle min-w-0 flex-wrap"
        tabClassName="flex h-12 items-center gap-2.5 text-[length:var(--fs-label)] font-bold uppercase tracking-[0.06em] whitespace-nowrap select-none"
        tabs={tabs.map((tab) => ({
          id: tab.id,
          label: (
            <span className="flex items-center gap-2.5" onMouseEnter={() => playSound?.("hover")}>
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span className="font-metric min-w-5 rounded-full bg-[var(--tone-4)] px-1.5 text-center text-[length:var(--step-0)] font-bold leading-5 text-[var(--ink)]">
                  {tab.badge}
                </span>
              )}
            </span>
          ),
        }))}
      />
      {connected && (
        <span className="console-bumper" title="Próxima aba" aria-hidden="true">
          <ControllerButtonGlyph button="RB" gamepadFamily={family} size={16} />
        </span>
      )}
    </div>
  );
};
