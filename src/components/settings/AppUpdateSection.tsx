import React, { useState } from "react";
import { Info, Download } from "lucide-react";
import { usePreferences } from "../../context/PreferencesContext";
import { useAppUpdater } from "../../hooks/useAppUpdater";
import { AppUpdateErrorModal } from "./AppUpdateErrorModal";
import WhatsNewModal from "../WhatsNewModal";
import { getReleaseHighlights, LATEST_RELEASE } from "../../releases/releaseHighlights";

const WHATS_NEW_BUTTON_COPY = {
  "pt-BR": "O que há de novo?",
  "en-US": "What's New?",
  "es-ES": "¿Qué hay de nuevo?",
  "fr-FR": "Quoi de neuf ?",
  "de-DE": "Was gibt's Neues?",
  "it-IT": "Novità",
} as const;

const UPDATE_COPY = {
  "pt-BR": ["Atualizações do Sistema", "Versão instalada atualmente", "Mantenha seu Phelierium Launcher na versão mais recente.", "Buscando atualizações...", "Nova versão disponível para baixar.", "Você já está usando a versão mais recente.", "Baixando atualização", "Atualização pronta para instalar.", "Ambiente de desenvolvimento local.", "Não foi possível verificar atualizações.", "Buscar Atualizações", "Baixar e Atualizar", "Reiniciar e Atualizar"],
  "en-US": ["System Updates", "Currently installed version", "Keep Phelierium Launcher up to date.", "Checking for updates...", "A new version is available to download.", "You already have the latest version.", "Downloading update", "Update ready to install.", "Local development environment.", "Unable to check for updates.", "Check for Updates", "Download and Update", "Restart and Update"],
  "es-ES": ["Actualizaciones del sistema", "Versión instalada", "Mantén Phelierium Launcher actualizado.", "Buscando actualizaciones...", "Hay una nueva versión disponible.", "Ya tienes la última versión.", "Descargando actualización", "Actualización lista para instalar.", "Entorno de desarrollo local.", "No se pudieron verificar las actualizaciones.", "Buscar actualizaciones", "Descargar y actualizar", "Reiniciar y actualizar"],
  "fr-FR": ["Mises à jour système", "Version installée", "Gardez Phelierium Launcher à jour.", "Recherche de mises à jour...", "Une nouvelle version est disponible.", "Vous utilisez déjà la dernière version.", "Téléchargement de la mise à jour", "Mise à jour prête à installer.", "Environnement de développement local.", "Impossible de vérifier les mises à jour.", "Rechercher des mises à jour", "Télécharger et mettre à jour", "Redémarrer et mettre à jour"],
  "de-DE": ["Systemupdates", "Installierte Version", "Halte Phelierium Launcher auf dem neuesten Stand.", "Suche nach Updates...", "Eine neue Version ist verfügbar.", "Du verwendest bereits die neueste Version.", "Update wird heruntergeladen", "Update ist installationsbereit.", "Lokale Entwicklungsumgebung.", "Updates konnten nicht geprüft werden.", "Nach Updates suchen", "Herunterladen und aktualisieren", "Neu starten und aktualisieren"],
  "it-IT": ["Aggiornamenti di sistema", "Versione installata", "Mantieni Phelierium Launcher aggiornato.", "Ricerca aggiornamenti...", "È disponibile una nuova versione.", "Hai già la versione più recente.", "Download aggiornamento", "Aggiornamento pronto per l’installazione.", "Ambiente di sviluppo locale.", "Impossibile verificare gli aggiornamenti.", "Cerca aggiornamenti", "Scarica e aggiorna", "Riavvia e aggiorna"],
} as const;

export const SettingsHeader: React.FC<{
  icon: React.ReactNode;
  title: React.ReactNode;
  description: string;
}> = React.memo(({ icon, title, description }) => (
  <div className="mb-6 flex items-center gap-3.5">
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-white/10 bg-white/10 text-white/75 shadow-sm">
      {icon}
    </div>
    <div>
      <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">{title}</h2>
      {description && <p className="text-xs font-medium text-white/40 mt-0.5 leading-relaxed">{description}</p>}
    </div>
  </div>
));
SettingsHeader.displayName = "SettingsHeader";

