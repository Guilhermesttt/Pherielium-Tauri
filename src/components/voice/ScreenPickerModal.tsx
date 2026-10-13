import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MonitorSmartphone, X } from "lucide-react";
import type { ScreenShareOptions } from "../../hooks/useVoiceCall";
import { BITRATE_CHOICES_MBPS } from "../../services/voiceCall/screenShare";
import { RefinedButton, Segmented, SettingRow, Toggle } from "../ui/refined";

interface ScreenPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectSource: (options: ScreenShareOptions) => void;
}

const squircleStyle = { cornerShape: "squircle" } as React.CSSProperties;
const springTransition = { type: "spring" as const, bounce: 0, duration: 0.4 };

const STORAGE_KEY = "pherielium_screen_share_prefs";

function readStoredPrefs(): Pick<ScreenShareOptions, "resolution" | "fps" | "withAudio" | "bitrateMbps"> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { resolution: "1080p", fps: 60, withAudio: true, bitrateMbps: "auto" };
    const parsed = JSON.parse(raw) as ScreenShareOptions;
    return {
      resolution: parsed.resolution === "720p" ? "720p" : parsed.resolution === "source" ? "source" : "1080p",
      fps: parsed.fps === 30 ? 30 : 60,
      withAudio: parsed.withAudio !== false,
      bitrateMbps: (BITRATE_CHOICES_MBPS as readonly (number | "auto")[]).includes(parsed.bitrateMbps as number | "auto")
        ? (parsed.bitrateMbps as number | "auto")
        : "auto",
    };
  } catch {
    return { resolution: "1080p", fps: 60, withAudio: true, bitrateMbps: "auto" };
  }
}

export const ScreenPickerModal: React.FC<ScreenPickerModalProps> = ({
  isOpen,
  onClose,
  onSelectSource,
}) => {
  const [resolution, setResolution] = useState<"720p" | "1080p" | "source">("1080p");
  const [fps, setFps] = useState<30 | 60>(60);
  const [withAudio, setWithAudio] = useState(true);
  const [bitrateMbps, setBitrateMbps] = useState<number | "auto">("auto");

  useEffect(() => {
    if (!isOpen) return;
    const stored = readStoredPrefs();
    setResolution(stored.resolution === "720p" ? "720p" : stored.resolution === "source" ? "source" : "1080p");
    setFps(stored.fps === 30 ? 30 : 60);
    setWithAudio(stored.withAudio !== false);
    setBitrateMbps(stored.bitrateMbps ?? "auto");
  }, [isOpen]);

  if (!isOpen) return null;

  const handleStart = () => {
    const options: ScreenShareOptions = {
      resolution,
      fps,
      withAudio,
      bitrateMbps,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(options));
    } catch {
      // ignore
    }
    onClose();
    onSelectSource(options);
  };

  const bitrateOptions = BITRATE_CHOICES_MBPS.map((value) => ({
    value: String(value),
    label: value === "auto" ? "Auto" : `${value}M`,
  }));

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/70 p-4"
        onKeyDown={(event) => {
          if (event.key === "Escape") onClose();
        }}
      >
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-labelledby="screen-picker-title"
          initial={{ scale: 0.96, opacity: 0, y: 12 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.98, opacity: 0, y: 8 }}
          transition={springTransition}
          style={squircleStyle}
          className="relative flex w-full max-w-[640px] flex-col overflow-hidden rounded-[var(--corner-lg)] bg-[var(--tone-1)] text-[var(--ink)]"
        >
          <div className="flex items-start justify-between gap-6 px-8 pt-8">
            <div>
              <h3 id="screen-picker-title" className="font-display text-[length:var(--step-4)] font-semibold tracking-[-0.03em]">
                Transmitir a tela
              </h3>
              <p className="mt-2 max-w-[44ch] text-[length:var(--step-1)] leading-relaxed text-[var(--ink-muted)]">
                Escolha a qualidade aqui; a tela ou janela é escolhida no seletor do Windows em seguida.
              </p>
            </div>
            <RefinedButton variant="quiet" size="sm" aria-label="Fechar" onClick={onClose} icon={<X className="h-4 w-4" />} />
          </div>

          <div className="px-8 pt-4">
            <SettingRow
              title="Qualidade"
              control={() => (
                <Segmented
                  label="Qualidade"
                  value={resolution}
                  onChange={setResolution}
                  options={[
                    { value: "720p", label: "720p" },
                    { value: "1080p", label: "1080p" },
                    { value: "source", label: "Fonte" },
                  ]}
                />
              )}
            />
            <SettingRow
              title="Quadros por segundo"
              control={() => (
                <Segmented
                  label="Quadros por segundo"
                  value={String(fps) as "30" | "60"}
                  onChange={(value) => setFps(value === "30" ? 30 : 60)}
                  options={[
                    { value: "30", label: "30" },
                    { value: "60", label: "60" },
                  ]}
                />
              )}
            />
            <SettingRow
              title="Áudio do PC"
              description="Todos os apps, menos o Pherielium. O jogo, o sistema e a chamada não são silenciados."
              control={(labelId) => <Toggle aria-labelledby={labelId} checked={withAudio} onCheckedChange={setWithAudio} />}
            />
            <SettingRow
              title="Bitrate do vídeo"
              description="Auto escolhe pela qualidade e pelos quadros. Mais bitrate melhora o movimento e pede mais internet."
            >
              <Segmented
                label="Bitrate do vídeo"
                value={String(bitrateMbps)}
                onChange={(value) => setBitrateMbps(value === "auto" ? "auto" : Number(value))}
                options={bitrateOptions}
              />
            </SettingRow>
          </div>

          <div className="flex items-center justify-end gap-3 px-8 pb-8 pt-4">
            <RefinedButton variant="quiet" onClick={onClose}>
              Cancelar
            </RefinedButton>
            <RefinedButton variant="primary" onClick={handleStart} icon={<MonitorSmartphone className="h-4 w-4" />}>
              Escolher tela
            </RefinedButton>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
