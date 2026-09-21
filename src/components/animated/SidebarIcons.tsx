import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
  type HTMLAttributes,
} from "react";
import {
  Gamepad2 as AnimateUIGamepad,
  Hammer as AnimateUIHammer,
  Laptop as AnimateUILaptop,
  Radio as AnimateUIRadio,
  Settings as AnimateUISettings,
  Star as AnimateUIStar,
  User as AnimateUIUser,
  Users as AnimateUIUsers,
} from "../animate-ui/icons";

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
}

function createSidebarIcon<P extends { size?: number; animate?: boolean; animateOnHover?: boolean; className?: string; style?: React.CSSProperties }>(
  Component: React.ComponentType<P>,
  displayName: string
) {
  const Wrapped = forwardRef<AnimatedIconHandle, AnimatedIconProps>(
    ({ size = 24, className, color, style, ...props }, ref) => {
      const [isAnimating, setIsAnimating] = useState(false);
      const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

      useImperativeHandle(ref, () => ({
        startAnimation: () => {
          setIsAnimating(true);
          if (timerRef.current) clearTimeout(timerRef.current);
          timerRef.current = setTimeout(() => {
            setIsAnimating(false);
            timerRef.current = null;
          }, 1200);
        },
        stopAnimation: () => {
          setIsAnimating(false);
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
          }
        },
      }), []);

      return (
        <div
          className={`inline-flex items-center justify-center ${className || ""}`}
          style={{ width: size, height: size, color, ...style }}
          {...props}
        >
          <Component
            {...({
              size,
              animate: isAnimating,
              animateOnHover: true,
              style: { width: size, height: size, color: color || (style as any)?.color, ...style },
            } as unknown as P)}
          />
        </div>
      );
    }
  );

  Wrapped.displayName = displayName;
  return Wrapped;
}

export const GamepadIcon = createSidebarIcon(AnimateUIGamepad, "GamepadIcon");
export const HammerIcon = createSidebarIcon(AnimateUIHammer, "HammerIcon");
export const LaptopIcon = createSidebarIcon(AnimateUILaptop, "LaptopIcon");
export const RadioIcon = createSidebarIcon(AnimateUIRadio, "RadioIcon");
export const SettingsIcon = createSidebarIcon(AnimateUISettings, "SettingsIcon");
export const StarIcon = createSidebarIcon(AnimateUIStar, "StarIcon");
export const UserIcon = createSidebarIcon(AnimateUIUser, "UserIcon");
export const UsersIcon = createSidebarIcon(AnimateUIUsers, "UsersIcon");
