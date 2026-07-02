import { describe, it, expect } from "vitest";
import { generateCompose } from "@/lib/compose-generator";
import { parseRegistry } from "@/lib/service-registry";
import { makeState } from "../helpers/make-state";
import registryJson from "../../public/service-registry.json";

const registry = parseRegistry(registryJson);

describe("compose-generator", () => {
  it("generates output starting with services:", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("services:");
    expect(output).not.toContain("version:");
  });

  it("always includes core services", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("jarvis-config-service:");
    expect(output).toContain("jarvis-auth:");
    expect(output).toContain("jarvis-command-center:");
    expect(output).toContain("jarvis-logs:");
  });

  it("includes recommended services when enabled", () => {
    const output = generateCompose(
      makeState({ enabledModules: ["jarvis-whisper-api", "jarvis-tts"] }),
      registry,
    );
    expect(output).toContain("jarvis-whisper-api:");
    expect(output).toContain("jarvis-tts:");
  });

  it("excludes recommended services when not enabled", () => {
    const output = generateCompose(makeState({ enabledModules: [] }), registry);
    expect(output).not.toContain("jarvis-whisper-api:");
    expect(output).not.toContain("jarvis-tts:");
  });

  it("includes postgres infrastructure", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("postgres:");
    expect(output).toContain("pgvector/pgvector:pg16");
  });

  it("uses ${VAR} substitution for ports", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("${AUTH_PORT:-7701}");
    expect(output).toContain("${COMMAND_CENTER_PORT:-7703}");
  });

  it("applies port overrides in default values", () => {
    const output = generateCompose(
      makeState({ portOverrides: { "jarvis-auth": 9007 } }),
      registry,
    );
    expect(output).toContain("${AUTH_PORT:-9007}");
  });

  it("includes health checks", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("healthcheck:");
    expect(output).toContain("/health");
  });

  it("includes depends_on with conditions", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("depends_on:");
    expect(output).toContain("condition: service_healthy");
    expect(output).toContain("condition: service_started");
  });

  it("includes loki when logs service is present", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("loki:");
  });

  it("includes redis with requirepass command", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("redis:");
    expect(output).toContain("requirepass");
  });

  describe("data-plane infra host binding", () => {
    it("binds postgres to loopback by default (overridable via JARVIS_INFRA_BIND_HOST)", () => {
      const output = generateCompose(makeState(), registry);
      expect(output).toContain('"${JARVIS_INFRA_BIND_HOST:-127.0.0.1}:${POSTGRES_PORT:-5432}:5432"');
    });

    it("binds redis to loopback by default", () => {
      const output = generateCompose(makeState(), registry);
      expect(output).toContain('"${JARVIS_INFRA_BIND_HOST:-127.0.0.1}:${REDIS_PORT:-6379}:6379"');
    });

    it("does not bind application services to loopback (they need external reach)", () => {
      const output = generateCompose(makeState(), registry);
      // command-center is the public API surface; its published port must not be
      // forced onto loopback.
      expect(output).toContain('"${COMMAND_CENTER_PORT:-7703}:7703"');
      expect(output).not.toContain("127.0.0.1:${COMMAND_CENTER_PORT");
    });

    it("does not force mosquitto/loki/grafana onto loopback (external clients)", () => {
      const output = generateCompose(makeState(), registry);
      // loki is present (logs service is core). It should bind on all interfaces.
      expect(output).not.toContain("127.0.0.1:${LOKI_PORT");
    });
  });

  it("includes postgres init-db.sh volume mount", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("init-db.sh:/docker-entrypoint-initdb.d/init-db.sh");
  });

  it("includes network definition", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("networks:");
    expect(output).toContain("jarvis:");
  });

  it("includes volumes definition", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("volumes:");
    expect(output).toContain("jarvis-postgres-data:");
  });

  it("uses JARVIS_IMAGE_TAG variable for first-party images", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("ghcr.io/alexberardi/jarvis-auth:${JARVIS_IMAGE_TAG:-latest}");
    expect(output).toContain("ghcr.io/alexberardi/jarvis-command-center:${JARVIS_IMAGE_TAG:-latest}");
  });

  it("does not use JARVIS_IMAGE_TAG for infrastructure images", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("pgvector/pgvector:pg16");
    expect(output).not.toMatch(/pgvector.*JARVIS_IMAGE_TAG/);
  });

  it("includes DATABASE_URL for services with databases", () => {
    const output = generateCompose(makeState(), registry);
    expect(output).toContain("DATABASE_URL:");
    expect(output).toContain("MIGRATIONS_DATABASE_URL:");
  });

  it("adds whisper model volume mount for non-default model", () => {
    const output = generateCompose(
      makeState({
        enabledModules: ["jarvis-whisper-api"],
        whisperModel: "large-v3",
      }),
      registry,
    );
    expect(output).toContain("./whisper-models:/whisper-models:ro");
    expect(output).toContain("WHISPER_MODEL: /whisper-models/ggml-large-v3.bin");
  });

  it("always mounts whisper-models volume even for default model", () => {
    const output = generateCompose(
      makeState({ enabledModules: ["jarvis-whisper-api"], whisperModel: "base.en" }),
      registry,
    );
    expect(output).toContain("./whisper-models:/whisper-models:ro");
    expect(output).not.toContain("WHISPER_MODEL:");
  });

  describe("command-center prompt-provider volume", () => {
    it("emits command-center-prompt-providers in the top-level volumes block", () => {
      const output = generateCompose(makeState(), registry);
      const topLevelVolumesIdx = output.indexOf("\nvolumes:\n");
      expect(topLevelVolumesIdx).toBeGreaterThan(-1);
      const volumesBlock = output.slice(topLevelVolumesIdx);
      expect(volumesBlock).toContain("command-center-prompt-providers:");
    });

    it("mounts command-center-prompt-providers under the jarvis-command-center service", () => {
      const output = generateCompose(makeState(), registry);
      expect(output).toContain(
        "      - command-center-prompt-providers:/app/core/prompt_providers_custom",
      );
    });

    it("scopes the prompt-providers mount to the jarvis-command-center service block", () => {
      const output = generateCompose(
        makeState({ enabledModules: ["jarvis-whisper-api"] }),
        registry,
      );
      const ccStart = output.indexOf("jarvis-command-center:");
      const rest = output.slice(ccStart + "jarvis-command-center:".length);
      const ccEnd = rest.search(/\n  [a-z][a-z0-9-]*:\n/);
      const ccBlock = ccEnd > 0 ? rest.slice(0, ccEnd) : rest;
      expect(ccBlock).toContain("volumes:");
      expect(ccBlock).toContain(
        "- command-center-prompt-providers:/app/core/prompt_providers_custom",
      );
      expect(ccBlock).not.toContain("whisper-voice-profiles");
    });

    it("emits whisper and command-center volume blocks independently when both services are enabled", () => {
      const output = generateCompose(
        makeState({ enabledModules: ["jarvis-whisper-api"] }),
        registry,
      );

      const whisperStart = output.indexOf("jarvis-whisper-api:");
      const whisperRest = output.slice(whisperStart + "jarvis-whisper-api:".length);
      const whisperEnd = whisperRest.search(/\n  [a-z][a-z0-9-]*:\n/);
      const whisperBlock = whisperEnd > 0 ? whisperRest.slice(0, whisperEnd) : whisperRest;
      expect(whisperBlock).toContain("./whisper-models:/whisper-models:ro");
      expect(whisperBlock).toContain("whisper-voice-profiles:/app/voice_profiles");
      expect(whisperBlock).not.toContain("command-center-prompt-providers");

      const ccStart = output.indexOf("jarvis-command-center:");
      const ccRest = output.slice(ccStart + "jarvis-command-center:".length);
      const ccEnd = ccRest.search(/\n  [a-z][a-z0-9-]*:\n/);
      const ccBlock = ccEnd > 0 ? ccRest.slice(0, ccEnd) : ccRest;
      expect(ccBlock).toContain(
        "command-center-prompt-providers:/app/core/prompt_providers_custom",
      );
      expect(ccBlock).not.toContain("whisper-voice-profiles");
      expect(ccBlock).not.toContain("whisper-models");

      const topLevelVolumesIdx = output.indexOf("\nvolumes:\n");
      const volumesBlock = output.slice(topLevelVolumesIdx);
      expect(volumesBlock).toContain("command-center-prompt-providers:");
      expect(volumesBlock).toContain("whisper-voice-profiles:");
    });

    it("excludes whisper-voice-profiles from the top-level volumes when whisper is disabled", () => {
      const output = generateCompose(makeState(), registry);
      const topLevelVolumesIdx = output.indexOf("\nvolumes:\n");
      const volumesBlock = output.slice(topLevelVolumesIdx);
      expect(volumesBlock).toContain("command-center-prompt-providers:");
      expect(volumesBlock).not.toContain("whisper-voice-profiles:");
    });

    it("emits the command-center prompt-providers mount independently of the llmInterface seed", () => {
      const output = generateCompose(makeState({ llmInterface: "" }), registry);
      expect(output).toContain(
        "- command-center-prompt-providers:/app/core/prompt_providers_custom",
      );
      expect(output).not.toContain("LLM_INTERFACE_SEED:");
    });
  });

  describe("GPU image variants", () => {
    it("appends -cuda to llm-proxy image when nvidia GPU is selected", () => {
      const output = generateCompose(
        makeState({ gpuType: "nvidia", gpuEnabled: true }),
        registry,
      );
      expect(output).toContain(
        "image: ghcr.io/alexberardi/jarvis-llm-proxy-api:${JARVIS_IMAGE_TAG:-latest}-cuda",
      );
    });

    it("appends -vulkan to llm-proxy image when amd Vulkan is selected", () => {
      const output = generateCompose(
        makeState({ gpuType: "amd", gpuEnabled: true }),
        registry,
      );
      expect(output).toContain(
        "image: ghcr.io/alexberardi/jarvis-llm-proxy-api:${JARVIS_IMAGE_TAG:-latest}-vulkan",
      );
    });

    it("appends -rocm to llm-proxy image when amd-rocm is selected", () => {
      const output = generateCompose(
        makeState({ gpuType: "amd-rocm", gpuEnabled: true }),
        registry,
      );
      expect(output).toContain(
        "image: ghcr.io/alexberardi/jarvis-llm-proxy-api:${JARVIS_IMAGE_TAG:-latest}-rocm",
      );
    });

    it("appends -cpu to llm-proxy image when no GPU is selected", () => {
      const output = generateCompose(
        makeState({ gpuType: "none", gpuEnabled: false }),
        registry,
      );
      expect(output).toContain(
        "image: ghcr.io/alexberardi/jarvis-llm-proxy-api:${JARVIS_IMAGE_TAG:-latest}-cpu",
      );
    });

    it("does not apply variant suffix to non-GPU services", () => {
      const output = generateCompose(
        makeState({ gpuType: "nvidia", gpuEnabled: true }),
        registry,
      );
      expect(output).toContain(
        "image: ghcr.io/alexberardi/jarvis-config-service:${JARVIS_IMAGE_TAG:-latest}",
      );
      expect(output).not.toContain(
        "image: ghcr.io/alexberardi/jarvis-config-service:${JARVIS_IMAGE_TAG:-latest}-cuda",
      );
    });

    it("appends -cuda to whisper image when nvidia GPU is selected", () => {
      const output = generateCompose(
        makeState({
          enabledModules: ["jarvis-whisper-api"],
          gpuType: "nvidia",
          gpuEnabled: true,
        }),
        registry,
      );
      expect(output).toContain(
        "image: ghcr.io/alexberardi/jarvis-whisper-api:${JARVIS_IMAGE_TAG:-latest}-cuda",
      );
    });

    it("falls back to plain whisper image for amd Vulkan (no -vulkan whisper build)", () => {
      const output = generateCompose(
        makeState({
          enabledModules: ["jarvis-whisper-api"],
          gpuType: "amd",
          gpuEnabled: true,
        }),
        registry,
      );
      expect(output).toContain(
        "image: ghcr.io/alexberardi/jarvis-whisper-api:${JARVIS_IMAGE_TAG:-latest}",
      );
      expect(output).not.toContain(
        "image: ghcr.io/alexberardi/jarvis-whisper-api:${JARVIS_IMAGE_TAG:-latest}-vulkan",
      );
    });

    it("appends -rocm to whisper image when amd-rocm is selected", () => {
      const output = generateCompose(
        makeState({
          enabledModules: ["jarvis-whisper-api"],
          gpuType: "amd-rocm",
          gpuEnabled: true,
        }),
        registry,
      );
      expect(output).toContain(
        "image: ghcr.io/alexberardi/jarvis-whisper-api:${JARVIS_IMAGE_TAG:-latest}-rocm",
      );
    });

    it("worker image inherits parent's GPU variant suffix", () => {
      const output = generateCompose(
        makeState({ gpuType: "amd", gpuEnabled: true }),
        registry,
      );
      const workerStart = output.indexOf("llm-proxy-worker:");
      const rest = output.slice(workerStart);
      expect(rest).toContain(
        "image: ghcr.io/alexberardi/jarvis-llm-proxy-api:${JARVIS_IMAGE_TAG:-latest}-vulkan",
      );
    });

    it("emits nvidia deploy.resources block for nvidia GPU on llm-proxy", () => {
      const output = generateCompose(
        makeState({ gpuType: "nvidia", gpuEnabled: true }),
        registry,
      );
      const llmStart = output.indexOf("jarvis-llm-proxy-api:");
      const rest = output.slice(llmStart);
      const next = rest.search(/\n  [a-z][a-z0-9-]*:\n/);
      const block = next > 0 ? rest.slice(0, next) : rest;
      expect(block).toContain("deploy:");
      expect(block).toContain("driver: nvidia");
      expect(block).toContain("capabilities: [gpu]");
      expect(block).toContain('shm_size: "8gb"');
    });

    it("emits AMD device passthrough for amd Vulkan on llm-proxy", () => {
      const output = generateCompose(
        makeState({ gpuType: "amd", gpuEnabled: true }),
        registry,
      );
      const llmStart = output.indexOf("jarvis-llm-proxy-api:");
      const rest = output.slice(llmStart);
      const next = rest.search(/\n  [a-z][a-z0-9-]*:\n/);
      const block = next > 0 ? rest.slice(0, next) : rest;
      expect(block).toContain("- /dev/dri:/dev/dri");
      expect(block).toContain("- /dev/kfd:/dev/kfd");
      expect(block).toContain("group_add:");
      expect(block).toContain("- video");
      expect(block).toContain("- render");
    });

    it("emits no GPU runtime config when gpuEnabled is false", () => {
      const output = generateCompose(
        makeState({ gpuType: "none", gpuEnabled: false }),
        registry,
      );
      expect(output).not.toContain("driver: nvidia");
      expect(output).not.toContain("- /dev/dri:/dev/dri");
    });
  });

  describe("llm-proxy MODEL_SERVICE_TOKEN + AMD flash-attn", () => {
    // Grab a single service's YAML block, anchored on its "  <id>:" header.
    const serviceBlock = (output: string, id: string): string => {
      const start = output.indexOf(`\n  ${id}:\n`);
      if (start < 0) throw new Error(`service ${id} not found`);
      const rest = output.slice(start + 1);
      const end = rest.search(/\n  [a-z][a-z0-9-]*:\n/);
      return end > 0 ? rest.slice(0, end) : rest;
    };

    it("emits MODEL_SERVICE_TOKEN (same .env var) in BOTH the API and worker blocks", () => {
      const output = generateCompose(makeState(), registry);
      // The worker authenticates to the model service (7705) with this token;
      // the model service fails closed (503 on all inference) when it's unset,
      // so BOTH containers must resolve the SAME value.
      expect(serviceBlock(output, "jarvis-llm-proxy-api")).toContain(
        "MODEL_SERVICE_TOKEN: ${MODEL_SERVICE_TOKEN}",
      );
      expect(serviceBlock(output, "llm-proxy-worker")).toContain(
        "MODEL_SERVICE_TOKEN: ${MODEL_SERVICE_TOKEN}",
      );
    });

    it("does not leak MODEL_SERVICE_TOKEN into other service blocks", () => {
      const output = generateCompose(makeState(), registry);
      expect(serviceBlock(output, "jarvis-command-center")).not.toContain(
        "MODEL_SERVICE_TOKEN",
      );
    });

    it.each(["amd", "amd-rocm"] as const)(
      "emits JARVIS_FLASH_ATTN=false on API + worker for %s GPUs",
      (gpuType) => {
        const output = generateCompose(makeState({ gpuType, gpuEnabled: true }), registry);
        expect(serviceBlock(output, "jarvis-llm-proxy-api")).toContain(
          'JARVIS_FLASH_ATTN: "false"',
        );
        expect(serviceBlock(output, "llm-proxy-worker")).toContain(
          'JARVIS_FLASH_ATTN: "false"',
        );
      },
    );

    it("does NOT emit JARVIS_FLASH_ATTN for nvidia (definition default true is correct)", () => {
      const output = generateCompose(makeState({ gpuType: "nvidia", gpuEnabled: true }), registry);
      expect(output).not.toContain("JARVIS_FLASH_ATTN");
    });

    it("does NOT emit JARVIS_FLASH_ATTN for cpu-only installs", () => {
      const output = generateCompose(makeState({ gpuType: "none", gpuEnabled: false }), registry);
      expect(output).not.toContain("JARVIS_FLASH_ATTN");
    });
  });

  describe("worker emission", () => {
    it("emits llm-proxy-worker as a sibling service", () => {
      const output = generateCompose(makeState(), registry);
      expect(output).toContain("llm-proxy-worker:");
      expect(output).toContain("container_name: llm-proxy-worker");
    });

    it("worker uses parent command and env override", () => {
      const output = generateCompose(makeState(), registry);
      expect(output).toContain("command: python scripts/queue_worker.py");
      expect(output).toContain("LLM_PROXY_PROCESS_ROLE: worker");
      expect(output).toContain("MODEL_SERVICE_URL: http://jarvis-llm-proxy-api:7705");
    });

    it("worker depends_on parent service healthy", () => {
      const output = generateCompose(makeState(), registry);
      const workerBlock = output.slice(output.indexOf("llm-proxy-worker:"));
      expect(workerBlock).toMatch(/depends_on:[\s\S]*jarvis-llm-proxy-api:\s*\n\s*condition: service_healthy/);
    });

    it("worker has no ports and no healthcheck", () => {
      const output = generateCompose(makeState(), registry);
      const workerStart = output.indexOf("llm-proxy-worker:");
      const rest = output.slice(workerStart + "llm-proxy-worker:".length);
      const workerEnd = rest.search(/\n  [a-z][a-z0-9-]*:\n/);
      const workerOnly = workerEnd > 0 ? rest.slice(0, workerEnd) : rest;
      expect(workerOnly).not.toContain("ports:");
      expect(workerOnly).not.toContain("healthcheck:");
    });
  });
});
