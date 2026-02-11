import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import LandingPage from "@/components/landing/LandingPage";

function renderLandingPage() {
  return render(
    <MemoryRouter>
      <LandingPage />
    </MemoryRouter>,
  );
}

describe("LandingPage", () => {
  it("renders hero heading", () => {
    renderLandingPage();
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toBeInTheDocument();
    expect(heading.textContent).toContain("Jarvis");
  });

  it("has a CTA link to configurator", () => {
    renderLandingPage();
    const cta = screen.getByRole("link", { name: /get started/i });
    expect(cta).toBeInTheDocument();
    expect(cta).toHaveAttribute("href", "/configurator");
  });

  it("shows features list", () => {
    renderLandingPage();
    expect(screen.getByText("Voice Controlled")).toBeInTheDocument();
    expect(screen.getByText("Fully Private")).toBeInTheDocument();
    expect(screen.getByText("Self-Hosted")).toBeInTheDocument();
    expect(screen.getByText("Extensible")).toBeInTheDocument();
  });

  it("includes privacy messaging", () => {
    renderLandingPage();
    // Footer explicitly mentions open source
    expect(screen.getByText(/no cloud required/i)).toBeInTheDocument();
  });
});
