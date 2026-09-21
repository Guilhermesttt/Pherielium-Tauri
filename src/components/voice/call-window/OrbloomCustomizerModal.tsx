import React, { useState, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X,
  Mic,
  MicOff,
  Shuffle,
  ChevronDown,
  Check,
  Sliders,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import {
  createOrb,
  createOrbTheme,
  type OrbController,
  type OrbState,
  orbVariantDefinitions,
} from "orbloom";
import {
  type OrbloomCustomConfig,
  loadSavedOrbloomConfig,
  saveOrbloomConfig,
  clearOrbloomConfig,
} from "../OrbloomOrb";

export const ALL_ORBLOOM_PRESETS = [
  // NEBULA
  "nebula-blue-01",
  "nebula-violet-01",
  "nebula-violet-02",
  "nebula-pink-01",
  "nebula-cyan-01",
  "nebula-orange-01",
  "nebula-orange-02",
  "nebula-red-01",
  "nebula-yellow-01",
  // SPIRAL
  "spiral-pink-01",
  "spiral-cyan-01",
  "spiral-cyan-02",
  "spiral-cyan-03",
  "spiral-cyan-04",
  "spiral-orange-01",
  "spiral-orange-02",
  "spiral-violet-01",
  "spiral-blue-01",
  // CORE
  "core-teal-01",
  "core-blue-01",
  "core-blue-02",
  "core-cyan-01",
  "core-lime-01",
  "core-lime-02",
  "core-orange-01",
  "core-orange-02",
  "core-red-01",
  "core-yellow-01",
  // DEEP-FIELD
  "deep-field-blue-01",
  "deep-field-blue-02",
  "deep-field-cyan-01",
  "deep-field-green-01",
  "deep-field-teal-01",
  "deep-field-teal-02",
  "deep-field-yellow-01",
  "deep-field-orange-01",
] as const;

export function getPresetDetails(presetId: string): {
  id: string;
  category: "NEBULA" | "SPIRAL" | "CORE" | "DEEP-FIELD";
  name: string;
} {
  if (presetId.startsWith("deep-field")) {
    const parts = presetId.split("-");
    const color = parts[2] ? parts[2][0].toUpperCase() + parts[2].slice(1) : "";
    const num = parts[3] || "01";
    return { id: presetId, category: "DEEP-FIELD", name: `${color} ${num}`.trim() };
  }
  const parts = presetId.split("-");
  const category = (parts[0]?.toUpperCase() || "NEBULA") as "NEBULA" | "SPIRAL" | "CORE" | "DEEP-FIELD";
  const color = parts[1] ? parts[1][0].toUpperCase() + parts[1].slice(1) : "";
  const num = parts[2] || "01";
  return { id: presetId, category, name: `${color} ${num}`.trim() };
}

const QUALITY_LABELS: Record<"low" | "balanced" | "high", string> = {
  low: "Baixa",
  balanced: "Média",
  high: "Alta",
};

const ORB_STATE_LABELS: Record<OrbState, string> = {
  idle: "Ocioso",
  listening: "Ouvindo",
  thinking: "Pensando",
  speaking: "Falando",
  success: "Sucesso",
  error: "Erro",
};

interface OrbloomCustomizerModalProps {
  isOpen: boolean;
  onClose: () => void;
  localStream?: MediaStream | null;
}

export const OrbloomCustomizerModal: React.FC<OrbloomCustomizerModalProps> = ({
  isOpen,
  onClose,
  localStream,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const controllerRef = useRef<OrbController | null>(null);
  const audioCleanupRef = useRef<(() => void) | null>(null);

  // Estado do Preset Ativo
  const [selectedPreset, setSelectedPreset] = useState<string>(() => {
    const saved = loadSavedOrbloomConfig();
    return saved?.preset || "nebula-blue-01";
  });

  const [activeOrbState, setActiveOrbState] = useState<OrbState>("speaking");
  const [qualityProfile, setQualityProfile] = useState<"low" | "balanced" | "high">("high");

  // Definição original do preset para extrair cores padrão
  const defaultDefinition = useMemo(() => {
    return (orbVariantDefinitions as any)[selectedPreset] || (orbVariantDefinitions as any)["nebula-blue-01"];
  }, [selectedPreset]);

  // Cores Customizáveis (Base, Interior, 3 Accents)
  const [baseColor, setBaseColor] = useState<string>(defaultDefinition.baseColor || "#1B1E33");
  const [interiorColor, setInteriorColor] = useState<string>("#000000");
  const [accents, setAccents] = useState<[string, string, string]>(() => {
    const def = defaultDefinition.accentColors || ["#C7CFFF", "#9FB4E8", "#F2F4FF"];
    return [def[0] || "#C7CFFF", def[1] || "#9FB4E8", def[2] || "#F2F4FF"];
  });

  // Sliders de Aparência
  const [seed, setSeed] = useState<number>(2.4);
  const [appearance, setAppearance] = useState({
    intensity: 1.0,
    detail: 0.85,
    glass: defaultDefinition.lensStrength ?? 0.45,
    glow: 1.1,
  });

  // Movimento e Áudio
  const [motionConfig, setMotionConfig] = useState({
    speed: 0.8,
    drift: 0.6,
  });

  const [audioResponse, setAudioResponse] = useState({
    brightness: 1.5,
    motion: 1.5,
    pulse: 1.5,
  });

  const [isMicActive, setIsMicActive] = useState(true);
  const [isPresetDropdownOpen, setIsPresetDropdownOpen] = useState(false);
  const [showAdvancedControls, setShowAdvancedControls] = useState(false);
  const [saveToast, setSaveToast] = useState(false);

  // Atualizar cores ao mudar de preset (se não estiver no modo editado)
  useEffect(() => {
    const def = (orbVariantDefinitions as any)[selectedPreset];
    if (def) {
      setBaseColor(def.baseColor || "#1B1E33");
      const acc = def.accentColors || ["#C7CFFF", "#9FB4E8", "#F2F4FF"];
      setAccents([acc[0], acc[1], acc[2]]);
      if (def.lensStrength !== undefined) {
        setAppearance((prev) => ({ ...prev, glass: def.lensStrength }));
      }
      if (def.phase !== undefined) {
        setSeed(def.phase);
      }
    }
  }, [selectedPreset]);

  // Carregar configuração salva do usuário ao abrir
  useEffect(() => {
    const saved = loadSavedOrbloomConfig();
    if (saved) {
      if (saved.preset) setSelectedPreset(saved.preset);
      if (saved.seed !== undefined) setSeed(saved.seed);
      if (saved.appearance) setAppearance((prev) => ({ ...prev, ...saved.appearance }));
      if (saved.motion) setMotionConfig((prev) => ({ ...prev, ...saved.motion }));
      if (saved.audioResponse) setAudioResponse((prev) => ({ ...prev, ...saved.audioResponse }));
    }
  }, [isOpen]);

  // Agrupamento dos presets por arquétipo
  const groupedPresets = useMemo(() => {
    const groups: Record<"NEBULA" | "SPIRAL" | "CORE" | "DEEP-FIELD", Array<{ id: string; name: string }>> = {
      NEBULA: [],
      SPIRAL: [],
      CORE: [],
      "DEEP-FIELD": [],
    };
    for (const presetId of ALL_ORBLOOM_PRESETS) {
      const details = getPresetDetails(presetId);
      groups[details.category].push({ id: details.id, name: details.name });
    }
    return groups;
  }, []);

  // Construir o tema atual
  const currentTheme = useMemo(() => {
    try {
      const themeId = `vlt-${selectedPreset.replace(/[^a-z0-9-]/g, "")}`.slice(0, 32);
      return createOrbTheme({
        preset: selectedPreset as any,
        id: themeId,
        seed,
        colors: {
          base: baseColor,
          interior: interiorColor,
          accents,
        },
        appearance,
        motion: motionConfig,
        audioResponse,
      });
    } catch {
      return selectedPreset;
    }
  }, [selectedPreset, seed, baseColor, interiorColor, accents, appearance, motionConfig, audioResponse]);

  // Instanciar / atualizar o canvas do Orbloom
  useEffect(() => {
    if (!isOpen || !canvasRef.current) return;

    let controller = controllerRef.current;
    if (!controller) {
      try {
        controller = createOrb(canvasRef.current, {
          quality: qualityProfile,
          state: activeOrbState,
          theme: currentTheme as any,
        });
        controllerRef.current = controller;
      } catch (err) {
        console.warn("Failed to create Orbloom in modal:", err);
      }
    } else {
      try {
        controller.setTheme(currentTheme as any);
        controller.setState(activeOrbState);
        controller.setQuality(qualityProfile);
      } catch (err) {
        console.warn("Failed to update Orbloom theme:", err);
      }
    }

    // Conectar áudio se ativado
    if (controller && isMicActive) {
      // Clear previous if any
      audioCleanupRef.current?.();
      audioCleanupRef.current = null;

      if (localStream && localStream.getAudioTracks().length > 0) {
        try {
          const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
          if (Ctx) {
            const ctx = new Ctx();
            const src = ctx.createMediaStreamSource(localStream);
            const analyser = ctx.createAnalyser();
            analyser.fftSize = 1024;
            analyser.smoothingTimeConstant = 0.55;
            src.connect(analyser);
            void ctx.resume().catch(() => {});
            
            if (typeof (controller as any).attachAudioSource === "function") {
              const disconnect = (controller as any).attachAudioSource(analyser);
              audioCleanupRef.current = () => {
                try { disconnect(); } catch {}
                try { src.disconnect(); } catch {}
                void ctx.close().catch(() => {});
              };
            } else {
              audioCleanupRef.current = () => {
                try { src.disconnect(); } catch {}
                void ctx.close().catch(() => {});
              };
            }
          }
        } catch {
          controller.connectMicrophone().then((disconnect) => {
            audioCleanupRef.current = disconnect;
          }).catch(() => {});
        }
      } else {
        controller.connectMicrophone().then((disconnect) => {
          audioCleanupRef.current = disconnect;
        }).catch(() => {});
      }
    } else if (controller && !isMicActive) {
      audioCleanupRef.current?.();
      audioCleanupRef.current = null;
      if (typeof (controller as any).disconnectAudio === "function") {
        (controller as any).disconnectAudio();
      }
    }
  }, [isOpen, currentTheme, activeOrbState, qualityProfile, isMicActive, localStream]);

  // Limpeza ao fechar
  useEffect(() => {
    if (!isOpen) {
      audioCleanupRef.current?.();
      audioCleanupRef.current = null;
      if (controllerRef.current) {
        try {
          controllerRef.current.destroy();
        } catch {}
        controllerRef.current = null;
      }
    }
  }, [isOpen]);

  const currentDetails = getPresetDetails(selectedPreset);

  const handleToggleMic = () => {
    setIsMicActive((prev) => !prev);
  };

  const handleRemix = () => {
    const randomIndex = Math.floor(Math.random() * ALL_ORBLOOM_PRESETS.length);
    const nextPreset = ALL_ORBLOOM_PRESETS[randomIndex];
    setSelectedPreset(nextPreset);
    setSeed(Number((Math.random() * 6.2).toFixed(2)));
    setAppearance({
      intensity: Number((0.7 + Math.random() * 0.8).toFixed(2)),
      detail: Number((0.5 + Math.random() * 0.5).toFixed(2)),
      glass: Number((0.2 + Math.random() * 0.6).toFixed(2)),
      glow: Number((0.8 + Math.random() * 0.6).toFixed(2)),
    });
  };

  const handleSelectPreset = (presetId: string) => {
    setSelectedPreset(presetId);
    setIsPresetDropdownOpen(false);
  };

  const handleSaveDefault = () => {
    const config: OrbloomCustomConfig = {
      preset: selectedPreset,
      seed,
      appearance,
      motion: motionConfig,
      audioResponse,
    };
    saveOrbloomConfig(config);
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2500);
  };

  const handleResetDefault = () => {
    clearOrbloomConfig();
    setSelectedPreset("nebula-blue-01");
    setSeed(2.4);
    setAppearance({
      intensity: 1.0,
      detail: 0.85,
      glass: 0.45,
      glow: 1.1,
    });
    setMotionConfig({
      speed: 0.8,
      drift: 0.6,
    });
    setAudioResponse({
      brightness: 1.5,
      motion: 1.5,
      pulse: 1.5,
    });
    setSaveToast(true);
    setTimeout(() => setSaveToast(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Personalizador do Orbloom"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-md select-none"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
        style={{ cornerShape: "squircle" } as React.CSSProperties}
        className="relative w-full max-w-xl max-h-[92vh] flex flex-col rounded-[26px] bg-[#0F0F0F]/95 border border-[#161616] text-white shadow-[0_30px_70px_rgba(0,0,0,0.85),inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-2xl overflow-hidden"
      >
        {/* Cabeçalho */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-[#161616]">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-[10px] bg-white/[0.06] flex items-center justify-center text-purple-300">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white tracking-tight">
                Orbloom
              </h2>
              <p className="text-[11px] text-white/45">Personalize o visual do seu orbe</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            style={{ cornerShape: "squircle" } as React.CSSProperties}
            aria-label="Fechar"
            className="p-1.5 rounded-full text-white/50 hover:text-white hover:bg-white/[0.08] transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Conteúdo Rolável */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6 custom-scrollbar">
          <>
              {/* Card Principal de Demonstração (Fiel ao vault.rickybharti.com) */}
              <div
                style={{ cornerShape: "squircle" } as React.CSSProperties}
                className="relative flex flex-col items-center justify-center p-6 rounded-[22px] bg-[#0A0A0A] border border-white/[0.08] shadow-inner text-center overflow-hidden"
              >
                {/* Botões do canto superior direito */}
                <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
                  <button
                    type="button"
                    onClick={handleToggleMic}
                    style={{ cornerShape: "squircle" } as React.CSSProperties}
                    className="px-3 py-1.5 rounded-[12px] bg-[#1F1F1F] hover:bg-[#2A2A2A] text-xs font-medium text-white/90 border border-white/[0.08] shadow-sm transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    {isMicActive ? (
                      <>
                        <MicOff className="h-3.5 w-3.5 text-rose-400" />
                        <span>Parar microfone</span>
                      </>
                    ) : (
                      <>
                        <Mic className="h-3.5 w-3.5 text-emerald-400" />
                        <span>Ativar microfone</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={handleRemix}
                    style={{ cornerShape: "squircle" } as React.CSSProperties}
                    className="px-3 py-1.5 rounded-[12px] bg-[#1F1F1F] hover:bg-[#2A2A2A] text-xs font-medium text-white/90 border border-white/[0.08] shadow-sm transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
                  >
                    <Shuffle className="h-3.5 w-3.5" />
                    <span>Remixar</span>
                  </button>
                </div>

                {/* Canvas do Orbloom em tamanho fixo */}
                <div
                  style={{ width: "240px", height: "240px" }}
                  className="relative flex items-center justify-center my-2"
                >
                  <canvas
                    ref={canvasRef}
                    className="h-full w-full object-contain"
                    aria-label="Visualizador do orbe Orbloom"
                  />
                </div>

                {/* Indicador de status do microfone */}
                <div className="flex items-center justify-center gap-2 text-xs text-white/50 mb-1">
                  <span
                    className={`h-2 w-2 rounded-full ${
                      isMicActive ? "bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]" : "bg-white/20"
                    }`}
                  />
                  <span>
                    {isMicActive
                      ? "microfone ativo · o áudio permanece só neste app"
                      : "microfone desligado · clique em ativar para reagir à sua voz"}
                  </span>
                </div>

                {/* Legenda descritiva da biblioteca */}
                <p className="text-xs text-white/40 max-w-sm">
                  um orbe vivo para interfaces de voz, estados do produto e tudo que existe entre eles
                </p>
              </div>

              {/* Seção Controls (Controles) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-white tracking-tight">
                    Controles
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowAdvancedControls((prev) => !prev)}
                    className="text-xs text-white/50 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
                  >
                    <Sliders className="h-3 w-3" />
                    <span>{showAdvancedControls ? "Ocultar mais opções" : "Mais opções"}</span>
                  </button>
                </div>

                {/* Seletor Suspenso de Presets (Orb preset) */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsPresetDropdownOpen((prev) => !prev)}
                    style={{ cornerShape: "squircle" } as React.CSSProperties}
                    className="w-full flex items-center justify-between px-4 py-3 rounded-[16px] bg-[#1C1C1C] hover:bg-[#222222] border border-white/[0.08] text-sm text-white transition-all cursor-pointer shadow-sm"
                  >
                    <span className="text-white/60 font-medium">Estilo do orbe</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-white">
                        {currentDetails.name}
                      </span>
                      <ChevronDown
                        className={`h-4 w-4 text-white/50 transition-transform duration-200 ${
                          isPresetDropdownOpen ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </button>

                  {/* Menu de Presets Agrupados */}
                  <AnimatePresence>
                    {isPresetDropdownOpen && (
                      <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ type: "spring", bounce: 0.1, duration: 0.2 }}
                        style={{ cornerShape: "squircle" } as React.CSSProperties}
                        className="absolute top-full left-0 right-0 mt-2 p-2 rounded-[18px] bg-[#181818]/95 border border-white/[0.1] backdrop-blur-xl shadow-2xl z-30 max-h-72 overflow-y-auto custom-scrollbar"
                      >
                        {(Object.keys(groupedPresets) as Array<keyof typeof groupedPresets>).map(
                          (category) => (
                            <div key={category} className="mb-2 last:mb-0">
                              <div className="px-3 py-1.5 text-[10px] font-bold tracking-wider text-white/35 uppercase">
                                {category}
                              </div>
                              <div className="space-y-0.5">
                                {groupedPresets[category].map((preset) => {
                                  const isSelected = selectedPreset === preset.id;
                                  return (
                                    <button
                                      key={preset.id}
                                      type="button"
                                      onClick={() => handleSelectPreset(preset.id)}
                                      style={{ cornerShape: "squircle" } as React.CSSProperties}
                                      className={`w-full flex items-center justify-between px-3 py-2 rounded-[12px] text-xs font-medium transition-colors cursor-pointer ${
                                        isSelected
                                          ? "bg-white/15 text-white"
                                          : "text-white/75 hover:bg-white/[0.07] hover:text-white"
                                      }`}
                                    >
                                      <span>{preset.name}</span>
                                      {isSelected && <Check className="h-3.5 w-3.5 text-white" />}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Estado do orbe (idle, listening, thinking, speaking, success, error) */}
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-white/50 px-1">
                    <span>Estado do orbe</span>
                  </div>
                  <div className="flex items-center gap-1.5 p-1 rounded-[14px] bg-[#181818] border border-white/[0.06]">
                    {(["idle", "listening", "thinking", "speaking", "success", "error"] as OrbState[]).map((st) => (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setActiveOrbState(st)}
                        style={{ cornerShape: "squircle" } as React.CSSProperties}
                        className={`flex-1 py-1.5 text-xs font-semibold rounded-[10px] transition-all cursor-pointer ${
                          activeOrbState === st
                            ? "bg-white/15 text-white shadow-sm"
                            : "text-white/45 hover:text-white/80"
                        }`}
                      >
                        {ORB_STATE_LABELS[st]}
                      </button>
                    ))}
                  </div>
                </div>

                {/* More Settings (Fiel ao vault.rickybharti.com) */}
                <AnimatePresence>
                  {showAdvancedControls && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      transition={{ type: "spring", bounce: 0, duration: 0.3 }}
                      className="space-y-5 pt-3 border-t border-white/[0.06] overflow-hidden"
                    >
                      {/* Appearance (Cores e Parâmetros) */}
                      <div className="space-y-3 p-4 rounded-[18px] bg-[#181818] border border-white/[0.06]">
                        <h4 className="text-xs font-bold text-white tracking-wider uppercase">Aparência</h4>

                        {/* Cores */}
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
                          <div>
                            <span className="text-[11px] text-white/50 block mb-1">Cor base</span>
                            <div className="flex items-center gap-2 bg-[#121212] p-1.5 rounded-[10px] border border-white/10">
                              <input
                                type="color"
                                value={baseColor}
                                onChange={(e) => setBaseColor(e.target.value)}
                                className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                              />
                              <span className="text-[11px] font-mono text-white/70 uppercase">{baseColor}</span>
                            </div>
                          </div>

                          <div>
                            <span className="text-[11px] text-white/50 block mb-1">Cor interior</span>
                            <div className="flex items-center gap-2 bg-[#121212] p-1.5 rounded-[10px] border border-white/10">
                              <input
                                type="color"
                                value={interiorColor}
                                onChange={(e) => setInteriorColor(e.target.value)}
                                className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                              />
                              <span className="text-[11px] font-mono text-white/70 uppercase">{interiorColor}</span>
                            </div>
                          </div>

                          <div>
                            <span className="text-[11px] text-white/50 block mb-1">Destaque um</span>
                            <div className="flex items-center gap-2 bg-[#121212] p-1.5 rounded-[10px] border border-white/10">
                              <input
                                type="color"
                                value={accents[0]}
                                onChange={(e) => setAccents([e.target.value, accents[1], accents[2]])}
                                className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                              />
                              <span className="text-[11px] font-mono text-white/70 uppercase">{accents[0]}</span>
                            </div>
                          </div>

                          <div>
                            <span className="text-[11px] text-white/50 block mb-1">Destaque dois</span>
                            <div className="flex items-center gap-2 bg-[#121212] p-1.5 rounded-[10px] border border-white/10">
                              <input
                                type="color"
                                value={accents[1]}
                                onChange={(e) => setAccents([accents[0], e.target.value, accents[2]])}
                                className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                              />
                              <span className="text-[11px] font-mono text-white/70 uppercase">{accents[1]}</span>
                            </div>
                          </div>

                          <div>
                            <span className="text-[11px] text-white/50 block mb-1">Destaque três</span>
                            <div className="flex items-center gap-2 bg-[#121212] p-1.5 rounded-[10px] border border-white/10">
                              <input
                                type="color"
                                value={accents[2]}
                                onChange={(e) => setAccents([accents[0], accents[1], e.target.value])}
                                className="w-5 h-5 rounded cursor-pointer border-0 bg-transparent"
                              />
                              <span className="text-[11px] font-mono text-white/70 uppercase">{accents[2]}</span>
                            </div>
                          </div>

                          <div>
                            <span className="text-[11px] text-white/50 block mb-1">Semente</span>
                            <div className="flex items-center justify-between bg-[#121212] px-2.5 py-1.5 rounded-[10px] border border-white/10">
                              <span className="text-[11px] font-mono text-white/80">{seed.toFixed(2)}</span>
                            </div>
                          </div>
                        </div>

                        {/* Sliders de Aparência */}
                        <div className="grid grid-cols-2 gap-3 text-xs pt-2">
                          <div>
                            <div className="flex justify-between text-white/50 mb-1">
                              <span>Intensidade</span>
                              <span>{appearance.intensity}</span>
                            </div>
                            <input
                              type="range"
                              min="0.25"
                              max="2"
                              step="0.01"
                              value={appearance.intensity}
                              onChange={(e) =>
                                setAppearance((prev) => ({
                                  ...prev,
                                  intensity: parseFloat(e.target.value),
                                }))
                              }
                              className="w-full accent-white cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between text-white/50 mb-1">
                              <span>Detalhe</span>
                              <span>{appearance.detail}</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.01"
                              value={appearance.detail}
                              onChange={(e) =>
                                setAppearance((prev) => ({
                                  ...prev,
                                  detail: parseFloat(e.target.value),
                                }))
                              }
                              className="w-full accent-white cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between text-white/50 mb-1">
                              <span>Vidro</span>
                              <span>{appearance.glass}</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="1"
                              step="0.01"
                              value={appearance.glass}
                              onChange={(e) =>
                                setAppearance((prev) => ({
                                  ...prev,
                                  glass: parseFloat(e.target.value),
                                }))
                              }
                              className="w-full accent-white cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between text-white/50 mb-1">
                              <span>Brilho</span>
                              <span>{appearance.glow}</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="2"
                              step="0.01"
                              value={appearance.glow}
                              onChange={(e) =>
                                setAppearance((prev) => ({
                                  ...prev,
                                  glow: parseFloat(e.target.value),
                                }))
                              }
                              className="w-full accent-white cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Voice response */}
                      <div className="space-y-3 p-4 rounded-[18px] bg-[#181818] border border-white/[0.06]">
                        <h4 className="text-xs font-bold text-white tracking-wider uppercase">Resposta à voz</h4>
                        <div className="grid grid-cols-3 gap-3 text-xs">
                          <div>
                            <div className="flex justify-between text-white/50 mb-1">
                              <span>Brilho</span>
                              <span>{audioResponse.brightness}</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="2"
                              step="0.01"
                              value={audioResponse.brightness}
                              onChange={(e) =>
                                setAudioResponse((prev) => ({
                                  ...prev,
                                  brightness: parseFloat(e.target.value),
                                }))
                              }
                              className="w-full accent-white cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between text-white/50 mb-1">
                              <span>Movimento</span>
                              <span>{audioResponse.motion}</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="2"
                              step="0.01"
                              value={audioResponse.motion}
                              onChange={(e) =>
                                setAudioResponse((prev) => ({
                                  ...prev,
                                  motion: parseFloat(e.target.value),
                                }))
                              }
                              className="w-full accent-white cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between text-white/50 mb-1">
                              <span>Pulso</span>
                              <span>{audioResponse.pulse}</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="2"
                              step="0.01"
                              value={audioResponse.pulse}
                              onChange={(e) =>
                                setAudioResponse((prev) => ({
                                  ...prev,
                                  pulse: parseFloat(e.target.value),
                                }))
                              }
                              className="w-full accent-white cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                            />
                          </div>
                        </div>
                      </div>

                      {/* Motion & Rendering */}
                      <div className="space-y-3 p-4 rounded-[18px] bg-[#181818] border border-white/[0.06]">
                        <h4 className="text-xs font-bold text-white tracking-wider uppercase">Movimento & Qualidade</h4>
                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div>
                            <div className="flex justify-between text-white/50 mb-1">
                              <span>Velocidade procedural</span>
                              <span>{motionConfig.speed}</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="2"
                              step="0.01"
                              value={motionConfig.speed}
                              onChange={(e) =>
                                setMotionConfig((prev) => ({
                                  ...prev,
                                  speed: parseFloat(e.target.value),
                                }))
                              }
                              className="w-full accent-white cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                            />
                          </div>

                          <div>
                            <div className="flex justify-between text-white/50 mb-1">
                              <span>Deriva procedural</span>
                              <span>{motionConfig.drift}</span>
                            </div>
                            <input
                              type="range"
                              min="0"
                              max="2"
                              step="0.01"
                              value={motionConfig.drift}
                              onChange={(e) =>
                                setMotionConfig((prev) => ({
                                  ...prev,
                                  drift: parseFloat(e.target.value),
                                }))
                              }
                              className="w-full accent-white cursor-pointer h-1.5 bg-white/10 rounded-lg appearance-none"
                            />
                          </div>
                        </div>

                        <div className="pt-2 flex items-center justify-between text-xs">
                          <span className="text-white/60">Perfil de qualidade</span>
                          <div className="flex items-center gap-1">
                            {(["low", "balanced", "high"] as const).map((q) => (
                              <button
                                key={q}
                                type="button"
                                onClick={() => setQualityProfile(q)}
                                className={`px-2 py-1 rounded text-xs font-semibold transition ${
                                  qualityProfile === q ? "bg-white text-black" : "bg-white/10 text-white/60"
                                }`}
                              >
                                {QUALITY_LABELS[q]}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </>
        </div>

        {/* Rodapé de Ações */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-white/[0.06] bg-[#111111]">
          <button
            type="button"
            onClick={handleResetDefault}
            style={{ cornerShape: "squircle" } as React.CSSProperties}
            className="flex items-center gap-1.5 px-3 py-2 rounded-[14px] text-xs font-medium text-white/50 hover:text-white hover:bg-white/[0.06] transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>Restaurar Padrão</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSaveDefault}
              style={{ cornerShape: "squircle" } as React.CSSProperties}
              className="flex items-center gap-1.5 px-4 py-2 rounded-[14px] bg-white text-black font-semibold text-xs shadow-lg hover:bg-white/90 active:scale-95 transition-all cursor-pointer"
            >
              <Sparkles className="h-3.5 w-3.5 text-black" />
              <span>Salvar como Meu Padrão</span>
            </button>
          </div>
        </div>

        {/* Notificação Toast Flutuante */}
        <AnimatePresence>
          {saveToast && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="absolute bottom-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-emerald-500/90 text-white text-xs font-semibold backdrop-blur-md shadow-xl flex items-center gap-1.5 z-50 pointer-events-none"
            >
              <Check className="h-3.5 w-3.5" />
              <span>Configuração salva com sucesso!</span>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
