import React from "react";
import { Package, ExternalLink, Info } from "lucide-react";

interface ModsSummaryBannerProps {
  installedModsCount: number;
  activeModsCount: number;
  onOpenFullModManager: () => void;
}

export const ModsSummaryBanner: React.FC<ModsSummaryBannerProps> = ({
  installedModsCount,
  activeModsCount,
  onOpenFullModManager,
}) => {
  return (
    <div className="mb-6 rounded-3xl border border-white/[0.08] p-4.5 backdrop-blur-xl shadow-[inset_0_1px_0_rgba(255,255,255,0.06),0_8px_30px_rgba(0,0,0,0.5)]" style={{ background: "rgba(255, 255, 255, 0.02)" }}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-white/80 shadow-sm">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-bold uppercase tracking-wider text-white">
                Resumo de Mods do Jogo
              </h4>
              <span className="flex items-center gap-1 rounded-md border border-white/10 bg-white/10 px-2 py-0.5 text-[9px] font-black text-white/70">
                <Info className="h-3 w-3" /> Atalho Rápido
              </span>
            </div>
            <p className="mt-0.5 text-xs font-medium text-white/60">
              {activeModsCount} mod{activeModsCount === 1 ? "" : "s"} ativo{activeModsCount === 1 ? "" : "s"} de {installedModsCount} instalado{installedModsCount === 1 ? "" : "s"}. Para baixar ou gerenciar a coleção completa, use o Gerenciador de Mods Geral.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onOpenFullModManager}
          className="cursor-pointer flex shrink-0 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-xs font-black uppercase tracking-wider text-black shadow-md transition-all hover:bg-white/90 hover:scale-105 active:scale-95"
        >
          <span>Gerenciar Mods Completo</span>
          <ExternalLink className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
