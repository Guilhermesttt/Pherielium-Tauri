import React from "react";
import { cn } from "../../../lib/utils";

/**
 * Botão do Pherielium Refined. Forma única: a pílula (o "nó" do logo). Três pesos:
 * `primary` (tinta cheia, uma por tela), `tonal` (um degrau de tom) e `quiet` (só texto).
 */
export type RefinedButtonVariant = "primary" | "tonal" | "quiet";
export type RefinedButtonSize = "sm" | "md" | "lg";

const VARIANT: Record<RefinedButtonVariant, string> = {
  primary: "bg-[var(--ink)] text-[var(--tone-0)] hover:bg-white",
  tonal: "bg-[var(--tone-3)] text-[var(--ink)] hover:bg-[var(--tone-4)]",
  quiet: "bg-transparent text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--tone-2)]",
};

const SIZE: Record<RefinedButtonSize, string> = {
  sm: "h-9 px-4 text-[length:var(--step-0)]",
  md: "h-11 px-5 text-[length:var(--step-1)]",
  lg: "h-14 px-7 text-[length:var(--step-2)]",
};

export interface RefinedButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: RefinedButtonVariant;
  size?: RefinedButtonSize;
  /** Ícone à esquerda (decorativo; o texto do botão é o rótulo). */
  icon?: React.ReactNode;
}

export const RefinedButton = React.forwardRef<HTMLButtonElement, RefinedButtonProps>(
  ({ variant = "tonal", size = "md", icon, className, children, type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex select-none items-center justify-center gap-2 rounded-[var(--node)] font-semibold tracking-[-0.01em]",
        "transition-[background-color,color,scale] duration-[var(--dur-1)] ease-[var(--spring)]",
        "disabled:cursor-not-allowed disabled:opacity-40 cursor-pointer",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    >
      {icon && (
        <span aria-hidden="true" className="inline-flex shrink-0">
          {icon}
        </span>
      )}
      {children}
    </button>
  ),
);
RefinedButton.displayName = "RefinedButton";
