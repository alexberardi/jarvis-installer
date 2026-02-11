import { describe, it, expect, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WizardProvider } from "@/context/WizardContext";
import ModulesStep from "@/components/wizard/ModulesStep";

// Mock fetch for service-registry.json
const registryJson = await import("../../../public/service-registry.json");

vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(registryJson.default),
}));

function renderModulesStep() {
  return render(
    <WizardProvider>
      <ModulesStep />
    </WizardProvider>,
  );
}

describe("ModulesStep", () => {
  it("renders core services as always-on", async () => {
    renderModulesStep();
    // Wait for registry to load
    const coreSection = await screen.findByTestId("core-services");
    expect(coreSection).toBeInTheDocument();
    expect(within(coreSection).getByText(/auth service/i)).toBeInTheDocument();
    expect(within(coreSection).getByText(/command center/i)).toBeInTheDocument();
  });

  it("renders optional modules with toggles", async () => {
    renderModulesStep();
    const optionalSection = await screen.findByTestId("optional-services");
    expect(optionalSection).toBeInTheDocument();
    expect(within(optionalSection).getByText(/ocr service/i)).toBeInTheDocument();
    expect(within(optionalSection).getByText(/recipes service/i)).toBeInTheDocument();
  });

  it("shows module descriptions", async () => {
    renderModulesStep();
    await screen.findByTestId("optional-services");
    expect(screen.getByText(/optical character recognition/i)).toBeInTheDocument();
  });

  it("toggles an optional module on", async () => {
    renderModulesStep();
    const user = userEvent.setup();
    const toggle = await screen.findByTestId("toggle-jarvis-ocr-service");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });

  it("enabling recipes auto-enables OCR", async () => {
    renderModulesStep();
    const user = userEvent.setup();
    const recipesToggle = await screen.findByTestId("toggle-jarvis-recipes");
    await user.click(recipesToggle);
    // OCR should also be checked
    const ocrToggle = screen.getByTestId("toggle-jarvis-ocr-service");
    expect(ocrToggle).toHaveAttribute("aria-checked", "true");
  });
});
