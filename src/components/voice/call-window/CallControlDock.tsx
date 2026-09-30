import React from "react";
import {
  Mic,
  MicOff,
  Volume2,
  VolumeX,
  Video,
  VideoOff,
  MonitorUp,
  MonitorOff,
  Settings,
  UserPlus,
  PhoneOff,
  Sparkles,
} from "lucide-react";
import { CallControlButton } from "./CallControlButton";

interface CallControlDockProps {
  isMuted: boolean;
  isDeafened: boolean;
  isCameraOn?: boolean;
  isSharingScreen: boolean;
  isSettingsOpen: boolean;
  isOnlyOnePerson: boolean;
  isMicAvailable?: boolean;
  isCameraAvailable?: boolean;
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleCamera?: () => void;
  onToggleScreenShare?: () => void;
  onToggleSettings: () => void;
  onOpenOrbloomCustomizer?: () => void;
  onHangUp?: () => void;
}

export const CallControlDock: React.FC<CallControlDockProps> = ({
  isMuted,
  isDeafened,
  isCameraOn = false,
  isSharingScreen,
  isSettingsOpen,
  isOnlyOnePerson,
  isMicAvailable = true,
  isCameraAvailable = true,
  onToggleMute,
  onToggleDeafen,
  onToggleCamera,
  onToggleScreenShare,
  onToggleSettings,
  onOpenOrbloomCustomizer,
  onHangUp,
}) => {
  // Estado do microfone: Ligado | Desligado | Indisponível
  const micTooltip = !isMicAvailable
    ? "Microfone indisponível (nenhum dispositivo conectado)"
    : isMuted
    ? "Ativar microfone (Mutado)"
    : "Silenciar microfone (Ativo)";

  const micVariant = !isMicAvailable ? "ghost" : isMuted ? "muted" : "default";

  // Estado da câmera: Ligada | Desligada | Indisponível
  const cameraTooltip = !isCameraAvailable
    ? "Câmera indisponível (nenhuma webcam conectada)"
    : isCameraOn
    ? "Desligar câmera"
    : "Ligar câmera";

  const cameraVariant = !isCameraAvailable ? "ghost" : isCameraOn ? "active" : "default";

  return (
    <nav
      aria-label="Controles da chamada"
      style={{
        cornerShape: "squircle",
      } as React.CSSProperties}
      className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 rounded-[22px] bg-[#0F0F0F] border border-[#161616] shadow-[0_20px_50px_rgba(0,0,0,0.7),inset_0_1px_0_rgba(255,255,255,0.06)] select-none shrink-0"
    >
      {/* Grupo Principal: Comunicação Ativa (Microfone, Som, Câmera, Transmissão) */}
      <div className="flex items-center gap-1.5" role="group" aria-label="Controles de mídia">
        <CallControlButton
          icon={
            !isMicAvailable ? (
              <MicOff className="h-4.5 w-4.5 opacity-40" />
            ) : isMuted ? (
              <MicOff className="h-4.5 w-4.5" />
            ) : (
              <Mic className="h-4.5 w-4.5" />
            )
          }
          tooltip={micTooltip}
          variant={micVariant}
          disabled={!isMicAvailable}
          onClick={onToggleMute}
        />

        <CallControlButton
          icon={isDeafened ? <VolumeX className="h-4.5 w-4.5" /> : <Volume2 className="h-4.5 w-4.5" />}
          tooltip={isDeafened ? "Reativar áudio da chamada" : "Silenciar saída de áudio (Deafen)"}
          variant={isDeafened ? "muted" : "default"}
          onClick={onToggleDeafen}
        />

        {onToggleCamera && (
          <CallControlButton
            icon={
              !isCameraAvailable ? (
                <VideoOff className="h-4.5 w-4.5 opacity-40" />
              ) : isCameraOn ? (
                <Video className="h-4.5 w-4.5" />
              ) : (
                <VideoOff className="h-4.5 w-4.5" />
              )
            }
            tooltip={cameraTooltip}
            variant={cameraVariant}
            disabled={!isCameraAvailable}
            onClick={onToggleCamera}
          />
        )}

        {onToggleScreenShare && (
          <CallControlButton
            icon={isSharingScreen ? <MonitorOff className="h-4.5 w-4.5" /> : <MonitorUp className="h-4.5 w-4.5" />}
            tooltip={isSharingScreen ? "Interromper transmissão de tela" : "Compartilhar tela ou aplicativo"}
            variant={isSharingScreen ? "active" : "default"}
            onClick={onToggleScreenShare}
          />
        )}
      </div>

      {/* Divisor Visual Sutil Base 4/8 */}
      <div className="w-px h-6 bg-white/[0.08] mx-1 shrink-0" aria-hidden="true" />

      {/* Grupo Secundário: Ajustes & Personalização da Esfera */}
      <div className="flex items-center gap-1.5" role="group" aria-label="Ajustes e efeitos">
        {onOpenOrbloomCustomizer && (
          <CallControlButton
            icon={<Sparkles className="h-4 w-4" />}
            tooltip="Personalizar Esfera de Luz (Orbloom)"
            variant="default"
            onClick={onOpenOrbloomCustomizer}
          />
        )}

        <CallControlButton
          icon={<Settings className="h-4 w-4" />}
          tooltip="Ajustes de Áudio & Dispositivos"
          variant={isSettingsOpen ? "active" : "default"}
          onClick={onToggleSettings}
        />
      </div>

      {/* Divisor Visual Sutil Base 4/8 */}
      <div className="w-px h-6 bg-white/[0.08] mx-1 shrink-0" aria-hidden="true" />

      {/* Grupo Destrutivo: Sair da Chamada */}
      <CallControlButton
        icon={<PhoneOff className="h-4 w-4" />}
        label="Sair da chamada"
        tooltip="Sair da chamada"
        variant="danger"
        size="lg"
        onClick={onHangUp}
      />
    </nav>
  );
};
