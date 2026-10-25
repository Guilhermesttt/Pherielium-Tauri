import React from "react";
import VirtualKeyboard from "../keyboard/VirtualKeyboard";
import { usePreferences } from "../../context/PreferencesContext";
import { useModalSounds } from "../../hooks/useModalSounds";
import { useSoundEffects } from "../../hooks/useSoundEffects";
import {
  CONTROLLER_KEYBOARD_EVENT,
  CONTROLLER_KEYBOARD_VISIBILITY_EVENT,
  isControllerTextTarget,
  setControllerTextValue,
  type ControllerTextTarget,
} from "../../utils/controllerTextInput";

/** Próximo campo de texto visível depois de `current`, na ordem da página. */
function nextTextTarget(current: ControllerTextTarget): ControllerTextTarget | null {
  const fields = Array.from(
    document.querySelectorAll<HTMLElement>("input, textarea"),
  ).filter((element): element is ControllerTextTarget =>
    isControllerTextTarget(element) && !element.disabled && element.getClientRects().length > 0,
  );
  const index = fields.indexOf(current);
  return index >= 0 ? fields[index + 1] ?? null : null;
}

/** "Buscar": confirma o campo como a tecla Enter do teclado de verdade faria. */
function submitTarget(target: ControllerTextTarget): void {
  const init = { key: "Enter", code: "Enter", bubbles: true, cancelable: true };
  target.dispatchEvent(new KeyboardEvent("keydown", init));
  target.dispatchEvent(new KeyboardEvent("keyup", init));
  if (target instanceof HTMLInputElement && target.form) target.form.requestSubmit();
}

/**
 * Teclado virtual do controle: abre quando o jogador ativa um campo de texto com o controle
 * (evento `CONTROLLER_KEYBOARD_EVENT`) e escreve direto no campo. O desenho e as regras ficam em
 * `components/keyboard`.
 */
const ControllerVirtualKeyboard: React.FC = () => {
  const [target, setTarget] = React.useState<ControllerTextTarget | null>(null);
  const [initialValue, setInitialValue] = React.useState("");
  const { effectsVolume, soundTheme, notificationVolume } = usePreferences();
  const { playSound } = useSoundEffects(effectsVolume / 100, soundTheme, notificationVolume / 100);
  const isOpen = Boolean(target);
  useModalSounds(isOpen);

  React.useEffect(() => {
    const handleOpen = (event: Event) => {
      const nextTarget = (event as CustomEvent<{ target: ControllerTextTarget }>).detail.target;
      setInitialValue(nextTarget.value);
      setTarget(nextTarget);
    };
    window.addEventListener(CONTROLLER_KEYBOARD_EVENT, handleOpen);
    return () => window.removeEventListener(CONTROLLER_KEYBOARD_EVENT, handleOpen);
  }, []);

  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent(CONTROLLER_KEYBOARD_VISIBILITY_EVENT, { detail: { isOpen } }));
  }, [isOpen]);

  const close = React.useCallback(() => {
    // devolve o foco ao campo: quem fechou o teclado continua onde estava
    target?.focus({ preventScroll: true });
    setTarget(null);
  }, [target]);

  const handleChange = React.useCallback(
    (value: string, caret: number) => {
      if (!target) return;
      setControllerTextValue(target, value);
      try {
        target.setSelectionRange(caret, caret);
      } catch {
        // alguns tipos de campo (email, number) não aceitam seleção: o texto já foi escrito
      }
    },
    [target],
  );

  const handleSubmit = React.useCallback(() => {
    if (!target) return;
    submitTarget(target);
    close();
  }, [close, target]);

  const handleTab = React.useCallback(() => {
    if (!target) return;
    const next = nextTextTarget(target);
    if (!next) {
      close();
      return;
    }
    next.focus({ preventScroll: true });
    setInitialValue(next.value);
    setTarget(next);
  }, [close, target]);

  return (
    <VirtualKeyboard
      isOpen={isOpen}
      initialValue={initialValue}
      maxLength={target?.maxLength ?? -1}
      isPassword={target?.type === "password"}
      onChange={handleChange}
      onSubmit={handleSubmit}
      onTab={handleTab}
      onClose={close}
      playSound={playSound}
    />
  );
};

export default ControllerVirtualKeyboard;
