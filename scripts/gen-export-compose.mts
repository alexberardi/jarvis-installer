/**
 * Headless generator for the self-contained compose-export docker-compose.yml.
 *
 * The install-e2e CI harness uses this to stand up and validate the EXACT
 * artifact the installer ships, so generation bugs (undefined volumes, missing
 * port maps, wrong healthcheck binaries, network wiring) are caught in CI
 * before they ever reach a user — instead of by hand on someone's machine.
 *
 * Usage:
 *   npx tsx scripts/gen-export-compose.mts [options]
 *
 * Options:
 *   --out PATH        where to write the compose file (default: docker-compose.yml)
 *   --storage DIR     host storage path for bind mounts (default: /var/lib/jarvis)
 *   --modules a,b,c   recommended modules to enable on top of core
 *                     (default: whisper, tts, notifications, web, admin — i.e. all)
 *   --gpu MODE        none | nvidia | amd | amd-rocm (default: none — CI has no GPU)
 *   --release TRACK   stable | dev (default: stable)
 *
 * Writes the compose to --out and a one-line summary to stderr so stdout can be
 * piped if ever needed.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { parseArgs } from "node:util";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { generateComposeExport } from "../src/lib/compose-export-generator";
import { parseRegistry } from "../src/lib/service-registry";
import type { GpuType, WizardState } from "../src/types/wizard";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const { values } = parseArgs({
  options: {
    out: { type: "string", default: "docker-compose.yml" },
    storage: { type: "string", default: "/var/lib/jarvis" },
    modules: {
      type: "string",
      default:
        "jarvis-whisper-api,jarvis-tts,jarvis-notifications,jarvis-web,jarvis-admin",
    },
    gpu: { type: "string", default: "none" },
    release: { type: "string", default: "stable" },
  },
});

const registry = parseRegistry(
  JSON.parse(
    readFileSync(resolve(repoRoot, "public/service-registry.json"), "utf-8"),
  ),
);

const state: WizardState = {
  currentStep: 0,
  totalSteps: 0,
  enabledModules: values
    .modules!.split(",")
    .map((m: string) => m.trim())
    .filter(Boolean),
  portOverrides: {},
  infraPortOverrides: {},
  // Deterministic non-secret placeholders — the CI override supplies real
  // runtime secrets where they matter. These only need to be well-formed.
  secrets: {
    AUTH_SECRET_KEY: "a".repeat(64),
    JARVIS_CONFIG_ADMIN_TOKEN: "b".repeat(64),
    JARVIS_AUTH_ADMIN_TOKEN: "c".repeat(64),
    ADMIN_API_KEY: "d".repeat(64),
    POSTGRES_PASSWORD: "e".repeat(32),
    REDIS_PASSWORD: "f".repeat(32),
  },
  dbUser: "jarvis",
  whisperModel: "base.en",
  // The behavior lane drives CC's real native-tool provider against a cloud model.
  llmInterface: "ChatGPTOpenAI",
  deploymentTarget: "compose-export",
  storagePath: values.storage!,
  gpuEnabled: values.gpu !== "none",
  gpuType: values.gpu as GpuType,
  relayEnabled: false,
  relayUrl: "https://relay.jarvisautomation.io",
  releaseTrack: values.release as "stable" | "dev",
};

const compose = generateComposeExport(state, registry, state.storagePath);
writeFileSync(values.out!, compose);
console.error(
  `[gen-export-compose] wrote ${values.out} — modules=[${state.enabledModules.join(", ")}] gpu=${values.gpu} release=${values.release}`,
);
