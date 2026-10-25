import React from "react";
import { NotificationProvider } from "../components/NotificationCenter";
import { PreferencesProvider } from "../context/PreferencesContext";
import { GamepadProvider } from "../context/GamepadContext";
import ControllerVirtualKeyboard from "../components/ui/ControllerVirtualKeyboard";
import { activateElementWithController } from "../utils/controllerTextInput";

/**
 * Laboratório (só em desenvolvimento): o teclado virtual do controle aberto sobre um campo de busca.
 * Abrir: #/design-lab/keyboard
 */
const DesignLabKeyboard: React.FC = () => {
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      if (inputRef.current) activateElementWithController(inputRef.current);
    }, 400);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <NotificationProvider>
      <PreferencesProvider>
        <GamepadProvider>
          <div className="flex h-full flex-col items-center justify-start gap-4 p-10">
            <input
              ref={inputRef}
              aria-label="Buscar jogos"
              placeholder="Buscar jogos"
              className="h-12 w-full max-w-xl rounded-full bg-[var(--surface-raised)] px-6 text-[var(--ink)]"
            />
            <button
              type="button"
              className="h-11 rounded-full bg-[var(--ink)] px-5 text-[length:var(--step-0)] font-semibold text-[var(--tone-0)]"
              onClick={() => inputRef.current && activateElementWithController(inputRef.current)}
            >
              Abrir teclado
            </button>
          </div>
          <ControllerVirtualKeyboard />
        </GamepadProvider>
      </PreferencesProvider>
    </NotificationProvider>
  );
};

export default DesignLabKeyboard;