export const AppUpdateSection: React.FC = React.memo(() => {
  const { language } = usePreferences();
  const updateCopy = UPDATE_COPY[language] || UPDATE_COPY["pt-BR"];
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showWhatsNewModal, setShowWhatsNewModal] = useState(false);

  const {
    currentVersion,
    updateStatus,
    downloadProgress,
    errorMessage,
    newVersionInfo,
    checkForUpdates,
    downloadUpdate,
    installUpdate,
  } = useAppUpdater();

  return (
    <>
      <section className="mt-6 rounded-3xl border border-white/[0.08] p-6 md:p-7 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
        style={{
          background: "rgba(255, 255, 255, 0.02)",
          backdropFilter: "blur(20px) saturate(180%)",
          WebkitBackdropFilter: "blur(20px) saturate(180%)",
        }}>
        <SettingsHeader
          icon={<Download className="h-5 w-5 text-white/70" />}
          title={updateCopy[0]}
          description={`${updateCopy[1]}: v${currentVersion}`}
        />
        <div className="flex flex-col gap-4 rounded-3xl border border-white/[0.05] bg-white/[0.02] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              {updateStatus === "idle" && (
                <p className="text-xs text-white/50">{updateCopy[2]}</p>
              )}
              {updateStatus === "checking" && (
                <p className="flex items-center gap-2 text-xs text-amber-300">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-amber-300" />
                  {updateCopy[3]}
                </p>
              )}
              {updateStatus === "available" && (
                <p className="text-xs text-emerald-400">
                  {updateCopy[4]} {newVersionInfo?.version ? `v${newVersionInfo.version}` : ""}
                </p>
              )}
              {updateStatus === "not-available" && (
                <p className="text-xs text-white/70">{updateCopy[5]}</p>
              )}
              {updateStatus === "downloading" && (
                <div className="space-y-2">
                  <p className="text-xs text-sky-400">{updateCopy[6]}... {downloadProgress}%</p>
                  <div className="h-1.5 w-48 overflow-hidden rounded-full bg-white/10">
                    <div className="h-full bg-sky-400 transition-all duration-300" style={{ width: `${downloadProgress}%` }} />
                  </div>
                </div>
              )}
              {updateStatus === "downloaded" && (
                <p className="text-xs text-emerald-400">{updateCopy[7]}</p>
              )}
              {updateStatus === "dev" && (
                <p className="text-xs text-amber-300/80">{updateCopy[8]}</p>
              )}
              {updateStatus === "error" && (
                <div className="flex items-center gap-2">
                  <p className="text-xs text-red-400">{updateCopy[9]}</p>
                  <button
                    type="button"
                    onClick={() => setShowErrorModal(true)}
                    className="flex cursor-pointer items-center gap-1 text-[11px] font-bold text-red-300/80 hover:text-red-200 underline decoration-red-400/40"
                  >
                    <Info className="h-3 w-3" />
                    Ver detalhes
                  </button>
                </div>
              )}
            </div>

            <div className="shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowWhatsNewModal(true)}
                className="cursor-pointer rounded-xl border border-white/10 bg-white/5 px-3.5 py-2 text-[10px] font-bold uppercase tracking-wider text-white/80 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white active:scale-95 shadow-sm"
              >
                {WHATS_NEW_BUTTON_COPY[language] || WHATS_NEW_BUTTON_COPY["pt-BR"]}
              </button>

              {updateStatus === "idle" || updateStatus === "not-available" || updateStatus === "dev" || updateStatus === "error" ? (
                <button
                  type="button"
                  onClick={checkForUpdates}
                  className="cursor-pointer rounded-xl bg-white px-4 py-2 text-[10px] font-black uppercase text-black transition-all hover:bg-white/90 active:scale-95 shadow-md"
                >
                  {updateCopy[10]}
                </button>
              ) : null}

              {updateStatus === "available" ? (
                <button
                  type="button"
                  onClick={downloadUpdate}
                  className="cursor-pointer rounded-xl bg-sky-500 px-4 py-2 text-[10px] font-black uppercase text-white shadow-[0_0_15px_rgba(14,165,233,0.3)] transition-all hover:bg-sky-400 active:scale-95"
                >
                  {updateCopy[11]}
                </button>
              ) : null}

              {updateStatus === "downloaded" ? (
                <button
                  type="button"
                  onClick={installUpdate}
                  className="cursor-pointer rounded-xl bg-emerald-500 px-4 py-2 text-[10px] font-black uppercase text-white shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all hover:bg-emerald-400 active:scale-95"
                >
                  {updateCopy[12]}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <AppUpdateErrorModal
        isOpen={showErrorModal}
        onClose={() => setShowErrorModal(false)}
        errorMessage={errorMessage}
      />

      {showWhatsNewModal && (
        <WhatsNewModal
          release={getReleaseHighlights(currentVersion || LATEST_RELEASE.version)}
          onClose={() => setShowWhatsNewModal(false)}
        />
      )}
    </>
  );
});

AppUpdateSection.displayName = "AppUpdateSection";
