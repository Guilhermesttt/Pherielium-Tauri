import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "../../lib/utils";

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-xs font-bold transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer active:scale-95",
  {
    variants: {
      variant: {
        default:
          "bg-white text-black hover:bg-white/90 shadow-[0_4px_16px_rgba(255,255,255,0.15)]",
        destructive:
          "bg-rose-600 text-white hover:bg-rose-500 shadow-[0_4px_16px_rgba(225,29,72,0.25)]",
        outline:
          "border border-white/15 bg-white/[0.04] text-white hover:bg-white/10 hover:border-white/25 backdrop-blur-md",
        secondary:
          "bg-white/10 text-white hover:bg-white/15 border border-white/10",
        ghost:
          "text-white/80 hover:bg-white/10 hover:text-white",
        link:
          "text-white underline-offset-4 hover:underline",
        glass:
          "bg-white/[0.08] text-white border border-white/20 backdrop-blur-2xl hover:bg-white/[0.14] shadow-lg",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-lg px-3 text-[11px]",
        lg: "h-11 rounded-2xl px-6 text-sm",
        icon: "h-9 w-9 rounded-xl",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
  VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
