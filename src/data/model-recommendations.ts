import type { VramTier, ModelRecommendation } from "@/types/hardware";

export interface ModelTierConfig {
  modelId: string;
  modelName: string;
  quantization: string;
  gpuLayers: number | "all";
  estimatedVramMb: number;
  description: string;
}

export const MODEL_TIERS: Record<VramTier, ModelTierConfig> = {
  high: {
    modelId: "mistral-7b-instruct-v0.3",
    modelName: "Mistral 7B Instruct v0.3",
    quantization: "q8_0",
    gpuLayers: "all",
    estimatedVramMb: 8500,
    description:
      "High quality quantization with all layers on GPU. Best response quality and speed.",
  },
  medium: {
    modelId: "mistral-7b-instruct-v0.3",
    modelName: "Mistral 7B Instruct v0.3",
    quantization: "q4_k_m",
    gpuLayers: "all",
    estimatedVramMb: 5000,
    description:
      "Balanced quantization with all layers on GPU. Good quality with moderate VRAM usage.",
  },
  low: {
    modelId: "mistral-7b-instruct-v0.3",
    modelName: "Mistral 7B Instruct v0.3",
    quantization: "q4_k_m",
    gpuLayers: 20,
    estimatedVramMb: 3200,
    description:
      "Balanced quantization with partial GPU offload. Some layers run on CPU.",
  },
  "cpu-only": {
    modelId: "mistral-7b-instruct-v0.3",
    modelName: "Mistral 7B Instruct v0.3",
    quantization: "q4_k_m",
    gpuLayers: 0,
    estimatedVramMb: 0,
    description:
      "CPU-only inference. Slower but works without a dedicated GPU.",
  },
};

export function getModelConfig(tier: VramTier): ModelRecommendation {
  const config = MODEL_TIERS[tier];
  return {
    ...config,
    tier,
  };
}
