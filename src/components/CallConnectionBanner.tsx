import React from "react";

type Props = {
  status: "idle" | "connecting" | "connected" | "poor" | "error";
  onRetry?: () => void;
};

export const CallConnectionBanner: React.FC<Props> = ({ status, onRetry }) => {
  if (status === "connected" || status === "idle") return null;

  const message =
    status === "connecting"
      ? "Conectando chamada..."
      : status === "poor"
      ? "Conexão fraca — áudio pode falhar"
      : "Erro na chamada";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[1000] px-4 py-2 bg-black/70 text-white rounded-lg shadow-lg"
    >
      <div className="flex items-center gap-4">
        <div className="font-medium">{message}</div>
        {onRetry && (
          <button onClick={onRetry} className="ml-2 btn" aria-label="Tentar novamente">
            Tentar novamente
          </button>
        )}
      </div>
    </div>
  );
};

export default CallConnectionBanner;
