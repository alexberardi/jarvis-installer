import { describe, it, expect } from "vitest";
import { generateComposeExport } from "@/lib/compose-export-generator";
import { parseRegistry } from "@/lib/service-registry";
import { makeState } from "../helpers/make-state";
import registryJson from "../../public/service-registry.json";

const registry = parseRegistry(registryJson);

describe("compose-export-generator: worker emission", () => {
  function nvidiaState() {
    return makeState({
      gpuEnabled: true,
      gpuType: "nvidia",
    });
  }

  it("emits llm-proxy-worker as a sibling service", () => {
    const output = generateComposeExport(nvidiaState(), registry);
    expect(output).toContain("llm-proxy-worker:");
    expect(output).toContain("container_name: llm-proxy-worker");
  });

  it("worker uses parent command and env override", () => {
    const output = generateComposeExport(nvidiaState(), registry);
    expect(output).toContain("command: python scripts/queue_worker.py");
    expect(output).toContain('LLM_PROXY_PROCESS_ROLE: "worker"');
    expect(output).toContain('MODEL_SERVICE_URL: "http://jarvis-llm-proxy-api:7705"');
  });

  it("worker depends_on parent service healthy", () => {
    const output = generateComposeExport(nvidiaState(), registry);
    const workerBlock = output.slice(output.indexOf("llm-proxy-worker:"));
    expect(workerBlock).toMatch(
      /depends_on:[\s\S]*jarvis-llm-proxy-api:\s*\n\s*condition: service_healthy/,
    );
  });

  it("worker inherits parent NVIDIA GPU deploy block", () => {
    const output = generateComposeExport(nvidiaState(), registry);
    const workerStart = output.indexOf("llm-proxy-worker:");
    const rest = output.slice(workerStart + "llm-proxy-worker:".length);
    const workerEnd = rest.search(/\n  [a-z][a-z0-9-]*:\n/);
    const workerOnly = workerEnd > 0 ? rest.slice(0, workerEnd) : rest;
    expect(workerOnly).toContain("driver: nvidia");
    expect(workerOnly).toContain("capabilities: [gpu]");
    expect(workerOnly).toContain("ipc: host");
  });

  it("worker has no ports and no healthcheck", () => {
    const output = generateComposeExport(nvidiaState(), registry);
    const workerStart = output.indexOf("llm-proxy-worker:");
    const rest = output.slice(workerStart + "llm-proxy-worker:".length);
    const workerEnd = rest.search(/\n  [a-z][a-z0-9-]*:\n/);
    const workerOnly = workerEnd > 0 ? rest.slice(0, workerEnd) : rest;
    expect(workerOnly).not.toContain("ports:");
    expect(workerOnly).not.toContain("healthcheck:");
  });

  it("worker shares parent app credentials", () => {
    const output = generateComposeExport(nvidiaState(), registry);
    const workerStart = output.indexOf("llm-proxy-worker:");
    const rest = output.slice(workerStart + "llm-proxy-worker:".length);
    const workerEnd = rest.search(/\n  [a-z][a-z0-9-]*:\n/);
    const workerOnly = workerEnd > 0 ? rest.slice(0, workerEnd) : rest;
    expect(workerOnly).toContain('JARVIS_APP_ID: "jarvis-llm-proxy-api"');
    expect(workerOnly).toContain("JARVIS_APP_KEY:");
  });
});

describe("compose-export-generator: cpuFallback (whisper)", () => {
  function whisperState(gpuType: "nvidia" | "amd" | "amd-rocm" | "none", gpuEnabled = true) {
    return makeState({ gpuEnabled, gpuType, enabledModules: ["jarvis-whisper-api"] });
  }

  it("uses -cuda variant on NVIDIA hosts", () => {
    const output = generateComposeExport(whisperState("nvidia"), registry);
    expect(output).toContain("image: ghcr.io/alexberardi/jarvis-whisper-api:latest-cuda");
  });

  it("uses -rocm variant on AMD ROCm hosts", () => {
    const output = generateComposeExport(whisperState("amd-rocm"), registry);
    expect(output).toContain("image: ghcr.io/alexberardi/jarvis-whisper-api:latest-rocm");
  });

  it("falls back to plain CPU image on AMD Vulkan hosts (no -vulkan tag published)", () => {
    const output = generateComposeExport(whisperState("amd"), registry);
    const blockStart = output.search(/\n {2}jarvis-whisper-api:\n/);
    const block = output.slice(blockStart + 1);
    const blockEnd = block.slice(1).search(/\n {2}[a-z][a-z0-9-]*:\n/);
    const whisperOnly = blockEnd > 0 ? block.slice(0, blockEnd + 1) : block;
    expect(whisperOnly).toContain("image: ghcr.io/alexberardi/jarvis-whisper-api:latest");
    expect(whisperOnly).not.toContain("image: ghcr.io/alexberardi/jarvis-whisper-api:latest-vulkan");
    expect(whisperOnly).not.toContain("driver: nvidia");
  });

  it("does NOT mount the models volume on whisper", () => {
    const output = generateComposeExport(whisperState("nvidia"), registry);
    const blockStart = output.search(/\n {2}jarvis-whisper-api:\n/);
    const block = output.slice(blockStart + 1);
    const blockEnd = block.slice(1).search(/\n {2}[a-z][a-z0-9-]*:\n/);
    const whisperOnly = blockEnd > 0 ? block.slice(0, blockEnd + 1) : block;
    expect(whisperOnly).not.toContain("/models:/app/.models");
  });

  it("still mounts models volume on llm-proxy (modelVolume: true)", () => {
    const output = generateComposeExport(whisperState("nvidia"), registry);
    expect(output).toContain("/models:/app/.models");
  });
});

describe("compose-export-generator: Jarvis Relay", () => {
  it("emits JARVIS_RELAY_URL with default URL on command-center when enabled and no custom value", () => {
    const output = generateComposeExport(
      makeState({ relayEnabled: true, relayUrl: "" }),
      registry,
    );
    expect(output).toContain('JARVIS_RELAY_URL: "https://relay.jarvisautomation.io"');
  });

  it("emits JARVIS_RELAY_URL with custom value when provided", () => {
    const output = generateComposeExport(
      makeState({ relayEnabled: true, relayUrl: "https://relay.example.com" }),
      registry,
    );
    expect(output).toContain('JARVIS_RELAY_URL: "https://relay.example.com"');
  });

  it("omits JARVIS_RELAY_URL on command-center when disabled", () => {
    const output = generateComposeExport(
      makeState({ relayEnabled: false, relayUrl: "https://relay.example.com" }),
      registry,
    );
    expect(output).not.toContain("JARVIS_RELAY_URL:");
  });
});
