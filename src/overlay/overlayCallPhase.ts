export type OverlayCallPhase = "hidden" | "visible" | "dismissed" | "revealing";

export function resolveOverlayCallPhase(input: {
  enabled: boolean;
  callActive: boolean;
  hubVisible: boolean;
  dismissed: boolean;
  pointerInReveal: boolean;
}): OverlayCallPhase {
  if (!input.enabled || !input.callActive || input.hubVisible) return "hidden";
  if (!input.dismissed) return "visible";
  if (input.pointerInReveal) return "revealing";
  return "dismissed";
}
