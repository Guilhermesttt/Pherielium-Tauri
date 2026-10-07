import React from "react";
import { FOCUS_RING } from "./panelTokens";

type Variant = "primary" | "ghost" | "danger";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-white text-black hover:bg-white/90",
  ghost: "bg-white/[0.08] text-white/85 hover:bg-white/[0.16] hover:text-white",
  danger: "bg-rose-500 text-white hover:bg-rose-400",
};

/** Botão em pílula do painel (substitui os botões `rounded-xl` escritos à mão). */
export const PillButton: React.FC<
  React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" }
> = ({ variant = "ghost", size = "md", className = "", type = "button", ...props }) => (
  <button
    type={type}
    className={`inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full font-semibold transition-all duration-150 active:scale-95 disabled:opacity-40 ${FOCUS_RING} ${
      size === "sm" ? "px-3 py-1.5 text-[11px]" : "min-h-10 px-4 text-xs"
    } ${VARIANTS[variant]} ${className}`}
    {...props}
  />
);
