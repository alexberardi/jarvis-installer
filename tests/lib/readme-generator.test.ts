import { describe, it, expect } from "vitest";
import { generateReadme } from "@/lib/readme-generator";
import { parseRegistry } from "@/lib/service-registry";
import type { WizardState } from "@/types/wizard";
import registryJson from "../../public/service-registry.json";

const registry = parseRegistry(registryJson);

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    currentStep: 3,
    totalSteps: 4,
    inferenceMode: "gpu",
    detectedGpu: null,
    vramMb: 8192,
    ramGb: 16,
    recommendation: {
      modelId: "mistral-7b-instruct-v0.3",
      modelName: "Mistral 7B Instruct v0.3",
      quantization: "q4_k_m",
      gpuLayers: "all",
      estimatedVramMb: 5000,
      tier: "medium",
      description: "Test",
    },
    homeAssistant: { enabled: false, url: "", token: "" },
    wakeWord: "jarvis",
    enabledModules: [],
    outputMode: "command",
    ...overrides,
  };
}

describe("readme-generator", () => {
  it("generates markdown content", () => {
    const readme = generateReadme(makeState(), registry);
    expect(readme).toContain("# Jarvis");
    expect(readme).toContain("##");
  });

  it("includes hardware summary", () => {
    const readme = generateReadme(makeState({ inferenceMode: "gpu", vramMb: 8192 }), registry);
    expect(readme).toContain("GPU");
    expect(readme).toContain("8192");
  });

  it("includes selected modules", () => {
    const readme = generateReadme(
      makeState({ enabledModules: ["jarvis-recipes"] }),
      registry,
    );
    expect(readme).toContain("Recipes");
  });

  it("includes docker compose command", () => {
    const readme = generateReadme(makeState(), registry);
    expect(readme).toContain("docker compose");
  });

  it("includes model information", () => {
    const readme = generateReadme(makeState(), registry);
    expect(readme).toContain("Mistral 7B");
    expect(readme).toContain("q4_k_m");
  });
});
