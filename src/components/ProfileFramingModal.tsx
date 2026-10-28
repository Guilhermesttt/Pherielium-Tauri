import React, { useEffect, useState } from "react";
import { Check, RotateCcw } from "lucide-react";
import ModalShell from "./ui/ModalShell";
import { FramingSurface } from "./ui/FramingSurface";
import { DEFAULT_FRAMING, MAX_ZOOM, MIN_ZOOM, type Framing } from "../services/mediaFraming";
import type { ProfileMediaKind } from "../services/profileMedia";

interface ProfileFramingModalProps {
  isOpen: boolean;
  kind: ProfileMediaKind;
  /** URL da mídia, sem enquadramento. */
  src: string;
  initial: Framing;
  onApply: (framing: Framing) => void;
  onClose: () => void;
}

/**
 * Ajuste do enquadramento de uma mídia animada (GIF): arrastar para escolher a parte que aparece e
 * o controle de aproximar. A imagem não é recortada, então a animação continua inteira.
 */
const ProfileFramingModal: React.FC<ProfileFramingModalProps> = ({ isOpen, kind, src, initial, onApply, onClose }) => {
  const [framing, setFraming] = useState<Framing>(initial);

  // cada abertura começa do enquadramento atual
  useEffect(() => {
    if (isOpen) setFraming(initial);
  }, [isOpen, initial]);

  const isBanner = kind === "banner";

  const setZoom = (zoom: number) => setFraming((current) => ({ ...current, zoom }));

  return (
    <ModalShell isOpen={isOpen} onClose={onClose} maxWidthClassName="max-w-xl" zIndexClassName="z-[260]" ariaLabel="Ajustar enquadramento">
      <div className="w-full rounded-[var(--corner-lg)] bg-[var(--tone-1)] p-8 text-[var(--ink)]">
        <h2 className="text-[length:var(--step-3)] font-semibold">Ajustar enquadramento</h2>
        <p className="mt-2 text-[length:var(--step-0)] text-[var(--ink-muted)]">
          Arraste a imagem até ficar como você quer; a roda do mouse aproxima. A animação continua inteira.
        </p>

        <div className="mt-6 flex justify-center">
          <FramingSurface
            src={src}
            framing={framing}
            onChange={setFraming}
            label={isBanner ? "Banner" : "Foto"}
            className={isBanner ? "aspect-[5/1] w-full rounded-[var(--corner-md)]" : "aspect-square w-56 rounded-[var(--corner-lg)]"}
          />
        </div>

        <label className="mt-7 block">
          <span className="flex items-baseline justify-between text-[length:var(--step-0)] text-[var(--ink-muted)]">
            Aproximar
            <span className="font-metric text-[var(--ink)]">{framing.zoom.toFixed(2)}×</span>
          </span>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step={0.01}
            value={framing.zoom}
            onChange={(event) => setZoom(Number(event.target.value))}
            className="mt-3 w-full accent-[var(--ink)]"
          />
        </label>

        <div className="mt-8 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setFraming(DEFAULT_FRAMING)}
            className="inline-flex h-12 cursor-pointer items-center gap-2.5 rounded-[var(--corner-sm)] bg-[var(--tone-3)] px-5 text-[length:var(--step-0)] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--tone-4)]"
          >
            <RotateCcw className="h-4 w-4" aria-hidden /> Centralizar
          </button>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={onClose}
              className="h-12 cursor-pointer rounded-[var(--corner-sm)] bg-[var(--tone-3)] px-6 text-[length:var(--step-0)] font-semibold text-[var(--ink)] transition-colors hover:bg-[var(--tone-4)]"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => onApply(framing)}
              className="inline-flex h-12 cursor-pointer items-center gap-2.5 rounded-[var(--corner-sm)] bg-[var(--ink)] px-6 text-[length:var(--step-0)] font-semibold text-[var(--tone-0)] transition hover:opacity-90 active:scale-95"
            >
              <Check className="h-4 w-4" aria-hidden /> Aplicar
            </button>
          </div>
        </div>
      </div>
    </ModalShell>
  );
};

export default ProfileFramingModal;
