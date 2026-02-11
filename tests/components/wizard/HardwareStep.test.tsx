import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WizardProvider } from "@/context/WizardContext";
import HardwareStep from "@/components/wizard/HardwareStep";

// Mock gpu-detect to avoid canvas issues in jsdom
vi.mock("@/lib/gpu-detect", () => ({
  detectGpu: vi.fn().mockResolvedValue(null),
  parseGpuName: vi.fn((s: string) => s),
  estimateVramFromName: vi.fn(() => null),
}));

function renderHardwareStep() {
  return render(
    <WizardProvider>
      <HardwareStep />
    </WizardProvider>,
  );
}

describe("HardwareStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders GPU/CPU toggle", () => {
    renderHardwareStep();
    expect(screen.getByLabelText(/gpu/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/cpu/i)).toBeInTheDocument();
  });

  it("defaults to GPU mode selected", () => {
    renderHardwareStep();
    const gpuRadio = screen.getByLabelText(/gpu/i);
    expect(gpuRadio).toBeChecked();
  });

  it("switches to CPU mode on click", async () => {
    renderHardwareStep();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/cpu/i));
    expect(screen.getByLabelText(/cpu/i)).toBeChecked();
  });

  it("shows VRAM input when GPU mode is selected", () => {
    renderHardwareStep();
    expect(screen.getByLabelText(/vram/i)).toBeInTheDocument();
  });

  it("shows RAM input", () => {
    renderHardwareStep();
    expect(screen.getByLabelText(/^ram/i)).toBeInTheDocument();
  });

  it("updates VRAM and shows model recommendation", async () => {
    renderHardwareStep();
    const user = userEvent.setup();
    const vramInput = screen.getByLabelText(/vram/i);
    await user.clear(vramInput);
    await user.type(vramInput, "24576");
    // Should show a recommendation section
    expect(screen.getByTestId("model-recommendation")).toBeInTheDocument();
  });

  it("shows recommendation details", async () => {
    renderHardwareStep();
    const user = userEvent.setup();
    const vramInput = screen.getByLabelText(/vram/i);
    await user.clear(vramInput);
    await user.type(vramInput, "24576");
    // Check for model name and quantization in recommendation
    expect(screen.getByText(/mistral/i)).toBeInTheDocument();
    expect(screen.getByText(/q8_0|q4_k_m/i)).toBeInTheDocument();
  });

  it("hides VRAM input when CPU mode is selected", async () => {
    renderHardwareStep();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/cpu/i));
    expect(screen.queryByLabelText(/vram/i)).not.toBeInTheDocument();
  });

  it("shows CPU-only recommendation when in CPU mode", async () => {
    renderHardwareStep();
    const user = userEvent.setup();
    await user.click(screen.getByLabelText(/cpu/i));
    expect(screen.getByTestId("model-recommendation")).toBeInTheDocument();
    // The tier label shows "cpu-only" in the recommendation
    expect(screen.getAllByText(/cpu-only/i).length).toBeGreaterThan(0);
  });
});
