import React from "react";
import { Check, Delete, Space, Trash2 } from "lucide-react";
import ModalShell from "./ModalShell";
import {
  CONTROLLER_KEYBOARD_EVENT,
  CONTROLLER_KEYBOARD_VISIBILITY_EVENT,
  setControllerTextValue,
  type ControllerTextTarget,
} from "../../utils/controllerTextInput";

const rows = [
  ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"],
  ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
  ["A", "S", "D", "F", "G", "H", "J", "K", "L", "@"],
  ["Z", "X", "C", "V", "B", "N", "M", ".", "_", "-"],
];

const ControllerVirtualKeyboard: React.FC = () => {
  const [target, setTarget] = React.useState<ControllerTextTarget | null>(null);
  const [value, setValue] = React.useState("");

  React.useEffect(() => {
    const handleOpen = (event: Event) => {
      const nextTarget = (event as CustomEvent<{ target: ControllerTextTarget }>).detail.target;
      setTarget(nextTarget);
      setValue(nextTarget.value);
    };
    window.addEventListener(CONTROLLER_KEYBOARD_EVENT, handleOpen);
    return () => window.removeEventListener(CONTROLLER_KEYBOARD_EVENT, handleOpen);
  }, []);

  React.useEffect(() => {
    window.dispatchEvent(new CustomEvent(CONTROLLER_KEYBOARD_VISIBILITY_EVENT, {
      detail: { isOpen: Boolean(target) },
    }));
  }, [target]);

  const commit = React.useCallback((nextValue: string) => {
    if (!target) return;
    const limitedValue = target.maxLength > -1 ? nextValue.slice(0, target.maxLength) : nextValue;
    setValue(limitedValue);
    setControllerTextValue(target, limitedValue);
  }, [target]);

  return (
    <ModalShell
      isOpen={Boolean(target)}
      onClose={() => setTarget(null)}
      maxWidthClassName="max-w-[calc(100vw-1rem)] md:max-w-[58vw]"
      zIndexClassName="z-[300]"
      containerClassName="items-end justify-center p-2 md:items-center md:justify-end md:p-3"
      backdropClassName="pointer-events-none bg-transparent backdrop-blur-none"
      className="rounded-[22px] border border-white/12 bg-[#08080b] p-6 shadow-2xl"
      ariaLabel="Teclado virtual do controle"
      gamepadPriority={200}
    >
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/60">Entrada pelo controle</p>
          <h2 className="mt-1 text-2xl font-black text-white">Teclado virtual</h2>
        </div>
        <p className="text-xs font-medium text-white/60">X seleciona · O conclui</p>
      </div>

      <div className="mb-5 min-h-14 overflow-hidden rounded-2xl border border-white/10 bg-black/50 px-5 py-4 text-lg font-bold text-white">
        {target?.type === "password" ? "•".repeat(value.length) : value || <span className="text-white/20">Digite usando o controle...</span>}
      </div>

      <div className="space-y-2">
        {rows.map((row, rowIndex) => (
          <div key={rowIndex} className="grid grid-cols-10 gap-2">
            {row.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => commit(value + key.toLowerCase())}
                className="h-12 rounded-xl border border-white/10 bg-white/[0.05] text-sm font-black text-white transition hover:bg-white/10"
              >
                {key}
              </button>
            ))}
          </div>
        ))}
      </div>

      <div className="mt-3 grid grid-cols-[1fr_2fr_1fr_1fr] gap-2">
        <button type="button" onClick={() => commit(value.slice(0, -1))} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] text-xs font-black uppercase text-white">
          <Delete className="h-4 w-4" /> Apagar
        </button>
        <button type="button" onClick={() => commit(value + " ")} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.05] text-xs font-black uppercase text-white">
          <Space className="h-4 w-4" /> Espaco
        </button>
        <button type="button" onClick={() => commit("")} className="flex h-12 items-center justify-center gap-2 rounded-xl border border-red-400/15 bg-red-500/[0.06] text-xs font-black uppercase text-red-200">
          <Trash2 className="h-4 w-4" /> Limpar
        </button>
        <button type="button" onClick={() => setTarget(null)} className="flex h-12 items-center justify-center gap-2 rounded-xl bg-white text-xs font-black uppercase text-black">
          <Check className="h-4 w-4" /> Pronto
        </button>
      </div>
    </ModalShell>
  );
};

export default ControllerVirtualKeyboard;
