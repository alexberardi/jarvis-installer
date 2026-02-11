import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WizardProvider } from "@/context/WizardContext";
import IntegrationsStep from "@/components/wizard/IntegrationsStep";

function renderIntegrationsStep() {
  return render(
    <WizardProvider>
      <IntegrationsStep />
    </WizardProvider>,
  );
}

describe("IntegrationsStep", () => {
  it("renders Home Assistant toggle", () => {
    renderIntegrationsStep();
    expect(screen.getByLabelText(/home assistant/i)).toBeInTheDocument();
  });

  it("hides URL and token inputs when HA is disabled", () => {
    renderIntegrationsStep();
    expect(screen.queryByLabelText(/home assistant url/i)).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/access token/i)).not.toBeInTheDocument();
  });

  it("shows URL and token inputs when HA is enabled", async () => {
    renderIntegrationsStep();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/home assistant/i));
    expect(screen.getByLabelText(/home assistant url/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/access token/i)).toBeInTheDocument();
  });

  it("accepts HA URL input", async () => {
    renderIntegrationsStep();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/home assistant/i));
    const urlInput = screen.getByLabelText(/home assistant url/i);
    await user.type(urlInput, "http://ha.local:8123");
    expect(urlInput).toHaveValue("http://ha.local:8123");
  });

  it("masks token input", async () => {
    renderIntegrationsStep();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/home assistant/i));
    const tokenInput = screen.getByLabelText(/access token/i);
    expect(tokenInput).toHaveAttribute("type", "password");
    await user.type(tokenInput, "abc123");
    expect(tokenInput).toHaveValue("abc123");
  });

  it("renders wake word selector", () => {
    renderIntegrationsStep();
    expect(screen.getByLabelText(/wake word/i)).toBeInTheDocument();
  });

  it("allows selecting a wake word", async () => {
    renderIntegrationsStep();
    const user = userEvent.setup();
    const select = screen.getByLabelText(/wake word/i);
    await user.selectOptions(select, "hey jarvis");
    expect(select).toHaveValue("hey jarvis");
  });
});
