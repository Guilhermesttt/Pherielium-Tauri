import React from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Globe, Keyboard } from "lucide-react";
import { useGamepad, useGamepadButton } from "../../context/GamepadContext";
import { ControllerButtonGlyph, type ControllerButtonKey } from "../ui/ControllerButtonGlyph";
import { rankSpatialCandidates, type SpatialDirection } from "../../utils/spatialFocus";
import type { SoundEffectType } from "../../hooks/useSoundEffects";
import {
  ACCENT_KEYS,
  EMOJI_KEYS,
  KEY_ROWS,
  backspace,
  charOutput,
  extraOutput,
  insertText,
  moveCaret,
  type ActionKeyDef,
  type CharKeyDef,
  type KeyAction,
  type KeyDef,
  type TextState,
} from "./keyboardModel";

/** Acima de modais (100) e do teclado antigo (200): o teclado sempre ganha o controle quando aberto. */
const GAMEPAD_PRIORITY = 300;
const SMOOTH_OUT = [0.22, 1, 0.36, 1] as const;

type Panel = "keys" | "accents" | "emoji";

export interface VirtualKeyboardProps {
  isOpen: boolean;
  initialValue: string;
  /** -1 quando o campo não tem limite. */
  maxLength: number;
  isPassword: boolean;
  /** O texto novo (e onde está o cursor) a cada tecla. */
  onChange: (value: string, caret: number) => void;
  onSubmit: () => void;
  onTab: () => void;
  onClose: () => void;
  playSound?: (type: SoundEffectType) => void;
}

/** O botão do controle que cada tecla de ação mostra (a mesma ideia do teclado do Steam Deck). */
const ACTION_GLYPH: Partial<Record<KeyAction, ControllerButtonKey>> = {
  backspace: "X",
  space: "Y",
  submit: "R2",
  shift: "L2",
};

const ACTION_LABEL: Partial<Record<KeyAction, string>> = {
  backspace: "Apagar",
  tab: "Tab",
  caps: "Caps",
  submit: "Buscar",
  shift: "Shift",
  paste: "Colar",
};

/** Rosto sorridente cheio, como o do teclado do Steam Deck (o conjunto de ícones do app não tem um). */
const SmileFace: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="currentColor" />
    <circle cx="8.6" cy="9.8" r="1.5" fill="var(--surface-base)" />
    <circle cx="15.4" cy="9.8" r="1.5" fill="var(--surface-base)" />
    <path d="M7 14c1 2.6 3 3.7 5 3.7s4-1.1 5-3.7z" fill="var(--surface-base)" />
  </svg>
);

const ACTION_ICON: Partial<Record<KeyAction, React.ReactNode>> = {
  emoji: <SmileFace className="h-6 w-6" />,
  accents: <Globe className="h-6 w-6" aria-hidden />,
  caretLeft: <ChevronLeft className="h-6 w-6" aria-hidden />,
  caretRight: <ChevronRight className="h-6 w-6" aria-hidden />,
  hide: <Keyboard className="h-6 w-6" aria-hidden />,
};

const ACTION_ARIA: Record<KeyAction, string> = {
  backspace: "Apagar",
  tab: "Próximo campo",
  caps: "Caps Lock",
  shift: "Shift",
  submit: "Buscar",
  emoji: "Emojis",
  accents: "Acentos",
  space: "Espaço",
  caretLeft: "Cursor para a esquerda",
  caretRight: "Cursor para a direita",
  paste: "Colar",
  hide: "Fechar teclado",
};

