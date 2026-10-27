import { useSafePreferences } from "../context/PreferencesContext";
import { useOpenCloseSound } from "./useOpenCloseSound";
import { useSoundEffects } from "./useSoundEffects";

/**
 * Som de abrir e de fechar de uma modal, no tema sonoro do launcher. Toda modal chama isto com o
 * seu `isOpen`; abrir/fechar repetido no mesmo gesto toca uma vez só (ver o dedupe em useSoundEffects).
 *
 * Usa as preferências "seguras": o `ModalShell` também roda em janelas sem o provedor de
 * preferências (login, overlay), e lá a modal só fica sem som em vez de derrubar a tela.
 */
export function useModalSounds(isOpen: boolean): void {
  const preferences = useSafePreferences();
  const { playSound } = useSoundEffects(
    (preferences?.effectsVolume ?? 35) / 100,
    preferences?.soundTheme ?? "default",
    (preferences?.notificationVolume ?? 40) / 100,
  );
  useOpenCloseSound(isOpen, preferences ? playSound : undefined, { open: "showModal", close: "modalClose" });
}
