import React from "react";
import { FOCUS_RING } from "./panelTokens";

/** Linha de menu em pílula arredondada: ícone + rótulo à esquerda, badge opcional à direita. */
export const PanelRow: React.FC<{
  icon: React.ReactNode;
  label: string;
  trailing?: React.ReactNode;
  onClick: () => void;
}> = ({ icon, label, trailing, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`flex min-h-11 items-center justify-between gap-3 rounded-2xl bg-white/[0.06] px-3.5 text-[13px] font-medium text-white/85 transition-all duration-150 hover:bg-white/[0.12] hover:text-white active:scale-[0.98] ${FOCUS_RING}`}
  >
    <span className="flex min-w-0 items-center gap-2.5">
      {icon}
      <span className="truncate">{label}</span>
    </span>
    {trailing != null && <span className="shrink-0 text-[11px] font-semibold tabular-nums text-white/45">{trailing}</span>}
  </button>
);