export const VirtualKeyboard: React.FC<VirtualKeyboardProps> = ({
  isOpen,
  initialValue,
  maxLength,
  isPassword,
  onChange,
  onSubmit,
  onTab,
  onClose,
  playSound,
}) => {
  const { gamepadFamily } = useGamepad();
  const rootRef = React.useRef<HTMLDivElement>(null);
  const [text, setText] = React.useState<TextState>({ value: initialValue, caret: initialValue.length });
  const [shift, setShift] = React.useState(false);
  const [caps, setCaps] = React.useState(false);
  const [panel, setPanel] = React.useState<Panel>("keys");

  // Os botões do controle chamam funções criadas a cada render: a ref garante o estado mais novo.
  const live = React.useRef({ text, shift, caps, panel });
  live.current = { text, shift, caps, panel };

  React.useEffect(() => {
    if (!isOpen) return;
    setText({ value: initialValue, caret: initialValue.length });
    setShift(false);
    setCaps(false);
    setPanel("keys");
    // só ao abrir: o valor inicial do campo não deve reiniciar o teclado enquanto se digita
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const focusFirstKey = React.useCallback(() => {
    const keys = rootRef.current?.querySelectorAll<HTMLElement>("[data-vk-key]");
    const preferred = rootRef.current?.querySelector<HTMLElement>('[data-vk-id="char:q"], [data-vk-panel-first]');
    (preferred ?? keys?.[0])?.focus({ preventScroll: true });
  }, []);

  React.useEffect(() => {
    if (!isOpen) return;
    const timer = window.setTimeout(focusFirstKey, 30);
    return () => window.clearTimeout(timer);
  }, [isOpen, panel, focusFirstKey]);

  // Dois toques seguidos podem chegar antes de o React renderizar: a ref é atualizada na hora.
  const setShiftNow = React.useCallback((value: boolean | ((current: boolean) => boolean)) => {
    const next = typeof value === "function" ? value(live.current.shift) : value;
    live.current.shift = next;
    setShift(next);
  }, []);

  const setCapsNow = React.useCallback((value: (current: boolean) => boolean) => {
    const next = value(live.current.caps);
    live.current.caps = next;
    setCaps(next);
  }, []);

  const apply = React.useCallback(
    (next: TextState) => {
      if (next === live.current.text) return;
      live.current.text = next;
      setText(next);
      onChange(next.value, next.caret);
    },
    [onChange],
  );

  const insert = React.useCallback(
    (output: string) => {
      apply(insertText(live.current.text, output, maxLength));
      if (live.current.shift) setShiftNow(false);
    },
    [apply, maxLength, setShiftNow],
  );

  const pasteFromClipboard = React.useCallback(async () => {
    try {
      const clip = await navigator.clipboard.readText();
      if (clip) apply(insertText(live.current.text, clip.replace(/\s+/g, " "), maxLength));
    } catch {
      // sem permissão para ler a área de transferência: a tecla simplesmente não cola
    }
  }, [apply, maxLength]);

  const runAction = React.useCallback(
    (act: KeyAction) => {
      switch (act) {
        case "backspace":
          apply(backspace(live.current.text));
          break;
        case "space":
          insert(" ");
          break;
        case "shift":
          setShiftNow((value) => !value);
          break;
        case "caps":
          setCapsNow((value) => !value);
          break;
        case "caretLeft":
          apply(moveCaret(live.current.text, -1));
          break;
        case "caretRight":
          apply(moveCaret(live.current.text, 1));
          break;
        case "paste":
          void pasteFromClipboard();
          break;
        case "emoji":
          setPanel((value) => (value === "emoji" ? "keys" : "emoji"));
          break;
        case "accents":
          setPanel((value) => (value === "accents" ? "keys" : "accents"));
          break;
        case "tab":
          onTab();
          break;
        case "submit":
          onSubmit();
          break;
        case "hide":
          onClose();
          break;
      }
    },
    [apply, insert, onClose, onSubmit, onTab, pasteFromClipboard, setCapsNow, setShiftNow],
  );

  const pressChar = (key: CharKeyDef) => {
    playSound?.("keyTyping");
    insert(charOutput(key, live.current));
  };

  const pressExtra = (value: string) => {
    playSound?.("keyTyping");
    insert(extraOutput(value, live.current));
  };

  const pressAction = (act: KeyAction) => {
    playSound?.("keyTyping");
    runAction(act);
  };

  const moveFocus = (direction: SpatialDirection) => {
    const root = rootRef.current;
    if (!root) return;
    const keys = Array.from(root.querySelectorAll<HTMLElement>("[data-vk-key]"));
    const current = keys.find((key) => key === document.activeElement);
    if (!current) {
      focusFirstKey();
      return;
    }
    const ranked = rankSpatialCandidates(
      current.getBoundingClientRect(),
      keys.filter((key) => key !== current).map((key) => ({ id: key, rect: key.getBoundingClientRect() })),
      direction,
    );
    const next = ranked[0]?.id;
    if (next) {
      next.focus({ preventScroll: true });
      playSound?.("navigate");
    } else {
      playSound?.("edgeBump");
    }
  };

  // X digita a tecla em foco; os demais botões são atalhos das teclas de ação.
  useGamepadButton("DPAD_UP", () => moveFocus("up"), isOpen, GAMEPAD_PRIORITY);
  useGamepadButton("DPAD_DOWN", () => moveFocus("down"), isOpen, GAMEPAD_PRIORITY);
  useGamepadButton("DPAD_LEFT", () => moveFocus("left"), isOpen, GAMEPAD_PRIORITY);
  useGamepadButton("DPAD_RIGHT", () => moveFocus("right"), isOpen, GAMEPAD_PRIORITY);
  useGamepadButton("X", () => {
    const active = document.activeElement;
    if (active instanceof HTMLElement && rootRef.current?.contains(active) && active.hasAttribute("data-vk-key")) {
      active.click();
    }
  }, isOpen, GAMEPAD_PRIORITY);
  useGamepadButton("O", () => onClose(), isOpen, GAMEPAD_PRIORITY);
  useGamepadButton("SQUARE", () => pressAction("backspace"), isOpen, GAMEPAD_PRIORITY);
  useGamepadButton("TRIANGLE", () => pressAction("space"), isOpen, GAMEPAD_PRIORITY);
  useGamepadButton("R2", () => pressAction("submit"), isOpen, GAMEPAD_PRIORITY);
  useGamepadButton("L2", () => pressAction("shift"), isOpen, GAMEPAD_PRIORITY);
  useGamepadButton("L3", () => pressAction("caps"), isOpen, GAMEPAD_PRIORITY);
  useGamepadButton("L1", () => pressAction("caretLeft"), isOpen, GAMEPAD_PRIORITY);
  useGamepadButton("R1", () => pressAction("caretRight"), isOpen, GAMEPAD_PRIORITY);

  React.useEffect(() => {
    if (!isOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  if (typeof document === "undefined") return null;

  const preview = isPassword ? "•".repeat(text.value.length) : text.value;
  const before = Array.from(preview).slice(0, Array.from(text.value.slice(0, text.caret)).length).join("");
  const after = preview.slice(before.length);

  const renderAction = (key: ActionKeyDef) => {
    const glyph = ACTION_GLYPH[key.action];
    const label = ACTION_LABEL[key.action];
    const pressed =
      (key.action === "shift" && shift) || (key.action === "caps" && caps) ||
      (key.action === "emoji" && panel === "emoji") || (key.action === "accents" && panel === "accents");
    const wide = key.span >= 6 && key.action !== "space";
    return (
      <button
        key={key.id}
        type="button"
        data-vk-key
        data-vk-id={key.id}
        data-kind="action"
        aria-label={ACTION_ARIA[key.action]}
        aria-pressed={key.action === "shift" || key.action === "caps" ? pressed : undefined}
        data-pressed={pressed || undefined}
        className="vk-key"
        style={{ "--vk-span": key.span } as React.CSSProperties}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => pressAction(key.action)}
      >
        {ACTION_ICON[key.action] ?? null}
        {wide && label && <span className="vk-label">{label}</span>}
        {glyph && key.action !== "space" && (
          <span className="vk-badge">
            <ControllerButtonGlyph button={glyph} gamepadFamily={gamepadFamily} size={22} />
          </span>
        )}
        {key.action === "space" && (
          <span className="vk-badge vk-badge--start">
            <ControllerButtonGlyph button="Y" gamepadFamily={gamepadFamily} size={22} />
          </span>
        )}
        {key.action === "caps" && <span className="vk-badge vk-badge--text">L3</span>}
      </button>
    );
  };

  const renderChar = (key: CharKeyDef) => {
    const output = charOutput(key, { shift, caps });
    return (
      <button
        key={key.id}
        type="button"
        data-vk-key
        data-vk-id={key.id}
        data-kind="char"
        aria-label={output}
        className="vk-key"
        style={{ "--vk-span": key.span } as React.CSSProperties}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => pressChar(key)}
      >
        {key.shifted && <span className="vk-sub" aria-hidden>{key.shifted}</span>}
        <span className="vk-main" aria-hidden>{output}</span>
      </button>
    );
  };

  const renderKey = (key: KeyDef) => (key.kind === "char" ? renderChar(key) : renderAction(key));

  const extras = panel === "accents" ? ACCENT_KEYS : EMOJI_KEYS;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <motion.div
          ref={rootRef}
          role="dialog"
          aria-label="Teclado virtual"
          className="vk-dock"
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0, transition: { duration: 0.25, ease: SMOOTH_OUT } }}
          exit={{ opacity: 0, y: 16, transition: { duration: 0.15, ease: SMOOTH_OUT } }}
        >
          <p className="vk-preview" aria-live="polite">
            {preview ? (
              <>
                <span>{before}</span>
                <span className="vk-caret" aria-hidden />
                <span>{after}</span>
              </>
            ) : (
              <>
                <span className="vk-caret" aria-hidden />
                <span className="vk-placeholder">Digite com o controle</span>
              </>
            )}
          </p>

          <div className="vk">
            {panel === "keys" ? (
              KEY_ROWS.slice(0, 4).map((row, index) => (
                <div className="vk-row" key={index}>{row.map(renderKey)}</div>
              ))
            ) : (
              <div className="vk-extras">
                {extras.map((value, index) => (
                  <button
                    key={value}
                    type="button"
                    data-vk-key
                    data-vk-id={`extra:${value}`}
                    data-vk-panel-first={index === 0 ? "" : undefined}
                    data-kind="char"
                    className="vk-key"
                    aria-label={value}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => pressExtra(value)}
                  >
                    <span className="vk-main">{panel === "accents" ? extraOutput(value, { shift, caps }) : value}</span>
                  </button>
                ))}
              </div>
            )}
            <div className="vk-row">{KEY_ROWS[4].map(renderKey)}</div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
};

export default VirtualKeyboard;
