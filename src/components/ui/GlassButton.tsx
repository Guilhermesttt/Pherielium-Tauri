import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const glassButtonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-[length:var(--step-0)] font-semibold transition-[transform,background-color,border-color,color,box-shadow,opacity] duration-[180ms] ease-[var(--ease-out-strong)] active:duration-75 motion-reduce:transition-colors disabled:pointer-events-none disabled:opacity-50 shrink-0 cursor-pointer select-none active:scale-[0.97] motion-reduce:active:scale-100",
  {
    variants: {
      variant: {
        default: "bg-white/10 hover:bg-white/20 text-white border border-white/10 shadow-lg",
        white: "bg-white hover:bg-white/90 text-black font-bold hover:scale-[1.02] shadow-[0_4px_20px_rgba(255,255,255,0.25)] motion-reduce:hover:scale-100",
        destructive: "bg-red-500/90 hover:bg-red-500 text-white font-bold hover:scale-[1.02] shadow-[0_4px_20px_rgba(239,68,68,0.35)] motion-reduce:hover:scale-100",
        ghost: "hover:bg-white/10 text-[var(--ink-muted)] hover:text-white",
        outline: "border border-white/15 bg-white/[0.05] hover:bg-white/10 hover:border-white/25 text-white",
      },
      size: {
        default: "h-10 px-5",
        sm: "h-8 px-3.5 text-xs",
        lg: "h-12 px-6 text-sm",
        icon: "size-10 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface GlassButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof glassButtonVariants> {
  asChild?: boolean;
}

const GlassButton = React.forwardRef<HTMLButtonElement, GlassButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(glassButtonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
GlassButton.displayName = "GlassButton";

export default GlassButton;
