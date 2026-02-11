import { useWizard } from "@/context/WizardContext";

const STEP_LABELS = ["Hardware", "Integrations", "Modules", "Install"];

export default function WizardShell() {
  const { state, dispatch } = useWizard();
  const { currentStep } = state;

  return (
    <div className="mx-auto max-w-3xl p-6">
      {/* Step indicators */}
      <nav className="mb-8 flex items-center justify-between">
        {STEP_LABELS.map((label, index) => (
          <div
            key={label}
            className="flex flex-col items-center gap-1"
            data-testid={`step-indicator-${index}`}
            data-active={index === currentStep ? "true" : "false"}
            data-completed={index < currentStep ? "true" : "false"}
          >
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                index === currentStep
                  ? "bg-[var(--color-accent)] text-white"
                  : index < currentStep
                    ? "bg-[var(--color-success)] text-white"
                    : "bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]"
              }`}
            >
              {index < currentStep ? "✓" : index + 1}
            </div>
            <span
              className={`text-xs ${
                index === currentStep
                  ? "text-[var(--color-text)]"
                  : "text-[var(--color-text-secondary)]"
              }`}
            >
              {label}
            </span>
          </div>
        ))}
      </nav>

      {/* Step content placeholder */}
      <div className="min-h-[300px]" data-testid={`step-content-${currentStep}`}>
        {/* Step components will be rendered here */}
      </div>

      {/* Navigation buttons */}
      <div className="mt-8 flex justify-between">
        {currentStep > 0 ? (
          <button
            type="button"
            className="rounded-lg border border-[var(--color-border)] px-6 py-2 text-sm hover:bg-[var(--color-bg-tertiary)]"
            onClick={() => dispatch({ type: "PREV_STEP" })}
          >
            Back
          </button>
        ) : (
          <div />
        )}
        {currentStep < state.totalSteps - 1 && (
          <button
            type="button"
            className="rounded-lg bg-[var(--color-accent)] px-6 py-2 text-sm text-white hover:bg-[var(--color-accent-hover)]"
            onClick={() => dispatch({ type: "NEXT_STEP" })}
          >
            Next
          </button>
        )}
      </div>
    </div>
  );
}
