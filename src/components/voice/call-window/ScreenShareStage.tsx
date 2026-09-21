import React, { useState } from "react";
import {
  Monitor,
  Scaling,
  Scan,
  PictureInPicture2,
  Maximize2,
  Volume2,
  VolumeX,
  Volume1,
  Pin,
} from "lucide-react";
import type { CallFeed } from "../VoiceCallWindow";
import { VideoRenderer } from "./VideoRenderer";

interface ScreenShareStageProps {
  feed: CallFeed;
  fitMode: "contain" | "cover";
  onToggleFitMode: () => void;
  onTogglePip: () => void;
  onRequestFullscreen: () => void;
  isFocused?: boolean;
  onToggleFocus?: () => void;
  streamerVolume?: number;
  onChangeStreamerVolume?: (vol: number) => void;
  localScreenStream?: MediaStream | null;
  notify?: (msg: string, type: "success" | "error" | "info") => void;
  onVideoElement?: (el: HTMLVideoElement | null) => void;
}

export const ScreenShareStage: React.FC<ScreenShareStageProps> = ({
  feed,
  fitMode,
  onToggleFitMode,
  onTogglePip,
  onRequestFullscreen,
  isFocused = true,
  onToggleFocus,
  streamerVolume = 100,
  onChangeStreamerVolume,
  localScreenStream,
  notify,
  onVideoElement,
}) => {
  const [isVolOpen, setIsVolOpen] = useState(false);

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden rounded-[24px] bg-[#0F0F0F]/80 border border-[#161616] shadow-[0_20px_60px_rgba(0,0,0,0.8)]">
      {/* Stream Video Render */}
      {feed.stream ? (
        <VideoRenderer
          stream={feed.stream}
          fitMode={fitMode}
          muted={feed.isLocal}
          className="h-full w-full"
          onVideoElement={onVideoElement}
        />
      ) : (
        <div className="flex flex-col items-center justify-center p-8 text-center text-white/50 space-y-2">
          <Monitor className="h-10 w-10 text-white/30 animate-pulse" aria-hidden="true" />
          <p className="text-sm font-semibold">Carregando transmissão…</p>
        </div>
      )}

      {/* Top Floating Badge & Action Toolbar (Overlay Discreto) */}
      <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none z-20">
        {/* Identificador de Transmissão */}
        <div
          style={{ cornerShape: "squircle" } as React.CSSProperties}
          className="flex items-center gap-2 px-3 py-1.5 rounded-[14px] bg-[#0F0F0F]/80 border border-[#161616] backdrop-blur-xl shadow-lg pointer-events-auto select-none"
        >
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-xs font-semibold text-white tracking-tight">
            {feed.title.replace(/^Tela de /i, "")}
          </span>
          <span className="text-[10px] font-medium text-white/50 pl-1 border-l border-[#161616]">
            Transmitindo tela
          </span>
        </div>

        {/* Toolbar de Ações da Stream */}
        <div
          style={{ cornerShape: "squircle" } as React.CSSProperties}
          className="flex items-center gap-1 p-1 rounded-[14px] bg-[#0F0F0F]/80 border border-[#161616] backdrop-blur-xl shadow-lg pointer-events-auto select-none"
        >
          {/* Controle de Volume do Streamer Remoto */}
          {!feed.isLocal && onChangeStreamerVolume && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setIsVolOpen((prev) => !prev)}
                aria-label={`Volume da transmissão (${streamerVolume}%)`}
                className={`h-8 w-8 flex items-center justify-center rounded-[10px] transition-colors cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-white/40 ${
                  isVolOpen
                    ? "bg-white text-black"
                    : "text-white/70 hover:text-white hover:bg-white/[0.08]"
                }`}
                title={`Volume da transmissão (${streamerVolume}%)`}
              >
                {streamerVolume === 0 ? (
                  <VolumeX className="h-4 w-4 text-rose-400" aria-hidden="true" />
                ) : streamerVolume < 60 ? (
                  <Volume1 className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                )}
              </button>

              {isVolOpen && (
                <div
                  style={{ cornerShape: "squircle" } as React.CSSProperties}
                  className="absolute top-10 right-0 p-3 w-48 rounded-[16px] bg-[#0F0F0F]/95 border border-[#161616] shadow-2xl z-30 space-y-2 backdrop-blur-2xl"
                >
                  <div className="flex justify-between text-[11px] font-bold text-white">
                    <span>Volume</span>
                    <span className="font-mono tabular-nums text-white/70">{streamerVolume}%</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={200}
                    aria-label="Volume da transmissão de tela"
                    value={streamerVolume}
                    onChange={(e) => onChangeStreamerVolume(Number(e.target.value))}
                    className="w-full accent-white h-1.5 cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-white/40"
                  />
                </div>
              )}
            </div>
          )}

          {/* Toggle de Áudio de Tela Local (se streamer local) */}
          {feed.isLocal && localScreenStream && localScreenStream.getAudioTracks().length > 0 && (
            <button
              type="button"
              onClick={() => {
                const tracks = localScreenStream.getAudioTracks();
                const nextState = !tracks[0].enabled;
                tracks.forEach((t) => {
                  t.enabled = nextState;
                });
                notify?.(
                  nextState ? "Áudio da transmissão ativado" : "Áudio da transmissão silenciado",
                  "info"
                );
              }}
              className="flex items-center gap-1 h-8 px-2.5 rounded-[10px] text-xs font-semibold text-white/75 hover:text-white hover:bg-white/[0.08] transition cursor-pointer"
              title="Silenciar / Ativar áudio transmitido da tela"
            >
              {localScreenStream.getAudioTracks()[0]?.enabled === false ? (
                <>
                  <VolumeX className="h-3.5 w-3.5 text-rose-400" />
                  <span className="text-[10px] text-rose-300">Mudo</span>
                </>
              ) : (
                <>
                  <Volume2 className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-[10px] text-emerald-300">Com Som</span>
                </>
              )}
            </button>
          )}

          {onToggleFocus && (
            <button
              type="button"
              onClick={onToggleFocus}
              aria-label={isFocused ? "Desafixar transmissão" : "Fixar transmissão"}
              className={`h-8 w-8 flex items-center justify-center rounded-[10px] transition cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-white/40 ${
                isFocused
                  ? "bg-white text-black shadow-sm"
                  : "text-white/70 hover:text-white hover:bg-white/[0.08]"
              }`}
              title={isFocused ? "Desafixar transmissão" : "Fixar transmissão"}
            >
              <Pin className={`h-4 w-4 ${isFocused ? "fill-black" : ""}`} aria-hidden="true" />
            </button>
          )}

          {/* Aspect Ratio: Ajustar (Fit) vs Preencher (Fill) */}
          <button
            type="button"
            onClick={onToggleFitMode}
            aria-label={fitMode === "contain" ? "Preencher janela (Zoom)" : "Ajustar à janela (Fit)"}
            className="h-8 w-8 flex items-center justify-center rounded-[10px] text-white/70 hover:text-white hover:bg-white/[0.08] transition cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-white/40"
            title={fitMode === "contain" ? "Preencher janela (Zoom)" : "Ajustar à janela (Fit)"}
          >
            {fitMode === "contain" ? (
              <Scan className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Scaling className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          {/* Picture-in-Picture */}
          <button
            type="button"
            onClick={onTogglePip}
            aria-label="Ativar Mini-player flutuante (PiP)"
            className="h-8 w-8 flex items-center justify-center rounded-[10px] text-white/70 hover:text-white hover:bg-white/[0.08] transition cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-white/40"
            title="Mini-player flutuante (PiP)"
          >
            <PictureInPicture2 className="h-4 w-4" aria-hidden="true" />
          </button>

          {/* Fullscreen da Stream */}
          <button
            type="button"
            onClick={onRequestFullscreen}
            aria-label="Tela cheia da transmissão"
            className="h-8 w-8 flex items-center justify-center rounded-[10px] text-white/70 hover:text-white hover:bg-white/[0.08] transition cursor-pointer outline-none focus-visible:ring-1 focus-visible:ring-white/40"
            title="Tela cheia da transmissão"
          >
            <Maximize2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>
    </div>
  );
};
