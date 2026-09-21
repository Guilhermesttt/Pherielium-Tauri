import React from "react";
import { motion } from "framer-motion";
import { MicOff, VolumeX, Camera, Monitor, Pin } from "lucide-react";
import type { CallFeed } from "../VoiceCallWindow";
import { VideoRenderer } from "./VideoRenderer";

interface ParticipantTileProps {
  feed: CallFeed;
  isFocused?: boolean;
  isPresenting?: boolean;
  onSelect?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}

const ParticipantTileComponent: React.FC<ParticipantTileProps> = ({
  feed,
  isFocused = false,
  isPresenting = false,
  onSelect,
  onContextMenu,
}) => {
  const isSpeaking = Boolean(feed.isSpeaking);

  return (
    <motion.div
      layout
      role="button"
      tabIndex={0}
      whileTap={{ scale: 0.97 }}
      transition={{ type: "spring", bounce: 0.2, duration: 0.3 }}
      onClick={onSelect}
      onContextMenu={onContextMenu}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect?.();
        }
      }}
      aria-label={`${feed.title}${feed.isLocal ? " (Você)" : ""}`}
      title={`${feed.title}${feed.isLocal ? " (Você)" : ""} — Clique para focar, clique direito para opções`}
      style={{
        cornerShape: "squircle",
      } as React.CSSProperties}
      className={`group relative flex items-center gap-2.5 px-3 py-2 rounded-[18px] select-none cursor-pointer transition-colors duration-200 shrink-0 min-w-[130px] max-w-[190px] h-[52px] outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
        isFocused
          ? "bg-white/[0.12] text-white border border-white/40 shadow-[0_4px_16px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.15)]"
          : isPresenting
          ? "bg-[#0F0F0F]/90 text-white border border-sky-400/50 shadow-[0_2px_12px_rgba(56,189,248,0.18),inset_0_1px_0_rgba(255,255,255,0.08)]"
          : isSpeaking
          ? "bg-[#0F0F0F]/90 text-white border border-emerald-400/50 shadow-[0_2px_12px_rgba(52,211,153,0.15),inset_0_1px_0_rgba(255,255,255,0.08)] -translate-y-0.5"
          : "bg-[#0F0F0F]/80 text-white/85 hover:bg-[#151515]/90 hover:text-white border border-[#161616] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]"
      }`}
    >
      {/* Avatar / Camera Thumbnail */}
      <div className="relative h-8 w-8 rounded-full overflow-hidden shrink-0 bg-[#141414] border border-[#161616] flex items-center justify-center">
        {feed.cameraStream ? (
          <VideoRenderer
            stream={feed.cameraStream}
            fitMode="cover"
            muted={feed.isLocal}
            className="h-full w-full"
          />
        ) : feed.avatar ? (
          <img
            src={feed.avatar}
            alt={feed.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="text-[11px] font-bold text-white/80 font-mono">
            {feed.title.slice(0, 2).toUpperCase()}
          </span>
        )}

        {/* Micro indicador de fala na borda do avatar */}
        {isSpeaking && (
          <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-[#0F0F0F]" />
        )}
      </div>

      {/* Info: Nome e Ícones de Status */}
      <div className="flex flex-col min-w-0 flex-1 justify-center">
        <div className="flex items-center gap-1.5">
          <span className={`text-xs font-semibold tracking-tight truncate ${isPresenting ? "text-sky-300" : ""}`}>
            {feed.isLocal ? `${feed.title} (Você)` : feed.title}
          </span>
        </div>

        {/* Status secundário em linha discreta */}
        <div className="flex items-center gap-1.5 text-[10px] text-white/60">
          {isPresenting ? (
            <span className="flex items-center gap-1 text-sky-300 font-medium">
              <Monitor className="h-2.5 w-2.5" aria-hidden="true" />
              <span>Transmitindo</span>
            </span>
          ) : feed.isDeafened ? (
            <span className="flex items-center gap-1 text-rose-400">
              <VolumeX className="h-2.5 w-2.5" aria-hidden="true" />
              <span>Surdo</span>
            </span>
          ) : feed.isMuted ? (
            <span className="flex items-center gap-1 text-rose-400">
              <MicOff className="h-2.5 w-2.5" aria-hidden="true" />
              <span>Mudo</span>
            </span>
          ) : isSpeaking ? (
            <span className="text-emerald-400 font-medium">Falando</span>
          ) : (
            <span className="text-white/50">Conectado</span>
          )}

          {feed.isCamera && !feed.cameraStream && (
            <Camera className="h-2.5 w-2.5 text-white/50 shrink-0" aria-hidden="true" />
          )}
        </div>
      </div>

      {/* Hover Pin Indicator */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSelect?.();
        }}
        className={`ml-auto shrink-0 flex h-6 w-6 items-center justify-center rounded-full transition-opacity outline-none focus-visible:ring-1 focus-visible:ring-white/40 ${
          isFocused ? "opacity-100 text-white" : "opacity-0 group-hover:opacity-100 text-white/40 hover:text-white"
        }`}
        title={isFocused ? "Desafixar este participante" : "Fixar este participante"}
        aria-label={isFocused ? "Desafixar este participante" : "Fixar este participante"}
      >
        <Pin className={`h-3 w-3 ${isFocused ? "fill-white text-white" : ""}`} aria-hidden="true" />
      </button>
    </motion.div>
  );
};

export const ParticipantTile = React.memo(ParticipantTileComponent);
