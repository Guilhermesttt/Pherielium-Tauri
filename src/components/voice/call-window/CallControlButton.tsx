import React from "react";
import { motion, type HTMLMotionProps } from "framer-motion";

export type CallButtonVariant =
  | "default"
  | "active"
  | "muted"
  | "danger"
  | "ghost";

interface CallControlButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  icon: React.ReactNode;
  label?: string;
  tooltip: string;
  variant?: CallButtonVariant;
  disabled?: boolean;
  badge?: React.ReactNode;
  onClick?: () => void;
  size?: "md" | "lg";
}

export const CallControlButton: React.FC<CallControlButtonProps> = ({
  icon,
  label,
  tooltip,
  variant = "default",
  disabled = false,
  badge,
  onClick,
  size = "md",
  className = "",
  ...props
}) => {
  // Preenchidos, sem contorno: o estado é dito pela cor do bloco (tinta = ligado, perigo = mutado).
  const variantStyles: Record<CallButtonVariant, string> = {
    default: "bg-[var(--tone-3)] text-[var(--ink)] hover:bg-[var(--tone-4)]",
    active: "bg-[var(--ink)] text-[var(--tone-0)] hover:opacity-90",
    muted: "bg-[color-mix(in_srgb,var(--danger)_20%,transparent)] text-[var(--danger)] hover:bg-[color-mix(in_srgb,var(--danger)_30%,transparent)]",
    danger: "bg-[var(--danger)] text-[var(--tone-0)] hover:opacity-90",
    ghost: "bg-transparent text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--tone-3)]",
  };

  // botões só com ícone são blocos squircle de 56 px; com rótulo, blocos largos
  const sizeStyles = {
    md: label ? "h-14 gap-2 rounded-[var(--corner-sm)] px-5" : "h-14 w-14 rounded-[var(--corner-sm)]",
    lg: "h-14 gap-2 rounded-[var(--corner-sm)] px-6",
  };

  return (
    <motion.button
      type="button"
      whileHover={!disabled ? { scale: 1.06 } : undefined}
      whileTap={!disabled ? { scale: 0.9 } : undefined}
      transition={{ type: "spring", stiffness: 520, damping: 24 }}
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      aria-label={tooltip}
      className={`relative inline-flex items-center justify-center select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--ink)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--tone-0)] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 text-[length:var(--step-0)] font-medium ${
        variantStyles[variant]
      } ${sizeStyles[size]} ${className}`}
      {...props}
    >
      <span className="flex items-center justify-center shrink-0">
        {icon}
      </span>
      {label && <span className="truncate">{label}</span>}
      {badge && <span className="ml-1 shrink-0">{badge}</span>}
    </motion.button>
  );
};
