import { useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Posiciona o bloco de tinta (`.console-tab-pill`) atrás da aba ativa (`[role="tab"][aria-selected="true"]`)
 * dentro de `track`. A primeira posição e os reajustes de tamanho entram secos; só a troca de aba desliza.
 */
export function useSlidingPill(
  track: RefObject<HTMLElement | null>,
  pill: RefObject<HTMLElement | null>,
  activeKey: unknown,
): void {
  const placed = useRef(false);

  useLayoutEffect(() => {
    const trackEl = track.current;
    const pillEl = pill.current;
    if (!trackEl || !pillEl) return;

    const place = (animate: boolean) => {
      const active = trackEl.querySelector<HTMLElement>('[role="tab"][aria-selected="true"]');
      if (!active) {
        pillEl.style.opacity = "0";
        return;
      }
      const t = trackEl.getBoundingClientRect();
      const r = active.getBoundingClientRect();
      pillEl.style.transition = animate ? "" : "none";
      pillEl.style.opacity = "1";
      pillEl.style.width = `${r.width}px`;
      pillEl.style.height = `${r.height}px`;
      pillEl.style.transform = `translate(${r.left - t.left + trackEl.scrollLeft}px, ${r.top - t.top + trackEl.scrollTop}px)`;
      if (!animate) {
        void pillEl.offsetWidth;
        pillEl.style.transition = "";
      }
    };

    place(placed.current);
    placed.current = true;

    const reflow = () => place(false);
    const observer = new ResizeObserver(reflow);
    observer.observe(trackEl);
    void document.fonts?.ready.then(reflow);
    return () => observer.disconnect();
  }, [track, pill, activeKey]);
}
