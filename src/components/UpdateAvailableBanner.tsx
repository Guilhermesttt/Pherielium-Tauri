import React, { useEffect, useState } from "react";
import { Download, X } from "lucide-react";

type BannerState = {
  version?: string;
  phase: "available" | "downloaded";
};

/**
 * Persistent in-hub banner when GitHub has a newer release.
 * Complements the toast so the user always sees the update CTA.
 */
export const UpdateAvailableBanner: React.FC = () => {
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [dismissedVersion, setDismissedVersion] = useState<string | null>(null);

  useEffect(() => {
    const api = window.electronAPI;
    if (!api?.onUpdateMessage) return;

    const apply = (phase: BannerState["phase"], data?: { version?: string } | string) => {
      const version = typeof data === "object" ? data?.version : undefined;
      if (version && version === dismissedVersion) return;
      setBanner({ phase, version });
    };

    void api.getUpdateState?.().then((state) => {
      if (state.status === "available" || state.status === "downloading") {
        apply("available", state.info || undefined);
      } else if (state.status === "downloaded") {
        apply("downloaded", state.info || undefined);
      }
    }).catch(() => undefined);

    return api.onUpdateMessage((msg, data) => {
      if (msg === "update-available") apply("available", data);
      else if (msg === "update-downloaded") apply("downloaded", data);
    });
  }, [dismissedVersion]);

  if (!banner) return null;

  const goSettings = () => {
    window.dispatchEvent(new CustomEvent("phelierium:open-settings-tab"));
  };

  return (
    <div
      role="status"
      className="pointer-events-auto fixed bottom-5 left-1/2 z-[210] flex w-[min(560px,calc(100%-2rem))] -translate-x-1/2 items-center gap-3 rounded-2xl border border-amber-400/25 bg-[#121210]/95 px-4 py-3 shadow-[0_20px_50px_rgba(0,0,0,0.55)] backdrop-blur-xl"
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-amber-400/30 bg-amber-400/10 text-amber-200">
        <Download className="h-4 w-4" strokeWidth={2.25} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[13px] font-semibold text-white">
          {banner.phase === "downloaded"
            ? `Atualização${banner.version ? ` v${banner.version}` : ""} pronta`
            : `Nova versão${banner.version ? ` v${banner.version}` : ""} no GitHub`}
        </p>
        <p className="mt-0.5 text-[12px] text-white/50">
          {banner.phase === "downloaded"
            ? "Abra Configurações para instalar o setup baixado."
            : "Atualize para receber correções e novidades."}
        </p>
      </div>
      <button
        type="button"
        onClick={() => {
          if (banner.phase === "downloaded") {
            void window.electronAPI?.quitAndInstallUpdate?.();
          } else {
            void window.electronAPI?.downloadUpdate?.();
          }
        }}
        className="shrink-0 rounded-xl bg-white px-3 py-2 text-[11px] font-bold uppercase tracking-wide text-black transition hover:bg-white/90"
      >
        {banner.phase === "downloaded" ? "Instalar" : "Atualizar"}
      </button>
      <button
        type="button"
        onClick={goSettings}
        className="hidden shrink-0 rounded-xl border border-white/10 px-3 py-2 text-[11px] font-semibold text-white/70 transition hover:bg-white/5 hover:text-white sm:inline-flex"
      >
        Ajustes
      </button>
      <button
        type="button"
        aria-label="Dispensar aviso de atualização"
        onClick={() => {
          setDismissedVersion(banner.version ?? "dismissed");
          setBanner(null);
        }}
        className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-white/40 transition hover:bg-white/10 hover:text-white"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default UpdateAvailableBanner;
