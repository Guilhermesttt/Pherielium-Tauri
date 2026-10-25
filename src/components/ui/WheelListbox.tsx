import React, { useEffect, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SfSymbol } from "../../design-system/sf-symbols";
import { columnOffset, moveFocus, rowVisual } from "./wheelListboxLogic";

export interface WheelOption<T extends string> {
  value: T;
  label: string;
}

export interface WheelListboxProps<T extends string> {
  options: ReadonlyArray<WheelOption<T>>;
  value: T;
  onSelect: (value: T) => void;
  onClose: () => void;
  /** Chamado quando a opção em foco muda (para tocar o som de navegação do tema). */
  onFocusChange?: () => void;
  ariaLabel: string;
  className?: string;
}

const ROW_HEIGHT = 44;
const VIEWPORT_HEIGHT = 264;
const WHEEL_STEP_MS = 90;
/** Mola do deslize da coluna: rápida, com uma leve ultrapassada ao parar (o "encaixe" do vídeo). */
const COLUMN_SPRING = { type: "spring", stiffness: 300, damping: 26, mass: 0.9 } as const;
const ROW_SPRING = { type: "spring", stiffness: 340, damping: 30 } as const;

/**
 * Lista de opções em "roleta": a opção em foco fica no centro, em branco e em negrito, com uma
 * seta ao lado; as vizinhas ficam menores, apagadas e desfocadas, e a coluna desliza com uma
 * mola a cada passo. A coluna é levemente inclinada, como no vídeo de referência.
 *
 * Roda do mouse e setas movem o foco; Enter, Espaço ou clique escolhem; Esc fecha. Passar o
 * mouse NÃO move o foco (a coluna correria debaixo do cursor).
 */
export function WheelListbox<T extends string>({
  options,
  value,
  onSelect,
  onClose,
  onFocusChange,
  ariaLabel,
  className = "",
}: WheelListboxProps<T>): React.ReactElement {
  const reducedMotion = useReducedMotion();
  const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value));
  const [focusIndex, setFocusIndex] = useState(selectedIndex);
  const rootRef = useRef<HTMLDivElement>(null);
  const lastWheelAt = useRef(0);

  useEffect(() => {
    rootRef.current?.focus({ preventScroll: true });
  }, []);

  const moveBy = (delta: number) => {
    const next = moveFocus(focusIndex, delta, options.length);
    if (next === focusIndex) return;
    setFocusIndex(next);
    onFocusChange?.();
  };

  const choose = (index: number) => {
    const option = options[index];
    if (option) onSelect(option.value);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    switch (event.key) {
      case "ArrowDown":
        event.preventDefault();
        moveBy(1);
        break;
      case "ArrowUp":
        event.preventDefault();
        moveBy(-1);
        break;
      case "Home":
        event.preventDefault();
        moveBy(-options.length);
        break;
      case "End":
        event.preventDefault();
        moveBy(options.length);
        break;
      case "Enter":
      case " ":
        event.preventDefault();
        choose(focusIndex);
        break;
      case "Escape":
        event.preventDefault();
        event.stopPropagation();
        onClose();
        break;
      default:
    }
  };

  const onWheel = (event: React.WheelEvent) => {
    const now = performance.now();
    if (now - lastWheelAt.current < WHEEL_STEP_MS || event.deltaY === 0) return;
    lastWheelAt.current = now;
    moveBy(event.deltaY > 0 ? 1 : -1);
  };

  const offset = columnOffset(focusIndex, ROW_HEIGHT, VIEWPORT_HEIGHT);
  // Na abertura a coluna chega deslizando de duas linhas acima, como a lista do vídeo entrando.
  const entryOffset = columnOffset(Math.max(0, selectedIndex - 2), ROW_HEIGHT, VIEWPORT_HEIGHT);

  return (
    <motion.div
      ref={rootRef}
      role="listbox"
      aria-label={ariaLabel}
      aria-activedescendant={`wheel-option-${focusIndex}`}
      tabIndex={0}
      onKeyDown={onKeyDown}
      onWheel={onWheel}
      initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: -6 }}
      transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
      className={`relative overflow-hidden rounded-[var(--corner-md)] bg-[var(--tone-3)] focus-visible:outline-none ${className}`}
      style={{
        height: VIEWPORT_HEIGHT,
        // as pontas somem em degradê, como a lista que entra e sai do vídeo
        WebkitMaskImage: "linear-gradient(to bottom, transparent 0, #000 22%, #000 78%, transparent 100%)",
        maskImage: "linear-gradient(to bottom, transparent 0, #000 22%, #000 78%, transparent 100%)",
      }}
    >
      {/* A seta fica fixa no centro: é a coluna que corre por baixo dela */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute left-4 flex items-center text-[var(--ink)]"
        style={{ top: VIEWPORT_HEIGHT / 2 - ROW_HEIGHT / 2, height: ROW_HEIGHT }}
      >
        <SfSymbol name="arrow.right" size={18} />
      </span>

      <motion.div
        initial={{ y: reducedMotion ? offset : entryOffset }}
        animate={{ y: offset }}
        transition={reducedMotion ? { duration: 0 } : COLUMN_SPRING}
        className="absolute left-0 right-0 top-0 origin-left"
        style={{ rotate: reducedMotion ? 0 : -2.5 }}
      >
        {options.map((option, index) => {
          const visual = rowVisual(index - focusIndex);
          const isFocused = index === focusIndex;
          return (
            <motion.button
              key={option.value}
              id={`wheel-option-${index}`}
              type="button"
              role="option"
              aria-selected={option.value === value}
              tabIndex={-1}
              onClick={() => choose(index)}
              animate={{
                opacity: visual.opacity,
                scale: visual.scale,
                x: visual.x,
                filter: `blur(${visual.blur}px)`,
              }}
              transition={reducedMotion ? { duration: 0 } : ROW_SPRING}
              className={`flex w-full origin-left cursor-pointer items-center truncate pl-11 pr-4 text-left text-[length:var(--step-3)] tracking-[-0.02em] ${
                isFocused ? "font-extrabold text-[var(--ink)]" : "font-semibold text-[var(--ink-muted)]"
              }`}
              style={{ height: ROW_HEIGHT }}
            >
              <span className="truncate">{option.label}</span>
              {option.value === value && (
                <span aria-hidden="true" className="ml-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ink)]" />
              )}
            </motion.button>
          );
        })}
      </motion.div>
    </motion.div>
  );
}

export default WheelListbox;
