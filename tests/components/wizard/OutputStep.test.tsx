import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WizardProvider } from "@/context/WizardContext";
import OutputStep from "@/components/wizard/OutputStep";

// Mock fetch for registry
const registryJson = await import("../../../public/service-registry.json");
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(registryJson.default),
}));

// Mock URL.createObjectURL
vi.stubGlobal("URL", {
  ...URL,
  createObjectURL: vi.fn(() => "blob:mock-url"),
  revokeObjectURL: vi.fn(),
});

function renderOutputStep() {
  return render(
    <WizardProvider>
      <OutputStep />
    </WizardProvider>,
  );
}

describe("OutputStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders two output mode tabs", async () => {
    renderOutputStep();
    expect(await screen.findByRole("tab", { name: /command/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /bundle/i })).toBeInTheDocument();
  });

  it("shows install command by default", async () => {
    renderOutputStep();
    const codeBlock = await screen.findByTestId("install-command");
    expect(codeBlock).toBeInTheDocument();
    expect(codeBlock.textContent).toContain("curl");
  });

  it("has a copy button for the command", async () => {
    renderOutputStep();
    await screen.findByTestId("install-command");
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
  });

  it("copy button changes text after click", async () => {
    // Set up clipboard mock for this test
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(window.navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });

    renderOutputStep();
    const user = userEvent.setup();
    await screen.findByTestId("install-command");
    const copyBtn = screen.getByRole("button", { name: /copy/i });
    await user.click(copyBtn);
    // After clicking, the button text should change to "Copied!"
    expect(await screen.findByText("Copied!")).toBeInTheDocument();
  });

  it("switches to bundle mode and shows download button", async () => {
    renderOutputStep();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: /bundle/i }));
    expect(screen.getByRole("button", { name: /download/i })).toBeInTheDocument();
  });
});
