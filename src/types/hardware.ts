export type InferenceMode = "gpu" | "cpu";

export interface DetectedGpu {
  name: string;
  vendor: string;
  vramMb: number | null;
  source: "webgpu" | "webgl" | "manual";
}

export interface HardwareProfile {
  mode: InferenceMode;
  gpu: DetectedGpu | null;
  vramMb: number;
  ramGb: number;
}

export interface ModelRecommendation {
  modelId: string;
  modelName: string;
  quantization: string;
  gpuLayers: number | "all";
  estimatedVramMb: number;
  tier: VramTier;
  description: string;
}

export type VramTier = "high" | "medium" | "low" | "cpu-only";
