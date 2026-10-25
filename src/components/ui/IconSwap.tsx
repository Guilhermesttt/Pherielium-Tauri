import React from "react";

export interface IconSwapProps {
  /** Verdadeiro mostra `b` (o ícone do estado ativo: mudo, senha visível, copiado...). */
  active: boolean;
  /** Ícone do estado padrão. */
  a: React.ReactNode;
  /** Ícone do estado ativo. */
  b: React.ReactNode;
  className?: string;
}

/**
 * Dois ícones no mesmo lugar que trocam com fade, desfoque e escala (transitions-dev "icon swap",
 * `.t-icon-swap` em src/index.css). Decorativo: o rótulo acessível fica no botão que o contém.
 */
export const IconSwap: React.FC<IconSwapProps> = ({ active, a, b, className }) => (
  <span className={`t-icon-swap${className ? ` ${className}` : ""}`} data-state={active ? "b" : "a"} aria-hidden="true">
    <span className="t-icon" data-icon="a">
      {a}
    </span>
    <span className="t-icon" data-icon="b">
      {b}
    </span>
  </span>
);

export default IconSwap;
