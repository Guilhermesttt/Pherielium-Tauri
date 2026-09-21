// components/ui/Squircle.tsx
import { useLayoutEffect, useRef, useState, forwardRef } from "react";
import type { ReactNode, CSSProperties, ButtonHTMLAttributes } from "react";

interface SquircleProps extends ButtonHTMLAttributes<HTMLButtonElement> {
    as?: "div" | "button";
    cornerRadius?: number;
    cornerSmoothing?: number; // 0–1 — Apple usa ~0.6–0.7
    className?: string;
    style?: CSSProperties;
    children?: ReactNode;
}

export const Squircle = forwardRef<HTMLElement, SquircleProps>(
    (
        { as = "div", cornerRadius = 16, cornerSmoothing = 0.65, className, style, children, ...rest },
        forwardedRef
    ) => {
        const innerRef = useRef<HTMLElement>(null);
        const [clipPath, setClipPath] = useState<string>();

        useLayoutEffect(() => {
            const el = innerRef.current;
            if (!el) return;

            const update = () => {
                const { width, height } = el.getBoundingClientRect();
                if (width === 0 || height === 0) return;
                setClipPath(`path('M${cornerRadius} 0 H${width - cornerRadius} Q${width} 0 ${width} ${cornerRadius} V${height - cornerRadius} Q${width} ${height} ${width - cornerRadius} ${height} H${cornerRadius} Q0 ${height} 0 ${height - cornerRadius} V${cornerRadius} Q0 0 ${cornerRadius} 0 Z')`);
            };

            update();
            const observer = new ResizeObserver(update);
            observer.observe(el);
            return () => observer.disconnect();
        }, [cornerRadius, cornerSmoothing]);

        const setRefs = (node: HTMLElement | null) => {
            innerRef.current = node as HTMLElement;
            if (typeof forwardedRef === "function") forwardedRef(node as HTMLElement);
            else if (forwardedRef && "current" in forwardedRef) {
                forwardedRef.current = node as HTMLElement;
            }
        };

        const Tag = as as React.ElementType;
        return (
            <Tag ref={setRefs} className={className} style={{ ...style, clipPath }} {...rest}>
                {children}
            </Tag>
        );
    }
);
Squircle.displayName = "Squircle";