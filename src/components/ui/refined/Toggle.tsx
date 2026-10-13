import React from "react";
import { cn } from "../../../lib/utils";

/**
 * Interruptor do Pherielium Refined (role="switch"). O botão desliza com a mola do sistema; ligado usa a tinta cheia.
 * Não depende de provedores (o `Switch` antigo exige o PreferencesProvider para tocar som).
 */
export interface ToggleProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "onChange"> {
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
}

export const Toggle: React.FC<ToggleProps> = ({ checked, onCheckedChange, className, disabled, ...props }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    disabled={disabled}
    onClick={() => onCheckedChange(!checked)}
    className={cn(
      "relative inline-flex h-8 w-[52px] shrink-0 cursor-pointer items-center rounded-[var(--node)] p-[3px]",
      "transition-colors duration-[var(--dur-2)] ease-[var(--spring)] disabled:cursor-not-allowed disabled:opacity-40",
      checked ? "bg-[var(--ink)]" : "bg-[var(--tone-4)]",
      className,
    )}
    {...props}
  >
    <span
      aria-hidden="true"
      className={cn(
        "h-[26px] w-[26px] rounded-[var(--node)] transition-transform duration-[var(--dur-2)] ease-[var(--spring)]",
        checked ? "translate-x-5 bg-[var(--tone-0)]" : "translate-x-0 bg-[var(--ink)]",
      )}
    />
  </button>
);
