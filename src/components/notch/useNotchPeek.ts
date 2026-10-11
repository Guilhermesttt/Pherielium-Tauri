import { useEffect, useState } from "react";

/**
 * Pherie espiando: com o notch escondido (outro app em foco), ela aparece UMA vez na
 * borda de cima da tela, dá um piado e some, como quem diz "olha eu aqui!". Só uma por
 * esconder: o notch precisa reaparecer e esconder de novo para ela espiar outra vez
 * (repetir a cada poucos segundos viraria chateação).
 */

/** Espera até ela espiar depois que o notch some. */
export const PEEK_DELAY_MS = 6_000;
/** Quanto tempo ela fica à mostra. */
export const PEEK_VISIBLE_MS = 3_600;

/** `true` enquanto a Pherie está espiando. Desliga na hora quando `enabled` cai. */
export function useNotchPeek(enabled: boolean): boolean {
  const [peeking, setPeeking] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let hideTimer = 0;
    const showTimer = window.setTimeout(() => {
      setPeeking(true);
      hideTimer = window.setTimeout(() => setPeeking(false), PEEK_VISIBLE_MS);
    }, PEEK_DELAY_MS);
    return () => {
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
      setPeeking(false);
    };
  }, [enabled]);

  return enabled && peeking;
}
