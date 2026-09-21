import { useEffect, useState } from "react";

/**
 * Hook simples que retorna true quando o usuário prefere redução de movimento
 * (via media query) — útil para alimentar MotionConfig ou condicionar animações.
 */
export function usePrefersReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const handler = () => setPrefersReduced(mq.matches);
    if (typeof mq.addEventListener === "function") mq.addEventListener("change", handler);
    else mq.addListener(handler);
    return () => {
      if (typeof mq.removeEventListener === "function") mq.removeEventListener("change", handler);
      else mq.removeListener(handler);
    };
  }, []);

  return prefersReduced;
}
