import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import App from "@/App";

// Mock gpu-detect for HardwareStep
vi.mock("@/lib/gpu-detect", () => ({
  detectGpu: vi.fn().mockResolvedValue(null),
  parseGpuName: vi.fn((s: string) => s),
  estimateVramFromName: vi.fn(() => null),
}));

// Mock fetch for ModulesStep/OutputStep
const registryJson = await import("../public/service-registry.json");
vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
  ok: true,
  json: () => Promise.resolve(registryJson.default),
}));

describe("App", () => {
  it("renders landing page at /", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders wizard at /configurator", () => {
    render(
      <MemoryRouter initialEntries={["/configurator"]}>
        <App />
      </MemoryRouter>,
    );
    // Wizard shell should render step indicators
    expect(screen.getByText("Hardware")).toBeInTheDocument();
    expect(screen.getByText("Integrations")).toBeInTheDocument();
    expect(screen.getByText("Modules")).toBeInTheDocument();
    expect(screen.getByText("Install")).toBeInTheDocument();
  });
});
