import React from "react";
import { Check } from "lucide-react";
import { guidedSteps, type DownloadPhase, type StepState } from "../../services/downloadView";

const STEP_LABEL = {
  open: "Página da Nexus aberta",
  slow: "Clique em Download lento",
  accept: "Aceite abrir o Pherielium",
  download: "O Pherielium baixa e instala",
} as const;

/** O que a pessoa vê em cada passo quando ele é o atual (o que fazer, em uma frase). */
const STEP_HINT: Partial<Record<keyof typeof STEP_LABEL, string>> = {
  slow: "Na página da Nexus, o botão fica ao lado de Download rápido (que é do Premium).",
  accept: "O navegador pergunta se pode abrir o Pherielium: aceite. Marque “sempre” para não perguntar de novo.",
};

const MARK: Record<StepState, string> = {
  done: "bg-[var(--live)] text-[var(--tone-0)]",
  current: "bg-[var(--ink)] text-[var(--tone-0)]",
  todo: "bg-[var(--tone-4)] text-[var(--ink-faint)]",
};

/**
 * Os passos da conta grátis, em ordem: a Nexus só entrega o link a quem clica em "Download lento",
 * então a pessoa precisa saber o que fazer e em que ponto está. Mostra a dica só do passo atual.
 */
export const FreeDownloadSteps: React.FC<{ phase: DownloadPhase; className?: string }> = ({ phase, className }) => {
  const steps = guidedSteps(phase);
  if (steps.length === 0) return null;
  return (
    <ol className={`flex flex-col gap-2 ${className ?? ""}`} aria-label="Passos do download">
      {steps.map((step, index) => (
        <li key={step.id} className="flex items-start gap-3" aria-current={step.state === "current" ? "step" : undefined}>
          <span
            className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[length:var(--step-0)] font-semibold ${MARK[step.state]}`}
            aria-hidden="true"
          >
            {step.state === "done" ? <Check className="h-3 w-3" /> : index + 1}
          </span>
          <span className="min-w-0">
            <span
              className={`block text-[length:var(--step-0)] ${
                step.state === "current" ? "font-semibold text-[var(--ink)]" : step.state === "done" ? "text-[var(--ink-muted)]" : "text-[var(--ink-faint)]"
              }`}
            >
              {STEP_LABEL[step.id]}
            </span>
            {step.state === "current" && STEP_HINT[step.id] && (
              <span className="mt-0.5 block text-[length:var(--step-0)] leading-relaxed text-[var(--ink-muted)]">{STEP_HINT[step.id]}</span>
            )}
          </span>
        </li>
      ))}
    </ol>
  );
};

export default FreeDownloadSteps;
