import React from "react";
import {
  FACTORY_SETTINGS,
  previewCurve,
  previewTrigger,
  type ControllerSettings,
} from "../../services/controllerProfile";

/** Linha de configuração: rótulo (+ dica) à esquerda, controle à direita. */
export const Row: React.FC<{
  label: string;
  hint?: string;
  children: React.ReactNode;
}> = ({ label, hint, children }) => (
  <div className="flex items-center justify-between gap-[var(--gap-section)] border-b border-[color:var(--edge-subtle)] py-[var(--space-3)] last:border-b-0">
    <div className="min-w-0">
      <p className="text-[length:var(--fs-caption)] font-medium text-white/90">{label}</p>
      {hint && <p className="mt-0.5 text-[length:var(--fs-label)] text-white/45">{hint}</p>}
    </div>
    <div className="flex shrink-0 items-center gap-[var(--gap-inline)]">{children}</div>
  </div>
);

export const Slider: React.FC<{
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (v: number) => void;
  format: (v: number) => string;
  label: string;
}> = ({ value, min, max, step, onChange, format, label }) => (
  <>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}
      className="game-row-scrubber w-[160px]"
    />
    <span className="w-[52px] text-right text-[length:var(--fs-label)] tabular-nums text-white/70">
      {format(value)}
    </span>
  </>
);

export const Toggle: React.FC<{
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}> = ({ checked, onChange, label, disabled }) => (
  <button
    type="button"
    role="switch"
    aria-checked={checked}
    aria-label={label}
    disabled={disabled}
    onClick={() => onChange(!checked)}
    className={`relative h-6 w-11 shrink-0 rounded-full border transition-colors duration-[var(--dur-focus)] ease-[var(--ease-focus)] ${
      disabled
        ? "cursor-not-allowed border-[color:var(--edge-subtle)] bg-white/[0.03] opacity-50"
        : checked
          ? "cursor-pointer border-[color:var(--edge-selected)] bg-[color:var(--selection-bg)]"
          : "cursor-pointer border-[color:var(--edge-subtle)] bg-white/[0.06]"
    }`}
  >
    <span
      className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-white transition-[left] duration-[var(--dur-focus)] ease-[var(--ease-focus)]"
      style={{ left: checked ? "calc(100% - 1.25rem)" : "0.25rem" }}
    />
  </button>
);

/** Grupo de opções exclusivas (uma só marcada). */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: ReadonlyArray<{ value: T; label: string }>;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`cursor-pointer rounded-[var(--radius-control)] border px-3 py-1.5 text-[length:var(--fs-label)] font-medium transition-colors duration-[var(--dur-focus)] ease-[var(--ease-focus)] ${
              active
                ? "border-[color:var(--edge-selected)] bg-[color:var(--selection-bg)] text-white"
                : "border-[color:var(--edge-subtle)] text-white/70 hover:border-[color:var(--edge-strong)] hover:text-white"
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Gráfico de resposta ─────────────────────────────────────────────────────

const GRAPH = 120;

/**
 * Curva de resposta desenhada com as amostras do Rust (`controller_curve_preview`),
 * nunca com uma fórmula própria: se o front tivesse a sua, o gráfico passaria a
 * mentir sobre o que o controle faz no dia em que as duas divergissem.
 */
export const ResponseGraph: React.FC<{
  settings: ControllerSettings;
  kind: "stick" | "trigger";
  title: string;
}> = ({ settings, kind, title }) => {
  const [samples, setSamples] = React.useState<number[] | null>(null);

  // Só os campos que mexem na curva entram no objeto: arrastar "vibração" não
  // deve pedir uma nova amostra ao Rust.
  const { deadzoneLeft, curve, sensitivity, triggerThreshold } = settings;
  const shaping = React.useMemo<ControllerSettings>(
    () => ({ ...FACTORY_SETTINGS, deadzoneLeft, curve, sensitivity, triggerThreshold }),
    [deadzoneLeft, curve, sensitivity, triggerThreshold],
  );

  React.useEffect(() => {
    let alive = true;
    const request = kind === "stick" ? previewCurve : previewTrigger;
    request(shaping)
      .then((s) => {
        if (alive) setSamples(Array.isArray(s) ? s : null);
      })
      .catch(() => {
        // Fora do app desktop não há Rust para amostrar: o gráfico só fica sem a linha.
        if (alive) setSamples(null);
      });
    return () => {
      alive = false;
    };
  }, [kind, shaping]);

  const points = React.useMemo(() => {
    if (!samples || samples.length < 2) return "";
    return samples
      .map((y, i) => {
        const x = (i / (samples.length - 1)) * GRAPH;
        return `${x.toFixed(1)},${(GRAPH - Math.min(1, Math.max(0, y)) * GRAPH).toFixed(1)}`;
      })
      .join(" ");
  }, [samples]);

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${GRAPH} ${GRAPH}`}
        width={GRAPH}
        height={GRAPH}
        role="img"
        aria-label={`Gráfico de resposta: ${title}`}
        data-graph={kind}
        className="rounded-[var(--radius-control)] border border-[color:var(--edge-subtle)]"
        style={{ background: "color-mix(in srgb, var(--surface-base) 60%, transparent)" }}
      >
        <line x1={0} y1={GRAPH} x2={GRAPH} y2={0} stroke="var(--edge-subtle)" strokeDasharray="3 4" />
        {points && (
          <polyline
            points={points}
            fill="none"
            stroke="rgb(var(--launcher-accent))"
            strokeWidth={2}
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        )}
      </svg>
      <figcaption className="mt-1 text-center text-[length:var(--fs-label)] text-white/45">{title}</figcaption>
    </figure>
  );
};
