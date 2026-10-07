import { useEffect, useMemo, useState } from "react";
import {
  loadOverlayPrefs,
  onOverlayPrefsChanged,
  readLocalOverlayPrefs,
  saveOverlayPrefs,
  type OverlayPrefs,
} from "../lib/overlayPrefs";
import { readLegacyMascotColor } from "./mascotColor";
import { effectiveNotchConfig, notchConfigsEqual, type NotchConfig } from "./notchConfig";
import { resolveNotchStyle, type NotchStyle } from "./notchTheme";
import { hasTauriRuntime } from "./useVoiceLevel";

const computeEffective = (stored: NotchConfig | null) => effectiveNotchConfig(stored, readLegacyMascotColor());

export interface OverlayAppearance {
  config: NotchConfig;
  /** tema visual do launcher (espelhado em overlay-prefs.json) */
  visualTheme: string;
  /** estilo resolvido: tema + ajustes do usuário */
  style: NotchStyle;
}

const fromPrefs = (prefs: OverlayPrefs) => ({
  config: computeEffective(prefs.notch),
  visualTheme: prefs.visualTheme,
});

/**
 * Configuração viva do notch + tema visual. Semeada de forma síncrona pelo espelho
 * em localStorage (sem flash do padrão), depois sincronizada com o disco e com o
 * evento `overlay:prefs` (mudanças feitas nas Configurações chegam ao overlay ao vivo).
 */
export function useOverlayAppearance(): OverlayAppearance {
  const [state, setState] = useState(() => fromPrefs(readLocalOverlayPrefs()));

  useEffect(() => {
    let cancelled = false;
    const apply = (prefs: OverlayPrefs) => {
      const next = fromPrefs(prefs);
      setState((prev) =>
        notchConfigsEqual(prev.config, next.config) && prev.visualTheme === next.visualTheme ? prev : next,
      );
    };

    // fora do Tauri (dev no navegador) só vale o espelho local
    if (!hasTauriRuntime()) {
      const onLocal = () => apply(readLocalOverlayPrefs());
      window.addEventListener("pherielium-overlay-prefs", onLocal);
      window.addEventListener("storage", onLocal);
      return () => {
        window.removeEventListener("pherielium-overlay-prefs", onLocal);
        window.removeEventListener("storage", onLocal);
      };
    }

    void loadOverlayPrefs().then((prefs) => {
      if (!cancelled) apply(prefs);
    });
    const stop = onOverlayPrefsChanged(apply);
    // a cor legada pode mudar enquanto o notch nunca foi configurado
    const onStorage = () => apply(readLocalOverlayPrefs());
    window.addEventListener("storage", onStorage);
    return () => {
      cancelled = true;
      stop();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  const style = useMemo(() => resolveNotchStyle(state.visualTheme, state.config), [state]);
  return { config: state.config, visualTheme: state.visualTheme, style };
}

/** Só a configuração (compatível com os usos que não precisam do tema). */
export function useNotchConfig(): NotchConfig {
  return useOverlayAppearance().config;
}

/** Grava a configuração completa do notch (objeto pequeno; o Rust faz o merge profundo). */
export function saveNotchConfig(config: NotchConfig): Promise<unknown> {
  return saveOverlayPrefs({ notch: config });
}
