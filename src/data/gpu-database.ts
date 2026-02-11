/**
 * Known GPU models mapped to their VRAM in MB.
 * Used to estimate VRAM when WebGPU doesn't report it directly.
 */
export const GPU_VRAM_DATABASE: Record<string, number> = {
  // NVIDIA RTX 40 series
  "NVIDIA GeForce RTX 4090": 24576,
  "NVIDIA GeForce RTX 4080 SUPER": 16384,
  "NVIDIA GeForce RTX 4080": 16384,
  "NVIDIA GeForce RTX 4070 Ti SUPER": 16384,
  "NVIDIA GeForce RTX 4070 Ti": 12288,
  "NVIDIA GeForce RTX 4070 SUPER": 12288,
  "NVIDIA GeForce RTX 4070": 12288,
  "NVIDIA GeForce RTX 4060 Ti": 8192,
  "NVIDIA GeForce RTX 4060": 8192,

  // NVIDIA RTX 30 series
  "NVIDIA GeForce RTX 3090 Ti": 24576,
  "NVIDIA GeForce RTX 3090": 24576,
  "NVIDIA GeForce RTX 3080 Ti": 12288,
  "NVIDIA GeForce RTX 3080": 10240,
  "NVIDIA GeForce RTX 3070 Ti": 8192,
  "NVIDIA GeForce RTX 3070": 8192,
  "NVIDIA GeForce RTX 3060 Ti": 8192,
  "NVIDIA GeForce RTX 3060": 12288,

  // NVIDIA RTX 20 series
  "NVIDIA GeForce RTX 2080 Ti": 11264,
  "NVIDIA GeForce RTX 2080 SUPER": 8192,
  "NVIDIA GeForce RTX 2080": 8192,
  "NVIDIA GeForce RTX 2070 SUPER": 8192,
  "NVIDIA GeForce RTX 2070": 8192,
  "NVIDIA GeForce RTX 2060 SUPER": 8192,
  "NVIDIA GeForce RTX 2060": 6144,

  // NVIDIA GTX 16 series
  "NVIDIA GeForce GTX 1660 Ti": 6144,
  "NVIDIA GeForce GTX 1660 SUPER": 6144,
  "NVIDIA GeForce GTX 1660": 6144,
  "NVIDIA GeForce GTX 1650 SUPER": 4096,
  "NVIDIA GeForce GTX 1650": 4096,

  // Apple Silicon (unified memory estimates for GPU allocation)
  "Apple M4 Ultra": 32768,
  "Apple M4 Max": 32768,
  "Apple M4 Pro": 16384,
  "Apple M4": 16384,
  "Apple M3 Ultra": 32768,
  "Apple M3 Max": 32768,
  "Apple M3 Pro": 16384,
  "Apple M3": 8192,
  "Apple M2 Ultra": 32768,
  "Apple M2 Max": 32768,
  "Apple M2 Pro": 16384,
  "Apple M2": 8192,
  "Apple M1 Ultra": 32768,
  "Apple M1 Max": 32768,
  "Apple M1 Pro": 16384,
  "Apple M1": 8192,

  // AMD Radeon RX 7000 series
  "AMD Radeon RX 7900 XTX": 24576,
  "AMD Radeon RX 7900 XT": 20480,
  "AMD Radeon RX 7800 XT": 16384,
  "AMD Radeon RX 7700 XT": 12288,
  "AMD Radeon RX 7600 XT": 16384,
  "AMD Radeon RX 7600": 8192,
};
