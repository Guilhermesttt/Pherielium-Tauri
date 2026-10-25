import React from "react";
import { IncomingCallModal } from "../components/voice/IncomingCallModal";
import { GamepadProvider } from "../context/GamepadContext";

/**
 * Laboratório (só em desenvolvimento): o modal de chamada recebida com um convite de exemplo.
 * Abrir: #/design-lab/call (opcional: ?video=1&stay=1). Atender/recusar fecham e reabrem em 1,5s; com stay=1, atender fica em "Entrando…".
 */
const DesignLabCall: React.FC = () => {
  const [open, setOpen] = React.useState(true);
  const params = new URLSearchParams(window.location.hash.split("?")[1] ?? "");
  const reopen = () => {
    setOpen(false);
    window.setTimeout(() => setOpen(true), 1500);
  };
  return (
    <GamepadProvider>
      <div className="h-screen bg-[var(--surface-base)] p-8 text-[var(--ink-muted)]">Fundo da aplicação</div>
      <IncomingCallModal
        isOpen={open}
        invite={{
          callerId: "lab-caller",
          callerName: "Sacrig",
          callerAvatar: null,
          chatId: "lab-chat",
          hasVideo: params.get("video") === "1",
          timestamp: Date.now(),
        }}
        onAccept={params.get("stay") === "1" ? () => undefined : reopen}
        onReject={reopen}
      />
    </GamepadProvider>
  );
};

export default DesignLabCall;
