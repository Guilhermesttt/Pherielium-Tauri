import { useCallback, useEffect } from "react";
import type { SoundEffectType } from "./useSoundEffects";
import {
  findDeclaredSpatialNeighbor,
  rankSpatialCandidates,
  type SpatialDirection,
} from "../utils/spatialFocus";
export type { SpatialDirection } from "../utils/spatialFocus";

interface UseGamepadFocusNavigationProps {
  playSound: (t: SoundEffectType) => void;
  activeCategory: string;
  isSystemCategory: boolean;
}

export function useGamepadFocusNavigation({
  playSound,
  activeCategory,
  isSystemCategory,
}: UseGamepadFocusNavigationProps) {
  const getSystemFocusableElements = useCallback(() => {
    const root =
      document.querySelector<HTMLElement>("[data-system-page]") ||
      document.querySelector<HTMLElement>("main") ||
      document.body;

    const selectors = [
      "button:not(:disabled)",
      "input:not(:disabled)",
      "select:not(:disabled)",
      "textarea:not(:disabled)",
      "[role='button']:not([aria-disabled='true'])",
      "[tabindex]:not([tabindex='-1'])",
      "[data-gamepad-focusable='true']",
    ].join(",");

    return Array.from(root.querySelectorAll<HTMLElement>(selectors)).filter((element) => {
      if (element.closest("[aria-hidden='true']")) return false;
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return (
        rect.width > 0 &&
        rect.height > 0 &&
        style.visibility !== "hidden" &&
        style.display !== "none" &&
        style.opacity !== "0"
      );
    });
  }, []);

  const focusSystemElement = useCallback(
    (element: HTMLElement, previousElement?: HTMLElement) => {
      document
        .querySelectorAll<HTMLElement>("[data-gamepad-focused='true']")
        .forEach((focusedElement) => {
          delete focusedElement.dataset.gamepadFocused;
        });

      element.dataset.gamepadFocused = "true";
      element.focus({ preventScroll: true });
      element.scrollIntoView({ block: "nearest", inline: "nearest" });

      if (element !== previousElement) {
        playSound("navigate");
      }
    },
    [playSound],
  );

  const moveSystemFocus = useCallback(
    (direction: SpatialDirection = "down") => {
      const elements = getSystemFocusableElements();
      if (elements.length === 0) return false;

      let currentElement: HTMLElement | null = null;
      if (document.activeElement instanceof HTMLElement && elements.includes(document.activeElement)) {
        currentElement = document.activeElement;
      } else {
        const marked = document.querySelector<HTMLElement>("[data-gamepad-focused='true']");
        if (marked && elements.includes(marked)) {
          currentElement = marked;
        }
      }

      if (!currentElement) {
        focusSystemElement(elements[0]);
        return true;
      }

      const currentRect = currentElement.getBoundingClientRect();
      const root = document.querySelector<HTMLElement>("[data-system-page]");
      const declaredNeighbor = root
        ? findDeclaredSpatialNeighbor(root, currentElement, direction)
        : null;

      const rankedCandidates = rankSpatialCandidates(
        currentRect,
        elements
          .filter((element) => element !== currentElement)
          .map((element) => ({ id: element, rect: element.getBoundingClientRect() })),
        direction,
      );

      const nextElement = declaredNeighbor ?? rankedCandidates[0]?.id;

      if (!nextElement) {
        // Natural console UX: when reaching the end of content in that direction,
        // do not warp to the opposite end of the screen.
        return false;
      }

      focusSystemElement(nextElement, currentElement);
      return true;
    },
    [focusSystemElement, getSystemFocusableElements],
  );

  useEffect(() => {
    if (isSystemCategory) return;
    document
      .querySelectorAll<HTMLElement>("[data-gamepad-focused='true']")
      .forEach((focusedElement) => {
        delete focusedElement.dataset.gamepadFocused;
      });
  }, [isSystemCategory]);

  useEffect(() => {
    if (!isSystemCategory) return;
    const timer = window.setTimeout(() => {
      const root = document.querySelector<HTMLElement>("[data-system-page]");
      if (root?.contains(document.activeElement)) return;
      moveSystemFocus("down");
    }, 80);

    return () => window.clearTimeout(timer);
  }, [activeCategory, isSystemCategory, moveSystemFocus]);

  const adjustFocusedRange = useCallback(
    (direction: 1 | -1) => {
      const activeElement = document.activeElement;
      if (!(activeElement instanceof HTMLInputElement) || activeElement.type !== "range") {
        return false;
      }

      const previousValue = activeElement.value;
      if (direction > 0) {
        activeElement.stepUp();
      } else {
        activeElement.stepDown();
      }

      if (activeElement.value !== previousValue) {
        activeElement.dispatchEvent(new Event("input", { bubbles: true }));
        activeElement.dispatchEvent(new Event("change", { bubbles: true }));
        playSound("navigate");
      }
      return true;
    },
    [playSound],
  );

  return { moveSystemFocus, adjustFocusedRange };
}
