import { describe, it, expect } from "vitest";
import { generateCompose } from "@/lib/compose-generator";
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

describe("compose-generator", () => {
  it("generates valid YAML-like output", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("version:");
    expect(output).toContain("services:");
  });

  it("always includes core services", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("jarvis-auth:");
    expect(output).toContain("jarvis-command-center:");
    expect(output).toContain("jarvis-whisper:");
    expect(output).toContain("jarvis-tts:");
    expect(output).toContain("jarvis-logs:");
  });

  it("includes optional services when enabled", () => {
    const output = generateCompose(
      makeState({ enabledModules: ["jarvis-recipes", "jarvis-ocr-service"] }),
      registry,
    );
    expect(output).toContain("jarvis-recipes:");
    expect(output).toContain("jarvis-ocr-service:");
  });

  it("excludes optional services when not enabled", () => {
    const output = generateCompose(makeState({ enabledModules: [] }), registry);
    expect(output).not.toContain("jarvis-recipes:");
    expect(output).not.toContain("jarvis-ocr-service:");
  });

  it("includes postgres when services need it", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("postgres:");
  });

  it("includes correct ports", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("8007:8007");
    expect(output).toContain("8002:8002");
  });

  it("includes health checks", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("healthcheck:");
    expect(output).toContain("/health");
  });

  it("includes loki when logs service is present", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("loki:");
  });

  it("includes network definition", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("networks:");
    expect(output).toContain("jarvis:");
  });

  it("includes volumes definition", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("volumes:");
    expect(output).toContain("jarvis-postgres-data:");
  });
});
