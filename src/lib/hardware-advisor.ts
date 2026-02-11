import type { HardwareProfile, ModelRecommendation, VramTier } from "@/types/hardware";
import { getModelConfig } from "@/data/model-recommendations";

export function getVramTier(vramMb: number): VramTier {
  if (vramMb >= 24576) return "high";
  if (vramMb >= 8192) return "medium";
  if (vramMb >= 4096) return "low";
  return "cpu-only";
}

export function getModelRecommendation(profile: HardwareProfile): ModelRecommendation {
  if (profile.mode === "cpu") {
    return getModelConfig("cpu-only");
  }

  const tier = getVramTier(profile.vramMb);
  return getModelConfig(tier);
}
