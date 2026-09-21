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
    default:
      "bg-white/[0.05] text-white/90 hover:bg-white/[0.09] hover:text-white border border-[#161616] shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]",
    active:
      "bg-white text-black font-semibold border border-white shadow-[0_4px_16px_rgba(255,255,255,0.18)]",
    muted:
      "bg-[#3A1D23] text-[#FF5A79] border border-[#FF2B55]/30 hover:bg-[#482029] shadow-[inset_0_1px_0_rgba(255,43,85,0.15)]",
    danger:
      "bg-[#FF2B55] text-white font-semibold hover:bg-[#FF1A45] border border-[#FF4D71]/40 shadow-[0_4px_20px_rgba(255,43,85,0.4),inset_0_1px_0_rgba(255,255,255,0.2)]",
    ghost:
      "bg-transparent text-white/70 hover:text-white hover:bg-white/[0.08] border border-transparent",
  };

  const sizeStyles = {
    md: "h-11 min-w-[44px] px-3 rounded-[16px]",
    lg: "h-11 px-5 rounded-[18px]",
  };

  return (
    <motion.button
      type="button"
      whileTap={!disabled ? { scale: 0.96 } : undefined}
      transition={{ type: "spring", bounce: 0.2, duration: 0.25 }}
      onClick={onClick}
      disabled={disabled}
      title={tooltip}
      aria-label={tooltip}
      style={{
        cornerShape: "squircle",
      } as React.CSSProperties}
      className={`relative inline-flex items-center justify-center gap-2 select-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-white/60 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F0F0F] disabled:opacity-40 disabled:cursor-not-allowed transition-colors text-xs font-medium tracking-tight ${
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
