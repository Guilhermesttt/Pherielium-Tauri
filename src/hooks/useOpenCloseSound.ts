import { useEffect, useRef } from "react";
import type { SoundEffectType } from "./useSoundEffects";

export interface OpenCloseSounds {
  open: SoundEffectType;
  close: SoundEffectType;
}

/**
 * Qual som tocar quando algo passa de `previous` para `next` (aberto/fechado).
 * `previous` indefinido é a primeira renderização: não toca nada (nada abriu nem fechou ainda).
 */
export function openCloseSound(previous: boolean | undefined, next: boolean, sounds: OpenCloseSounds): SoundEffectType | null {
  if (previous === undefined || previous === next) return null;
  return next ? sounds.open : sounds.close;
}

/**
 * Toca o som de abrir ao abrir e o de fechar ao fechar, no tema sonoro do launcher (`playSound`
 * vem do `useSoundEffects`, que já aplica o tema e o volume). Usado por gavetas e modais.
 */
export function useOpenCloseSound(
  isOpen: boolean,
  playSound: ((type: SoundEffectType) => void) | undefined,
  sounds: OpenCloseSounds,
): void {
  const previous = useRef<boolean | undefined>(undefined);
  const live = useRef({ playSound, sounds });
  live.current = { playSound, sounds };

  useEffect(() => {
    const type = openCloseSound(previous.current, isOpen, live.current.sounds);
    previous.current = isOpen;
    if (type) live.current.playSound?.(type);
  }, [isOpen]);
}
