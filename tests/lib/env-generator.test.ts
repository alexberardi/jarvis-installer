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
  });
});
