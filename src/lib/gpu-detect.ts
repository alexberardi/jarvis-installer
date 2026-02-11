import type { DetectedGpu } from "@/types/hardware";
import { GPU_VRAM_DATABASE } from "@/data/gpu-database";

/**
 * Parses a GPU name from a WebGL ANGLE renderer string.
 * Examples:
 *   "ANGLE (NVIDIA GeForce RTX 4090 Direct3D11 vs_5_0)" → "NVIDIA GeForce RTX 4090"
 *   "ANGLE (Apple, Apple M2 Pro, OpenGL 4.1)" → "Apple M2 Pro"
 *   "ANGLE (NVIDIA Corporation, NVIDIA GeForce RTX 3080, OpenGL 4.5)" → "NVIDIA GeForce RTX 3080"
 */
export function parseGpuName(renderer: string): string {
  if (!renderer) return "Unknown GPU";

  // Try comma-separated ANGLE format: "ANGLE (Vendor, GPU Name, API)"
  const commaMatch = renderer.match(/ANGLE\s*\(\s*[^,]+,\s*([^,]+),/);
  if (commaMatch?.[1]) {
    return commaMatch[1].trim();
  }

  // Try space-separated ANGLE format: "ANGLE (GPU Name Direct3D11 vs_5_0)"
  const spaceMatch = renderer.match(/ANGLE\s*\(\s*(.+?)(?:\s+Direct3D|\s+OpenGL|\s+Metal)/);
  if (spaceMatch?.[1]) {
    return spaceMatch[1].trim();
  }

  // Try bare ANGLE format
  const bareAngle = renderer.match(/ANGLE\s*\(\s*(.+?)\s*\)/);
  if (bareAngle?.[1]) {
    return bareAngle[1].trim();
  }

  return renderer;
}

/**
 * Estimates VRAM in MB from a parsed GPU name using the known GPU database.
 */
export function estimateVramFromName(gpuName: string): number | null {
  // Direct lookup
  if (gpuName in GPU_VRAM_DATABASE) {
    return GPU_VRAM_DATABASE[gpuName]!;
  }

  // Try fuzzy match (remove extra spaces, normalize)
  const normalized = gpuName.replace(/\s+/g, " ").trim();
  for (const [key, vram] of Object.entries(GPU_VRAM_DATABASE)) {
    if (key.toLowerCase() === normalized.toLowerCase()) {
      return vram;
    }
  }

  return null;
}

function detectVendor(gpuName: string): string {
  const lower = gpuName.toLowerCase();
  if (lower.includes("nvidia") || lower.includes("geforce")) return "NVIDIA";
  if (lower.includes("amd") || lower.includes("radeon")) return "AMD";
  if (lower.includes("apple") || lower.includes("m1") || lower.includes("m2") || lower.includes("m3") || lower.includes("m4")) return "Apple";
  if (lower.includes("intel")) return "Intel";
  return "Unknown";
}

/**
 * Attempts to detect the user's GPU using WebGPU or WebGL.
 * Returns null if no GPU info can be detected.
 */
export async function detectGpu(): Promise<DetectedGpu | null> {
  // Try WebGPU first
  if (typeof navigator !== "undefined" && "gpu" in navigator) {
    try {
      const adapter = await (navigator as { gpu: { requestAdapter(): Promise<{ info?: { device?: string; vendor?: string } } | null> } }).gpu.requestAdapter();
      if (adapter?.info) {
        const name = adapter.info.device || "Unknown GPU";
        const vendor = adapter.info.vendor || detectVendor(name);
        const vramMb = estimateVramFromName(name);
        return { name, vendor, vramMb, source: "webgpu" };
      }
    } catch {
      // Fall through to WebGL
    }
  }

  // Try WebGL fallback
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
    if (gl && "getExtension" in gl) {
      const ext = (gl as WebGLRenderingContext).getExtension("WEBGL_debug_renderer_info");
      if (ext) {
        const renderer = (gl as WebGLRenderingContext).getParameter(ext.UNMASKED_RENDERER_WEBGL) as string;
        const name = parseGpuName(renderer);
        const vendor = detectVendor(name);
        const vramMb = estimateVramFromName(name);
        return { name, vendor, vramMb, source: "webgl" };
      }
    }
  } catch {
    // No WebGL available
  }

  return null;
}
