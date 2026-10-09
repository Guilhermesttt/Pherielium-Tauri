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
  // Styles according to Apple Design System guidelines:
  // Solid surface by default (#333333) with inset light bevel (inset 0 1px 0 rgba(255,255,255,0.08))
  // Active/Pressed physics with instant response on pointerdown (scale 0.96)
  const variantStyles: Record<CallButtonVariant, string> = {
    default: "bg-white/[0.09] text-white/90 hover:bg-white/[0.16] hover:text-white",
    active: "bg-white text-black font-semibold hover:bg-white/90",
    muted: "bg-[#ff453a]/18 text-[#ff7a72] hover:bg-[#ff453a]/28",
    danger: "bg-[#ff453a] text-white font-medium hover:brightness-110",
    ghost: "bg-transparent text-white/55 hover:text-white hover:bg-white/[0.08]",
  };

  // botões só com ícone são círculos (como o FaceTime); com rótulo viram pílula
  const sizeStyles = {
    md: label ? "h-12 gap-2 rounded-full px-4" : "h-12 w-12 rounded-full",
    lg: "h-12 gap-2 rounded-full px-5",
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
      className={`relative inline-flex items-center justify-center select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0c0c0e] disabled:opacity-40 disabled:cursor-not-allowed transition-colors duration-150 text-[13px] font-medium ${
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
