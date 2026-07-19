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
  it("renders core services with toggles", async () => {
    renderModulesStep();
    const coreSection = await screen.findByTestId("core-services");
    expect(coreSection).toBeInTheDocument();
    expect(within(coreSection).getByText(/auth service/i)).toBeInTheDocument();
    expect(within(coreSection).getByText(/command center/i)).toBeInTheDocument();
    expect(within(coreSection).getByText(/llm proxy/i)).toBeInTheDocument();
  });

  it("renders recommended services with toggles", async () => {
    renderModulesStep();
    const recommendedSection = await screen.findByTestId("recommended-services");
    expect(recommendedSection).toBeInTheDocument();
    // Check toggles exist for recommended services
    expect(within(recommendedSection).getByTestId("toggle-jarvis-whisper-api")).toBeInTheDocument();
    expect(within(recommendedSection).getByTestId("toggle-jarvis-tts")).toBeInTheDocument();
    expect(within(recommendedSection).getByTestId("toggle-jarvis-web")).toBeInTheDocument();
    expect(within(recommendedSection).getByTestId("toggle-jarvis-admin")).toBeInTheDocument();
  });

  it("shows port numbers next to service names", async () => {
    renderModulesStep();
    await screen.findByTestId("core-services");
    // Auth service should show :7701
    expect(screen.getByText(":7701")).toBeInTheDocument();
  });

  it("auto-enables all core and recommended services on load", async () => {
    renderModulesStep();
    await screen.findByTestId("core-services");
    // All toggles should be checked (aria-checked="true")
    const authToggle = screen.getByTestId("toggle-jarvis-auth");
    expect(authToggle).toHaveAttribute("aria-checked", "true");
    const whisperToggle = screen.getByTestId("toggle-jarvis-whisper-api");
    expect(whisperToggle).toHaveAttribute("aria-checked", "true");
  });

  it("toggles a recommended module off", async () => {
    renderModulesStep();
    const user = userEvent.setup();
    const toggle = await screen.findByTestId("toggle-jarvis-tts");
    // Should start enabled
    expect(toggle).toHaveAttribute("aria-checked", "true");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });
});

describe("ModulesStep optional services", () => {
  it("renders the optional section with the phone gateway toggle", async () => {
    renderModulesStep();
    const optionalSection = await screen.findByTestId("optional-services");
    expect(optionalSection).toBeInTheDocument();
    expect(within(optionalSection).getByTestId("toggle-jarvis-phone-gateway")).toBeInTheDocument();
  });

  it("does NOT auto-enable optional services on load", async () => {
    renderModulesStep();
    const toggle = await screen.findByTestId("toggle-jarvis-phone-gateway");
    expect(toggle).toHaveAttribute("aria-checked", "false");
  });

  it("optional services can be toggled on", async () => {
    renderModulesStep();
    const user = userEvent.setup();
    const toggle = await screen.findByTestId("toggle-jarvis-phone-gateway");
    await user.click(toggle);
    expect(toggle).toHaveAttribute("aria-checked", "true");
  });
});
