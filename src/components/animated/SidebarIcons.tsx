import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type HTMLAttributes,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import { SfSymbol } from "../../design-system/sf-symbols/SfSymbol";
import type { SfSymbolName } from "../../design-system/sf-symbols/types";

export interface AnimatedIconHandle {
  startAnimation: () => void;
  stopAnimation: () => void;
}

export interface AnimatedIconProps extends Omit<
  HTMLAttributes<HTMLDivElement>,
  "color" | "onDrag" | "onDragStart" | "onDragEnd" | "onAnimationStart" | "onAnimationEnd" | "onAnimationIteration"
> {
  size?: number;
  duration?: number;
  color?: string;
  active?: boolean;
}

function createAppleSidebarIcon(
  name: SfSymbolName,
  fillVariant?: SfSymbolName,
  animationType: "bounce" | "rotate" | "pulse" | "scale" = "bounce",
  displayName = `SfIcon(${name})`
) {
  const Wrapped = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
    ({ size = 24, className, color, style, active, ...props }, ref) => {
      const prefersReducedMotion = useReducedMotion();
      const [isAnimating, setIsAnimating] = useState(false);
      const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

      useImperativeHandle(ref, () => ({
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
      }), [prefersReducedMotion]);

      const targetName = active && fillVariant ? fillVariant : name;

      const getAnimationVariants = () => {
        if (prefersReducedMotion) return { scale: 1, rotate: 0 };
        switch (animationType) {
          case "rotate":
            return isAnimating ? { rotate: 90, scale: 1.05 } : { rotate: 0, scale: 1 };
          case "pulse":
            return isAnimating ? { scale: [1, 1.15, 0.95, 1.04, 1] } : { scale: 1 };
          case "scale":
            return isAnimating ? { scale: [1, 1.18, 0.96, 1.02, 1] } : { scale: 1 };
          case "bounce":
          default:
            return isAnimating ? { scale: [1, 1.15, 0.94, 1.04, 1] } : { scale: 1 };
        }
      };

      return (
        <motion.div
          className={`inline-flex items-center justify-center transform-gpu ${className || ""}`}
          style={{ width: size, height: size, color, ...style }}
          animate={getAnimationVariants()}
          transition={{
            type: "spring",
            bounce: 0.2,
            duration: 0.4,
          }}
          {...props}
        >
          <SfSymbol
            name={targetName}
            active={active}
            size={size}
            style={{ width: size, height: size, color: color || (style as any)?.color }}
          />
        </motion.div>
      );
    }
  );

  Wrapped.displayName = displayName;
  return Wrapped;
}

export const GamepadIcon = createAppleSidebarIcon("gamecontroller", "gamecontroller.fill", "bounce", "GamepadIcon");
export const HammerIcon = createAppleSidebarIcon("hammer", "hammer.fill", "bounce", "HammerIcon");
export const LaptopIcon = createAppleSidebarIcon("desktopcomputer", undefined, "scale", "LaptopIcon");
export const RadioIcon = createAppleSidebarIcon("dot.radiowaves.left.and.right", undefined, "pulse", "RadioIcon");
export const SettingsIcon = createAppleSidebarIcon("gear", undefined, "rotate", "SettingsIcon");
export const StarIcon = createAppleSidebarIcon("star", "star.fill", "scale", "StarIcon");
export const UserIcon = createAppleSidebarIcon("person.crop.circle", "person.crop.circle.fill", "bounce", "UserIcon");
export const UsersIcon = createAppleSidebarIcon("person.2", "person.2.fill", "bounce", "UsersIcon");
