import { describe, it, expect } from "vitest";
import { generateInstallCommand } from "@/lib/install-command";
import type { WizardState } from "@/types/wizard";

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    currentStep: 3,
    totalSteps: 3,
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
    wakeWord: "jarvis",
    enabledModules: [],
    outputMode: "command",
    ...overrides,
  };
}

describe("install-command", () => {
  it("generates a curl command", () => {
    const cmd = generateInstallCommand(makeState());
    expect(cmd).toContain("curl");
    expect(cmd).toContain("bash");
  });

  it("includes GPU profile when in GPU mode", () => {
    const cmd = generateInstallCommand(makeState({ inferenceMode: "gpu" }));
    expect(cmd).toContain("--profile gpu");
  });

  it("includes CPU profile when in CPU mode", () => {
    const cmd = generateInstallCommand(makeState({ inferenceMode: "cpu" }));
    expect(cmd).toContain("--profile cpu");
  });

  it("includes model and quantization flags", () => {
    const cmd = generateInstallCommand(makeState());
    expect(cmd).toContain("--model mistral-7b-instruct-v0.3");
    expect(cmd).toContain("--quantization q4_k_m");
  });

  it("includes gpu-layers flag", () => {
    const cmd = generateInstallCommand(makeState());
    expect(cmd).toContain("--gpu-layers all");
  });

  it("includes numeric gpu-layers", () => {
    const state = makeState({
      recommendation: {
        modelId: "mistral-7b-instruct-v0.3",
        modelName: "Mistral 7B Instruct v0.3",
        quantization: "q4_k_m",
        gpuLayers: 20,
        estimatedVramMb: 3200,
        tier: "low",
        description: "Test",
      },
    });
    const cmd = generateInstallCommand(state);
    expect(cmd).toContain("--gpu-layers 20");
  });

  it("includes modules flag when modules are selected", () => {
    const cmd = generateInstallCommand(
      makeState({ enabledModules: ["jarvis-recipes", "jarvis-ocr-service"] }),
    );
    expect(cmd).toContain("--modules jarvis-recipes,jarvis-ocr-service");
  });

  it("omits modules flag when none selected", () => {
    const cmd = generateInstallCommand(makeState({ enabledModules: [] }));
    expect(cmd).not.toContain("--modules");
  });

  it("includes wake word flag", () => {
    const cmd = generateInstallCommand(makeState({ wakeWord: "hey jarvis" }));
    expect(cmd).toContain('--wake-word "hey jarvis"');
  });

  it("output is valid shell with line continuations", () => {
    const cmd = generateInstallCommand(makeState());
    // Every newline (except the last line) should be preceded by a backslash
    const lines = cmd.split("\n");
    for (let i = 0; i < lines.length - 1; i++) {
      expect(lines[i]!.trimEnd().endsWith("\\")).toBe(true);
    }
  });
});
