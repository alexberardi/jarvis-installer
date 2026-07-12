import { describe, it, expect } from "vitest";
import { generateComposeExport } from "@/lib/compose-export-generator";
import { parseRegistry } from "@/lib/service-registry";
import { makeState } from "../helpers/make-state";
import registryJson from "../../public/service-registry.json";

const registry = parseRegistry(registryJson);

// Expected inlined image ref for the export (no ${VAR}). Floating track tags
// are the default (2026-07-06); digest pinning is opt-in via pinImages.
function exportRef(base: string, suffix = "", track: "latest" | "dev" = "latest"): string {
  return `${base}:${track}${suffix}`;
}
const WHISPER = "ghcr.io/alexberardi/jarvis-whisper-api";

describe("compose-export-generator: data-plane infra host binding", () => {
  // Loki ships no authentication and stores voice transcripts. The export path
  // published it on 0.0.0.0:3100 even after postgres/redis were loopback-bound.
  it("binds loki to loopback by default (overridable via JARVIS_INFRA_BIND_HOST)", () => {
    const output = generateComposeExport(makeState(), registry);
    expect(output).toContain('"${JARVIS_INFRA_BIND_HOST:-127.0.0.1}:3100:3100"');
    expect(output).not.toContain('"3100:3100"');
  });
});

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

describe("compose-export-generator: whisper backend selection", () => {
  // Whisper's variant is chosen EXPLICITLY via whisperBackend (default cpu),
  // independent of the auto-detected LLM gpuType.
  function whisperState(whisperBackend: "cpu" | "cuda" | "vulkan" | "rocm") {
    return makeState({ whisperBackend, enabledModules: ["jarvis-whisper-api"] });
  }
  function whisperBlock(output: string): string {
    const start = output.search(/\n {2}jarvis-whisper-api:\n/);
    const block = output.slice(start + 1);
    const end = block.slice(1).search(/\n {2}[a-z][a-z0-9-]*:\n/);
    return end > 0 ? block.slice(0, end + 1) : block;
  }

  it("cpu (default): plain image, no GPU passthrough", () => {
    const w = whisperBlock(generateComposeExport(whisperState("cpu"), registry));
    expect(w).toContain("image: " + exportRef(WHISPER, ""));
    expect(w).not.toContain("-vulkan");
    expect(w).not.toContain("-cuda");
    expect(w).not.toContain("/dev/dri");
    expect(w).not.toContain("driver: nvidia");
  });

  it("vulkan: -vulkan image + /dev/dri + render group", () => {
    const w = whisperBlock(generateComposeExport(whisperState("vulkan"), registry));
    expect(w).toContain("image: " + exportRef(WHISPER, "-vulkan"));
    expect(w).toContain("/dev/dri:/dev/dri");
    expect(w).toContain("- render");
  });

  it("rocm: -rocm image + /dev/dri + /dev/kfd", () => {
    const w = whisperBlock(generateComposeExport(whisperState("rocm"), registry));
    expect(w).toContain("image: " + exportRef(WHISPER, "-rocm"));
    expect(w).toContain("/dev/dri:/dev/dri");
    expect(w).toContain("/dev/kfd:/dev/kfd");
  });

  it("cuda: -cuda image + nvidia deploy block", () => {
    const w = whisperBlock(generateComposeExport(whisperState("cuda"), registry));
    expect(w).toContain("image: " + exportRef(WHISPER, "-cuda"));
    expect(w).toContain("driver: nvidia");
  });

  it("is independent of the LLM gpuType (amd LLM + cpu whisper -> plain whisper)", () => {
    const w = whisperBlock(
      generateComposeExport(
        makeState({ gpuType: "amd", gpuEnabled: true, whisperBackend: "cpu", enabledModules: ["jarvis-whisper-api"] }),
        registry,
      ),
    );
    expect(w).toContain("image: " + exportRef(WHISPER, ""));
    expect(w).not.toContain("/dev/dri");
  });

  it("does NOT mount the models volume on whisper", () => {
    const w = whisperBlock(generateComposeExport(whisperState("cpu"), registry));
    expect(w).not.toContain("/models:/app/.models");
  });

  it("still mounts models volume on llm-proxy (modelVolume: true)", () => {
    const output = generateComposeExport(whisperState("cpu"), registry);
    expect(output).toContain("/models:/app/.models");
  });
});

