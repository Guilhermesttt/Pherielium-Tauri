import { useEffect, useRef } from "react";
import { useGamepadButton } from "../context/GamepadContext";
import { activateElementWithController } from "../utils/controllerTextInput";

interface UseGamepadNavigationProps {
  onClose?: () => void;
  scrollRef?: React.RefObject<HTMLElement | null>;
  scrollSpeed?: number;
  /** Desabilita X (útil quando o painel define ação própria, ex.: Jogar) */
  disableX?: boolean;
  /** Desabilita O (útil quando o painel define ação própria de fechar) */
  disableO?: boolean;
  enabled?: boolean;
  /** Camada de entrada. Modais devem usar prioridade maior que paginas. */
  priority?: number;
}

function resolveScrollableTarget(explicitRef?: HTMLElement | null): HTMLElement | null {
  if (explicitRef && explicitRef.scrollHeight > explicitRef.clientHeight) {
    return explicitRef;
  }

  // 1. Check if activeElement is inside a scrollable container
  let cur = document.activeElement as HTMLElement | null;
  while (cur && cur !== document.body) {
    const overflowY = window.getComputedStyle(cur).overflowY;
    if ((overflowY === "auto" || overflowY === "scroll") && cur.scrollHeight > cur.clientHeight + 4) {
      return cur;
    }
    cur = cur.parentElement;
  }

  // 2. Check for open system page or modal container
  const systemPage = document.querySelector<HTMLElement>("[data-system-page]");
  if (systemPage) {
    if (systemPage.scrollHeight > systemPage.clientHeight + 4) return systemPage;
    const innerScroll = systemPage.querySelector<HTMLElement>(
      ".overflow-y-auto, .overflow-y-scroll, [class*='overflow-y-auto']",
    );
    if (innerScroll && innerScroll.scrollHeight > innerScroll.clientHeight + 4) {
      return innerScroll;
    }
  }

  // 3. Fallback to any visible scrollable element
  const allScrollable = Array.from(
    document.querySelectorAll<HTMLElement>(
      ".overflow-y-auto, .overflow-y-scroll, main, [data-system-page]",
    ),
  );
  for (const el of allScrollable) {
    if (el.scrollHeight > el.clientHeight + 4 && el.getBoundingClientRect().height > 80) {
      return el;
    }
  }

  return (document.scrollingElement as HTMLElement) || document.documentElement;
}

export function useGamepadNavigation({
  onClose,
  scrollRef,
  scrollSpeed = 22,
  disableX = false,
  disableO = false,
  enabled = true,
  priority = 0,
}: UseGamepadNavigationProps = {}) {
  useGamepadButton(
    "X",
    () => {
      if (document.activeElement instanceof HTMLElement) {
        activateElementWithController(document.activeElement);
      }
    },
    enabled && !disableX,
    priority,
  );

  useGamepadButton(
    "O",
    () => {
      if (onClose) onClose();
    },
    enabled && !disableO,
    priority,
  );

  const rightStickXRef = useRef(0);
  const rightStickYRef = useRef(0);

  useEffect(() => {
    if (!enabled) return;

    const MAX_PX_PER_FRAME = scrollSpeed;

    const handleRightStick = (e: Event) => {
      const detail = (e as CustomEvent<{ x: number; y: number }>).detail;
      rightStickXRef.current = detail?.x ?? 0;
      rightStickYRef.current = detail?.y ?? 0;
    };

    let rafId = requestAnimationFrame(function tick() {
      if (rightStickYRef.current !== 0 || rightStickXRef.current !== 0) {
        const el = resolveScrollableTarget(scrollRef?.current);
        if (el) {
          if (rightStickYRef.current !== 0) {
            const maxScrollTop = el.scrollHeight - el.clientHeight;
            el.scrollTop = Math.max(
              0,
              Math.min(el.scrollTop + rightStickYRef.current * MAX_PX_PER_FRAME, maxScrollTop),
            );
          }
          if (rightStickXRef.current !== 0) {
            const maxScrollLeft = el.scrollWidth - el.clientWidth;
            el.scrollLeft = Math.max(
              0,
              Math.min(el.scrollLeft + rightStickXRef.current * MAX_PX_PER_FRAME, maxScrollLeft),
            );
          }
        }
      }
      rafId = requestAnimationFrame(tick);
    });

    window.addEventListener("gamepad:rightstick", handleRightStick);
    return () => {
      window.removeEventListener("gamepad:rightstick", handleRightStick);
      cancelAnimationFrame(rafId);
      rightStickXRef.current = 0;
      rightStickYRef.current = 0;
    };
  }, [scrollRef, scrollSpeed, enabled]);
}
