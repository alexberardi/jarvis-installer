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
    modelId: "llama-3.1-8b-instruct",
    modelName: "Llama 3.1 8B Instruct",
    quantization: "q8_0",
    gpuLayers: "all",
    estimatedVramMb: 9500,
    description:
      "High quality quantization with all layers on GPU. Best response quality and speed.",
  },
  medium: {
    modelId: "llama-3.1-8b-instruct",
    modelName: "Llama 3.1 8B Instruct",
    quantization: "q4_k_m",
    gpuLayers: "all",
    estimatedVramMb: 5500,
    description:
      "Balanced quantization with all layers on GPU. Good quality with moderate VRAM usage.",
  },
  low: {
    modelId: "llama-3.1-8b-instruct",
    modelName: "Llama 3.1 8B Instruct",
    quantization: "q4_k_m",
    gpuLayers: 20,
    estimatedVramMb: 3500,
    description:
      "Balanced quantization with partial GPU offload. Some layers run on CPU.",
  },
  "cpu-only": {
    modelId: "llama-3.1-8b-instruct",
    modelName: "Llama 3.1 8B Instruct",
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
