import React, { useId, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "../../../lib/utils";

/**
 * Controle segmentado (radiogroup). A pílula selecionada desliza entre as opções com a mola do sistema.
 * Teclado: setas esquerda/direita (e cima/baixo) mudam a seleção; Tab entra e sai do grupo.
 */
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

export interface SegmentedProps<T extends string> {
  label: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  className?: string;
}

export function Segmented<T extends string>({ label, options, value, onChange, className }: SegmentedProps<T>) {
  const groupId = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const index = Math.max(0, options.findIndex((o) => o.value === value));

  const move = (delta: number) => {
    const next = (index + delta + options.length) % options.length;
    onChange(options[next].value);
    refs.current[next]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn("inline-flex rounded-[var(--node)] bg-[var(--tone-2)] p-1", className)}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight" || e.key === "ArrowDown") {
          e.preventDefault();
          move(1);
        } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
          e.preventDefault();
          move(-1);
        }
      }}
    >
      {options.map((option, i) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            ref={(el) => {
              refs.current[i] = el;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            tabIndex={selected ? 0 : -1}
            onClick={() => onChange(option.value)}
            className={cn(
              "relative h-9 min-w-16 cursor-pointer rounded-[var(--node)] px-4 text-[length:var(--step-0)] font-semibold",
              "transition-colors duration-[var(--dur-1)] ease-[var(--spring)]",
              selected ? "text-[var(--ink)]" : "text-[var(--ink-muted)] hover:text-[var(--ink)]",
            )}
          >
            {selected && (
              <motion.span
                layoutId={`segmented-thumb-${groupId}`}
                aria-hidden="true"
                className="absolute inset-0 rounded-[var(--node)] bg-[var(--tone-4)]"
                transition={{ type: "spring", bounce: 0.15, duration: 0.42 }}
              />
            )}
            <span className="relative">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}
