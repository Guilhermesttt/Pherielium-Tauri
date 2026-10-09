import React from "react";
import { createRoot } from "react-dom/client";
import { IncomingCallModal } from "../../src/components/voice/IncomingCallModal";
import { CallControlDock } from "../../src/components/voice/call-window/CallControlDock";

const Dock: React.FC = () => {
  const [muted, setMuted] = React.useState(false);
  return (
    <div style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", zIndex: 100000 }}>
      <CallControlDock
        isMuted={muted}
        isDeafened={false}
        isCameraOn={false}
        isSharingScreen={false}
        isSettingsOpen={false}
        isOnlyOnePerson={false}
        onToggleMute={() => setMuted((m) => !m)}
        onToggleDeafen={() => {}}
        onToggleCamera={() => {}}
        onToggleScreenShare={() => {}}
        onToggleSettings={() => {}}
        onOpenOrbloomCustomizer={() => {}}
        onHangUp={() => {}}
      />
    </div>
  );
};

export function mount(el: HTMLElement, mode: "incoming" | "dock") {
  createRoot(el).render(
    mode === "incoming" ? (
      <IncomingCallModal
        isOpen
        invite={{ callerId: "u1", callerName: "Tania Castillo", callerAvatar: null, chatId: "c", hasVideo: false, timestamp: Date.now() } as never}
        onAccept={() => {}}
        onReject={() => {}}
      />
    ) : (
      <Dock />
    ),
  );
}
