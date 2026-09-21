import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Monitor,
  AppWindow,
  X,
  RefreshCw,
  Check,
  Volume2,
  Radio,
  Shield,
  ShieldCheck,
} from "lucide-react";
import type { ScreenShareOptions } from "../../hooks/useVoiceCall";

interface ScreenSource {
  id: string;
  name: string;
  thumbnail: string;
  appIcon: string | null;
}

interface ScreenPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSource: (options: ScreenShareOptions) => void;
}

const squircleStyle = { cornerShape: "squircle" } as React.CSSProperties;
const springTransition = { type: "spring" as const, bounce: 0, duration: 0.4 };

export const ScreenPickerModal: React.FC<ScreenPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectSource,
}) => {
  const [sources, setSources] = useState<ScreenSource[]>([]);
  const [activeTab, setActiveTab] = useState<"screens" | "windows">("screens");
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<"720p" | "1080p">("1080p");
  const [fps, setFps] = useState<30 | 60>(60);
  const [withAudio, setWithAudio] = useState(true);
  const [callAudioBarrier, setCallAudioBarrier] = useState(true);
  const [loading, setLoading] = useState(false);

  const fetchSources = async () => {
    setLoading(true);
    try {
      const list = (await window.electronAPI?.getScreenSources?.()) ?? [];
      setSources(list);
      setSelectedSourceId((current) => {
        if (current && list.some((item) => item.id === current)) return current;
        return list[0]?.id ?? null;
      });
    } catch (err) {
      console.error("[ScreenPickerModal] Failed to get screen sources", err);
      setSources([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      void fetchSources();
    } else {
      setSelectedSourceId(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const screens = sources.filter((s) => s.id.startsWith("screen:"));
  const windows = sources.filter((s) => !s.id.startsWith("screen:"));
  const displayedSources = activeTab === "screens" ? screens : windows;

  const emitOptions = (sourceId?: string) => {
    onClose();
    onSelectSource({
      sourceId,
      resolution,
      fps,
      withAudio,
      callAudioBarrier,
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.98, opacity: 0, y: 8 }}
          transition={springTransition}
          style={squircleStyle}
          className="relative flex w-full max-w-3xl max-h-[90vh] flex-col overflow-hidden rounded-[28px] border border-[#161616] bg-[#0F0F0F] shadow-[0_30px_90px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]"
        >
          <div className="flex items-center justify-between border-b border-[#161616] px-6 py-4">
            <div className="flex items-center gap-3">
              <div
                style={squircleStyle}
                className="flex h-9 w-9 items-center justify-center rounded-[14px] border border-[#161616] bg-white/[0.05] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
              >
                <Radio className="h-4 w-4" />
              </div>
              <div>
                <h3 className="text-base font-semibold tracking-tight text-white">Compartilhar tela</h3>
                <p className="text-xs font-normal text-white/50">Defina qualidade e áudio. O Windows pede a tela em seguida.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void fetchSources()}
                disabled={loading}
                className="flex h-8 w-8 items-center justify-center rounded-[12px] text-white/50 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                title="Atualizar fontes"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </button>
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 items-center justify-center rounded-[12px] text-white/50 transition hover:bg-white/10 hover:text-white"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 border-b border-[#161616] bg-black/20 px-6 py-3">
            <button
              type="button"
              onClick={() => setActiveTab("screens")}
              className={`flex cursor-pointer items-center gap-2 rounded-[14px] px-4 py-2 text-xs font-semibold transition ${
                activeTab === "screens"
                  ? "bg-white text-black"
                  : "text-white/45 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              Telas ({screens.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("windows")}
              className={`flex cursor-pointer items-center gap-2 rounded-[14px] px-4 py-2 text-xs font-semibold transition ${
                activeTab === "windows"
                  ? "bg-white text-black"
                  : "text-white/45 hover:bg-white/5 hover:text-white"
              }`}
            >
              <AppWindow className="h-3.5 w-3.5" />
              Janelas ({windows.length})
            </button>
          </div>

          <div className="min-h-[220px] flex-1 overflow-y-auto p-6">
            {sources.length === 0 && !loading ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Monitor className="mb-3 h-12 w-12 text-white/20" />
                <p className="text-sm font-semibold text-white/70">Nenhuma fonte listada</p>
                <p className="mt-1 mb-4 text-xs text-white/40">Use o seletor nativo do Windows para continuar.</p>
                <button
                  type="button"
                  onClick={() => emitOptions()}
                  className="cursor-pointer rounded-[14px] bg-white px-5 py-2.5 text-xs font-semibold text-black transition hover:bg-white/90"
                >
                  Selecionar pelo sistema
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
                {displayedSources.map((source) => {
                  const isSelected = selectedSourceId === source.id;
                  return (
                    <button
                      key={source.id}
                      type="button"
                      onClick={() => setSelectedSourceId(source.id)}
                      className={`group relative flex cursor-pointer flex-col overflow-hidden rounded-[18px] border p-3 text-left transition ${
                        isSelected
                          ? "border-white bg-white/10 shadow-[0_0_25px_rgba(255,255,255,0.12)]"
                          : "border-[#161616] bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                      }`}
                    >
                      <div className="relative aspect-video w-full overflow-hidden rounded-[14px] border border-[#161616] bg-black/60">
                        {source.thumbnail ? (
                          <img src={source.thumbnail} alt={source.name} className="h-full w-full object-contain" />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-white/20">
                            <Monitor className="h-8 w-8" />
                          </div>
                        )}
                        {isSelected && (
                          <div className="absolute right-2 top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-black">
                            <Check className="h-3.5 w-3.5 stroke-[3]" />
                          </div>
                        )}
                      </div>
                      <div className="mt-2.5 flex min-w-0 items-center gap-2">
                        {source.appIcon && (
                          <img src={source.appIcon} alt="" className="h-4 w-4 shrink-0 rounded object-contain" />
                        )}
                        <span className={`truncate text-xs font-semibold ${isSelected ? "text-white" : "text-white/80"}`}>
                          {source.name}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="space-y-4 border-t border-[#161616] bg-black/20 p-5">
            <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-white/45">Qualidade</span>
                <div className="grid grid-cols-2 gap-1 rounded-[14px] border border-[#161616] bg-white/[0.04] p-1">
                  {(["720p", "1080p"] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setResolution(r)}
                      className={`cursor-pointer rounded-[10px] py-1.5 text-xs font-semibold transition ${
                        resolution === r ? "bg-white text-black" : "text-white/50 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-white/45">Taxa de quadros</span>
                <div className="grid grid-cols-2 gap-1 rounded-[14px] border border-[#161616] bg-white/[0.04] p-1">
                  {([30, 60] as const).map((f) => (
                    <button
                      key={f}
                      type="button"
                      onClick={() => setFps(f)}
                      className={`cursor-pointer rounded-[10px] py-1.5 text-xs font-semibold transition ${
                        fps === f ? "bg-white text-black" : "text-white/50 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {f} FPS
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-white/45">Áudio da stream</span>
                <label className="flex h-[34px] cursor-pointer items-center gap-2.5 rounded-[14px] border border-[#161616] bg-white/[0.04] px-3">
                  <input
                    type="checkbox"
                    checked={withAudio}
                    onChange={(e) => setWithAudio(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded accent-white"
                  />
                  <Volume2 className="h-3.5 w-3.5 text-white/55" />
                  <span className="text-xs font-semibold text-white/90">Sons do computador</span>
                </label>
              </div>
            </div>

            {withAudio && (
              <div className="flex flex-col gap-1.5">
                <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-emerald-400">
                  <Shield className="h-3 w-3" />
                  Barreira de áudio da call
                </span>
                <label className="flex h-[34px] cursor-pointer items-center gap-2.5 rounded-[14px] border border-emerald-500/20 bg-emerald-500/10 px-3">
                  <input
                    type="checkbox"
                    checked={callAudioBarrier}
                    onChange={(e) => setCallAudioBarrier(e.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded accent-emerald-400"
                  />
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-400" />
                  <span className="text-xs font-semibold text-white/95">Isolar vozes da chamada</span>
                </label>
              </div>
            )}

            <div className="flex items-center justify-end gap-3 pt-1">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[14px] px-4 py-2 text-xs font-semibold text-white/60 transition hover:bg-white/10 hover:text-white"
              >
                Cancelar
              </button>
              <motion.button
                type="button"
                onClick={() => emitOptions()}
                whileTap={{ scale: 0.96 }}
                transition={springTransition}
                style={squircleStyle}
                className="flex cursor-pointer items-center gap-2 rounded-[16px] bg-white px-5 py-2.5 text-xs font-semibold tracking-tight text-black shadow-[0_8px_24px_rgba(255,255,255,0.12)] hover:bg-white/90"
              >
                <Monitor className="h-4 w-4" />
                Transmitir
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
