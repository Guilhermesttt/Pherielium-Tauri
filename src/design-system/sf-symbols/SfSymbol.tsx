import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { SfSymbolName, SfSymbolProps } from "./types";
import { getSfSymbolFillVariant, getSfSymbolUrl } from "./sfSymbolsMap";

/**
 * Core Apple SF Symbol primitive rendered with high-precision CSS alpha masking.
 * Supports dynamic CSS currentColor, theme accents, drop shadows, and automatic
 * switching to Apple HIG filled variants when selected/active.
 */
export const SfSymbol: React.FC<SfSymbolProps> = ({
  name,
  fill,
  active,
  size,
  color,
  className,
  style,
  role = "img",
  "aria-hidden": ariaHidden = true,
  ...rest
}) => {
  const shouldFill = Boolean(fill || active);
  const resolvedName = shouldFill
    ? (getSfSymbolFillVariant(name) ?? name)
    : name;

  const url = getSfSymbolUrl(resolvedName) ?? getSfSymbolUrl(name);

  if (!url) {
    return null;
  }

  const { color: styleColor, filter, width, height, ...restStyle } = style ?? {};
  const effectiveColor = (color || styleColor || "currentColor") as string;

  const sizeStyle: React.CSSProperties = {};
  if (size !== undefined) {
    const formattedSize = typeof size === "number" ? `${size}px` : size;
    sizeStyle.width = formattedSize;
    sizeStyle.height = formattedSize;
  } else {
    if (width !== undefined) sizeStyle.width = width;
    if (height !== undefined) sizeStyle.height = height;
  }

  return (
    <span
      role={role}
      aria-hidden={ariaHidden}
      className={className}
      style={{
        ...restStyle,
        ...sizeStyle,
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
        backgroundColor: effectiveColor,
        WebkitMaskImage: `url(${url})`,
        maskImage: `url(${url})`,
        WebkitMaskSize: "contain",
        maskSize: "contain",
        WebkitMaskRepeat: "no-repeat",
        maskRepeat: "no-repeat",
        WebkitMaskPosition: "center",
        maskPosition: "center",
        filter: filter && filter !== "none" ? (filter as string) : undefined,
      }}
      {...rest}
    />
  );
};

export interface SfIconProps extends React.HTMLAttributes<HTMLSpanElement> {
  className?: string;
  style?: React.CSSProperties;
  active?: boolean;
  size?: number | string;
  color?: string;
  fill?: string | boolean;
  strokeWidth?: number | string;
  absoluteStrokeWidth?: boolean;
  [key: string]: any;
}

/**
 * Creates a static Apple SF Symbol icon component compatible with standard icon slots.
 */
export function createSfSymbolIcon(name: SfSymbolName, fillVariant?: SfSymbolName) {
  const IconComponent: React.FC<SfIconProps> = ({
    className,
    style,
    active,
    size,
    color,
    fill,
    strokeWidth,
    absoluteStrokeWidth,
    ...rest
  }) => {
    const isFilled = Boolean(fill === true || (typeof fill === "string" && fill !== "none") || active);
    const targetName = isFilled && fillVariant ? fillVariant : name;
    return (
      <SfSymbol
        name={targetName}
        fill={isFilled}
        active={active}
        size={size}
        color={color}
        className={className}
        style={style}
        {...rest}
      />
    );
  };
  IconComponent.displayName = `SfIcon(${name})`;
  return IconComponent;
}

export interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

export interface AnimatedSfIconProps extends SfIconProps {
  duration?: number;
}

/**
 * Creates an Apple SF Symbol icon with Apple-standard spring physics on interaction.
 * Respects prefers-reduced-motion and conforms to Apple Spring Guidelines.
 */
export function createAnimatedSfSymbol(
  name: SfSymbolName,
  fillVariant?: SfSymbolName,
  animationType: "bounce" | "rotate" | "pulse" | "scale" = "bounce"
) {
  const AnimatedComponent = forwardRef<AnimatedIconHandle, AnimatedSfIconProps>(
    ({ className, style, active, size }, ref) => {
      const prefersReducedMotion = useReducedMotion();
      const [isAnimating, setIsAnimating] = useState(false);
      const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

      useImperativeHandle(
        ref,
        () => ({
          startAnimation: () => {
            if (prefersReducedMotion) return;
            setIsAnimating(true);
            if (timerRef.current) clearTimeout(timerRef.current);
            timerRef.current = setTimeout(() => {
              setIsAnimating(false);
              timerRef.current = null;
            }, 600);
          },
          stopAnimation: () => {
            setIsAnimating(false);
            if (timerRef.current) {
              clearTimeout(timerRef.current);
              timerRef.current = null;
            }
          },
        }),
        [prefersReducedMotion]
      );

      const targetName = active && fillVariant ? fillVariant : name;

      // Apple HIG Animation Spring Profiles
      const getAnimationVariants = () => {
        if (prefersReducedMotion) return { scale: 1, rotate: 0, opacity: 1 };

        switch (animationType) {
          case "rotate":
            return isAnimating
              ? { rotate: 90, scale: 1.05 }
              : { rotate: 0, scale: 1 };
          case "pulse":
            return isAnimating
              ? { scale: [1, 1.18, 0.97, 1.05, 1], opacity: [1, 0.85, 1] }
              : { scale: 1, opacity: 1 };
          case "scale":
            return isAnimating
              ? { scale: [1, 1.2, 0.95, 1] }
              : { scale: 1 };
          case "bounce":
          default:
            return isAnimating
              ? { scale: [1, 1.15, 0.94, 1.04, 1] }
              : { scale: 1 };
        }
      };

      return (
        <motion.span
          animate={getAnimationVariants()}
          transition={{
            type: "spring",
            bounce: 0.25,
            duration: 0.45,
          }}
          className="inline-flex items-center justify-center transform-gpu"
          style={{ display: "inline-flex" }}
        >
          <SfSymbol
            name={targetName}
            active={active}
            size={size}
            className={className}
            style={style}
          />
        </motion.span>
      );
    }
  );

  AnimatedComponent.displayName = `AnimatedSfIcon(${name})`;
  return AnimatedComponent;
}

export default SfSymbol;
