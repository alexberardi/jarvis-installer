import { describe, it, expect, vi, beforeEach } from "vitest";
import { detectGpu, parseGpuName, estimateVramFromName } from "@/lib/gpu-detect";

describe("gpu-detect", () => {
  beforeEach(() => {
    // Reset navigator.gpu and WebGL mocks
    vi.restoreAllMocks();
  });

  describe("parseGpuName", () => {
    it("extracts GPU name from ANGLE renderer string", () => {
      expect(
        parseGpuName("ANGLE (NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0)"),
      ).toBe("NVIDIA GeForce RTX 4090");
    });

    it("extracts GPU name from ANGLE string with comma format", () => {
      expect(
        parseGpuName("ANGLE (Apple, Apple M2 Pro, OpenGL 4.1)"),
      ).toBe("Apple M2 Pro");
    });

    it("handles ANGLE string with parenthetical vendor", () => {
      expect(
        parseGpuName("ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 3080, OpenGL 4.5)"),
      ).toBe("NVIDIA GeForce RTX 3080");
    });

    it("returns the input if not an ANGLE string", () => {
      expect(parseGpuName("Mali-G78")).toBe("Mali-G78");
    });

    it("returns 'Unknown GPU' for empty string", () => {
      expect(parseGpuName("")).toBe("Unknown GPU");
    });
  });

  describe("estimateVramFromName", () => {
    it("returns 24576 for RTX 4090", () => {
      expect(estimateVramFromName("NVIDIA GeForce RTX 4090")).toBe(24576);
    });

    it("returns 12288 for RTX 4070 Ti", () => {
      expect(estimateVramFromName("NVIDIA GeForce RTX 4070 Ti")).toBe(12288);
    });

    it("returns 8192 for RTX 4060", () => {
      expect(estimateVramFromName("NVIDIA GeForce RTX 4060")).toBe(8192);
    });

    it("returns 10240 for RTX 3080", () => {
      expect(estimateVramFromName("NVIDIA GeForce RTX 3080")).toBe(10240);
    });

    it("returns null for unrecognized GPU", () => {
      expect(estimateVramFromName("Some Unknown Card")).toBeNull();
    });

    it("estimates shared memory for Apple Silicon", () => {
      // Apple M2 Pro has unified memory, we estimate based on chip
      expect(estimateVramFromName("Apple M2 Pro")).toBe(16384);
    });
  });

  describe("detectGpu", () => {
    it("returns null when no GPU APIs are available", async () => {
      // jsdom has no navigator.gpu or WebGL
      const result = await detectGpu();
      expect(result).toBeNull();
    });

    it("uses WebGL fallback when WebGPU is not available", async () => {
      // Mock canvas.getContext to return a WebGL context
      const mockGetContext = vi.fn().mockReturnValue({
        getExtension: vi.fn().mockReturnValue({
          UNMASKED_RENDERER_WEBGL: 0x9246,
        }),
        getParameter: vi.fn().mockReturnValue("ANGLE (NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0)"),
      });
      vi.spyOn(document, "createElement").mockReturnValue({
        getContext: mockGetContext,
      } as unknown as HTMLCanvasElement);

      const result = await detectGpu();
      expect(result).not.toBeNull();
      expect(result!.name).toBe("NVIDIA GeForce RTX 4090");
      expect(result!.source).toBe("webgl");
      expect(result!.vramMb).toBe(24576);
    });

    it("returns vendor from renderer string", async () => {
      const mockGetContext = vi.fn().mockReturnValue({
        getExtension: vi.fn().mockReturnValue({
          UNMASKED_RENDERER_WEBGL: 0x9246,
        }),
        getParameter: vi.fn().mockReturnValue("ANGLE (Apple, Apple M2 Pro, OpenGL 4.1)"),
      });
      vi.spyOn(document, "createElement").mockReturnValue({
        getContext: mockGetContext,
      } as unknown as HTMLCanvasElement);

      const result = await detectGpu();
      expect(result).not.toBeNull();
      expect(result!.name).toBe("Apple M2 Pro");
      expect(result!.vendor).toBe("Apple");
    });
  });
});
