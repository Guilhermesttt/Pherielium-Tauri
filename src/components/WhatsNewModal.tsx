import React from "react";
import { Check, X } from "lucide-react";
import ModalShell from "./ui/ModalShell";
import { useGamepadButton } from "../context/GamepadContext";
import type { ReleaseHighlights } from "../releases/releaseHighlights";
import desktopIcon from "../assets/Pherielium_Desktop_icon.png";

interface WhatsNewModalProps {
  release: ReleaseHighlights;
  onClose: () => void;
}

const WhatsNewModal: React.FC<WhatsNewModalProps> = ({ release, onClose }) => {
  useGamepadButton("X", onClose, true, 260);
  useGamepadButton("O", onClose, true, 260);

  const openReleaseNotes = async () => {
    if (window.electronAPI?.openExternalUrl) {
      await window.electronAPI.openExternalUrl(release.releaseUrl);
      return;
    }
    window.open(release.releaseUrl, "_blank", "noopener,noreferrer");
  };

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      maxWidthClassName="max-w-[440px]"
      zIndexClassName="z-[260]"
      backdropClassName="bg-black/80 backdrop-blur-md"
      ariaLabel={`Novidades da versão ${release.version}`}
      gamepadPriority={260}
      className="overflow-hidden rounded-[28px] border border-white/10 bg-[#141414] p-0 shadow-[0_32px_90px_rgba(0,0,0,0.75)]"
    >
      <div className="relative overflow-hidden">
        {/* Banner superior — ícone do hub em plano full-bleed */}
        <div className="relative flex h-[180px] items-center justify-center overflow-hidden bg-[#0A0A0A]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.1)_0%,transparent_65%)]" />
          <img
            src={desktopIcon}
            alt=""
            className="relative z-[1] h-[128px] w-[128px] rounded-[28px] object-cover shadow-[0_16px_48px_rgba(0,0,0,0.55)]"
            draggable={false}
          />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-[#141414] to-transparent" />

          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar novidades"
            className="absolute right-3.5 top-3.5 z-20 grid h-8 w-8 place-items-center rounded-full border border-white/10 bg-black/45 text-white/60 backdrop-blur-sm transition-colors hover:border-white/20 hover:bg-black/65 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-6 pb-6 pt-5">
          <header>
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-white/35">
              Versão {release.version}
            </p>
            <h2 className="mt-2 text-[22px] font-bold leading-tight tracking-tight text-white">
              {release.title}
            </h2>
            <p className="mt-2.5 text-[13px] font-medium leading-relaxed text-white/50">
              {release.description}
            </p>
          </header>

          <section className="mt-6" aria-label="Destaques da atualização">
            <h3 className="text-[15px] font-semibold tracking-tight text-white">
              O que há de novo
            </h3>

            <ul className="mt-4 space-y-4">
              {release.highlights.map((highlight) => (
                <li
                  key={highlight.id}
                  data-testid="release-highlight"
                  className="flex items-start gap-3"
                >
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border border-white/25 text-white/70">
                    <Check className="h-3 w-3" strokeWidth={2.5} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-semibold leading-snug text-white">
                      {highlight.title}
                    </p>
                    <p className="mt-0.5 text-[12.5px] font-medium leading-relaxed text-white/45">
                      {highlight.description}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <footer className="mt-7 grid grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="h-11 cursor-pointer rounded-full bg-[#2A2A2A] px-4 text-[13px] font-semibold text-white/70 transition-colors hover:bg-[#333] hover:text-white/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white/40"
            >
              Fechar
            </button>
            <button
              type="button"
              onClick={() => void openReleaseNotes()}
              aria-label="Ver notas completas"
              className="h-11 cursor-pointer rounded-full bg-[#E8E8E8] px-4 text-[13px] font-semibold text-[#111] transition-colors hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              Ver notas
            </button>
          </footer>
        </div>
      </div>
    </ModalShell>
  );
};

export default WhatsNewModal;
