import React from "react";
import { Check } from "lucide-react";

interface AddGameWizardStepsProps {
  currentStep: number;
  onStepClick?: (step: number) => void;
}

export const AddGameWizardSteps: React.FC<AddGameWizardStepsProps> = ({
  currentStep,
  onStepClick,
}) => {
  const steps = [
    { number: 1, label: "Origem & Busca" },
    { number: 2, label: "Informações" },
    { number: 3, label: "Artes & Atalho" },
  ];

  return (
    <div className="mb-6 w-full rounded-2xl border border-white/10 bg-black/40 p-3.5 backdrop-blur-2xl">
      <div className="flex items-center justify-between gap-2">
        {steps.map((step, idx) => {
          const isCompleted = currentStep > step.number;
          const isActive = currentStep === step.number;

          return (
            <React.Fragment key={step.number}>
              <button
                type="button"
                disabled={!onStepClick}
                onClick={() => onStepClick?.(step.number)}
                className={`flex cursor-pointer items-center gap-2.5 rounded-xl px-3 py-1.5 transition-all ${
                  isActive
                    ? "bg-white/10 text-white font-bold"
                    : isCompleted
                      ? "text-emerald-400 font-semibold hover:bg-white/5"
                      : "text-white/40 font-medium"
                }`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-black transition-all ${
                    isActive
                      ? "bg-white text-black shadow-[0_0_12px_rgba(255,255,255,0.4)]"
                      : isCompleted
                        ? "bg-emerald-500 text-black shadow-[0_0_8px_rgba(16,185,129,0.4)]"
                        : "border border-white/20 bg-white/5 text-white/50"
                  }`}
                >
                  {isCompleted ? <Check className="h-4 w-4 stroke-[3]" /> : step.number}
                </div>
                <span className="hidden sm:inline text-xs tracking-wide">{step.label}</span>
              </button>

              {idx < steps.length - 1 && (
                <div
                  className={`h-0.5 flex-1 rounded-full transition-all ${
                    currentStep > step.number ? "bg-emerald-500/60" : "bg-white/10"
                  }`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};
