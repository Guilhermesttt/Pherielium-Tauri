import React from "react";
import { Camera, FolderOpen, PackageOpen, Trash2 } from "lucide-react";
import type { Game, GameLaunchProfile } from "../../types/domain";
import type { GameDetailCopy, GamePanelMod, DisplayOption } from "../../types/gameDetail";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import { ModsSummaryBanner } from "../game/ModsSummaryBanner";
import { AdvancedLaunchSettings } from "../game/AdvancedLaunchSettings";
import { LoadingState } from "../ui/loading-state";

interface GameDetailSocialModsProps {
  game: Game;
  activeTab: string;
  copy: GameDetailCopy;
  localScreenshots: string[];
  gameMods: GamePanelMod[];
  sanitizedAboutHtml: string;
  sanitizedSupportedLanguagesHtml?: string;
  sanitizedMinRequirementsHtml?: string;
  sanitizedRecRequirementsHtml?: string;
  isAboutLoading: boolean;
  developer?: string;
  publisher?: string;
  releaseDate?: string;
  localizedCategory: string;
  metacritic?: { score: number };
  priceOverview?: { final_formatted: string };
  tags?: string[];
  launchProfile: GameLaunchProfile;
  displayOptions: DisplayOption[];
  onLaunchProfileChange: (profile: GameLaunchProfile) => void;
  onSaveLaunchProfile: () => void;
  onOpenDeleteModal: () => void;
  onOpenFolder: () => void;
  onOpenMods?: () => void;
  onSelectCapture: (index: number) => void;
  playSound: (type: SoundEffectType) => void;
}

const TechnicalDetail: React.FC<{ label: string; value?: string | null; fallback: string }> = ({
  label,
  value,
  fallback,
}) => (
  <div className="flex flex-col">
    <span className="text-[10px] font-black tracking-[0.2em] text-white/35 uppercase mb-1">{label}</span>
    <span className="text-sm font-semibold text-white/80">{value || fallback}</span>
  </div>
);

