// Shared motion language for the call window, aligned to the transitions.dev token scale
// (card resize / open-close / stagger) so every micro-interaction in this surface reads
// as one consistent system instead of ad-hoc per-component timings.
// Reference: https://transitions.dev/ — p1 (badge pop), p2 (scale-open), p4 (card resize).

export const gridSpring = {
  type: "spring" as const,
  stiffness: 420,
  damping: 38,
  mass: 0.9,
};

export const tileEnter = {
  initial: { opacity: 0, scale: 0.82, filter: "blur(6px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 0.85, filter: "blur(4px)" },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

export const stageEnter = {
  initial: { opacity: 0, scale: 0.97, filter: "blur(8px)" },
  animate: { opacity: 1, scale: 1, filter: "blur(0px)" },
  exit: { opacity: 0, scale: 0.98, filter: "blur(6px)" },
  transition: { duration: 0.32, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] },
};

export const popIn = {
  initial: { opacity: 0, scale: 0.9, y: 4 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.92, y: 4 },
  transition: { type: "spring" as const, bounce: 0.35, duration: 0.32 },
};

export const staggerDelay = (index: number, step = 0.035, max = 0.28) =>
  Math.min(index * step, max);
