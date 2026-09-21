import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const bubbleVariants = cva(
  "relative max-w-full rounded-2xl transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        muted: "bg-muted text-muted-foreground",
        outline: "border border-border bg-background text-foreground",
        destructive: "bg-destructive text-destructive-foreground",
        ghost: "bg-transparent text-foreground",
      },
      align: {
        start: "self-start",
        end: "self-end",
      },
    },
    defaultVariants: {
      variant: "default",
      align: "start",
    },
  }
)

export interface BubbleProps
  extends React.ComponentProps<"div">,
    VariantProps<typeof bubbleVariants> {
  asChild?: boolean
}

function Bubble({ className, variant, align, ...props }: BubbleProps) {
  return (
    <div
      data-slot="bubble"
      data-align={align}
      className={cn(bubbleVariants({ variant, align, className }))}
      {...props}
    />
  )
}

function BubbleContent({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bubble-content"
      className={cn("flex flex-col gap-1.5", className)}
      {...props}
    />
  )
}

function BubbleHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bubble-header"
      className={cn("flex items-center gap-1.5 text-xs text-muted-foreground", className)}
      {...props}
    />
  )
}

function BubbleFooter({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="bubble-footer"
      className={cn("flex items-center gap-1.5 text-[10px] text-muted-foreground", className)}
      {...props}
    />
  )
}

export { Bubble, BubbleContent, BubbleHeader, BubbleFooter, bubbleVariants }
