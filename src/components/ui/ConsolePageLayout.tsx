import React, { useRef } from "react";
import { motion } from "framer-motion";
import { useGamepadNavigation } from "../../hooks/useGamepadNavigation";

export interface PageReading {
  label: string;
  value: number | string;
  /** Pinta o número de verde "ao vivo" quando > 0 (só para estado em tempo real). */
  live?: boolean;
}

export interface ConsolePageLayoutProps {
  title: string;
  /** Leituras do topo; `null` mostra `emptyLine` no lugar. */
  readings: PageReading[] | null;
  emptyLine?: string;
  actions?: React.ReactNode;
  tabs?: React.ReactNode;
  /** Fixo embaixo, fora da rolagem (dicas de controle). */
  footer?: React.ReactNode;
  /** Valor de `data-system-page`; as regras de foco do controle olham esse atributo. */
  systemPage?: string;
  gamepadPriority?: number;
  children: React.ReactNode;
}

const Reading: React.FC<PageReading> = ({ label, value, live }) => (
  <div>
    <dt>{label}</dt>
    <dd className="font-metric" style={live && Number(value) > 0 ? { color: "var(--live)" } : undefined}>
      {value}
    </dd>
  </div>
);

/**
 * Moldura das páginas de sistema no tom da tela do jogo (Amigos, Troféus, Perfil): em cima o rótulo
 * e as leituras em número grande, as ações à direita e, abaixo, as abas. A rolagem e a navegação por
 * controle são as mesmas das outras páginas (`data-system-page`).
 */
export const ConsolePageLayout: React.FC<ConsolePageLayoutProps> = ({
  title,
  readings,
  emptyLine,
  actions,
  tabs,
  footer,
  systemPage = "",
  gamepadPriority,
  children,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  useGamepadNavigation({
    scrollRef: scrollRef as React.RefObject<HTMLElement>,
    scrollSpeed: 25,
    disableX: true,
    disableO: true,
    ...(gamepadPriority !== undefined ? { priority: gamepadPriority } : {}),
  });

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <motion.div
        ref={scrollRef}
        data-system-page={systemPage}
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
        className="thin-scrollbar min-h-0 flex-1 overflow-y-auto"
        style={{ padding: "var(--safe-y) var(--safe-x) 48px", contain: "layout" }}
      >
        <div className="mx-auto flex min-h-full w-full max-w-[1280px] flex-col gap-10">
          <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-5">
            <div className="min-w-0">
              <h1 className="text-[length:var(--fs-label)] font-bold uppercase tracking-[0.08em] text-[var(--ink-muted)]">{title}</h1>
              {readings ? (
                <dl className="console-stats mt-3 flex flex-wrap gap-x-12 gap-y-3">
                  {readings.map((r) => (
                    <Reading key={r.label} {...r} />
                  ))}
                </dl>
              ) : (
                <p className="mt-2 text-[length:var(--fs-title)] font-semibold text-[var(--ink)]">{emptyLine}</p>
              )}
            </div>
            {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
          </header>

          {tabs && <div>{tabs}</div>}

          <div className="min-w-0 flex-1">{children}</div>
        </div>
      </motion.div>
      {footer && <div className="flex shrink-0 justify-end px-[var(--safe-x)] py-3">{footer}</div>}
    </div>
  );
};
