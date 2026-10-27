import React from "react";
import { cn } from "../../../lib/utils";

/**
 * Superfície: um degrau de tom acima do fundo, sem sombra (o tom já separa).
 * `edge` acrescenta a borda interna de 1px (--hairline) para painéis que ficam sobre
 * imagem ou sobre outro tom parecido, onde o degrau sozinho não basta.
 */
export interface SurfaceProps extends React.HTMLAttributes<HTMLDivElement> {
  tone?: 1 | 2 | 3;
  corner?: "md" | "lg";
  as?: "div" | "section" | "article";
  edge?: boolean;
}

const TONE = { 1: "bg-[var(--tone-1)]", 2: "bg-[var(--tone-2)]", 3: "bg-[var(--tone-3)]" } as const;

export const Surface: React.FC<SurfaceProps> = ({ tone = 2, corner = "lg", as = "div", edge = false, className, ...props }) => {
  const Tag = as;
  return (
    <Tag
      className={cn(
        TONE[tone],
        corner === "lg" ? "rounded-[var(--corner-lg)]" : "rounded-[var(--corner-md)]",
        edge && "shadow-[var(--hairline)]",
        className,
      )}
      {...props}
    />
  );
};