describe("compose-export-generator: release track", () => {
  it("pins the stable (latest) track for first-party images", () => {
    const output = generateComposeExport(makeState({ releaseTrack: "stable" }), registry);
    expect(output).toContain(exportRef("ghcr.io/alexberardi/jarvis-auth", "", "latest"));
    expect(output).toContain(exportRef("ghcr.io/alexberardi/jarvis-command-center", "", "latest"));
  });

  it("pins the dev track for first-party images", () => {
    const output = generateComposeExport(makeState({ releaseTrack: "dev" }), registry);
    expect(output).toContain(exportRef("ghcr.io/alexberardi/jarvis-auth", "", "dev"));
    expect(output).toContain(exportRef("ghcr.io/alexberardi/jarvis-command-center", "", "dev"));
  });

  it("selects the dev-cuda variant for whisper when whisperBackend=cuda on the dev track", () => {
    const output = generateComposeExport(
      makeState({ releaseTrack: "dev", whisperBackend: "cuda", enabledModules: ["jarvis-whisper-api"] }),
      registry,
    );
    expect(output).toContain(exportRef(WHISPER, "-cuda", "dev"));
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

  it("uses python urllib for python service images, never curl (not installed)", () => {
    const output = generateComposeExport(
      makeState({
        enabledModules: ["jarvis-whisper-api", "jarvis-tts", "jarvis-notifications"],
      }),
      registry,
    );
    // curl is absent from several service images → it must never appear
    expect(output).not.toContain('"curl"');
    for (const id of ["jarvis-config-service", "jarvis-auth", "jarvis-notifications", "jarvis-tts"]) {
      expect(serviceBlock(output, id)).toContain(
        '"python", "-c", "import urllib.request',
      );
    }
  });
});

describe("compose-export-generator: command-center auth secret", () => {
  it("gives command-center JARVIS_AUTH_SECRET_KEY for local user-JWT validation", () => {
    const output = generateComposeExport(makeState(), registry);
    const start = output.indexOf("\n  jarvis-command-center:\n");
    const rest = output.slice(start + 1);
    const end = rest.search(/\n  [a-z][a-z0-9-]*:\n/);
    const ccBlock = end > 0 ? rest.slice(0, end) : rest;
    expect(ccBlock).toContain("JARVIS_AUTH_SECRET_KEY:");
    expect(ccBlock).toContain('JARVIS_AUTH_ALGORITHM: "HS256"');
    expect(ccBlock).toContain('JARVIS_MQTT_BROKER_URL: "mqtt://jarvis-mosquitto:1883"');
  });
});

describe("compose-export-generator: config-service seed external coords", () => {
  it("registers internal container coords AND external published coords", () => {
    const output = generateComposeExport(makeState({ enabledModules: ["jarvis-admin"] }), registry);
    // auth: internal jarvis-auth:8000 (container) + external localhost:7701 (published)
    expect(output).toContain('("jarvis-auth", "jarvis-auth", 8000, "http", "/health"');
    expect(output).toMatch(/\("jarvis-auth",.*"localhost", 7701\)/);
    // the seed must persist the external columns
    expect(output).toContain("external_host=ext_host, external_port=ext_port");
  });

  it("config seed still seeds + serves but no longer runs alembic itself (entrypoint owns it)", () => {
    const output = generateComposeExport(makeState({ enabledModules: ["jarvis-admin"] }), registry);
    const block = serviceBlock(output, "jarvis-config-service");
    // seeding + serving still present
    expect(block).toContain("Registered service:");
    expect(block).toContain("exec uvicorn app.main:app --host 0.0.0.0 --port 7700");
    // the leading migrate has been removed from the seed script — alembic now
    // appears only in the entrypoint wrapper (exactly once)
    expect(alembicCount(block)).toBe(1);
  });

  it("auth seed still seeds app clients + serves but no longer runs alembic itself", () => {
    const output = generateComposeExport(makeState({ enabledModules: ["jarvis-admin"] }), registry);
    const block = serviceBlock(output, "jarvis-auth");
    expect(block).toContain("Seeded app client:");
    expect(block).toContain("exec uvicorn jarvis_auth.app.main:app --host 0.0.0.0 --port 8000");
    expect(alembicCount(block)).toBe(1);
  });
});

describe("compose-export-generator: MQTT broker auth", () => {
  it("mosquitto builds a password_file from the shared credential at startup", () => {
    // The generator can't produce mosquitto's $7$ PBKDF2 hash, so the container
    // runs mosquitto_passwd at startup and points the broker at the result.
    const m = serviceBlock(generateComposeExport(makeState(), registry), "mosquitto");
    expect(m).toContain("mosquitto_passwd -b -c /tmp/pwfile");
    expect(m).toContain("password_file /tmp/pwfile");
  });

  it("mosquitto allow_anonymous is env-driven, defaulting FALSE (fresh installs lock the broker)", () => {
    // A fresh install has no un-migrated fleet: the CC reads MQTT_PASSWORD and
    // every node fetches broker creds over authenticated HTTP before connecting,
    // so the broker locks from the first boot (closes the anonymous-broker RCE
    // window). MQTT_ALLOW_ANON=true re-opens it only when adopting an old fleet.
    // $$ escapes Compose interpolation so the container shell expands the env var.
    const m = serviceBlock(generateComposeExport(makeState(), registry), "mosquitto");
    expect(m).toContain('MQTT_ALLOW_ANON: "${MQTT_ALLOW_ANON:-false}"');
    expect(m).toContain("allow_anonymous $$MQTT_ALLOW_ANON");
  });

  it("mosquitto + command-center share the SAME inlined MQTT password (else CC can't auth)", () => {
    const output = generateComposeExport(makeState(), registry);
    const m = serviceBlock(output, "mosquitto");
    const cc = serviceBlock(output, "jarvis-command-center");
    const pw = m.match(/MQTT_PASSWORD: "([^"]+)"/)?.[1];
    expect(pw).toBeTruthy();
    expect(pw).not.toBe("changeme");
    // Memoized resolveSecret guarantees both references resolve identically.
    expect(cc).toContain(`MQTT_PASSWORD: "${pw}"`);
    expect(m).toContain('MQTT_USERNAME: "jarvis"');
    expect(cc).toContain('MQTT_USERNAME: "jarvis"');
  });
});

// Grab a single service's YAML block, anchored on its "  <id>:" header. Shared
// helper so the migrate-entrypoint suite can isolate per-service blocks.
function serviceBlock(output: string, id: string): string {
  const start = output.indexOf(`\n  ${id}:\n`);
  if (start < 0) throw new Error(`service ${id} not found`);
  const rest = output.slice(start + 1);
  const end = rest.search(/\n  [a-z][a-z0-9-]*:\n/);
  return end > 0 ? rest.slice(0, end) : rest;
}

// `alembic upgrade head` must appear in a block EXACTLY ONCE — inside the
// migrate entrypoint wrapper — and never as a redundant leading line in a
// `command:`/seed script (the bug we're removing).
function alembicCount(block: string): number {
  return block.split("python -m alembic upgrade head").length - 1;
}

describe("compose-export-generator: migrate entrypoint wrapper", () => {
  // Every service the registry flags `migrate: true` must boot through the
  // entrypoint wrapper that runs `alembic upgrade head` then execs the image CMD.
  // jarvis-tts now ships alembic in its image and has DATABASE_URL wired, so it
  // joins the migrate set (its settings writes 500'd fleet-wide without it).
  // jarvis-logs stays deferred — its image doesn't ship alembic yet.
  const MIGRATE_SET = [
    "jarvis-config-service",
    "jarvis-auth",
    "jarvis-command-center",
    "jarvis-whisper-api",
    "jarvis-llm-proxy-api",
    "jarvis-notifications",
    "jarvis-tts",
  ];

  // Enable every migrate-set service so each block is present in the output.
  const fullState = () =>
    makeState({
      enabledModules: [
        "jarvis-logs",
        "jarvis-whisper-api",
        "jarvis-tts",
        "jarvis-llm-proxy-api",
        "jarvis-notifications",
      ],
    });

  it("registry flags exactly the expected migrate set", () => {
    const flagged = registry.services.filter((s) => s.migrate === true).map((s) => s.id);
    expect(new Set(flagged)).toEqual(new Set(MIGRATE_SET));
  });

  it.each(MIGRATE_SET)("emits the migrate entrypoint wrapper for %s", (id) => {
    const output = generateComposeExport(fullState(), registry);
    const block = serviceBlock(output, id);
    expect(block).toContain("    entrypoint:");
    expect(block).toContain("      - /bin/sh");
    expect(block).toContain("      - -c");
    expect(block).toContain('      - python -m alembic upgrade head && exec "$@"');
    expect(block).toContain("      - jarvis-migrate");
  });

  it("does NOT emit the migrate entrypoint for non-migrate services (web/admin/settings-server)", () => {
    const output = generateComposeExport(
      makeState({ enabledModules: ["jarvis-web", "jarvis-admin", "jarvis-settings-server"] }),
      registry,
    );
    for (const id of ["jarvis-web", "jarvis-admin", "jarvis-settings-server"]) {
      const block = serviceBlock(output, id);
      expect(block).not.toContain("entrypoint:");
      expect(block).not.toContain("alembic upgrade head");
    }
  });

  it("command-center keeps an explicit serve command (overriding entrypoint clears image CMD)", () => {
    const output = generateComposeExport(fullState(), registry);
    const block = serviceBlock(output, "jarvis-command-center");
    expect(block).toContain("entrypoint:");
    // alembic only in the entrypoint, not duplicated in the command
    expect(alembicCount(block)).toBe(1);
    // MUST re-emit the serve command — without it the migrate entrypoint
    // execs empty args and the service exits right after migrating.
    expect(block).toMatch(/\n {4}command:/);
    expect(block).toContain('"uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8002"');
  });

  it("whisper keeps an explicit serve command (overriding entrypoint clears image CMD)", () => {
    const output = generateComposeExport(fullState(), registry);
    const block = serviceBlock(output, "jarvis-whisper-api");
    expect(block).toContain("entrypoint:");
    expect(alembicCount(block)).toBe(1);
    expect(block).toMatch(/\n {4}command:/);
    expect(block).toContain('"uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7706"');
  });

  it("llm-proxy runs the supervised scripts/serve.sh launcher, not raw dual-uvicorn", () => {
    const output = generateComposeExport(fullState(), registry);
    const block = serviceBlock(output, "jarvis-llm-proxy-api");
    expect(block).toContain("entrypoint:");
    // The migrate entrypoint clears the image CMD, so an explicit command is
    // still required — and it MUST be the image's supervised launcher, which
    // respawns the model service with backoff when it dies.
    expect(block).toContain('    command: ["bash", "scripts/serve.sh"]');
    // The old unsupervised pattern is the 2026-07-02 outage signature: the
    // model service crashes, nothing respawns it, the API 503s forever.
    expect(block).not.toContain("uvicorn services.model_service:app");
    expect(block).not.toContain("exec python -m uvicorn main:app");
    // alembic appears only in the entrypoint, not duplicated in the command
    expect(alembicCount(block)).toBe(1);
  });
});

// Tight regression guard for the EXACT 2026-06 incident: config-service shipped
// migration 005 (services.external_host) but its compose never ran
// `alembic upgrade head` on startup, so `/services` 500'd fleet-wide. This block
// pins config-service's migrate wrapper byte-for-byte and proves the
// external-coords seed (which reads/writes external_host) can only run AFTER it.
describe("compose-export-generator: config-service migrate-before-seed regression guard", () => {
  it("jarvis-config-service emits the alembic-then-exec entrypoint wrapper verbatim", () => {
    const output = generateComposeExport(makeState({ enabledModules: ["jarvis-admin"] }), registry);
    const block = serviceBlock(output, "jarvis-config-service");
    // The wrapper, line for line — not a loose substring. If any line drifts
    // (or the whole entrypoint is dropped), config-service boots on a stale
    // schema again and /services 500s.
    expect(block).toContain(
      [
        "    entrypoint:",
        "      - /bin/sh",
        "      - -c",
        '      - python -m alembic upgrade head && exec "$@"',
        "      - jarvis-migrate",
      ].join("\n"),
    );
  });

  it("registry flags config-service to migrate but NOT the non-DB jarvis-web", () => {
    const byId = (id: string) => registry.services.find((s) => s.id === id);
    // config-service owns the schema that broke — it MUST be in the migrate set.
    expect(byId("jarvis-config-service")?.migrate).toBe(true);
    // jarvis-web has no database/alembic — flagging it would crash boot on a
    // missing alembic.ini. Guard against accidental over-flagging.
    expect(byId("jarvis-web")?.migrate).not.toBe(true);
  });

  it("runs alembic migrate BEFORE the external-coords seed (seed can't hit a stale schema)", () => {
    const output = generateComposeExport(makeState({ enabledModules: ["jarvis-admin"] }), registry);
    const block = serviceBlock(output, "jarvis-config-service");
    // The migrate entrypoint must appear strictly before the command/seed that
    // INSERTs external_host/external_port — otherwise seeding runs first and
    // explodes on the missing column (the original symptom).
    const entrypointIdx = block.indexOf("    entrypoint:");
    const seedIdx = block.indexOf("external_host=ext_host, external_port=ext_port");
    expect(entrypointIdx).toBeGreaterThan(-1);
    expect(seedIdx).toBeGreaterThan(-1);
    expect(entrypointIdx).toBeLessThan(seedIdx);
    // And the seed still serves config-service afterwards (so /services is live
    // on the migrated schema).
    expect(seedIdx).toBeLessThan(block.indexOf("exec uvicorn app.main:app --host 0.0.0.0 --port 7700"));
  });
});

describe("compose-export-generator: pinned project name", () => {
  it("pins the Compose project name (name: jarvis) above services:", () => {
    const output = generateComposeExport(makeState({}), registry);
    expect(output).toContain("name: jarvis");
    expect(output.indexOf("name: jarvis")).toBeGreaterThanOrEqual(0);
    expect(output.indexOf("name: jarvis")).toBeLessThan(output.indexOf("services:"));
  });
});

describe("compose-export-generator: migrate services keep a serve command", () => {
  it("re-emits uvicorn command for migrate services with no seed (overriding entrypoint clears image CMD)", () => {
    const output = generateComposeExport(
      makeState({ enabledModules: ["jarvis-whisper-api", "jarvis-notifications"] }),
      registry,
    );
    const block = (id: string) => {
      const s = output.indexOf(`\n  ${id}:\n`)
      const rest = output.slice(s + 1)
      const e = rest.search(/\n  [a-z][a-z0-9-]*:\n/)
      return e > 0 ? rest.slice(0, e) : rest
    };
    for (const [id, port] of [
      ["jarvis-command-center", "8002"],
      ["jarvis-whisper-api", "7706"],
      ["jarvis-notifications", "7712"],
    ] as const) {
      const b = block(id);
      // must run the migrate entrypoint AND keep an explicit serve command,
      // else it migrates then exits (empty exec "$@")
      expect(b).toContain('python -m alembic upgrade head && exec "$@"');
      expect(b).toContain(`"uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "${port}"`);
    }
  });
});

describe("compose-export-generator: migrate-entrypoint INVARIANT", () => {
  it("NO service may carry the migrate `exec \"$@\"` entrypoint without a non-empty command", () => {
    // Overriding `entrypoint` CLEARS the image's CMD. So any service that uses
    // the migrate wrapper MUST supply its own command, or it execs "" and exits
    // right after migrating (restart-loop, no server). This is a GENERIC class
    // invariant — unlike a per-service test, you can't accidentally encode the
    // bug as expected behavior. It would have caught the CC/whisper/notifications
    // migrate-exit regression before it shipped.
    const output = generateComposeExport(
      makeState({
        enabledModules: [
          "jarvis-whisper-api", "jarvis-tts", "jarvis-notifications",
          "jarvis-web", "jarvis-admin",
        ],
      }),
      registry,
    );
    const blockOf = (id: string): string => {
      const start = output.indexOf(`\n  ${id}:\n`);
      const rest = output.slice(start + 1);
      const end = rest.search(/\n {2}[a-z][a-z0-9-]*:\n/);
      return end > 0 ? rest.slice(0, end) : rest;
    };
    const headers = [...output.matchAll(/\n {2}([a-z][a-z0-9-]*):\n/g)].map((m) => m[1]!);
    const offenders = headers.filter((name) => {
      const b = blockOf(name);
      return b.includes('exec "$@"') && !/\n {4}command:/.test(b);
    });
    expect(
      offenders,
      `services with the migrate entrypoint but NO command (they exec "" and exit after migrating): ${offenders.join(", ")}`,
    ).toEqual([]);
  });
});

describe("compose-export-generator: llm-proxy MODEL_SERVICE_TOKEN + AMD flash-attn", () => {
  const tokenOf = (output: string, id: string): string => {
    const match = serviceBlock(output, id).match(/MODEL_SERVICE_TOKEN: "([^"]*)"/);
    if (!match) throw new Error(`MODEL_SERVICE_TOKEN not found in ${id} block`);
    return match[1]!;
  };

  it("inlines MODEL_SERVICE_TOKEN with an IDENTICAL value in the API and worker blocks", () => {
    const output = generateComposeExport(makeState(), registry);
    // Model service fails closed since llm-proxy 55d2431: unset token = 503 on
    // every inference call while /health stays green. The worker calls the model
    // service on 7705, so both containers MUST carry the same value.
    const apiToken = tokenOf(output, "jarvis-llm-proxy-api");
    const workerToken = tokenOf(output, "llm-proxy-worker");
    expect(apiToken).toBe("9".repeat(64));
    expect(workerToken).toBe(apiToken);
  });

  it("token is non-empty", () => {
    const output = generateComposeExport(makeState(), registry);
    expect(tokenOf(output, "jarvis-llm-proxy-api").length).toBeGreaterThan(0);
  });

  it.each(["amd", "amd-rocm"] as const)(
    "emits JARVIS_FLASH_ATTN=false on API + worker for %s GPUs",
    (gpuType) => {
      const output = generateComposeExport(makeState({ gpuType, gpuEnabled: true }), registry);
      expect(serviceBlock(output, "jarvis-llm-proxy-api")).toContain(
        'JARVIS_FLASH_ATTN: "false"',
      );
      expect(serviceBlock(output, "llm-proxy-worker")).toContain(
        'JARVIS_FLASH_ATTN: "false"',
      );
    },
  );

  it("does NOT emit JARVIS_FLASH_ATTN for nvidia (definition default true is correct)", () => {
    const output = generateComposeExport(
      makeState({ gpuType: "nvidia", gpuEnabled: true }),
      registry,
    );
    expect(output).not.toContain("JARVIS_FLASH_ATTN");
  });

  it("does NOT emit JARVIS_FLASH_ATTN for cpu-only installs", () => {
    const output = generateComposeExport(
      makeState({ gpuType: "none", gpuEnabled: false }),
      registry,
    );
    expect(output).not.toContain("JARVIS_FLASH_ATTN");
  });
});

