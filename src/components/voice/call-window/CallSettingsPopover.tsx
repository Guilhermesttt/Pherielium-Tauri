import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Headphones,
  Mic,
  Camera,
  Activity,
  Sliders,
  Sparkles,
  Keyboard,
  Check,
} from "lucide-react";
import { GhostSelect } from "../../ui/GhostSelect";

interface CallSettingsPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  audioInputDevices?: MediaDeviceInfo[];
  audioOutputDevices?: MediaDeviceInfo[];
  videoInputDevices?: MediaDeviceInfo[];
  selectedAudioInput?: string;
  selectedAudioOutput?: string;
  selectedVideoInput?: string;
  onChangeAudioInputDevice?: (deviceId: string) => void;
  onChangeAudioOutputDevice?: (deviceId: string) => void;
  onChangeVideoInputDevice?: (deviceId: string) => void;
  micVolumeLevel?: number;
  isMicMonitoring?: boolean;
  onChangeMicMonitoring?: (val: boolean) => void;
  micGain?: number;
  onChangeMicGain?: (val: number) => void;
  echoCancellation?: boolean;
  onChangeEchoCancellation?: (val: boolean) => void;
  noiseSuppression?: boolean;
  onChangeNoiseSuppression?: (val: boolean) => void;
  advancedNoiseSuppression?: boolean;
  onChangeAdvancedNoiseSuppression?: (val: boolean) => void;
  autoGainControl?: boolean;
  onChangeAutoGainControl?: (val: boolean) => void;
  onCalibrateNoise?: () => Promise<any>;
  isCalibratingNoise?: boolean;
  voiceSensitivity?: number;
  onChangeVoiceSensitivity?: (val: number) => void;
  inputMode?: "voice-activity" | "push-to-talk";
  setInputMode?: (mode: "voice-activity" | "push-to-talk") => void;
  pushToTalkKey?: string;
  setPushToTalkKey?: (key: string) => void;
  isRecordingKey?: boolean;
  setIsRecordingKey?: (recording: boolean) => void;
  onOpenOrbloomCustomizer?: () => void;
}

