import React, { useState } from "react";
import { ChevronDown, Sliders, Monitor, Cpu, Terminal, FolderOpen } from "lucide-react";

interface AdvancedLaunchSettingsProps {
  monitorIndex?: number;
  onMonitorChange?: (index: number) => void;
  resolution?: string;
  onResolutionChange?: (res: string) => void;
  processPriority?: string;
  onPriorityChange?: (priority: string) => void;
  commandLineArgs?: string;
  onArgsChange?: (args: string) => void;
  workingDirectory?: string;
  onWorkDirChange?: (dir: string) => void;
}

export const AdvancedLaunchSettings: React.FC<AdvancedLaunchSettingsProps> = ({
  monitorIndex = 0,
  onMonitorChange,
  resolution = "Native",
  onResolutionChange,
  processPriority = "Normal",
  onPriorityChange,
  commandLineArgs = "",
  onArgsChange,
  workingDirectory = "",
  onWorkDirChange,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="rounded-3xl border border-white/[0.08] bg-white/[0.02] shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] overflow-hidden transition-all">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between p-4 text-left transition-colors hover:bg-white/5"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-white/70">
            <Sliders className="h-4 w-4" />
          </div>
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-white">
              Configurações Avançadas de Inicialização
            </h4>
            <p className="text-[10px] font-medium text-white/40">
              Monitor, resolução, prioridade de processo e argumentos CLI
            </p>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-white/50 transition-transform duration-300 ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>

      {isOpen && (
        <div className="space-y-4 border-t border-white/[0.08] p-4 pt-4 bg-white/[0.01]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
                <Monitor className="h-3 w-3" /> Monitor de Exibição
              </label>
              <input
                type="number"
                min={0}
                max={4}
                value={monitorIndex}
                onChange={(e) => onMonitorChange?.(parseInt(e.target.value, 10) || 0)}
                className="h-10 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-bold text-white outline-none focus:border-white/20"
                placeholder="0 (Monitor Principal)"
              />
            </div>

            <div>
              <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
                <Cpu className="h-3 w-3" /> Prioridade de Processo
              </label>
              <select
                value={processPriority}
                onChange={(e) => onPriorityChange?.(e.target.value)}
                className="h-10 w-full rounded-2xl border border-white/10 bg-white/[0.04] px-3 text-xs font-bold text-white outline-none focus:border-white/20"
              >
                <option value="Normal">Normal</option>
                <option value="AboveNormal">Acima do Normal</option>
                <option value="High">Alta Prioridade</option>
                <option value="Realtime">Tempo Real</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
              <Terminal className="h-3 w-3" /> Argumentos de Linha de Comando
            </label>
            <input
              type="text"
              value={commandLineArgs}
              onChange={(e) => onArgsChange?.(e.target.value)}
              className="h-10 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-mono text-white outline-none focus:border-white/20 placeholder:text-white/20"
              placeholder="-fullscreen -novid -dx11"
            />
          </div>

          <div>
            <label className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-white/50">
              <FolderOpen className="h-3 w-3" /> Diretório de Trabalho (CWD)
            </label>
            <input
              type="text"
              value={workingDirectory}
              onChange={(e) => onWorkDirChange?.(e.target.value)}
              className="h-10 w-full rounded-2xl border border-white/10 bg-white/5 px-3 text-xs font-mono text-white outline-none focus:border-white/20 placeholder:text-white/20"
              placeholder="C:\Caminho\Para\PastaDoJogo"
            />
          </div>
        </div>
      )}
    </div>
  );
};
