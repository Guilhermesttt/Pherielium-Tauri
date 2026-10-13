import React from "react";

/** Cartão de seção, nos mesmos tokens do resto das Configurações. */
export const SettingsCard: React.FC<{ title: string; hint?: string; children: React.ReactNode; action?: React.ReactNode }> = ({
  title,
  hint,
  children,
  action,
}) => (
  <section className="rounded-[var(--radius-card)] border border-[color:var(--edge-subtle)] bg-[color:var(--surface-raised)] p-[var(--space-5)]">
    <header className="mb-[var(--space-3)] flex items-start justify-between gap-[var(--gap-inline)]">
      <div className="min-w-0">
        <h3 className="text-[length:var(--fs-heading)] font-semibold text-white">{title}</h3>
        {hint && <p className="mt-0.5 text-[length:var(--fs-label)] text-[var(--ink-muted)]">{hint}</p>}
      </div>
      {action}
    </header>
    {children}
  </section>
);