export const GameDetailSocialMods: React.FC<GameDetailSocialModsProps> = React.memo(({
  game,
  activeTab,
  copy,
  localScreenshots,
  gameMods,
  sanitizedAboutHtml,
  sanitizedSupportedLanguagesHtml,
  sanitizedMinRequirementsHtml,
  sanitizedRecRequirementsHtml,
  isAboutLoading,
  developer,
  publisher,
  releaseDate,
  localizedCategory,
  metacritic,
  priceOverview,
  tags,
  launchProfile,
  displayOptions,
  onLaunchProfileChange,
  onSaveLaunchProfile,
  onOpenDeleteModal,
  onOpenFolder,
  onOpenMods,
  onSelectCapture,
  playSound,
}) => {
  // ==========================================
  // ABA CAPTURAS
  // ==========================================
  if (activeTab === copy.tabCaptures) {
    return (
      <div className="w-full flex flex-col gap-6">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-[11px] font-black tracking-[0.28em] text-white/35 uppercase">
            {copy.photoWall} ({localScreenshots.length})
          </h3>
          {localScreenshots.length > 0 && (
            <button
              onClick={onOpenFolder}
              className="flex items-center gap-1.5 text-xs font-bold text-white/50 hover:text-white px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-white/5 transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              {copy.openFolder}
            </button>
          )}
        </div>

        {localScreenshots.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[var(--color-surface)] text-center p-8">
            <Camera className="mb-3 h-8 w-8 text-white/20" />
            <p className="text-sm font-semibold text-white/50">{copy.noScreenshot}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {localScreenshots.map((src, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  onSelectCapture(idx);
                  playSound("select");
                }}
                className="group relative rounded-2xl overflow-hidden border border-white/10 aspect-video cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-white transition-all bg-black/40"
              >
                <img
                  src={src}
                  alt={`Captura ${idx + 1}`}
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span className="text-[10px] font-bold text-white uppercase tracking-widest px-4 py-2 bg-white/10 rounded-full ">
                    {copy.viewGallery}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // ABA MODS
  // ==========================================
  if (activeTab === copy.tabMods) {
    return (
      <div className="w-full flex flex-col gap-6">
        <ModsSummaryBanner
          installedModsCount={gameMods.length}
          activeModsCount={gameMods.filter((m) => m.enabled).length}
          onOpenFullModManager={() => {
            playSound("select");
            onOpenMods?.();
          }}
        />

        {gameMods.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-[var(--color-surface)] text-center p-8">
            <PackageOpen className="mb-3 h-8 w-8 text-white/20" />
            <p className="text-sm font-semibold text-white/50">Nenhum mod instalado para este jogo.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {gameMods.map((mod) => (
              <div
                key={mod.id}
                className="flex items-center gap-4 rounded-2xl border border-white/10 bg-[var(--color-surface)] p-4 transition-colors hover:bg-[#222222]"
              >
                <div className="h-12 w-16 shrink-0 overflow-hidden rounded-xl bg-black/40 border border-white/10">
                  {mod.pictureUrl ? (
                    <img src={mod.pictureUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-white/20">
                      <PackageOpen className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-white text-sm truncate">{mod.name}</h4>
                  <span className="text-xs text-white/40">
                    {mod.enabled ? "Ativo no jogo" : "Desativado"}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // ABA SOBRE
  // ==========================================
  if (activeTab === copy.tabAbout) {
    return (
      <div className="w-full flex flex-col gap-8">
        <div>
          <h3 className="text-[11px] font-black tracking-[0.28em] text-white/35 uppercase mb-4">{copy.about}</h3>
          {isAboutLoading ? (
            <div className="w-full h-32 flex items-center justify-center">
              <LoadingState label="Carregando detalhes..." variant="searching" />
            </div>
          ) : (
            <div
              className="text-white/70 leading-relaxed text-sm prose prose-invert prose-p:my-0 pb-2"
              dangerouslySetInnerHTML={{ __html: sanitizedAboutHtml }}
            />
          )}
        </div>

        {sanitizedSupportedLanguagesHtml && (
          <div>
            <h3 className="text-[11px] font-black tracking-[0.28em] text-white/35 uppercase mb-3">
              Idiomas Suportados
            </h3>
            <div
              className="text-white/60 text-xs"
              dangerouslySetInnerHTML={{ __html: sanitizedSupportedLanguagesHtml }}
            />
          </div>
        )}

        {(sanitizedMinRequirementsHtml || sanitizedRecRequirementsHtml) && (
          <div>
            <h3 className="text-[11px] font-black tracking-[0.28em] text-white/35 uppercase mb-3">
              Requisitos de Sistema
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sanitizedMinRequirementsHtml && (
                <div
                  className="bg-[var(--color-surface)] p-4 rounded-xl border border-[var(--color-ui-detail)] prose prose-invert prose-sm"
                  dangerouslySetInnerHTML={{ __html: sanitizedMinRequirementsHtml }}
                />
              )}
              {sanitizedRecRequirementsHtml && (
                <div
                  className="bg-[var(--color-surface)] p-4 rounded-xl border border-[var(--color-ui-detail)] prose prose-invert prose-sm"
                  dangerouslySetInnerHTML={{ __html: sanitizedRecRequirementsHtml }}
                />
              )}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-y-6 gap-x-6 pt-6 border-t border-[var(--color-ui-detail)]">
          <TechnicalDetail label={copy.developer} value={developer} fallback={copy.notInformed} />
          <TechnicalDetail label={copy.publisher} value={publisher} fallback={copy.notInformed} />
          <TechnicalDetail label={copy.releaseDate} value={releaseDate} fallback={copy.notInformed} />
          <TechnicalDetail label={copy.category} value={localizedCategory} fallback={copy.notInformed} />

          {metacritic && (
            <div className="flex flex-col">
              <span className="text-[10px] font-black tracking-[0.2em] text-white/35 uppercase mb-2">
                Metacritic
              </span>
              <span
                className={`px-2 py-1 rounded text-xs font-bold w-fit ${
                  metacritic.score >= 75
                    ? "bg-green-500/20 text-green-400"
                    : metacritic.score >= 50
                    ? "bg-yellow-500/20 text-yellow-400"
                    : "bg-red-500/20 text-red-400"
                }`}
              >
                {metacritic.score}
              </span>
            </div>
          )}

          {priceOverview && (
            <div className="flex flex-col">
              <span className="text-[10px] font-black tracking-[0.2em] text-white/35 uppercase mb-2">
                Preço
              </span>
              <span className="text-sm font-semibold text-white/80">{priceOverview.final_formatted}</span>
            </div>
          )}
        </div>

        {tags && tags.length > 0 && (
          <div>
            <h3 className="text-[11px] font-black tracking-[0.28em] text-white/35 uppercase mb-3">
              {copy.popularTags}
            </h3>
            <div className="flex flex-wrap gap-2">
              {tags.slice(0, 15).map((tag, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 rounded-lg bg-[var(--color-surface)] border border-[var(--color-ui-detail)] text-[10px] font-semibold text-white/65"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // ABA GERENCIAR
  // ==========================================
  if (activeTab === copy.tabManage) {
    return (
      <div className="w-full flex flex-col gap-8">
        <AdvancedLaunchSettings
          monitorIndex={launchProfile.monitorId ?? 0}
          onMonitorChange={(index) => onLaunchProfileChange({ ...launchProfile, monitorId: index })}
          resolution={
            launchProfile.resolutionWidth && launchProfile.resolutionHeight
              ? `${launchProfile.resolutionWidth}x${launchProfile.resolutionHeight}`
              : "Native"
          }
          onResolutionChange={(res) => {
            const [w, h] = res.split("x").map(Number);
            onLaunchProfileChange({
              ...launchProfile,
              resolutionWidth: w || null,
              resolutionHeight: h || null,
            });
          }}
          processPriority={launchProfile.processPriority || "Normal"}
          onPriorityChange={(priority) =>
            onLaunchProfileChange({
              ...launchProfile,
              processPriority: priority.toLowerCase() as any,
            })
          }
          commandLineArgs={launchProfile.arguments || ""}
          onArgsChange={(args) => onLaunchProfileChange({ ...launchProfile, arguments: args })}
          workingDirectory={launchProfile.workingDirectory || ""}
          onWorkDirChange={(dir) => onLaunchProfileChange({ ...launchProfile, workingDirectory: dir })}
        />
        <div className="flex justify-end">
          <button
            onClick={onSaveLaunchProfile}
            className="px-4 py-2 rounded-xl bg-white/10 border border-white/15 text-xs font-bold text-white hover:bg-white/20 transition-colors"
          >
            Salvar Configurações
          </button>
        </div>

        <div className="pt-6 border-t border-white/10 flex flex-col gap-3">
          <h3 className="text-xs font-bold text-red-400 uppercase tracking-wider">
            Zona de Perigo
          </h3>
          <p className="text-xs text-white/40">
            Remover o jogo da sua biblioteca local do Checkpoint não desinstalará os arquivos do seu disco.
          </p>
          <button
            onClick={onOpenDeleteModal}
            className="self-start flex items-center gap-2 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 text-xs font-bold text-red-400 hover:bg-red-500/20 transition-colors"
          >
            <Trash2 className="w-4 h-4" />
            {copy.removeGame}
          </button>
        </div>
      </div>
    );
  }

  return null;
});

GameDetailSocialMods.displayName = "GameDetailSocialMods";
