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

describe("compose-export-generator: release track", () => {
  it("uses :latest tag when releaseTrack is stable", () => {
    const output = generateComposeExport(makeState({ releaseTrack: "stable" }), registry);
    expect(output).toContain("ghcr.io/alexberardi/jarvis-auth:latest");
    expect(output).toContain("ghcr.io/alexberardi/jarvis-command-center:latest");
  });

  it("uses :dev tag when releaseTrack is dev", () => {
    const output = generateComposeExport(makeState({ releaseTrack: "dev" }), registry);
    expect(output).toContain("ghcr.io/alexberardi/jarvis-auth:dev");
    expect(output).toContain("ghcr.io/alexberardi/jarvis-command-center:dev");
  });

  it("uses :dev-cuda for GPU services on dev track with nvidia", () => {
    const output = generateComposeExport(
      makeState({ releaseTrack: "dev", gpuEnabled: true, gpuType: "nvidia", enabledModules: ["jarvis-whisper-api"] }),
      registry,
    );
    expect(output).toContain("ghcr.io/alexberardi/jarvis-whisper-api:dev-cuda");
  });

  it("does not apply release track to infrastructure images", () => {
    const output = generateComposeExport(makeState({ releaseTrack: "dev" }), registry);
    expect(output).toContain("pgvector/pgvector:pg16");
    expect(output).not.toMatch(/pgvector.*:dev/);
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

  it("emits RELAY_URL + RELAY_HOUSEHOLD_JWT on jarvis-notifications when enabled", () => {
    const output = generateComposeExport(
      makeState({
        relayEnabled: true,
        relayUrl: "https://relay.example.com",
        relayHouseholdJwt: "eyJhbGciOiJIUzI1NiJ9.testtoken",
        enabledModules: ["jarvis-notifications"],
      }),
      registry,
    );
    const notifIdx = output.indexOf("jarvis-notifications:");
    expect(notifIdx).toBeGreaterThan(-1);
    const nextSvcIdx = output.indexOf("\n  jarvis-", notifIdx + 1);
    const notifBlock = output.slice(notifIdx, nextSvcIdx === -1 ? undefined : nextSvcIdx);
    expect(notifBlock).toContain('RELAY_URL: "https://relay.example.com"');
    expect(notifBlock).toContain('RELAY_HOUSEHOLD_JWT: "eyJhbGciOiJIUzI1NiJ9.testtoken"');
  });

  it("omits RELAY_URL + RELAY_HOUSEHOLD_JWT on jarvis-notifications when disabled", () => {
    const output = generateComposeExport(
      makeState({
        relayEnabled: false,
        enabledModules: ["jarvis-notifications"],
      }),
      registry,
    );
    const notifIdx = output.indexOf("jarvis-notifications:");
    expect(notifIdx).toBeGreaterThan(-1);
    const nextSvcIdx = output.indexOf("\n  jarvis-", notifIdx + 1);
    const notifBlock = output.slice(notifIdx, nextSvcIdx === -1 ? undefined : nextSvcIdx);
    expect(notifBlock).not.toContain("RELAY_URL:");
    expect(notifBlock).not.toContain("RELAY_HOUSEHOLD_JWT:");
  });
});

describe("compose-export-generator: top-level named volumes", () => {
  it("declares whisper-voice-profiles at the top level when whisper is enabled", () => {
    const output = generateComposeExport(
      makeState({ enabledModules: ["jarvis-whisper-api"] }),
      registry,
    );
    // service references the named volume...
    expect(output).toContain("- whisper-voice-profiles:/app/voice_profiles");
    // ...so it MUST be declared in a top-level volumes: section, or compose is invalid
    const topLevelVolumesIdx = output.indexOf("\nvolumes:\n");
    expect(topLevelVolumesIdx).toBeGreaterThan(-1);
    const volumesBlock = output.slice(topLevelVolumesIdx);
    expect(volumesBlock).toContain("whisper-voice-profiles:");
  });

  it("declares command-center-prompt-providers at the top level when CC is enabled", () => {
    const output = generateComposeExport(
      makeState({ enabledModules: ["jarvis-command-center"] }),
      registry,
    );
    const topLevelVolumesIdx = output.indexOf("\nvolumes:\n");
    expect(topLevelVolumesIdx).toBeGreaterThan(-1);
    const volumesBlock = output.slice(topLevelVolumesIdx);
    expect(volumesBlock).toContain("command-center-prompt-providers:");
  });
});

describe("compose-export-generator: healthcheck probe per image", () => {
  // Grab a single service's YAML block, anchored on its "  <id>:" header (so we
  // don't accidentally match the id inside another service's env URL).
  const serviceBlock = (output: string, id: string): string => {
    const start = output.indexOf(`\n  ${id}:\n`);
    if (start < 0) throw new Error(`service ${id} not found`);
    const rest = output.slice(start + 1);
    const end = rest.search(/\n  [a-z][a-z0-9-]*:\n/);
    return end > 0 ? rest.slice(0, end) : rest;
  };

  it("uses a node http probe for admin and web (Node images lack curl)", () => {
    const output = generateComposeExport(
      makeState({ enabledModules: ["jarvis-admin", "jarvis-web"] }),
      registry,
    );
    // admin/web must NOT use curl — that marks the container unhealthy forever
    const adminBlock = serviceBlock(output, "jarvis-admin");
    expect(adminBlock).toContain('"node", "-e"');
    expect(adminBlock).not.toMatch(/test:.*"curl"/);
    expect(serviceBlock(output, "jarvis-web")).toContain('"node", "-e"');
  });

  it("keeps curl for python service images (e.g. auth)", () => {
    const output = generateComposeExport(makeState(), registry);
    expect(serviceBlock(output, "jarvis-auth")).toMatch(/test:.*"curl", "-f"/);
  });
});
