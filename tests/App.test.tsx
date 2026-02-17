import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import App from "@/App";

// Mock fetch for service-registry.json
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
    expect(screen.getByText("Services")).toBeInTheDocument();
    expect(screen.getByText("Configure")).toBeInTheDocument();
    expect(screen.getByText("Install")).toBeInTheDocument();
  });
});