export const CallSettingsPopover: React.FC<CallSettingsPopoverProps> = ({
  isOpen,
  onClose,
  audioInputDevices = [],
  audioOutputDevices = [],
  videoInputDevices = [],
  selectedAudioInput = "default",
  selectedAudioOutput = "default",
  selectedVideoInput = "default",
  onChangeAudioInputDevice,
  onChangeAudioOutputDevice,
  onChangeVideoInputDevice,
  micVolumeLevel = 0,
  isMicMonitoring = false,
  onChangeMicMonitoring,
  micGain,
  onChangeMicGain,
  echoCancellation = true,
  onChangeEchoCancellation,
  noiseSuppression = true,
  onChangeNoiseSuppression,
  advancedNoiseSuppression = true,
  onChangeAdvancedNoiseSuppression,
  autoGainControl = true,
  onChangeAutoGainControl,
  onCalibrateNoise,
  isCalibratingNoise = false,
  voiceSensitivity = 35,
  onChangeVoiceSensitivity,
  inputMode = "voice-activity",
  setInputMode,
  pushToTalkKey = "F8",
  setPushToTalkKey,
  isRecordingKey = false,
  setIsRecordingKey,
  onOpenOrbloomCustomizer,
}) => {
  const [activeTab, setActiveTab] = useState<"devices" | "audio" | "activation">("devices");

  if (!isOpen) return null;

  const defaultInputLabel =
    audioInputDevices.find((d) => d.deviceId === "default" && d.label)?.label ||
    audioInputDevices[0]?.label ||
    "Padrão do Sistema";

  const defaultOutputLabel =
    audioOutputDevices.find((d) => d.deviceId === "default" && d.label)?.label ||
    audioOutputDevices[0]?.label ||
    "Padrão do Sistema";

  const defaultVideoLabel =
    videoInputDevices.find((d) => d.deviceId === "default" && d.label)?.label ||
    videoInputDevices[0]?.label ||
    "Padrão do Sistema";

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-99999 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md select-none">
        {/* Backdrop Dismiss */}
        <div className="absolute inset-0" onClick={onClose} />

        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
          style={{ cornerShape: "squircle" } as React.CSSProperties}
          className="relative flex flex-col w-full max-w-lg max-h-[85vh] overflow-hidden rounded-3xl bg-[#0F0F0F]/95 backdrop-blur-2xl border border-[#161616] shadow-[0_30px_90px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.05)] z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-[#161616] bg-[#0F0F0F]/80">
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-[10px] bg-white/6 flex items-center justify-center text-white/80">
                <Sliders className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-semibold text-white tracking-tight">
                Áudio & Vídeo
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="h-7 w-7 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/8 transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Segmented Control Tabs */}
          <div className="flex items-center gap-1 p-1 mx-6 mt-3 rounded-xl bg-white/3 border border-[#161616]">
            <button
              type="button"
              onClick={() => setActiveTab("devices")}
              className={`flex-1 py-1.5 rounded-[9px] text-xs font-semibold transition cursor-pointer ${
                activeTab === "devices"
                  ? "bg-white/12 text-white shadow-sm"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              Dispositivos
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("audio")}
              className={`flex-1 py-1.5 rounded-[9px] text-xs font-semibold transition cursor-pointer ${
                activeTab === "audio"
                  ? "bg-white/12 text-white shadow-sm"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              Processamento
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("activation")}
              className={`flex-1 py-1.5 rounded-[9px] text-xs font-semibold transition cursor-pointer ${
                activeTab === "activation"
                  ? "bg-white/12 text-white shadow-sm"
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              Ativação de Voz
            </button>
          </div>

          {/* Body Scroll Area */}
          <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-none">
            {/* Banner para abrir o personalizador padrão do Orbloom */}
            {onOpenOrbloomCustomizer && (
              <div
                style={{ cornerShape: "squircle" } as React.CSSProperties}
                className="p-3.5 rounded-2xl bg-linear-to-r from-purple-950/25 via-[#0F0F0F] to-cyan-950/15 border border-[#161616] flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-xl bg-white/6 flex items-center justify-center text-purple-300">
                    <Sparkles className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-xs font-semibold text-white">Visual do Orbloom</h4>
                    <p className="text-[11px] text-white/50">Personalize presets, reações e cores da sua esfera</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenOrbloomCustomizer();
                  }}
                  style={{ cornerShape: "squircle" } as React.CSSProperties}
                  className="px-3 py-1.5 rounded-[10px] bg-white text-black font-semibold text-xs hover:bg-white/90 transition active:scale-95 cursor-pointer shadow-sm"
                >
                  Personalizar
                </button>
              </div>
            )}
            {activeTab === "devices" && (
              <div className="space-y-4">
                {/* Microfone */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
                    <Mic className="h-3.5 w-3.5 text-white/60" />
                    <span>Microfone</span>
                  </label>
                  <GhostSelect
                    value={selectedAudioInput}
                    onChange={(val) => onChangeAudioInputDevice?.(val)}
                    options={[
                      {
                        value: "default",
                        label: defaultInputLabel.replace(/^Padrão - /i, ""),
                      },
                      ...audioInputDevices.map((dev) => ({
                        value: dev.deviceId,
                        label: dev.label || `Microfone (${dev.deviceId.slice(0, 8)}...)`,
                      })),
                    ]}
                  />
                </div>

                {/* VU Meter de Microfone */}
                <div className="p-3 rounded-[14px] bg-white/3 border border-[#161616] space-y-2">
                  <div className="flex justify-between text-xs font-medium text-white/60">
                    <span className="flex items-center gap-1.5">
                      <Activity className="h-3.5 w-3.5 text-emerald-400" />
                      Teste de Entrada
                    </span>
                    <span className="font-mono text-white/80">{micVolumeLevel}%</span>
                  </div>
                  <div className="flex items-center gap-1 h-2">
                    {Array.from({ length: 24 }).map((_, i) => {
                      const threshold = (i + 1) * 4.16;
                      const isLit = micVolumeLevel >= threshold;
                      const zoneColor =
                        threshold > 80
                          ? "bg-rose-500"
                          : threshold > 60
                          ? "bg-amber-400"
                          : "bg-emerald-400";

                      return (
                        <div
                          key={i}
                          className={`flex-1 h-full rounded-xs transition-all duration-75 ${
                            isLit ? zoneColor : "bg-white/6"
                          }`}
                        />
                      );
                    })}
                  </div>
                </div>

                {/* Retorno de Microfone (Sidetone) */}
                <label className="flex items-center justify-between p-3 rounded-[14px] bg-white/3 border border-[#161616] cursor-pointer hover:bg-white/5 transition">
                  <div className="flex items-center gap-2.5">
                    <Headphones className="h-4 w-4 text-white/60" />
                    <div>
                      <p className="text-xs font-semibold text-white">Retorno de Voz</p>
                      <p className="text-[11px] text-white/40">Escute a si mesmo nos fones</p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={Boolean(isMicMonitoring)}
                    onChange={(e) => onChangeMicMonitoring?.(e.target.checked)}
                    className="h-4 w-4 accent-white rounded cursor-pointer"
                  />
                </label>

                {/* Alto-Falante */}
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
                    <Headphones className="h-3.5 w-3.5 text-white/60" />
                    <span>Dispositivo de Saída</span>
                  </label>
                  <GhostSelect
                    value={selectedAudioOutput}
                    onChange={(val) => onChangeAudioOutputDevice?.(val)}
                    options={[
                      {
                        value: "default",
                        label: defaultOutputLabel.replace(/^Padrão - /i, ""),
                      },
                      ...audioOutputDevices.map((dev) => ({
                        value: dev.deviceId,
                        label: dev.label || `Alto-Falante (${dev.deviceId.slice(0, 8)}...)`,
                      })),
                    ]}
                  />
                </div>

                {/* Câmera */}
                {videoInputDevices.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-white/70 flex items-center gap-1.5">
                      <Camera className="h-3.5 w-3.5 text-white/60" />
                      <span>Câmera de Vídeo</span>
                    </label>
                    <GhostSelect
                      value={selectedVideoInput}
                      onChange={(val) => onChangeVideoInputDevice?.(val)}
                      options={[
                        {
                          value: "default",
                          label: defaultVideoLabel.replace(/^Padrão - /i, ""),
                        },
                        ...videoInputDevices.map((dev) => ({
                          value: dev.deviceId,
                          label: dev.label || `Câmera (${dev.deviceId.slice(0, 8)}...)`,
                        })),
                      ]}
                    />
                  </div>
                )}
              </div>
            )}

            {activeTab === "audio" && (
              <div className="space-y-3">
                {/* Volume de Entrada do Mic */}
                {typeof micGain === "number" && onChangeMicGain && (
                  <div className="p-3.5 rounded-[14px] bg-white/3 border border-[#161616] space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-white">
                      <span>Volume do Microfone</span>
                      <span className="font-mono text-white/70">{micGain}%</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={200}
                      value={micGain}
                      onChange={(e) => onChangeMicGain(Number(e.target.value))}
                      className="w-full accent-white h-1.5 cursor-pointer"
                    />
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-white/70">Supressão de Ruído</label>
                  <GhostSelect
                    value={advancedNoiseSuppression ? "rnnoise" : noiseSuppression ? "native" : "none"}
                    onChange={(val) => {
                      onChangeAdvancedNoiseSuppression?.(val === "rnnoise");
                      onChangeNoiseSuppression?.(val === "native");
                    }}
                    options={[
                      { value: "rnnoise", label: "Isolamento por IA (RNNoise)" },
                      { value: "native", label: "Nativo do sistema" },
                      { value: "none", label: "Desligado (bruto)" },
                    ]}
                  />
                </div>

                {onChangeVoiceSensitivity && (
                  <div className="p-3.5 rounded-[14px] bg-white/3 border border-[#161616] space-y-2">
                    <div className="flex justify-between text-xs font-semibold text-white">
                      <span>Sensibilidade de Voz</span>
                      <span className="font-mono text-white/70">{voiceSensitivity}</span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      value={voiceSensitivity}
                      onChange={(e) => onChangeVoiceSensitivity(Number(e.target.value))}
                      className="w-full accent-white h-1.5 cursor-pointer"
                    />
                  </div>
                )}

                {/* Cancelamento de Eco */}
                <button
                  type="button"
                  onClick={() => onChangeEchoCancellation?.(!echoCancellation)}
                  className="w-full flex items-center justify-between p-3.5 rounded-[14px] bg-white/3 border border-[#161616] hover:bg-white/5 transition cursor-pointer text-left"
                >
                  <div>
                    <p className="text-xs font-semibold text-white">Cancelamento de Eco</p>
                    <p className="text-[11px] text-white/40">Evita repetição de som pelos alto-falantes</p>
                  </div>
                  {echoCancellation && <Check className="h-4 w-4 text-emerald-400" />}
                </button>

                {/* Ganho Automático */}
                <button
                  type="button"
                  onClick={() => onChangeAutoGainControl?.(!autoGainControl)}
                  className="w-full flex items-center justify-between p-3.5 rounded-[14px] bg-white/3 border border-[#161616] hover:bg-white/5 transition cursor-pointer text-left"
                >
                  <div>
                    <p className="text-xs font-semibold text-white">Ganho Automático</p>
                    <p className="text-[11px] text-white/40">Nivela volume de voz baixa ou alta</p>
                  </div>
                  {autoGainControl && <Check className="h-4 w-4 text-emerald-400" />}
                </button>

                {onCalibrateNoise && (
                  <button
                    type="button"
                    disabled={isCalibratingNoise}
                    onClick={() => void onCalibrateNoise()}
                    className="w-full py-2 rounded-xl bg-white/6 hover:bg-white/10 text-xs font-semibold text-white/80 transition cursor-pointer disabled:opacity-50"
                  >
                    {isCalibratingNoise ? "Calibrando..." : "Calibrar Ruído Ambiente"}
                  </button>
                )}
              </div>
            )}

            {activeTab === "activation" && (
              <div className="space-y-4">
                <p className="text-[11px] text-white/40 px-1">
                  Escolha como o Checkpoint decide quando transmitir sua voz na chamada.
                </p>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-xl bg-white/3 border border-[#161616]">
                  <button
                    type="button"
                    onClick={() => setInputMode?.("voice-activity")}
                    className={`py-2 rounded-[9px] text-xs font-semibold transition cursor-pointer ${
                      inputMode === "voice-activity"
                        ? "bg-white/12 text-white shadow-sm"
                        : "text-white/50 hover:text-white/80"
                    }`}
                  >
                    Atividade de Voz
                  </button>
                  <button
                    type="button"
                    onClick={() => setInputMode?.("push-to-talk")}
                    className={`py-2 rounded-[9px] text-xs font-semibold transition cursor-pointer ${
                      inputMode === "push-to-talk"
                        ? "bg-white/12 text-white shadow-sm"
                        : "text-white/50 hover:text-white/80"
                    }`}
                  >
                    Push-to-Talk
                  </button>
                </div>

                {inputMode === "push-to-talk" && setPushToTalkKey && (
                  <div className="flex items-center justify-between p-3.5 rounded-[14px] bg-white/3 border border-[#161616]">
                    <div>
                      <p className="text-xs font-semibold text-white flex items-center gap-1.5">
                        <Keyboard className="h-3.5 w-3.5 text-white/60" />
                        Tecla Push-to-Talk
                      </p>
                      <p className="text-[11px] text-white/40">Pressione e segure para falar</p>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        setIsRecordingKey?.(true);
                        const onKey = (e: KeyboardEvent) => {
                          e.preventDefault();
                          e.stopPropagation();
                          const key =
                            e.key === " " ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.key;
                          setPushToTalkKey(key);
                          setIsRecordingKey?.(false);
                          window.removeEventListener("keydown", onKey, true);
                        };
                        window.addEventListener("keydown", onKey, true);
                      }}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-bold transition cursor-pointer ${
                        isRecordingKey
                          ? "bg-emerald-500/20 text-emerald-300 border-emerald-400 animate-pulse"
                          : "bg-white/8 text-white border-white/20 hover:bg-white/[0.14]"
                      }`}
                    >
                      {isRecordingKey ? "Pressione..." : pushToTalkKey}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end px-6 py-3 border-t border-[#161616] bg-[#0F0F0F]/80">
            <button
              type="button"
              onClick={onClose}
              style={{ cornerShape: "squircle" } as React.CSSProperties}
              className="px-4 py-1.5 rounded-xl bg-white text-black font-semibold text-xs hover:bg-white/90 transition cursor-pointer shadow-sm"
            >
              Concluído
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
