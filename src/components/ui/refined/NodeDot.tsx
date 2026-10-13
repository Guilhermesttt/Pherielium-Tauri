import React from "react";
import { cn } from "../../../lib/utils";

/**
 * O "nó" do logo em tamanho de texto: estado de presença ou de mídia. Só "live" usa cor (o acento do sistema).
 * Tem texto para leitores de tela; o ponto em si é decorativo.
 */
export type NodeState = "live" | "idle" | "away" | "off";

const FILL: Record<NodeState, string> = {
  live: "bg-[var(--live)]",
  idle: "bg-[var(--ink)]",
  away: "bg-[var(--ink-muted)]",
  off: "bg-transparent ring-[1.5px] ring-inset ring-[var(--ink-faint)]",
};

export const NodeDot: React.FC<{ state: NodeState; label: string; className?: string }> = ({ state, label, className }) => (
  <span className={cn("inline-flex items-center", className)}>
    <span aria-hidden="true" className={cn("h-2.5 w-2.5 rounded-[var(--node)]", FILL[state])} />
    <span className="sr-only">{label}</span>
  </span>
);
