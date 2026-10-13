"use client"

import * as React from "react"
import { Toast as ToastPrimitive } from "@base-ui/react/toast"
import {
    CircleCheckIcon,
    InfoIcon,
    Loader2Icon,
    OctagonXIcon,
    TriangleAlertIcon,
    XIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"

const toast = ToastPrimitive.createToastManager()

function ToastProvider({ ...props }: ToastPrimitive.Provider.Props) {
    return <ToastPrimitive.Provider {...props} />
}

function ToastPortal({ ...props }: ToastPrimitive.Portal.Props) {
    return <ToastPrimitive.Portal data-slot="toast-portal" {...props} />
}

function ToastViewport({ className, ...props }: ToastPrimitive.Viewport.Props) {
    return (
        <ToastPrimitive.Viewport
            data-slot="toast-viewport"
            className={cn(
                "pointer-events-none fixed inset-x-4 bottom-4 z-50 mx-auto w-auto max-w-sm outline-none sm:right-4 sm:left-auto sm:mx-0 sm:w-full",
                className
            )}
            {...props}
        />
    )
}

function Toast({ className, ...props }: ToastPrimitive.Root.Props) {
    return (
        <ToastPrimitive.Root
            data-slot="toast"
            className={cn(
                "group/toast pointer-events-auto absolute right-0 bottom-0 z-[calc(1000-var(--toast-index))] w-full origin-bottom rounded-[var(--corner-md)] bg-[var(--tone-3)] text-[var(--ink)] outline-none select-none focus-visible:ring-2 focus-visible:ring-[var(--ink)] antialiased",
                "[--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))]",
                "h-(--height) [transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] [transition:transform_var(--dur-3)_var(--spring),opacity_var(--dur-2),height_var(--dur-1)]",
                "after:absolute after:top-full after:left-0 after:h-[calc(var(--gap)+1px)] after:w-full after:content-['']",
                "data-expanded:h-(--toast-height) data-expanded:[transform:translateX(var(--toast-swipe-movement-x))_translateY(var(--offset-y))]",
                "data-limited:opacity-0 data-starting-style:[transform:translateY(150%)]",
                "[&[data-ending-style]:not([data-limited]):not([data-swipe-direction])]:[transform:translateY(150%)]",
                "data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
                "data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
                "data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
                "data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
                "data-expanded:data-ending-style:data-[swipe-direction=down]:[transform:translateY(calc(var(--toast-swipe-movement-y)+150%))]",
                "data-expanded:data-ending-style:data-[swipe-direction=left]:[transform:translateX(calc(var(--toast-swipe-movement-x)-150%))_translateY(var(--offset-y))]",
                "data-expanded:data-ending-style:data-[swipe-direction=right]:[transform:translateX(calc(var(--toast-swipe-movement-x)+150%))_translateY(var(--offset-y))]",
                "data-expanded:data-ending-style:data-[swipe-direction=up]:[transform:translateY(calc(var(--toast-swipe-movement-y)-150%))]",
                className
            )}
            {...props}
        />
    )
}

function ToastContent({ className, ...props }: ToastPrimitive.Content.Props) {
    return (
        <ToastPrimitive.Content
            data-slot="toast-content"
            className={cn(
                "flex h-full items-center gap-4 overflow-hidden p-3.5 transition-opacity duration-200 ease-out data-behind:opacity-0 data-expanded:opacity-100",
                className
            )}
            {...props}
        />
    )
}

function ToastTitle({ className, ...props }: ToastPrimitive.Title.Props) {
    return (
        <ToastPrimitive.Title
            data-slot="toast-title"
            className={cn("text-[length:var(--step-1)] font-semibold text-[var(--ink)] tracking-tight leading-tight", className)}
            {...props}
        />
    )
}

function ToastDescription({
    className,
    ...props
}: ToastPrimitive.Description.Props) {
    return (
        <ToastPrimitive.Description
            data-slot="toast-description"
            className={cn("text-[length:var(--step-0)] font-medium text-[var(--ink-muted)] leading-snug antialiased", className)}
            {...props}
        />
    )
}

function ToastAction({
    className,
    render = <Button variant="outline" size="sm" className="h-8 px-3.5 rounded-[var(--node)] border-0 text-[length:var(--step-0)] font-semibold bg-[var(--ink)] hover:bg-white text-[var(--tone-0)]" />,
    ...props
}: ToastPrimitive.Action.Props) {
    return (
        <ToastPrimitive.Action
            data-slot="toast-action"
            render={render}
            className={cn("shrink-0", className)}
            {...props}
        />
    )
}

function ToastClose({
    className,
    children,
    render = <button type="button" aria-label="Fechar aviso" className="h-8 w-8 rounded-[var(--node)] text-[var(--ink-faint)] hover:text-[var(--ink)] hover:bg-[var(--tone-4)] flex items-center justify-center transition-colors" />,
    ...props
}: ToastPrimitive.Close.Props) {
    return (
        <ToastPrimitive.Close
            data-slot="toast-close"
            aria-label="Close toast"
            render={render}
            className={cn(
                "relative shrink-0 text-[var(--ink-faint)] hover:text-white cursor-pointer transition-colors",
                className
            )}
            {...props}
        >
            {children ?? <XIcon className="h-4 w-4" aria-hidden="true" />}
        </ToastPrimitive.Close>
    )
}

function ToastIcon({ type }: { type: string | undefined }) {
    let icon: React.ReactNode = null
    let colorClass = "bg-[var(--tone-4)] text-[var(--ink)]"

    if (type === "success") {
        icon = <CircleCheckIcon className="h-5 w-5" aria-hidden="true" />
        colorClass = "bg-[var(--tone-4)] text-[var(--ink)]"
    }

    if (type === "info") {
        icon = <InfoIcon className="h-5 w-5" aria-hidden="true" />
        colorClass = "bg-[var(--tone-4)] text-[var(--ink)]"
    }

    if (type === "warning") {
        icon = <TriangleAlertIcon className="h-5 w-5" aria-hidden="true" />
        colorClass = "bg-amber-500/15 text-amber-400"
    }

    if (type === "error") {
        icon = <OctagonXIcon className="h-5 w-5" aria-hidden="true" />
        colorClass = "bg-[#FF453A]/15 text-[#FF453A]"
    }

    if (type === "loading") {
        icon = <Loader2Icon className="h-5 w-5 animate-spin text-[var(--ink-muted)]" aria-hidden="true" />
        colorClass = "bg-[var(--tone-4)] text-[var(--ink-muted)]"
    }

    if (!icon) {
        return null
    }

    return (
        <span
            data-slot="toast-icon"
            className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--node)] transition-colors",
                colorClass
            )}
        >
            {icon}
        </span>
    )
}

function ToastList() {
    const { toasts } = ToastPrimitive.useToastManager()

    return toasts.map((toastItem) => (
        <Toast key={toastItem.id} toast={toastItem}>
            <ToastContent>
                <ToastIcon type={toastItem.type} />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                    {toastItem.title ? <ToastTitle /> : null}
                    <ToastDescription />
                </div>
                <ToastAction />
                <ToastClose />
            </ToastContent>
        </Toast>
    ))
}

function Toaster({
    children,
    toastManager = toast,
    ...props
}: ToastPrimitive.Provider.Props) {
    return (
        <ToastProvider toastManager={toastManager} {...props}>
            {children}
            <ToastPortal>
                <ToastViewport>
                    <ToastList />
                </ToastViewport>
            </ToastPortal>
        </ToastProvider>
    )
}

const createToastManager = ToastPrimitive.createToastManager
const useToastManager = ToastPrimitive.useToastManager

export {
    Toaster,
    Toast,
    ToastAction,
    ToastClose,
    ToastContent,
    ToastDescription,
    ToastPortal,
    ToastProvider,
    ToastTitle,
    ToastViewport,
    createToastManager,
    toast,
    useToastManager,
}