describe("compose-export-generator: dockerized URL style + localhost broker", () => {
  it("emits JARVIS_CONFIG_URL_STYLE=dockerized for jarvis services", () => {
    const output = generateComposeExport(makeState({ enabledModules: ["jarvis-whisper-api", "jarvis-notifications"] }), registry);
    // every jarvis service block that talks to config-service gets the style
    expect(output).toContain('JARVIS_CONFIG_URL_STYLE: "dockerized"');
    const block = (id: string) => {
      const s = output.indexOf(`\n  ${id}:\n`);
      const rest = output.slice(s + 1);
      const e = rest.search(/\n {2}[a-z][a-z0-9-]*:\n/);
      return e > 0 ? rest.slice(0, e) : rest;
    };
    for (const id of ["jarvis-command-center", "jarvis-auth", "jarvis-config-service"]) {
      expect(block(id), `${id} missing dockerized style`).toContain('JARVIS_CONFIG_URL_STYLE: "dockerized"');
    }
  });

  it("seeds the MQTT broker as localhost (NOT host.docker.internal — remote nodes can't resolve that)", () => {
    const output = generateComposeExport(makeState({}), registry);
    // registered as localhost so it resolves per-consumer (dockerized→host.docker.internal, remote→server IP)
    expect(output).toContain('("jarvis-mqtt-broker", "localhost", 1884, "mqtt"');
    expect(output).not.toContain('"jarvis-mqtt-broker", "host.docker.internal"');
  });
});
