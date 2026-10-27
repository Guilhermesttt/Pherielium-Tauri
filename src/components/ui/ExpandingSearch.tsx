import React, { useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SfSymbol } from "../../design-system/sf-symbols";
import { isSearchOpen } from "./expandingSearchLogic";

export interface ExpandingSearchProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  /** Largura aberta, em px. */
  width?: number;
  /** Chamado ao abrir e ao fechar (para tocar o som do tema sonoro). */
  onOpenChange?: (open: boolean) => void;
}

const COLLAPSED_WIDTH = 44;
/** Mola da abertura: o botão cresce e vira o campo como um objeto só, com uma leve ultrapassada. */
const SPRING = { type: "spring", stiffness: 320, damping: 27, mass: 0.9 } as const;

/**
 * Busca que nasce de um botão: pelo ícone, o círculo se estica e vira o campo de texto. Fecha sozinha
 * ao perder o foco com o campo vazio (com texto, fica aberta para o filtro continuar visível).
 * Esc limpa o texto; com o campo já vazio, fecha.
 */
export const ExpandingSearch: React.FC<ExpandingSearchProps> = ({
  value,
  onChange,
  placeholder,
  ariaLabel,
  width = 256,
  onOpenChange,
}) => {
  const reducedMotion = useReducedMotion();
  const inputRef = useRef<HTMLInputElement>(null);
  const [opened, setOpened] = useState(false);
  const open = isSearchOpen(opened, value);

  const setOpen = (next: boolean) => {
    if (next === isSearchOpen(opened, value)) return;
    setOpened(next);
    onOpenChange?.(next);
  };

  const openAndFocus = () => {
    setOpen(true);
    // o campo só fica focável depois de aberto; espera o quadro seguinte
    requestAnimationFrame(() => inputRef.current?.focus());
  };

  return (
    <motion.div
      role="search"
      initial={false}
      animate={{ width: open ? width : COLLAPSED_WIDTH }}
      transition={reducedMotion ? { duration: 0 } : SPRING}
      className={`relative flex h-11 items-center overflow-hidden rounded-full transition-colors ${
        open ? "bg-[var(--tone-3)]" : "bg-[var(--tone-2)] hover:bg-[var(--tone-3)]"
      } focus-within:ring-2 focus-within:ring-[var(--ink)]`}
    >
      <button
        type="button"
        onClick={open ? () => inputRef.current?.focus() : openAndFocus}
        aria-label={open ? ariaLabel : `Abrir busca: ${ariaLabel}`}
        aria-expanded={open}
        className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--ink)] focus-visible:outline-none"
      >
        <SfSymbol name="magnifyingglass" size={16} />
      </button>

      <motion.input
        ref={inputRef}
        type="search"
        value={value}
        tabIndex={open ? 0 : -1}
        aria-label={ariaLabel}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        onBlur={() => {
          if (value === "") setOpen(false);
        }}
        onKeyDown={(event) => {
          if (event.key !== "Escape") return;
          event.stopPropagation();
          if (value) onChange("");
          else {
            setOpen(false);
            inputRef.current?.blur();
          }
        }}
        animate={{ opacity: open ? 1 : 0 }}
        transition={{ duration: 0.16, delay: open ? 0.08 : 0 }}
        className="h-full min-w-0 flex-1 bg-transparent pr-9 text-[length:var(--step-0)] text-[var(--ink)] outline-none placeholder:text-[var(--ink-faint)] focus-visible:!shadow-none [&::-webkit-search-cancel-button]:hidden"
      />

      {open && value && (
        <button
          type="button"
          // mousedown (não click): o clique no X não pode antes tirar o foco do campo e fechá-lo
          onMouseDown={(event) => {
            event.preventDefault();
            onChange("");
            inputRef.current?.focus();
          }}
          aria-label="Limpar busca"
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full text-[var(--ink-faint)] transition-colors hover:bg-[var(--tone-4)] hover:text-[var(--ink)]"
        >
          <SfSymbol name="xmark" size={12} />
        </button>
      )}
    </motion.div>
  );
};

export default ExpandingSearch;
