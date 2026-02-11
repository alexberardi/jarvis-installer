import { describe, it, expect } from "vitest";
import { generateEnv } from "@/lib/env-generator";
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

describe("env-generator", () => {
  it("generates valid KEY=value format", () => {
    const env = generateEnv(makeState(), registry);
    const lines = env.split("\n").filter((l) => l && !l.startsWith("#"));
    for (const line of lines) {
      expect(line).toMatch(/^[A-Z_]+=.*/);
    }
  });

  it("includes section comments", () => {
    const env = generateEnv(makeState(), registry);
    expect(env).toContain("#");
  });

  it("includes GPU vars when GPU mode", () => {
    const env = generateEnv(makeState({ inferenceMode: "gpu" }), registry);
    expect(env).toContain("INFERENCE_MODE=gpu");
    expect(env).toContain("GPU_LAYERS=all");
  });

  it("includes CPU vars when CPU mode", () => {
    const env = generateEnv(
      makeState({
        inferenceMode: "cpu",
        recommendation: {
          modelId: "mistral-7b-instruct-v0.3",
          modelName: "Mistral 7B Instruct v0.3",
          quantization: "q4_k_m",
          gpuLayers: 0,
          estimatedVramMb: 0,
          tier: "cpu-only",
          description: "CPU-only inference",
        },
      }),
      registry,
    );
    expect(env).toContain("INFERENCE_MODE=cpu");
    expect(env).toContain("GPU_LAYERS=0");
  });

  it("includes model configuration", () => {
    const env = generateEnv(makeState(), registry);
    expect(env).toContain("MODEL_ID=mistral-7b-instruct-v0.3");
    expect(env).toContain("QUANTIZATION=q4_k_m");
  });

  it("includes HA vars when enabled", () => {
    const env = generateEnv(
      makeState({
        homeAssistant: { enabled: true, url: "http://ha.local:8123", token: "abc" },
      }),
      registry,
    );
    expect(env).toContain("HA_URL=http://ha.local:8123");
    expect(env).toContain("HA_TOKEN=abc");
  });

  it("omits HA vars when disabled", () => {
    const env = generateEnv(makeState(), registry);
    expect(env).not.toContain("HA_URL");
    expect(env).not.toContain("HA_TOKEN");
  });

  it("includes placeholder secrets", () => {
    const env = generateEnv(makeState(), registry);
    expect(env).toContain("SECRET_KEY=");
    expect(env).toContain("POSTGRES_PASSWORD=");
  });

  it("includes database URL", () => {
    const env = generateEnv(makeState(), registry);
    expect(env).toContain("DATABASE_URL=");
  });
});
