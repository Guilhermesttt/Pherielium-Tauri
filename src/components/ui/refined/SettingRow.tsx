import React, { useId } from "react";
import { cn } from "../../../lib/utils";

/**
 * Linha de ajuste: título em tinta cheia, descrição em tinta secundária (nunca abaixo de 13px), controle à direita.
 * Substitui as cópias de `Row` espalhadas pelas telas de configuração. Sem divisória: o espaço separa as linhas.
 */
export interface SettingRowProps {
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Controle (Switch, botão, seletor). Recebe o id do título via `labelId` para `aria-labelledby`. */
  control?: (labelId: string) => React.ReactNode;
  children?: React.ReactNode;
  disabled?: boolean;
  className?: string;
}

export const SettingRow: React.FC<SettingRowProps> = ({ title, description, control, children, disabled, className }) => {
  const labelId = useId();
  return (
    <div className={cn("py-4", disabled && "opacity-45", className)}>
      <div className="flex min-h-11 items-center justify-between gap-6">
        <div className="min-w-0 flex-1">
          <div id={labelId} className="text-[length:var(--step-1)] font-medium text-[var(--ink)]">
            {title}
          </div>
          {description && (
            <p className="mt-1 text-[length:var(--step-0)] leading-relaxed text-[var(--ink-muted)]">{description}</p>
          )}
        </div>
        {control && <div className="flex shrink-0 items-center gap-3">{control(labelId)}</div>}
      </div>
      {children && <div className="mt-3">{children}</div>}
    </div>
  );
};
