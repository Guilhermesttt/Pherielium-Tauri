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
  onToggleMute: () => void;
  onToggleDeafen: () => void;
  onToggleCamera?: () => void;
  onToggleScreenShare?: () => void;
  onToggleSettings: () => void;
  onOpenInvite?: () => void;
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
  onToggleMute,
  onToggleDeafen,
  onToggleCamera,
  onToggleScreenShare,
  onToggleSettings,
  onOpenInvite,
  onOpenOrbloomCustomizer,
  onHangUp,
}) => {
  return (
    <nav
      aria-label="Controles da chamada"
      style={{
        cornerShape: "squircle",
      } as React.CSSProperties}
      className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 rounded-[22px] bg-[#0F0F0F]/80 border border-[#161616] backdrop-blur-xl shadow-[0_20px_50px_rgba(0,0,0,0.65),inset_0_1px_0_rgba(255,255,255,0.06)] select-none shrink-0"
    >
      {/* Grupo Primário: Comunicação (Mic, Som, Câmera, Tela) */}
      <div className="flex items-center gap-1.5">
        <CallControlButton
          icon={isMuted ? <MicOff className="h-4.5 w-4.5" /> : <Mic className="h-4.5 w-4.5" />}
          tooltip={isMuted ? "Ativar microfone (Desmutar)" : "Silenciar microfone (Mutar)"}
          variant={isMuted ? "muted" : "default"}
          onClick={onToggleMute}
        />

        <CallControlButton
          icon={isDeafened ? <VolumeX className="h-4.5 w-4.5" /> : <Volume2 className="h-4.5 w-4.5" />}
          tooltip={isDeafened ? "Reativar áudio da chamada" : "Silenciar todo o áudio (Deafen)"}
          variant={isDeafened ? "muted" : "default"}
          onClick={onToggleDeafen}
        />

        {onToggleCamera && (
          <CallControlButton
            icon={isCameraOn ? <Video className="h-4.5 w-4.5" /> : <VideoOff className="h-4.5 w-4.5" />}
            tooltip={isCameraOn ? "Desligar câmera" : "Ligar câmera"}
            variant={isCameraOn ? "active" : "default"}
            onClick={onToggleCamera}
          />
        )}

        {onToggleScreenShare && (
          <CallControlButton
            icon={isSharingScreen ? <MonitorOff className="h-4.5 w-4.5" /> : <MonitorUp className="h-4.5 w-4.5" />}
            tooltip={isSharingScreen ? "Interromper transmissão de tela" : "Transmitir tela ou aplicativo"}
            variant={isSharingScreen ? "active" : "default"}
            onClick={onToggleScreenShare}
          />
        )}
      </div>

      {/* Divisor Visual Sutil Base 4/8 */}
      <div className="w-px h-6 bg-[#161616] mx-1 shrink-0" />

      {/* Grupo Secundário: Ajustes */}
      <div className="flex items-center gap-1.5">
        {onOpenInvite && (
          <CallControlButton
            icon={<UserPlus className="h-4 w-4" />}
            tooltip="Convidar amigos para a chamada"
            variant="default"
            onClick={onOpenInvite}
            className="hidden sm:inline-flex"
          />
        )}

        {onOpenOrbloomCustomizer && (
          <CallControlButton
            icon={<Sparkles className="h-4 w-4" />}
            tooltip="Personalizar Orbloom"
            variant="default"
            onClick={onOpenOrbloomCustomizer}
          />
        )}

        <CallControlButton
          icon={<Settings className="h-4 w-4" />}
          tooltip="Ajustes de Áudio & Vídeo"
          variant={isSettingsOpen ? "active" : "default"}
          onClick={onToggleSettings}
        />
      </div>

      {/* Divisor Visual Sutil */}
      <div className="w-px h-6 bg-[#161616] mx-1 shrink-0" />

      {/* Grupo Destrutivo: Sair / Encerrar Chamada */}
      <CallControlButton
        icon={<PhoneOff className="h-4 w-4" />}
        label={isOnlyOnePerson ? "Encerrar" : "Desconectar"}
        tooltip={isOnlyOnePerson ? "Encerrar chamada" : "Desconectar da chamada"}
        variant="danger"
        size="lg"
        onClick={onHangUp}
      />
    </nav>
  );
};
