import React from "react";
import { createRoot } from "react-dom/client";
import { DesktopNotch } from "../../src/components/notch/DesktopNotch";

/** O notch de verdade, com uma chamada ativa vinda de fora (como no overlay). */
export function mount(el: HTMLElement) {
  createRoot(el).render(
    <DesktopNotch
      overlayCall={{ active: true, friendName: "Tania Castillo", muted: false, durationSeconds: 74 }}
      onOverlayHangUp={() => {}}
    />,
  );
}
