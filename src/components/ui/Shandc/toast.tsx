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
                "group/toast pointer-events-auto absolute right-0 bottom-0 z-[calc(1000-var(--toast-index))] w-full origin-bottom rounded-2xl border border-white/[0.08] bg-[#1C1C1E]/75 backdrop-blur-[40px] text-white shadow-[0_20px_40px_rgba(0,0,0,0.6)] outline-none select-none focus-visible:border-white/40 focus-visible:ring-2 focus-visible:ring-white/20 antialiased",
                "[--gap:0.75rem] [--height:var(--toast-frontmost-height,var(--toast-height))] [--offset-y:calc(var(--toast-offset-y)*-1+calc(var(--toast-index)*var(--gap)*-1)+var(--toast-swipe-movement-y))] [--peek:0.75rem] [--scale:calc(max(0,1-(var(--toast-index)*0.1)))] [--shrink:calc(1-var(--scale))]",
                "h-(--height) [transform:translateX(var(--toast-swipe-movement-x))_translateY(calc(var(--toast-swipe-movement-y)-(var(--toast-index)*var(--peek))-(var(--shrink)*var(--height))))_scale(var(--scale))] [transition:transform_400ms_cubic-bezier(0.16,1,0.3,1),opacity_300ms,height_150ms]",
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
            className={cn("text-[14px] font-semibold text-white tracking-tight leading-tight", className)}
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
            className={cn("text-[13px] font-medium text-white/60 leading-snug antialiased", className)}
            {...props}
        />
    )
}

function ToastAction({
    className,
    render = <Button variant="outline" size="sm" className="h-7 px-2.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 border-white/10 text-white" />,
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
    render = <button type="button" className="h-7 w-7 rounded-lg text-white/40 hover:text-white hover:bg-white/10 flex items-center justify-center transition-colors" />,
    ...props
}: ToastPrimitive.Close.Props) {
    return (
        <ToastPrimitive.Close
            data-slot="toast-close"
            aria-label="Close toast"
            render={render}
            className={cn(
                "relative shrink-0 text-white/40 hover:text-white cursor-pointer transition-colors",
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
    let colorClass = "bg-white/10 text-white/80 border-white/15"

    if (type === "success") {
        icon = <CircleCheckIcon className="h-5 w-5" aria-hidden="true" />
        colorClass = "bg-white/10 text-white border border-white/20 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
    }

    if (type === "info") {
        icon = <InfoIcon className="h-5 w-5" aria-hidden="true" />
        colorClass = "bg-sky-500/15 text-sky-400 border border-sky-500/25 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
    }

    if (type === "warning") {
        icon = <TriangleAlertIcon className="h-5 w-5" aria-hidden="true" />
        colorClass = "bg-amber-500/15 text-amber-400 border border-amber-500/25 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
    }

    if (type === "error") {
        icon = <OctagonXIcon className="h-5 w-5" aria-hidden="true" />
        colorClass = "bg-[#FF453A]/15 text-[#FF453A] border border-[#FF453A]/25 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
    }

    if (type === "loading") {
        icon = <Loader2Icon className="h-5 w-5 animate-spin text-white/70" aria-hidden="true" />
        colorClass = "bg-white/10 text-white/70 border border-white/15 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]"
    }

    if (!icon) {
        return null
    }

    return (
        <span
            data-slot="toast-icon"
            className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-[10px] shadow-sm transition-colors",
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
