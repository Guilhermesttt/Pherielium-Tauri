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
    { number: 1, label: "Origem" },
    { number: 2, label: "Identificação" },
    { number: 3, label: "Aparência" },
  ];

  return (
    <div className="mb-6 w-full rounded-2xl border border-white/[0.08] bg-[#141416] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]">
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
                    ? "bg-white/[0.08] text-white font-bold"
                    : isCompleted
                      ? "text-white/80 font-medium hover:bg-white/[0.04]"
                      : "text-white/35 font-medium hover:text-white/55"
                }`}
              >
                <div
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-bold transition-all ${
                    isActive
                      ? "bg-white text-black shadow-[0_0_12px_rgba(255,255,255,0.3)]"
                      : isCompleted
                        ? "bg-white/20 text-white"
                        : "border border-white/15 bg-white/[0.03] text-white/40"
                  }`}
                >
                  {isCompleted ? <Check className="h-3.5 w-3.5 stroke-[2.5]" /> : step.number}
                </div>
                <span className="text-[12px] tracking-tight">{step.label}</span>
              </button>

              {idx < steps.length - 1 && (
                <div
                  className={`h-px flex-1 transition-all ${
                    currentStep > step.number ? "bg-white/25" : "bg-white/[0.06]"
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
