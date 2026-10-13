import React from "react";
import { cn } from "../../../lib/utils";

/** Superfície: um degrau de tom acima do fundo, sem borda e sem sombra (o tom já separa). */
export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 1 | 2 | 3;
  corner?: "md" | "lg";
  as?: "div" | "section" | "article";
}

const TONE = { 1: "bg-[var(--tone-1)]", 2: "bg-[var(--tone-2)]", 3: "bg-[var(--tone-3)]" } as const;

export const Surface: React.FC<SurfaceProps> = ({ tone = 2, corner = "lg", as = "div", className, ...props }) => {
  const Tag = as;
  return (
    <Tag
      className={cn(TONE[tone], corner === "lg" ? "rounded-[var(--corner-lg)]" : "rounded-[var(--corner-md)]", className)}
      {...props}
    />
  );
};
