import { describe, it, expect } from "vitest";
import { generateEnv } from "@/lib/env-generator";
import { parseRegistry } from "@/lib/service-registry";
import { makeState } from "../helpers/make-state";
import registryJson from "../../public/service-registry.json";

const registry = parseRegistry(registryJson);

describe("env-generator", () => {
  it("generates valid KEY=value format", () => {
    const env = generateEnv(makeState(), registry);
    const lines = env.split("\n").filter((l) => l && !l.startsWith("#"));
    for (const line of lines) {
      expect(line).toMatch(/^[A-Z_]+=.*/);
    }
  });

  it("includes section comments", () => {
    const env = generateEnv(makeState(), registry);
    expect(env).toContain("# --- Secrets ---");
    expect(env).toContain("# --- Database ---");
    expect(env).toContain("# --- Service Ports ---");
    expect(env).toContain("# --- Infrastructure Ports ---");
  });

  it("includes all secrets from state", () => {
    const env = generateEnv(makeState(), registry);
    expect(env).toContain("AUTH_SECRET_KEY=" + "a".repeat(64));
    expect(env).toContain("POSTGRES_PASSWORD=" + "e".repeat(32));
    expect(env).toContain("REDIS_PASSWORD=" + "f".repeat(32));
    expect(env).toContain("MODEL_SERVICE_TOKEN=" + "9".repeat(64));
  });

  it("includes DB_USER", () => {
    const env = generateEnv(makeState(), registry);
    expect(env).toContain("DB_USER=jarvis");
  });

  it("includes custom DB_USER", () => {
    const env = generateEnv(makeState({ dbUser: "admin" }), registry);
    expect(env).toContain("DB_USER=admin");
  });

  it("includes core service ports", () => {
    const env = generateEnv(makeState(), registry);
    expect(env).toContain("AUTH_PORT=7701");
    expect(env).toContain("COMMAND_CENTER_PORT=7703");
    expect(env).toContain("CONFIG_SERVICE_PORT=7700");
    expect(env).toContain("LOGS_PORT=7702");
  });

  it("includes port overrides", () => {
    const env = generateEnv(
      makeState({ portOverrides: { "jarvis-auth": 9007 } }),
      registry,
    );
    expect(env).toContain("AUTH_PORT=9007");
  });

  it("includes infrastructure ports", () => {
    const env = generateEnv(makeState(), registry);
    expect(env).toContain("POSTGRES_PORT=5432");
    expect(env).toContain("REDIS_PORT=6379");
  });

  it("includes optional service ports when enabled", () => {
    const env = generateEnv(
      makeState({ enabledModules: ["jarvis-whisper-api"] }),
      registry,
    );
    expect(env).toContain("WHISPER_API_PORT=7706");
  });

  describe("Jarvis Relay", () => {
    it("writes JARVIS_RELAY_URL with default URL when enabled and no custom value", () => {
      const env = generateEnv(
        makeState({ relayEnabled: true, relayUrl: "" }),
        registry,
      );
      expect(env).toContain("JARVIS_RELAY_URL=https://relay.jarvisautomation.io");
    });

    it("writes JARVIS_RELAY_URL with custom value when provided", () => {
      const env = generateEnv(
        makeState({ relayEnabled: true, relayUrl: "https://relay.example.com" }),
        registry,
      );
      expect(env).toContain("JARVIS_RELAY_URL=https://relay.example.com");
    });

    it("omits JARVIS_RELAY_URL entirely when relayEnabled is false", () => {
      const env = generateEnv(
        makeState({ relayEnabled: false, relayUrl: "https://relay.example.com" }),
        registry,
      );
      expect(env).not.toContain("JARVIS_RELAY_URL=");
    });

    it("emits empty JARVIS_RELAY_HOUSEHOLD_JWT placeholder when enabled and no value", () => {
      const env = generateEnv(
        makeState({ relayEnabled: true, relayUrl: "" }),
        registry,
      );
      expect(env).toMatch(/JARVIS_RELAY_HOUSEHOLD_JWT=\s*$/m);
    });

    it("emits JARVIS_RELAY_HOUSEHOLD_JWT with provided value", () => {
      const env = generateEnv(
        makeState({
          relayEnabled: true,
          relayUrl: "",
          relayHouseholdJwt: "eyJhbGciOiJIUzI1NiJ9.testtoken",
        }),
        registry,
      );
      expect(env).toContain("JARVIS_RELAY_HOUSEHOLD_JWT=eyJhbGciOiJIUzI1NiJ9.testtoken");
    });

    it("omits JARVIS_RELAY_HOUSEHOLD_JWT entirely when relayEnabled is false", () => {
      const env = generateEnv(
        makeState({
          relayEnabled: false,
          relayHouseholdJwt: "eyJhbGciOiJIUzI1NiJ9.testtoken",
        }),
        registry,
      );
      expect(env).not.toContain("JARVIS_RELAY_HOUSEHOLD_JWT");
    });
  });

  describe("Release Track", () => {
    it("includes JARVIS_IMAGE_TAG=latest for stable track", () => {
      const env = generateEnv(makeState({ releaseTrack: "stable" }), registry);
      expect(env).toContain("JARVIS_IMAGE_TAG=latest");
    });

    it("includes JARVIS_IMAGE_TAG=dev for dev track", () => {
      const env = generateEnv(makeState({ releaseTrack: "dev" }), registry);
      expect(env).toContain("JARVIS_IMAGE_TAG=dev");
    });

    it("includes release track section comment", () => {
      const env = generateEnv(makeState(), registry);
      expect(env).toContain("# --- Release Track ---");
    });
  });

  describe("GPU backends", () => {
    // The .env keys are the only durable record of the backend choices —
    // jarvis-admin's reconcile reconstructs state from .env, and without
    // them a later reconcile silently downgrades whisper/TTS to CPU
    // (prod incidents 2026-07-04 and 2026-07-06).
    it("persists whisper and tts backends", () => {
      const env = generateEnv(
        makeState({ whisperBackend: "cuda", ttsBackend: "cuda" }),
        registry,
      );
      expect(env).toContain("WHISPER_BACKEND=cuda");
      expect(env).toContain("TTS_BACKEND=cuda");
      expect(env).toContain("TTS_GPU_DEVICE=0");
    });

    it("defaults both to cpu with no GPU index line", () => {
      const env = generateEnv(makeState(), registry);
      expect(env).toContain("WHISPER_BACKEND=cpu");
      expect(env).toContain("TTS_BACKEND=cpu");
      expect(env).not.toContain("TTS_GPU_DEVICE");
    });
  });
});
