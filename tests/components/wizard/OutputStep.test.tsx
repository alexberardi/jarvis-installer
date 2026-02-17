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

  it("renders two file preview tabs", async () => {
    renderOutputStep();
    expect(await screen.findByRole("tab", { name: /docker-compose/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /\.env/i })).toBeInTheDocument();
  });

  it("shows compose preview by default", async () => {
    renderOutputStep();
    const preview = await screen.findByTestId("preview-compose");
    expect(preview).toBeInTheDocument();
    expect(preview.textContent).toContain("services:");
  });

  it("has a copy button", async () => {
    renderOutputStep();
    await screen.findByTestId("preview-compose");
    expect(screen.getByRole("button", { name: /copy/i })).toBeInTheDocument();
  });

  it("switches to .env tab", async () => {
    renderOutputStep();
    const user = userEvent.setup();
    await user.click(await screen.findByRole("tab", { name: /\.env/i }));
    const preview = screen.getByTestId("preview-env");
    expect(preview).toBeInTheDocument();
    expect(preview.textContent).toContain("DB_USER=");
  });

  it("has a download zip button", async () => {
    renderOutputStep();
    await screen.findByTestId("preview-compose");
    expect(screen.getByTestId("download-zip")).toBeInTheDocument();
  });

  it("shows quick start instructions", async () => {
    renderOutputStep();
    await screen.findByTestId("preview-compose");
    expect(screen.getByText(/docker compose up -d/i)).toBeInTheDocument();
  });
});
