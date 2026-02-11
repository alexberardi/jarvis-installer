import { describe, it, expect } from "vitest";
import { getModelRecommendation, getVramTier } from "@/lib/hardware-advisor";
import type { HardwareProfile } from "@/types/hardware";

describe("hardware-advisor", () => {
  describe("getVramTier", () => {
    it("returns 'high' for 24GB+ VRAM", () => {
      expect(getVramTier(24576)).toBe("high");
    });

    it("returns 'medium' for 8-12GB VRAM", () => {
      expect(getVramTier(8192)).toBe("medium");
      expect(getVramTier(12288)).toBe("medium");
    });

    it("returns 'low' for 4-8GB VRAM", () => {
      expect(getVramTier(4096)).toBe("low");
      expect(getVramTier(6144)).toBe("low");
    });

    it("returns 'cpu-only' for <4GB VRAM", () => {
      expect(getVramTier(2048)).toBe("cpu-only");
      expect(getVramTier(0)).toBe("cpu-only");
    });
  });

  describe("getModelRecommendation", () => {
    it("recommends q8_0 quantization for 24GB+ GPU", () => {
      const profile: HardwareProfile = {
        mode: "gpu",
        gpu: { name: "RTX 4090", vendor: "NVIDIA", vramMb: 24576, source: "manual" },
        vramMb: 24576,
        ramGb: 32,
      };
      const rec = getModelRecommendation(profile);
      expect(rec.quantization).toBe("q8_0");
      expect(rec.gpuLayers).toBe("all");
      expect(rec.tier).toBe("high");
    });

    it("recommends q4_k_m quantization for 8-12GB GPU", () => {
      const profile: HardwareProfile = {
        mode: "gpu",
        gpu: { name: "RTX 4060", vendor: "NVIDIA", vramMb: 8192, source: "manual" },
        vramMb: 8192,
        ramGb: 16,
      };
      const rec = getModelRecommendation(profile);
      expect(rec.quantization).toBe("q4_k_m");
      expect(rec.tier).toBe("medium");
      expect(rec.gpuLayers).toBe("all");
    });

    it("recommends q4_k_m with partial GPU layers for 4-8GB", () => {
      const profile: HardwareProfile = {
        mode: "gpu",
        gpu: { name: "GTX 1650", vendor: "NVIDIA", vramMb: 4096, source: "manual" },
        vramMb: 4096,
        ramGb: 16,
      };
      const rec = getModelRecommendation(profile);
      expect(rec.quantization).toBe("q4_k_m");
      expect(rec.tier).toBe("low");
      expect(typeof rec.gpuLayers).toBe("number");
      expect(rec.gpuLayers as number).toBeLessThan(33);
    });

    it("recommends CPU-only for very low VRAM", () => {
      const profile: HardwareProfile = {
        mode: "gpu",
        gpu: { name: "Intel HD", vendor: "Intel", vramMb: 2048, source: "manual" },
        vramMb: 2048,
        ramGb: 16,
      };
      const rec = getModelRecommendation(profile);
      expect(rec.tier).toBe("cpu-only");
      expect(rec.gpuLayers).toBe(0);
    });

    it("recommends CPU-only when mode is cpu", () => {
      const profile: HardwareProfile = {
        mode: "cpu",
        gpu: null,
        vramMb: 0,
        ramGb: 16,
      };
      const rec = getModelRecommendation(profile);
      expect(rec.gpuLayers).toBe(0);
      expect(rec.tier).toBe("cpu-only");
      expect(rec.quantization).toBe("q4_k_m");
    });

    it("always returns a valid model ID", () => {
      const profiles: HardwareProfile[] = [
        { mode: "gpu", gpu: null, vramMb: 24576, ramGb: 64 },
        { mode: "gpu", gpu: null, vramMb: 8192, ramGb: 16 },
        { mode: "gpu", gpu: null, vramMb: 4096, ramGb: 8 },
        { mode: "cpu", gpu: null, vramMb: 0, ramGb: 8 },
      ];
      for (const profile of profiles) {
        const rec = getModelRecommendation(profile);
        expect(rec.modelId).toBeTruthy();
        expect(rec.modelName).toBeTruthy();
        expect(rec.description).toBeTruthy();
      }
    });
  });
});
