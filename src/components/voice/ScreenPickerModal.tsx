import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MonitorSmartphone, Radio, Volume2, X } from "lucide-react";
import type { ScreenShareOptions } from "../../hooks/useVoiceCall";

interface ScreenPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSource: (options: ScreenShareOptions) => void;
}

const squircleStyle = { cornerShape: "squircle" } as React.CSSProperties;
const springTransition = { type: "spring" as const, bounce: 0, duration: 0.4 };

const STORAGE_KEY = "pherielium_screen_share_prefs";

function readStoredPrefs(): Pick<ScreenShareOptions, "resolution" | "fps" | "withAudio"> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { resolution: "1080p", fps: 60, withAudio: true };
    const parsed = JSON.parse(raw) as ScreenShareOptions;
    return {
      resolution: parsed.resolution === "720p" ? "720p" : "1080p",
      fps: parsed.fps === 30 ? 30 : 60,
      withAudio: parsed.withAudio !== false,
    };
  } catch {
    return { resolution: "1080p", fps: 60, withAudio: true };
  }
}

export const ScreenPickerModal: React.FC<ScreenPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectSource,
}) => {
  const [resolution, setResolution] = useState<"720p" | "1080p">("1080p");
  const [fps, setFps] = useState<30 | 60>(60);
  const [withAudio, setWithAudio] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    const stored = readStoredPrefs();
    setResolution(stored.resolution === "720p" ? "720p" : "1080p");
    setFps(stored.fps === 30 ? 30 : 60);
    setWithAudio(stored.withAudio !== false);
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStart = () => {
    const options: ScreenShareOptions = {
      resolution,
      fps,
      withAudio,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
    } catch {
      // ignore
    }
    onClose();
    onSelectSource(options);
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/80 p-4 backdrop-blur-xl">
        <motion.div
          initial={{ scale: 0.96, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.98, opacity: 0, y: 8 }}
          transition={springTransition}
          style={squircleStyle}
          className="relative flex w-full max-w-xl flex-col overflow-hidden rounded-[28px] border border-[#161616] bg-[#0F0F0F] shadow-[0_30px_90px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.06)]"
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
                <p className="text-xs font-normal text-white/50">
                  Ajuste qualidade e áudio. A seleção da tela abre no seletor nativo do Windows.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="flex h-8 w-8 items-center justify-center rounded-[12px] text-white/50 transition hover:bg-white/10 hover:text-white"
              aria-label="Fechar"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-4 p-6">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-white/45">Qualidade</span>
                <div className="grid grid-cols-2 gap-1 rounded-[14px] border border-[#161616] bg-white/[0.04] p-1">
                  {(["720p", "1080p"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setResolution(value)}
                      className={`cursor-pointer rounded-[10px] py-1.5 text-xs font-semibold transition ${
                        resolution === value ? "bg-white text-black" : "text-white/50 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <span className="text-[11px] font-semibold tracking-wide text-white/45">Taxa de quadros</span>
                <div className="grid grid-cols-2 gap-1 rounded-[14px] border border-[#161616] bg-white/[0.04] p-1">
                  {([30, 60] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFps(value)}
                      className={`cursor-pointer rounded-[10px] py-1.5 text-xs font-semibold transition ${
                        fps === value ? "bg-white text-black" : "text-white/50 hover:bg-white/5 hover:text-white"
                      }`}
                    >
                      {value} FPS
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
                    onChange={(event) => setWithAudio(event.target.checked)}
                    className="h-4 w-4 cursor-pointer rounded accent-white"
                  />
                  <Volume2 className="h-3.5 w-3.5 text-white/55" />
                  <span className="text-xs font-semibold text-white/90">Sons do computador</span>
                </label>
              </div>
            </div>

            <p className="rounded-[14px] border border-white/8 bg-white/[0.03] px-3 py-2 text-[11px] leading-relaxed text-white/45">
              Compartilhar a tela não silencia o jogo, o sistema nem a chamada.
              O áudio enviado é o do computador, sem o som do próprio Pherielium.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-[#161616] bg-black/20 p-5">
            <button
              type="button"
              onClick={onClose}
              className="rounded-[14px] px-4 py-2 text-xs font-semibold text-white/60 transition hover:bg-white/10 hover:text-white"
            >
              Cancelar
            </button>
            <motion.button
              type="button"
              onClick={handleStart}
              whileTap={{ scale: 0.96 }}
              transition={springTransition}
              style={squircleStyle}
              className="flex cursor-pointer items-center gap-2 rounded-[16px] bg-white px-5 py-2.5 text-xs font-semibold tracking-tight text-black shadow-[0_8px_24px_rgba(255,255,255,0.12)] hover:bg-white/90"
            >
              <MonitorSmartphone className="h-4 w-4" />
              Abrir seletor nativo
            </motion.button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
