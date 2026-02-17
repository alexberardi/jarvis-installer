import { describe, it, expect } from "vitest";
import { generateZipBundle } from "@/lib/zip-bundle";
import { parseRegistry } from "@/lib/service-registry";
import type { WizardState } from "@/types/wizard";
import registryJson from "../../public/service-registry.json";
import JSZip from "jszip";

const registry = parseRegistry(registryJson);

function makeState(overrides: Partial<WizardState> = {}): WizardState {
  return {
    currentStep: 3,
    totalSteps: 3,
    inferenceMode: "gpu",
    detectedGpu: null,
    vramMb: 8192,
    ramGb: 16,
    recommendation: {
      modelId: "llama-3.1-8b-instruct",
      modelName: "Llama 3.1 8B Instruct",
      quantization: "q4_k_m",
      gpuLayers: "all",
      estimatedVramMb: 5000,
      tier: "medium",
      description: "Test",
    },
    wakeWord: "jarvis",
    enabledModules: [],
    outputMode: "bundle",
    ...overrides,
  };
}

describe("zip-bundle", () => {
  it("generates a zip blob", async () => {
    const blob = await generateZipBundle(makeState(), registry);
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(0);
  });

  it("contains docker-compose.yml", async () => {
    const blob = await generateZipBundle(makeState(), registry);
    const zip = await JSZip.loadAsync(blob);
    expect(zip.files["jarvis/docker-compose.yml"]).toBeDefined();
  });

  it("contains .env file", async () => {
    const blob = await generateZipBundle(makeState(), registry);
    const zip = await JSZip.loadAsync(blob);
    expect(zip.files["jarvis/.env"]).toBeDefined();
  });

  it("contains README.md", async () => {
    const blob = await generateZipBundle(makeState(), registry);
    const zip = await JSZip.loadAsync(blob);
    expect(zip.files["jarvis/README.md"]).toBeDefined();
  });

  it("contains service-registry.json", async () => {
    const blob = await generateZipBundle(makeState(), registry);
    const zip = await JSZip.loadAsync(blob);
    expect(zip.files["jarvis/service-registry.json"]).toBeDefined();
  });

  it("docker-compose.yml has valid content", async () => {
    const blob = await generateZipBundle(makeState(), registry);
    const zip = await JSZip.loadAsync(blob);
    const content = await zip.files["jarvis/docker-compose.yml"]!.async("string");
    expect(content).toContain("services:");
    expect(content).toContain("jarvis-auth:");
  });

  it(".env has valid content", async () => {
    const blob = await generateZipBundle(makeState(), registry);
    const zip = await JSZip.loadAsync(blob);
    const content = await zip.files["jarvis/.env"]!.async("string");
    expect(content).toContain("INFERENCE_MODE=gpu");
  });
});
