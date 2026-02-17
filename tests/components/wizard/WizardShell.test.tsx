import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WizardProvider } from "@/context/WizardContext";
import WizardShell from "@/components/wizard/WizardShell";

function renderWizardShell() {
  return render(
    <WizardProvider>
      <WizardShell />
    </WizardProvider>,
  );
}

describe("WizardShell", () => {
  it("renders 3 step indicators", () => {
    renderWizardShell();
    const indicators = screen.getAllByTestId(/^step-indicator-/);
    expect(indicators).toHaveLength(3);
  });

  it("renders step labels", () => {
    renderWizardShell();
    expect(screen.getByText("Hardware")).toBeInTheDocument();
    expect(screen.getByText("Modules")).toBeInTheDocument();
    expect(screen.getByText("Install")).toBeInTheDocument();
  });

  it("shows the Next button on step 0", () => {
    renderWizardShell();
    expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
  });

  it("hides Back button on step 0", () => {
    renderWizardShell();
    expect(screen.queryByRole("button", { name: /back/i })).not.toBeInTheDocument();
  });

  it("navigates to next step on Next click", async () => {
    renderWizardShell();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /next/i }));
    // Step 1 should now be active - check indicator
    const indicator = screen.getByTestId("step-indicator-1");
    expect(indicator).toHaveAttribute("data-active", "true");
  });

  it("shows Back button on step 1", async () => {
    renderWizardShell();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /next/i }));
    expect(screen.getByRole("button", { name: /back/i })).toBeInTheDocument();
  });

  it("navigates back on Back click", async () => {
    renderWizardShell();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /next/i }));
    await user.click(screen.getByRole("button", { name: /back/i }));
    const indicator = screen.getByTestId("step-indicator-0");
    expect(indicator).toHaveAttribute("data-active", "true");
  });

  it("marks completed steps", async () => {
    renderWizardShell();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /next/i }));
    const step0 = screen.getByTestId("step-indicator-0");
    expect(step0).toHaveAttribute("data-completed", "true");
  });
});
