import React from "react";
import { Camera, FileSearch, FolderOpen, PackageOpen, Trash2 } from "lucide-react";
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
  /** Imagens da loja (Steam/Epic): aparecem no mural da aba Sobre. `index` é a posição na galeria. */
  storeScreenshots?: Array<{ url: string; index: number }>;
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
  onSelectEpicInstallFolder?: () => void;
  onSelectEpicExecutable?: () => void;
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
    <span className="text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] mb-1">{label}</span>
    <span className="text-sm font-semibold text-[var(--ink)]">{value || fallback}</span>
  </div>
);

/** Mural de fotos: a grade de imagens que abre a galeria ao clicar (usada nas abas Capturas e Sobre). */
const PhotoWall: React.FC<{
  items: Array<{ url: string; index: number }>;
  copy: GameDetailCopy;
  onSelect: (index: number) => void;
  playSound: (type: SoundEffectType) => void;
}> = ({ items, copy, onSelect, playSound }) => (
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
    {items.map((item, position) => (
      <button
        key={`${item.index}-${position}`}
        type="button"
        onClick={() => {
          onSelect(item.index);
          playSound("select");
        }}
        className="group relative rounded-[var(--corner-md)] overflow-hidden border border-transparent aspect-video cursor-pointer text-left focus:outline-none focus:ring-2 focus:ring-white transition-all bg-black/40"
      >
        <img
          src={item.url}
          alt={`Foto ${position + 1}`}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
          <span className="text-[length:var(--step-0)] font-bold text-[var(--ink)] uppercase tracking-widest px-4 py-2 bg-[var(--tone-3)] rounded-full ">
            {copy.viewGallery}
          </span>
        </div>
      </button>
    ))}
  </div>
);

export const GameDetailSocialMods: React.FC<GameDetailSocialModsProps> = React.memo(({
  game,
  activeTab,
  copy,
  localScreenshots,
  storeScreenshots = [],
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
  onSelectEpicInstallFolder,
  onSelectEpicExecutable,
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
          <h3 className="text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)]">
            {copy.photoWall} ({localScreenshots.length})
          </h3>
          {localScreenshots.length > 0 && (
            <button
              onClick={onOpenFolder}
              className="flex items-center gap-1.5 text-[length:var(--step-0)] font-bold text-[var(--ink-muted)] hover:text-[var(--ink)] px-3 py-1.5 rounded-[10px] bg-[var(--color-surface)] border border-transparent transition-colors"
            >
              <FolderOpen className="w-3.5 h-3.5" />
              {copy.openFolder}
            </button>
          )}
        </div>

        {localScreenshots.length === 0 ? (
          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[var(--corner-md)] border border-dashed border-transparent bg-[var(--color-surface)] text-center p-8">
            <Camera className="mb-3 h-8 w-8 text-[var(--ink-faint)]" />
            <p className="text-sm font-semibold text-[var(--ink-muted)]">{copy.noScreenshot}</p>
          </div>
        ) : (
          <PhotoWall
            items={localScreenshots.map((url, index) => ({ url, index }))}
            copy={copy}
            onSelect={onSelectCapture}
            playSound={playSound}
          />
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
          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-[var(--corner-md)] border border-dashed border-transparent bg-[var(--color-surface)] text-center p-8">
            <PackageOpen className="mb-3 h-8 w-8 text-[var(--ink-faint)]" />
            <p className="text-sm font-semibold text-[var(--ink-muted)]">Nenhum mod instalado para este jogo.</p>
          </div>
        ) : (
          <div className="grid gap-3">
            {gameMods.map((mod) => (
              <div
                key={mod.id}
                className="flex items-center gap-4 rounded-[var(--corner-md)] border border-transparent bg-[var(--color-surface)] p-4 transition-colors hover:bg-[var(--tone-3)]"
              >
                <div className="h-12 w-16 shrink-0 overflow-hidden rounded-[var(--corner-sm)] bg-black/40 border border-transparent">
                  {mod.pictureUrl ? (
                    <img src={mod.pictureUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[var(--ink-faint)]">
                      <PackageOpen className="w-5 h-5" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-bold text-[var(--ink)] text-sm truncate">{mod.name}</h4>
                  <span className="text-[length:var(--step-0)] text-[var(--ink-faint)]">
                    {mod.enabled ? "Ativo no jogo" : mod.status === "downloaded" ? "Baixado, ainda não instalado" : "Desativado"}
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
          <h3 className="text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] mb-4">{copy.about}</h3>
          {isAboutLoading ? (
            <div className="w-full h-32 flex items-center justify-center">
              <LoadingState label="Carregando detalhes..." variant="searching" />
            </div>
          ) : (
            <div
              className="text-[var(--ink-muted)] leading-relaxed text-sm prose prose-invert prose-p:my-0 pb-2"
              dangerouslySetInnerHTML={{ __html: sanitizedAboutHtml }}
            />
          )}
        </div>

        {storeScreenshots.length > 0 && (
          <div>
            <h3 className="text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] mb-4">
              {copy.photoWall} ({storeScreenshots.length})
            </h3>
            <PhotoWall items={storeScreenshots} copy={copy} onSelect={onSelectCapture} playSound={playSound} />
          </div>
        )}

        {sanitizedSupportedLanguagesHtml && (
          <div>
            <h3 className="text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] mb-3">
              Idiomas Suportados
            </h3>
            <div
              className="text-[var(--ink-muted)] text-[length:var(--step-0)]"
              dangerouslySetInnerHTML={{ __html: sanitizedSupportedLanguagesHtml }}
            />
          </div>
        )}

        {(sanitizedMinRequirementsHtml || sanitizedRecRequirementsHtml) && (
          <div>
            <h3 className="text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] mb-3">
              Requisitos de Sistema
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {sanitizedMinRequirementsHtml && (
                <div
                  className="bg-[var(--color-surface)] p-4 rounded-[var(--corner-sm)] border border-[var(--color-ui-detail)] prose prose-invert prose-sm"
                  dangerouslySetInnerHTML={{ __html: sanitizedMinRequirementsHtml }}
                />
              )}
              {sanitizedRecRequirementsHtml && (
                <div
                  className="bg-[var(--color-surface)] p-4 rounded-[var(--corner-sm)] border border-[var(--color-ui-detail)] prose prose-invert prose-sm"
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
              <span className="text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] mb-2">
                Metacritic
              </span>
              <span
                className={`px-2 py-1 rounded text-[length:var(--step-0)] font-bold w-fit ${
                  metacritic.score >= 75
                    ? "bg-[var(--tone-3)] text-[var(--live)]"
                    : metacritic.score >= 50
                    ? "bg-[var(--tone-3)] text-[var(--ink)]"
                    : "bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] text-[var(--danger)]"
                }`}
              >
                {metacritic.score}
              </span>
            </div>
          )}

          {priceOverview && (
            <div className="flex flex-col">
              <span className="text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] mb-2">
                Preço
              </span>
              <span className="text-sm font-semibold text-[var(--ink)]">{priceOverview.final_formatted}</span>
            </div>
          )}
        </div>

        {tags && tags.length > 0 && (
          <div>
            <h3 className="text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] mb-3">
              {copy.popularTags}
            </h3>
            <div className="flex flex-wrap gap-2">
              {tags.slice(0, 15).map((tag, i) => (
                <span
                  key={i}
                  className="px-3 py-1.5 rounded-[10px] bg-[var(--color-surface)] border border-[var(--color-ui-detail)] text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)]"
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
    const isEpicGame = game.launcherType === "epic" || Boolean(game.epicCatalogId || game.epicLaunchId);

    return (
      <div className="w-full flex flex-col gap-8">
        {/* Metadados de Integração do Hub */}
        <div className="flex flex-col gap-3 p-5 rounded-[var(--corner-md)] bg-[var(--color-surface)] border border-transparent shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
          <h3 className="text-[length:var(--step-0)] font-semibold text-[var(--ink-muted)] uppercase tracking-wider">
            Metadados de Integração
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-[length:var(--step-0)]">
            {game.launcherType === "steam" && (
              <div className="flex flex-col gap-1">
                <span className="text-[var(--ink-faint)]">{copy.appId}</span>
                <span className="font-mono text-[var(--ink)]">{game.steamAppId || "---"}</span>
              </div>
            )}
            <div className="flex flex-col gap-1">
              <span className="text-[var(--ink-faint)]">{copy.source}</span>
              <span className="text-[var(--ink)]">
                {game.source === "steam"
                  ? copy.sourceSteamSync
                  : game.source === "epic"
                    ? copy.sourceEpicCatalog
                    : copy.sourceManual}
              </span>
            </div>
            <div className="flex flex-col gap-2 sm:col-span-2">
              <span className="text-[var(--ink-faint)]">
                {isEpicGame ? copy.epicInstallPath : "Executável"}
              </span>
              <span className="font-mono text-[length:var(--step-0)] text-[var(--ink-muted)] break-all">
                {game.executablePath || copy.epicInstallPathMissing}
              </span>
              {isEpicGame && (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={onSelectEpicInstallFolder}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-[var(--tone-3)] border border-transparent text-[length:var(--step-0)] font-bold text-[var(--ink)] hover:bg-[var(--tone-4)] transition-colors"
                  >
                    <FolderOpen className="w-3.5 h-3.5" />
                    {copy.epicSelectInstallFolder}
                  </button>
                  <button
                    type="button"
                    onClick={onSelectEpicExecutable}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-[var(--tone-3)] border border-transparent text-[length:var(--step-0)] font-bold text-[var(--ink)] hover:bg-[var(--tone-4)] transition-colors"
                  >
                    <FileSearch className="w-3.5 h-3.5" />
                    {copy.epicSelectExecutable}
                  </button>
                  {game.executablePath && (
                    <button
                      type="button"
                      onClick={onOpenFolder}
                      className="flex items-center gap-2 px-3 py-1.5 rounded-[10px] bg-[var(--tone-3)] border border-transparent text-[length:var(--step-0)] font-bold text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--tone-4)] transition-colors"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                      {copy.openFolder}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

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
            className="px-4 py-2 rounded-[var(--corner-sm)] bg-[var(--tone-3)] border border-transparent text-[length:var(--step-0)] font-bold text-[var(--ink)] hover:bg-[var(--tone-4)] transition-colors"
          >
            Salvar Configurações
          </button>
        </div>

        <div className="pt-6 border-t border-transparent flex flex-col gap-3">
          <h3 className="text-[length:var(--step-0)] font-bold text-[var(--danger)] uppercase tracking-wider">
            Zona de Perigo
          </h3>
          <p className="text-[length:var(--step-0)] text-[var(--ink-faint)]">
            Remover o jogo da sua biblioteca local do Checkpoint não desinstalará os arquivos do seu disco.
          </p>
          <button
            onClick={onOpenDeleteModal}
            className="self-start flex items-center gap-2 px-4 py-2 rounded-[var(--corner-sm)] bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] border border-transparent text-[length:var(--step-0)] font-bold text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_18%,transparent)] transition-colors"
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
